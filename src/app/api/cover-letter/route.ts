import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 토큰 제한 계산 함수 (대략적 계산)
function estimateTokens(text: string): number {
  // 한국어는 대략 1글자 = 1토큰, 영어는 1단어 = 1.3토큰으로 계산
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - koreanChars - englishWords;
  
  return koreanChars + Math.ceil(englishWords * 1.3) + otherChars;
}

// 컨텍스트 엔지니어링: 시스템 프롬프트 (AI의 역할과 규칙 정의)
function buildSystemPrompt(): string {
  return `
당신은 채용 자기소개서를 작성하는 전문 AI입니다. 다음의 **매우 중요한 조건**을 반드시 지켜야 합니다:

1. 각 답변은 **질문별로 지정된 글자 수 제한에 따라** 작성해야 합니다.
2. **글자 수 범위는 (제한 글자 수 - 100)자 이상, 제한 글자 수 이하**로 설정됩니다.
3. **최소 글자 수 미만은 무조건 무효**이며, GPT가 생성할 수 없습니다.
4. 각 답변에는 **경험, 과정, 수치, 실무성과**를 포함하고, 일반적인 문구 반복을 피하세요.
5. 각 문항은 아래 형식과 지침을 반드시 따르세요.
6. **입력된 정보가 부족한 경우, 해당 분야의 일반적인 경험과 성과를 적절히 상상하여 구체적으로 확장하세요.**

예시:
[질문 1] 지원 동기를 작성해주세요. (500자)
✍️ [답변 시작]
저는 대학에서 화학을 전공하며 실험 설계 및 데이터 분석 역량을 쌓았습니다. 특히 졸업 논문으로 단백질 정량 실험을 진행하며 정밀한 품질 관리의 중요성을 체득하였습니다. 이후 식품회사 인턴십에서 HACCP 운영 및 미생물 검사 절차를 체험하였고, 이를 통해 실무 역량을 강화했습니다. 귀사는 국내 최고 품질경영 시스템을 갖춘 기업으로, 제가 경험한 식품 안전 및 품질관리 역량을 발휘할 수 있는 최적의 환경이라 판단했습니다. 입사 후에는 위생관리 표준을 철저히 준수하며, 팀과의 협업을 통해 고품질 제품 생산에 기여하겠습니다.
(이 예시는 약 530자입니다)

📌 지침 요약:
- 각 질문별로 지정된 글자 수 제한을 반드시 지켜야 합니다.
- **글자 수 범위: (제한 글자 수 - 100)자 이상 ~ 제한 글자 수 이하**
- 예시: 500자 제한 → 400-500자, 800자 제한 → 700-800자
- **최소 글자 수 미만은 무조건 탈락 사유가 됩니다. 반드시 충분한 내용으로 채워주세요.**
- 너무 짧게 쓰지 말고 내용을 충분히 채우세요.
- **입력 정보가 간단하면 해당 분야의 일반적인 경험을 상상하여 구체적으로 확장하세요.**
- **각 답변은 반드시 최소 글자 수에 도달해야 합니다. 짧은 답변은 절대 허용되지 않습니다.**
`.trim();
}

// 컨텍스트 엔지니어링: 사용자 프롬프트 (구체적인 작업 지시)
function buildUserPrompt(
  companyName: string,
  jobTitle: string,
  keyExperience: string,
  questions: Array<{question: string, wordLimit?: number}>,
  companyAnalysis?: any,
  useSearchResults?: boolean
): string {
  // 컨텍스트 1: 기본 정보
  const basicContext = `
회사명: ${companyName}
지원 직무: ${jobTitle}
지원자 정보: ${keyExperience}`;

  // 컨텍스트 2: 추가 정보 (조건부)
  const additionalContext = [];
  if (useSearchResults) additionalContext.push('지원 회사/학교의 최신 정보를 검색하여 반영해주세요.');
  
  const searchInfo = additionalContext.length > 0 ? additionalContext.join('\n') : '';

  // 컨텍스트 3: 회사 분석 정보 (조건부)
  const companyInfo = companyAnalysis ? `
회사 분석 정보를 참고하여 다음 사항을 반영해주세요:
- 핵심가치 "${companyAnalysis.coreValues.join(', ')}"를 자연스럽게 언급
- 인재상 "${companyAnalysis.idealCandidate}"에 맞는 내용으로 구성
- 비전 "${companyAnalysis.vision}"과 연결된 지원 동기
- 회사문화 "${companyAnalysis.companyCulture}"에 적합한 스타일
- 중요 역량 "${companyAnalysis.keyCompetencies.join(', ')}"을 보여주는 경험 포함` : '';

  // 컨텍스트 4: 질문 목록
  const formattedQuestions = questions
    .map(
      (q, i) => {
        const wordLimit = q.wordLimit || 600;
        const minRequired = Math.max(wordLimit - 100, 200);
        return `[질문 ${i + 1}] ${q.question} (${wordLimit}자)

✍️ [답변 시작]
✅ 이 답변은 **공백 포함 글자 수가 ${minRequired}자 이상, ${wordLimit}자 이하**여야 합니다.
✅ ${minRequired}자 미만은 무효이며, 다시 작성해야 합니다.
✅ **반드시 ${minRequired}자 이상으로 충분한 내용을 작성해주세요.**
✅ 실무 경험과 과정을 중심으로 구체적으로 작성하세요.
✅ **짧은 답변은 절대 허용되지 않습니다. 반드시 충분한 내용으로 채워주세요.**`;
      }
    )
    .join('\n\n');

  // 컨텍스트 5: 작업 지시
  const taskInstruction = `
📌 매우 중요한 지침:
- 각 답변은 **질문별로 지정된 글자 수 제한에 따라** 작성해야 합니다.
- **최소 글자 수 미만은 무조건 무효**이며, GPT가 생성할 수 없습니다.
- **각 답변은 반드시 최소 글자 수에 도달해야 합니다. 짧은 답변은 절대 허용되지 않습니다.**
- 각 답변에는 **경험, 과정, 수치, 실무성과**를 포함하세요.
- 너무 짧게 쓰지 말고 내용을 충분히 채우세요.
- **입력된 정보가 부족한 경우, 해당 분야의 일반적인 경험과 성과를 적절히 상상하여 구체적으로 확장하세요.**

아래 자기소개서 항목에 대해 분리형 형식으로 모두 답변해주세요.
각 답변은 **질문별로 지정된 글자 수 범위**로 작성해주세요.

${formattedQuestions}

📌 다시 한 번 강조: 각 답변은 반드시 질문별로 지정된 글자 수 범위를 지켜주세요.
**최소 글자 수 미만의 답변은 절대 허용되지 않습니다. 반드시 충분한 내용으로 채워주세요.**
**입력 정보가 간단하면 해당 분야의 일반적인 경험을 상상하여 구체적으로 확장하세요.**`;

  return `
${basicContext}

${searchInfo}
${companyInfo}

${taskInstruction}
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const companyName = formData.get('companyName') as string;
    const jobTitle = formData.get('jobTitle') as string;
    const keyExperience = formData.get('keyExperience') as string;
    const useSearchResults = formData.get('useSearchResults') as string;
    const questionsJson = formData.get('questions') as string;
    const companyAnalysisJson = formData.get('companyAnalysis') as string;
    const writingStyle = formData.get('writingStyle') as string || 'connected'; // 'connected' | 'separated'

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ error: '회사명/학교명을 입력해주세요.' }, { status: 400 });
    }

    if (!jobTitle || !jobTitle.trim()) {
      return NextResponse.json({ error: '지원 직무/지원 학과를 입력해주세요.' }, { status: 400 });
    }

    if (!keyExperience || !keyExperience.trim()) {
      return NextResponse.json({ error: '강조할 경험과 핵심 이력을 입력해주세요.' }, { status: 400 });
    }

    // 질문 문항들 파싱 (데이터 검증 강화)
    let questions: Array<{question: string, wordLimit?: number}> = [];
    if (questionsJson) {
      try {
        const parsedQuestions = JSON.parse(questionsJson);
        if (Array.isArray(parsedQuestions)) {
          questions = parsedQuestions.filter((q: any) => 
            q && typeof q === 'object' && 
            typeof q.question === 'string' && 
            q.question.trim() &&
            (q.wordLimit === undefined || (typeof q.wordLimit === 'number' && q.wordLimit >= 0))
          );
        }
      } catch (error) {
        console.error('질문 파싱 오류:', error);
        return NextResponse.json({ error: '질문 데이터 형식이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    // 회사 분석 정보 파싱 (데이터 검증 강화)
    let companyAnalysis: any = null;
    if (companyAnalysisJson) {
      try {
        const parsedAnalysis = JSON.parse(companyAnalysisJson);
        if (parsedAnalysis && typeof parsedAnalysis === 'object') {
          // 필수 필드 검증 및 안전한 배열 처리
          companyAnalysis = {
            coreValues: Array.isArray(parsedAnalysis.coreValues) ? parsedAnalysis.coreValues : [],
            idealCandidate: typeof parsedAnalysis.idealCandidate === 'string' ? parsedAnalysis.idealCandidate : '',
            vision: typeof parsedAnalysis.vision === 'string' ? parsedAnalysis.vision : '',
            businessAreas: Array.isArray(parsedAnalysis.businessAreas) ? parsedAnalysis.businessAreas : [],
            companyCulture: typeof parsedAnalysis.companyCulture === 'string' ? parsedAnalysis.companyCulture : '',
            keyCompetencies: Array.isArray(parsedAnalysis.keyCompetencies) ? parsedAnalysis.keyCompetencies : []
          };
        }
      } catch (error) {
        console.error('회사 분석 파싱 오류:', error);
        return NextResponse.json({ error: '회사 분석 데이터 형식이 올바르지 않습니다.' }, { status: 400 });
      }
    }

    console.log('자기소개서 생성 시작:', { 
      companyName, 
      jobTitle, 
      keyExperience, 
      questionsCount: questions.length,
      hasCompanyAnalysis: !!companyAnalysis,
      writingStyle
    });

    // 파일 첨부 기능 제거됨
    let fileContent = '';

    const coverLetterContent = await generateCoverLetter({
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      keyExperience: keyExperience.trim(),
      useSearchResults: useSearchResults === 'true',
      questions,
      companyAnalysis,
      writingStyle,
    });

    console.log('✅ 자기소개서 생성 완료');
    console.log('📄 응답 내용 길이:', coverLetterContent.length);
    console.log('📄 응답 내용 미리보기:', coverLetterContent.substring(0, 200) + '...');
    console.log('📄 전체 응답 내용:');
    console.log(coverLetterContent);

    return NextResponse.json({ coverLetterContent });
  } catch (error) {
    console.error('자기소개서 생성 오류:', error);
    return NextResponse.json({ 
      error: '자기소개서 생성 중 오류가 발생했습니다.',
      errorCode: 'COVER_LETTER_GENERATION_FAILED',
      details: '입력 정보를 확인하고 다시 시도해주세요.'
    }, { status: 500 });
  }
}

async function generateCoverLetter({
  companyName,
  jobTitle,
  keyExperience,
  useSearchResults,
  questions,
  companyAnalysis,
  writingStyle,
}: {
  companyName: string;
  jobTitle: string;
  keyExperience: string;
  useSearchResults: boolean;
  questions: Array<{question: string, wordLimit?: number}>;
  companyAnalysis: any;
  writingStyle: string;
}): Promise<string> {
  const isSeparatedStyle = writingStyle === 'separated';
  
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    companyName,
    jobTitle,
    keyExperience,
    questions,
    companyAnalysis,
    useSearchResults
  );

  // 토큰 제한 체크 (파일 첨부 기능 제거로 단순화)
  const estimatedSystemTokens = estimateTokens(systemPrompt);
  const estimatedUserTokens = estimateTokens(userPrompt);
  
  // GPT-4의 대략적인 입력 제한 (8,000 토큰)
  const maxTokens = 7000; // 여유를 두고 설정
  
  // 최종 토큰 수 확인
  const totalEstimatedTokens = estimatedSystemTokens + estimatedUserTokens;
  
  if (totalEstimatedTokens > maxTokens) {
    console.log(`토큰 수 초과: ${totalEstimatedTokens} > ${maxTokens}`);
  }

  try {
    // 질문 수에 따라 max_tokens 동적 조정 (자동 보완 고려)
    const baseTokens = 2000; // 자동 보완을 위해 기본 토큰 수 증가
    const tokensPerQuestion = 700; // 자동 보완을 위해 질문당 토큰 수 증가
    const dynamicMaxTokens = Math.min(baseTokens + (questions.length * tokensPerQuestion), 4500); // 자동 보완을 위해 최대 토큰 수 증가

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: dynamicMaxTokens,
      temperature: 0.3, // 자동 보완을 위해 온도 조정
    });

    const content = completion.choices[0]?.message?.content || '';
    
    if (!content.trim()) {
      throw new Error('자기소개서 내용을 생성하지 못했습니다.');
    }

    // 분리형 응답에서 글자 수 검증 (자동 보완 시스템 활성화)
    if (isSeparatedStyle && questions.length > 0) {
      // 자동 보완 시스템 적용
      const supplementedContent = await applyAutoSupplement(content, questions);
      const validatedContent = validateWordLimits(supplementedContent, questions);
      return validatedContent;
    }

    return content;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    throw new Error('자기소개서 생성 중 오류가 발생했습니다.');
  }
}

// 자동 보완 적용 함수
async function applyAutoSupplement(content: string, questions: Array<{question: string, wordLimit?: number}>): Promise<string> {
  let supplementedContent = content;

  for (let i = 0; i < questions.length; i++) {
    console.log(`🔍 질문 ${i + 1} 답변 추출 시도...`);
    
    const patterns = [
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?✍️\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\n\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\n+\\s*([\\s\\S]*?)(?=\\n+\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?✍️\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\s*$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\s*$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\s*$)`, 'i')
    ];

    let answer = '';
    for (let j = 0; j < patterns.length; j++) {
      const match = supplementedContent.match(patterns[j]);
      if (match && match[1]) {
        answer = match[1].trim();
        console.log(`✅ 질문 ${i + 1} 답변 추출 성공 (패턴 ${j + 1}): ${answer.length}자`);
        break;
      }
    }

    if (!answer) {
      console.log(`❌ 질문 ${i + 1} 답변 추출 실패`);
      continue;
    }

    const wordLimit = questions[i].wordLimit || 600;
    const minRequired = Math.max(wordLimit - 100, 200);
    const maxAllowed = wordLimit;
    
    console.log(`📊 질문 ${i + 1} 분석: 현재 ${answer.length}자, 최소 ${minRequired}자 필요 (제한: ${wordLimit}자)`);
    
    if (answer.length < minRequired) {
      console.log(`질문 ${i + 1} 자동 보완 시작: ${answer.length}자 (최소 ${minRequired}자 필요)`);
      
      let currentAnswer = answer;
      let attemptCount = 0;
      const maxAttempts = 3; // 성능 최적화: 최대 3번까지 시도
      
      // 목표 글자 수에 도달할 때까지 반복 (최대 제한 준수)
      while (currentAnswer.length < minRequired && currentAnswer.length < maxAllowed && attemptCount < maxAttempts) {
        attemptCount++;
        console.log(`질문 ${i + 1} 보완 시도 ${attemptCount}: ${currentAnswer.length}자`);
        
        const supplementedAnswer = await autoSupplementAnswer(currentAnswer, questions[i].question);
        
        if (supplementedAnswer !== currentAnswer) {
          // 글자 수 제한 확인
          if (supplementedAnswer.length <= maxAllowed) {
            currentAnswer = supplementedAnswer;
            console.log(`질문 ${i + 1} 보완 성공 ${attemptCount}: ${currentAnswer.length}자`);
          } else {
            console.log(`질문 ${i + 1} 보완 중단 ${attemptCount}: ${supplementedAnswer.length}자 (제한 초과)`);
            break; // 제한을 초과하면 중단
          }
        } else {
          console.log(`질문 ${i + 1} 보완 실패 ${attemptCount}: 더 이상 확장할 수 없음`);
          break; // 더 이상 확장할 수 없으면 중단
        }
      }
      
      // 최종 결과로 교체
      if (currentAnswer !== answer) {
        supplementedContent = supplementedContent.replace(answer, currentAnswer);
        console.log(`질문 ${i + 1} 자동 보완 완료: ${answer.length}자 → ${currentAnswer.length}자`);
      }
      
      // 자동 보완 후에도 여전히 부족한 경우 추가 조정
      if (currentAnswer.length < minRequired) {
        console.log(`⚠️ 질문 ${i + 1} 자동 보완 후에도 부족: ${currentAnswer.length}자 (최소 ${minRequired}자 필요)`);
        
        const adjustedAnswer = await adjustAnswerLength(currentAnswer, minRequired);
        if (adjustedAnswer !== currentAnswer) {
          supplementedContent = supplementedContent.replace(currentAnswer, adjustedAnswer);
          console.log(`질문 ${i + 1} 추가 조정 완료: ${currentAnswer.length}자 → ${adjustedAnswer.length}자`);
        }
      }
    } else if (answer.length > maxAllowed) {
      console.log(`⚠️ 질문 ${i + 1} 글자 수 초과: ${answer.length}자 (제한: ${maxAllowed}자)`);
      
      // 초과한 경우 자동으로 조정
      const adjustedAnswer = await adjustAnswerLength(answer, maxAllowed);
      if (adjustedAnswer !== answer) {
        supplementedContent = supplementedContent.replace(answer, adjustedAnswer);
        console.log(`질문 ${i + 1} 글자 수 자동 조정: ${answer.length}자 → ${adjustedAnswer.length}자`);
      }
    } else {
      console.log(`✅ 질문 ${i + 1} 글자 수 적절함: ${answer.length}자`);
    }
  }

  return supplementedContent;
}

// 글자 수 검증 함수 (성능 최적화)
function validateWordLimits(content: string, questions: Array<{question: string, wordLimit?: number}>): string {
  const questionBlocks = content.split(/\[질문 \d+\]/).filter(block => block.trim());
  
  if (questionBlocks.length !== questions.length) {
    return content; // 검증 실패 시 원본 반환
  }

  let validatedContent = content;
  let hasWarnings = false;
  const invalidAnswers: { questionIndex: number; actual: number; minRequired: number; maxAllowed: number }[] = [];

  questions.forEach((question, index) => {
    // 개선된 정규식 패턴들 - 더 정확한 매칭을 위해
    const patterns = [
      // 패턴 1: [질문 N] 다음에 ✍️ [답변 시작] 형식이 있는 경우 (가장 일반적)
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?✍️\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      // 패턴 2: [질문 N] 다음에 [답변] 라벨이 있는 경우
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      // 패턴 3: [질문 N] 다음에 "답변:" 텍스트가 있는 경우
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      // 패턴 4: [질문 N] 다음에 바로 답변이 시작하는 경우
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\n\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      // 패턴 5: 마지막 질문의 답변 (끝까지 매칭)
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?✍️\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\s*$)`, 'i'),
      // 패턴 6: 질문과 답변 사이에 개행이 여러 개 있는 경우
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\n+\\s*([\\s\\S]*?)(?=\\n+\\s*\\[질문|$)`, 'i')
    ];

    let answer = '';
    let matchedPattern = '';
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = content.match(pattern);
      if (match && match[1]) {
        answer = match[1].trim();
        matchedPattern = `패턴 ${i + 1}`;
        console.log(`✅ 질문 ${index + 1} 매칭 성공: ${matchedPattern}`);
        break;
      }
    }

    if (answer) {
      // 답변 부분만 정확히 계산 (질문 제목 제외)
      const charCount = answer.length; // 공백 포함 글자 수 기준으로 변경
      const wordLimit = question.wordLimit || 600;
      const minRequired = Math.max(wordLimit - 100, 200);
      const maxAllowed = wordLimit;
      
      console.log(`🔍 질문 ${index + 1} 상세 분석:`);
      console.log(`  - 매칭된 패턴: ${matchedPattern}`);
      console.log(`  - 답변 내용: "${answer.substring(0, 50)}..."`);
      console.log(`  - 현재 글자 수: ${charCount}자`);
      console.log(`  - 허용 범위: ${minRequired}~${maxAllowed}자 (제한: ${wordLimit}자)`);
      
      // 질문 제목에 글자 수 추가 (수정된 부분)
      const questionTitle = `[질문 ${index + 1}] ${question.question}`;
      const questionWithCharCount = `${questionTitle} (답변: ${charCount}자/${wordLimit}자)`;
      
      // 원본에서 질문 제목을 글자 수가 포함된 제목으로 교체
      validatedContent = validatedContent.replace(
        new RegExp(`\\[질문 ${index + 1}\\]\\s*${question.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
        questionWithCharCount
      );
      
      // 디버깅: 실제 답변 글자 수와 표시되는 글자 수 비교
      console.log(`🔍 질문 ${index + 1} 글자 수 검증:`);
      console.log(`  - 실제 답변 글자 수: ${charCount}자`);
      console.log(`  - 표시될 글자 수: ${charCount}자`);
      console.log(`  - 질문 제목 길이: ${questionTitle.length}자`);
      console.log(`  - 전체 제목 길이: ${questionWithCharCount.length}자`);
      console.log(`  - 답변 내용 미리보기: "${answer.substring(0, 100)}..."`);
      
      // maxAllowed 초과인 경우 자동 수정 (비활성화)
      if (charCount > maxAllowed) {
        const excessChars = charCount - maxAllowed;
        console.log(`📝 질문 ${index + 1}: ${charCount}자 (${excessChars}자 초과) - 자동 수정 비활성화됨`);
        
        // 자동 수정 대신 경고만 표시
        hasWarnings = true;
        invalidAnswers.push({ 
          questionIndex: index, 
          actual: charCount, 
          minRequired: minRequired,
          maxAllowed: maxAllowed
        });
      }
      // minRequired 미만이거나 maxAllowed 초과인 경우 참고사항으로 표시
      else if (charCount < minRequired || charCount > maxAllowed) {
        hasWarnings = true;
        invalidAnswers.push({ 
          questionIndex: index, 
          actual: charCount, 
          minRequired: minRequired,
          maxAllowed: maxAllowed
        });
        
        const status = charCount < minRequired ? '부족' : '초과';
        console.log(`📝 질문 ${index + 1} ${status}: ${charCount}자 (범위: ${minRequired}-${maxAllowed}자, 제한: ${wordLimit}자) - 글자 수 조정 필요`);
      } else {
        console.log(`✅ 질문 ${index + 1}: ${charCount}자 (범위: ${minRequired}-${maxAllowed}자, 제한: ${wordLimit}자) - 적절함`);
      }
    } else {
      console.log(`질문 ${index + 1} 답변을 찾을 수 없습니다.`);
    }
  });

  if (hasWarnings) {
    // 경고 메시지를 content 끝에 추가 (더 부드러운 톤으로 수정)
    let warningMessage = '\n\n📝 참고사항: 일부 답변이 지정된 글자 수 범위를 벗어났습니다.';
    
    if (invalidAnswers.length > 0) {
      warningMessage += '\n\n글자 수 현황:';
      invalidAnswers.forEach(item => {
        const status = item.actual < item.minRequired ? '부족' : '초과';
        const difference = item.actual < item.minRequired ? 
          `${item.minRequired - item.actual}자 부족` : 
          `${item.actual - item.maxAllowed}자 초과`;
        
        warningMessage += `\n- 질문 ${item.questionIndex + 1}: ${item.actual}자 (${difference})`;
      });
      warningMessage += '\n\n💡 필요시 수동으로 글자 수를 조정해주세요.';
    }
    
    validatedContent += warningMessage;
  }

  return validatedContent;
}

// 자동 보완 함수 추가
async function autoSupplementAnswer(answer: string, questionText: string): Promise<string> {
  try {
    console.log(`🔧 autoSupplementAnswer 시작: ${answer.length}자`);
    
    // 목표 글자 수 계산 (현재 글자 수 + 200-250자, 최대 500자)
    const targetLength = Math.min(answer.length + 200, 500);
    const supplementLength = targetLength - answer.length;
    
    console.log(`🔧 목표 글자 수: ${targetLength}자 (현재: ${answer.length}자 + ${supplementLength}자)`);
    
    const supplement = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `다음 답변을 ${supplementLength}자 정도 자연스럽게 확장해주세요. 원래 내용과 자연스럽게 연결되도록 하고, 구체적인 경험과 성과를 추가해주세요. 절대 ${targetLength}자를 초과하지 마세요.`
        },
        {
          role: "user",
          content: `질문: ${questionText}\n\n현재 답변: ${answer}\n\n위 답변을 ${supplementLength}자 정도 자연스럽게 확장해주세요. 구체적인 경험, 과정, 수치, 실무성과를 추가해주세요. 총 ${targetLength}자를 초과하지 마세요.`
        }
      ],
      temperature: 0.4,
      max_tokens: supplementLength * 2, // 적절한 토큰 수 설정
    });
    
    const supplementText = supplement.choices[0]?.message?.content?.trim() || '';
    console.log(`🔧 보완 텍스트 생성: ${supplementText.length}자`);
    console.log(`🔧 보완 텍스트 내용: "${supplementText}"`);
    
    const result = supplementText ? `${answer} ${supplementText}` : answer;
    console.log(`🔧 최종 결과: ${result.length}자 (원본: ${answer.length}자)`);
    
    // 글자 수 제한 확인
    if (result.length > 500) {
      console.log(`⚠️ 글자 수 초과: ${result.length}자 > 500자, 원본 반환`);
      return answer;
    }
    
    return result;
  } catch (error) {
    console.error('자동 보완 중 오류:', error);
    return answer;
  }
}

// 답변 글자 수 조정 함수
async function adjustAnswerLength(answer: string, targetLength: number): Promise<string> {
  try {
    console.log(`🔧 adjustAnswerLength 시작: ${answer.length}자, 목표: ${targetLength}자`);
    
    // 현재 글자 수가 목표 글자 수보다 큰 경우 줄이기
    if (answer.length > targetLength) {
      console.log(`🔧 글자 수 줄이기: ${answer.length}자 → ${targetLength}자`);
      
      const adjustedAnswer = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `다음 답변을 정확히 ${targetLength}자로 줄여주세요. 핵심 내용은 유지하면서 불필요한 부분을 제거하세요.`
          },
          {
            role: "user",
            content: `답변: ${answer}\n\n위 답변을 정확히 ${targetLength}자로 줄여주세요. 핵심 내용과 구체적인 경험은 유지하세요.`
          }
        ],
        temperature: 0.3,
        max_tokens: targetLength * 2,
      });
      
      const result = adjustedAnswer.choices[0]?.message?.content?.trim() || answer;
      console.log(`🔧 글자 수 조정 결과: ${result.length}자`);
      
      return result;
    }
    // 현재 글자 수가 목표 글자 수보다 작은 경우 늘리기
    else if (answer.length < targetLength) {
      console.log(`🔧 글자 수 늘리기: ${answer.length}자 → ${targetLength}자`);
      
      const supplementLength = targetLength - answer.length;
      
      const supplementedAnswer = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `다음 답변을 ${supplementLength}자 정도 자연스럽게 확장해주세요. 총 ${targetLength}자가 되도록 구체적인 경험과 성과를 추가하세요.`
          },
          {
            role: "user",
            content: `답변: ${answer}\n\n위 답변을 ${supplementLength}자 정도 자연스럽게 확장해주세요. 구체적인 경험, 과정, 수치, 실무성과를 추가해주세요. 총 ${targetLength}자가 되도록 해주세요.`
          }
        ],
        temperature: 0.4,
        max_tokens: supplementLength * 2,
      });
      
      const supplementText = supplementedAnswer.choices[0]?.message?.content?.trim() || '';
      const result = supplementText ? `${answer} ${supplementText}` : answer;
      
      console.log(`🔧 글자 수 확장 결과: ${result.length}자`);
      
      return result;
    }
    
    return answer; // 목표 글자 수와 현재 글자 수가 같은 경우
  } catch (error) {
    console.error('답변 글자 수 조정 중 오류:', error);
    return answer;
  }
}
