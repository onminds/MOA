import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient } from '@/lib/openai';
import { AI_MODEL, WORD_RULE, DIVERSITY_RULE } from '@/config/ai';
import { calculateTokens, calculateResponseTokenLimit, validateTokenLimit } from '@/lib/token-validator';

// 모델 고정 (생성 메인 경로에서 사용)
const OPENAI_MODEL = 'gpt-5-mini' as const;

// 문자 → 토큰 근사치 (한국어 보수적으로 2 chars ~= 1 token)
function estTokensFromChars(chars: number): number {
  return Math.max(64, Math.floor(chars / 2));
}

// 전체 문항에 대한 최대 토큰 상한 계산
function totalMaxTokens(questions: Array<{ wordLimit?: number }>): number {
  const sumChars = questions.reduce((s, q) => s + (typeof q.wordLimit === 'number' ? q.wordLimit : 500), 0);
  return Math.min(4096, Math.floor(estTokensFromChars(sumChars) * 1.2));
}

// chat 기반 단일 호출 래퍼 (반복 억제 파라미터 포함)
async function chatSingle(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>, max_tokens: number): Promise<string> {
  const openai = getOpenAIClient();
  // 1) 우선 chat.completions 시도
  try {
    const resp = await (openai as any).chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.6,
      presence_penalty: 0.2,
      max_completion_tokens: max_tokens,
      messages,
    });
    const content = resp?.choices?.[0]?.message?.content || '';
    return (content as string).trim();
  } catch (e) {
    console.error('[chatSingle] chat.completions 실패, responses.create로 폴백:', e);
  }

  // 2) 폴백: Responses API 사용
  try {
    const system = messages.find(m => m.role === 'system')?.content || '';
    const user = messages.find(m => m.role === 'user')?.content || '';
    const composed = `${system}\n\n${user}`.trim();
    const resp = await (openai as any).responses.create({
      model: OPENAI_MODEL,
      input: composed,
    });
    const content = resp?.output_text || '';
    return (content as string).trim();
  } catch (e2) {
    console.error('[chatSingle] responses.create 폴백도 실패:', e2);
    throw e2;
  }
}

// 컨텍스트 엔지니어링: 시스템 프롬프트 (AI의 역할과 규칙 정의)
function buildSystemPrompt(): string {
  return `
당신은 채용 자기소개서 작성 전문가입니다. 반드시 다음을 지키세요:
- 모든 출력은 한국어, 일반 텍스트(마크다운·이모지 금지)
- 회사·직무 맞춤화, 구체적 경험/과정/수치 포함, 상투어·중복 회피
- 글자수 제한이 명시된 질문은 지정된 범위 내에서 작성
- 글자수 제한이 없는 질문은 적정 분량(약 500±100자)으로 충실히 작성
- 정보가 부족하면 업계 일반 사례로 구체적으로 보강(과장 금지)

중복 방지 규칙(매우 중요):
- 절대 동일한 문장이나 표현을 반복하지 마세요
- "삼성바이오로직스의..." 같은 문장을 두 번 쓰지 마세요
- 각 질문마다 서로 다른 경험/사례/성과를 사용하세요
- 글자 수가 부족해도 기존 내용을 반복하지 말고 새로운 내용을 추가하세요
- 구체적 수치, 프로젝트명, 기술명, 성과 지표를 다양하게 활용하세요

문장 구조 및 가독성:
- 한 문장은 50-80자 내외로 적절히 분리하세요
- 쉼표로만 연결하지 말고 마침표로 문장을 구분하세요
- "또한", "추가로", "여기에" 등으로 시작하는 부분은 새 문장으로 시작하세요
- 긴 문장은 의미 단위로 자연스럽게 분리하세요
- 가독성을 위해 적절한 문장 부호를 사용하세요

글자 수 관리:
- 목표 글자 수에 맞춰 충실한 내용을 작성하세요
- 부족할 때는 새로운 경험/사례/성과를 추가하세요
- 초과할 때는 핵심 내용을 유지하며 불필요한 부분을 제거하세요

형식 규칙(중요):
- 각 문항은 반드시 아래 헤더를 포함해 작성합니다.
  [질문 N] {질문 텍스트} ({제한자})
  [답변 시작]
- 위 형식을 벗어난 머리말/꼬리말을 추가하지 마세요.
- 서로 다른 질문의 답변은 내용·문장·근거·예시가 겹치지 않도록 서로 다른 관점/사례/성과 지표를 사용하세요.
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
  // 컨텍스트 1: 기본 정보 (불필요 공백 제거)
  const compact = (s: string, n: number) => {
    if (!s) return '';
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  };
  const listJoin = (arr: string[] | undefined, n: number) => Array.isArray(arr) ? arr.filter(Boolean).slice(0, n).join(', ') : '';

  const basicContext = `회사명: ${compact(companyName, 60)}\n지원 직무: ${compact(jobTitle, 60)}\n지원자 핵심 경험: ${compact(keyExperience, 600)}`;

  // 컨텍스트 2: 추가 정보 (조건부, 한 줄)
  const searchInfo = useSearchResults ? '검색 가능 시 최신 회사/학교 정보를 반영' : '';

  // 컨텍스트 3: 회사 분석 요약(초간결·한 줄·길이 제한)
  const companyInfo = companyAnalysis ? `회사 분석 요약: 핵심가치=${compact(listJoin(companyAnalysis.coreValues, 5), 80)}; 인재상=${compact(companyAnalysis.idealCandidate || '', 120)}; 비전=${compact(companyAnalysis.vision || '', 120)}; 문화=${compact(companyAnalysis.companyCulture || '', 100)}; 역량=${compact(listJoin(companyAnalysis.keyCompetencies, 6), 90)}` : '';

  // 컨텍스트 4: 질문 목록 (형식 유지)
  const formattedQuestions = questions
    .map((q, i) => {
      const hasExplicitLimit = typeof q.wordLimit === 'number' && q.wordLimit > 0;
      const limitLabel = hasExplicitLimit ? ` (${q.wordLimit}자)` : '';
      const sanitizedQuestion = hasExplicitLimit
        ? q.question
        : q.question.replace(/\s*\(\s*\d+\s*자\s*\)\s*$/i, '');
      return `[질문 ${i + 1}] ${sanitizedQuestion}${limitLabel}\n[답변 시작]`;
    })
    .join('\n\n');

  // 컨텍스트 5: 작업 지시(초간결)
  const taskInstruction = `지시: 각 질문 헤더에 이어 [답변 시작] 이후 답변만 작성. 글자수 제한 준수하되 내용 중복 금지. 회사/직무 맥락 반영.`;

  // 불필요한 빈 섹션 제거 후 합치기
  const parts = [basicContext, searchInfo, companyInfo, taskInstruction, formattedQuestions].filter(p => p && p.trim());
  return parts.join('\n\n').trim();
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
    // 작성 방식 제거: 항상 분리형

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
      writingStyle: 'separated'
    });

    // 파일 첨부 기능 제거됨
    // let fileContent = '';

    const coverLetterContent = await generateCoverLetter({
      companyName: companyName.trim(),
      jobTitle: jobTitle.trim(),
      keyExperience: keyExperience.trim(),
      useSearchResults: useSearchResults === 'true',
      questions,
      companyAnalysis,
    });

    console.log('✅ 자기소개서 생성 완료');
    console.log('📄 응답 내용 길이:', coverLetterContent.length);
    console.log('📄 응답 내용 미리보기:', coverLetterContent.substring(0, 200) + '...');
    console.log('📄 전체 응답 내용:');
    console.log(coverLetterContent);

    return NextResponse.json({ coverLetterContent });
  } catch (error) {
    console.error('자기소개서 생성 오류:', error);
    const debug = (error as any)?.message || String(error);
    return NextResponse.json({ 
      error: '자기소개서 생성 중 오류가 발생했습니다.',
      errorCode: 'COVER_LETTER_GENERATION_FAILED',
      details: '입력 정보를 확인하고 다시 시도해주세요.',
      debug: process.env.NODE_ENV !== 'production' ? debug : undefined
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
}: {
  companyName: string;
  jobTitle: string;
  keyExperience: string;
  useSearchResults: boolean;
  questions: Array<{question: string, wordLimit?: number}>;
  companyAnalysis: any;
}): Promise<string> {
  const isSeparatedStyle = true;
  
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(
    companyName,
    jobTitle,
    keyExperience,
    questions,
    companyAnalysis,
    useSearchResults
  );

  // 정확한 토큰 제한 검증
  const tokenValidation = validateTokenLimit(systemPrompt, userPrompt, AI_MODEL as any);
  
  if (!tokenValidation.isValid) {
    throw new Error(tokenValidation.error || '토큰 제한을 초과했습니다.');
  }
  
  console.log(`토큰 검증 통과: ${tokenValidation.estimatedTokens}/${tokenValidation.maxAllowedTokens}`);

  try {
    // 정확한 응답 토큰 제한 계산 (참고용)
    const systemTokens = calculateTokens(systemPrompt);
    const userTokens = calculateTokens(userPrompt);
    // const _maxResponseTokens = calculateResponseTokenLimit(systemTokens, userTokens, AI_MODEL as any);

    // chat 기반 호출로 전환 + 토큰 상한 적용
    const maxToks = totalMaxTokens(questions);
    const content = await chatSingle([
      { role: 'system', content: '너는 한국어 자기소개서를 간결하게 쓰는 도우미다. 동일 문장/표현 재진술 금지.' },
      { role: 'user', content: `${systemPrompt}\n\n${userPrompt}` },
    ], maxToks);
    
    if (!content.trim()) {
      throw new Error('자기소개서 내용을 생성하지 못했습니다.');
    }

    // 분리형 응답에서 글자 수 검증 (자동 보완 시스템 활성화)
    if (isSeparatedStyle && questions.length > 0) {
      // 헤더 강제 정규화: [질문 N] 다음에 [답변 시작]이 없으면 삽입
      const headerNormalized = enforceAnswerHeaders(content, questions);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[HEADERED]', headerNormalized.slice(0, 400));
      }
      // 자동 보완 시스템 적용 (최소/최대 근접화)
      const supplementedContent = await applyAutoSupplement(headerNormalized, questions);
      // 중복 문장/괄호 제거로 자연스러움 개선
      let cleanedContent = cleanupAnswers(supplementedContent, questions);
      // 교차-답변 다양화(유사도 억제)
      cleanedContent = await diversifyAcrossAnswers(cleanedContent, questions);
      // 빅그램 사후 필터로 추가 유사 문장 제거
      cleanedContent = postFilterByBigrams(cleanedContent);
      // 문장 구조 개선으로 가독성 향상
      cleanedContent = improveSentenceStructure(cleanedContent);
      // 최종 강제 제한: 문장 단위 트림 → 필요 시 하드 컷
      const finalizedContent = finalizeEnforceLimits(cleanedContent, questions);
      // 검증 및 현황 부착(수정은 하지 않음)
      const validatedContent = validateWordLimits(finalizedContent, questions);
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
    console.log(`🔍 질문 ${i + 1} 답변 추출 및 길이 검사...`);
    
    const patterns = [
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?✍️\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${i + 1}\\][\\s\\S]*?\\n\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
    ];

    let answer = '';
    for (let j = 0; j < patterns.length; j++) {
      const match = supplementedContent.match(patterns[j]);
      if (match && match[1]) {
        answer = match[1].trim();
        console.log(`✅ 질문 ${i + 1} 답변 추출 성공: ${answer.length}자`);
        break;
      }
    }

    if (!answer) {
      console.log(`❌ 질문 ${i + 1} 답변 추출 실패`);
      continue;
    }

    // 글자 수 제한 확인 및 스마트 확장
    const qLimit = questions[i]?.wordLimit;
    const hasExplicitLimit = typeof qLimit === 'number' && qLimit > 0;
    const wordLimit = hasExplicitLimit ? (qLimit as number) : 600; // 기본값 600자
    const minRequired = Math.max(wordLimit - 100, Math.floor(wordLimit * 0.8)); // 최소 100자 이내
    
    console.log(`📊 질문 ${i + 1} 분석: 현재 ${answer.length}자, 목표 ${wordLimit}자, 최소 ${minRequired}자`);
    
    if (answer.length < minRequired) {
      console.log(`🔧 질문 ${i + 1} 스마트 확장 시작: ${answer.length}자 → ${wordLimit}자`);
      
      try {
        const extendedAnswer = await smartExtendAnswer(answer, wordLimit, questions[i].question);
        
        if (extendedAnswer !== answer) {
          supplementedContent = supplementedContent.replace(answer, extendedAnswer);
          console.log(`✅ 질문 ${i + 1} 확장 완료: ${answer.length}자 → ${extendedAnswer.length}자`);
        } else {
          console.log(`⚠️ 질문 ${i + 1} 확장 실패: 내용이 변경되지 않음`);
        }
      } catch (error) {
        console.error(`❌ 질문 ${i + 1} 확장 중 오류:`, error);
      }
    } else if (answer.length > wordLimit) {
      console.log(`⚠️ 질문 ${i + 1} 글자 수 초과: ${answer.length}자 (제한: ${wordLimit}자)`);
      // 초과 시 문장 단위로 자르기
      const sentences = splitSentencesKorean(answer);
      let trimmed = '';
      for (const s of sentences) {
        if ((trimmed + s).length > wordLimit) break;
        trimmed += s;
      }
      if (trimmed.length === 0) {
        trimmed = answer.slice(0, wordLimit);
      }
      supplementedContent = supplementedContent.replace(answer, trimmed);
      console.log(`✂️ 질문 ${i + 1} 자동 자르기: ${answer.length}자 → ${trimmed.length}자`);
    } else {
      console.log(`✅ 질문 ${i + 1} 글자 수 적절함: ${answer.length}자`);
    }
  }

  return supplementedContent;
}

// 스마트 길이 조정: 기존 내용을 반복하지 않고 자연스럽게 확장
async function smartExtendAnswer(answer: string, targetLength: number, questionText: string): Promise<string> {
  try {
    if (answer.length >= targetLength) return answer;
    
    const neededChars = targetLength - answer.length;
    console.log(`🔧 스마트 확장: ${answer.length}자 → ${targetLength}자 (필요: ${neededChars}자)`);
    
    const openai = getOpenAIClient();
    const extension = await openai.responses.create({
      model: AI_MODEL,
      input: `아래 답변을 ${neededChars}자 정도 자연스럽게 확장하세요. 
중요: 절대 기존 내용을 반복하지 말고, 새로운 구체적 경험/성과/수치를 추가하세요.
예시 금지: "삼성바이오로직스의..." 같은 문장을 두 번 쓰지 마세요.

질문: ${questionText}
현재 답변: ${answer}

확장 요구사항:
- 기존 내용과 자연스럽게 연결
- 구체적 경험/성과/수치 추가
- 중복 문장 금지
- 총 ${targetLength}자 이내`,
      reasoning: { effort: 'low' }
    });
    
    const extensionText = extension.output_text?.trim() || '';
    if (!extensionText) return answer;
    
    const result = `${answer} ${extensionText}`;
    console.log(`🔧 확장 완료: ${result.length}자`);
    
    // 중복 문장 검사
    const sentences = splitSentencesKorean(result);
    const uniqueSentences = removeDuplicateSentences(sentences);
    const finalResult = uniqueSentences.join(' ');
    
    if (finalResult.length !== result.length) {
      console.log(`🔧 중복 제거 후: ${finalResult.length}자`);
    }
    
    return finalResult;
  } catch (error) {
    console.error('스마트 확장 중 오류:', error);
    return answer;
  }
}

// 문장 중복 제거 (정확 일치 + 근사 유사도)
function removeDuplicateSentences(sentences: string[]): string[] {
  const unique: string[] = [];
  const seenTokens: string[][] = [];
  
  for (const s of sentences) {
    const norm = normalizeSentence(s);
    const t = tokensKO(norm);
    
    // 정확 일치 검사
    const exactMatch = unique.some(existing => normalizeSentence(existing) === norm);
    if (exactMatch) {
      console.log(`🔧 중복 문장 제거: ${s.substring(0, 50)}...`);
      continue;
    }
    
    // 근사 유사도 검사 (더 엄격하게)
    const isSimilar = seenTokens.some(prev => jaccard(prev, t) >= 0.7);
    if (isSimilar) {
      console.log(`🔧 유사 문장 제거: ${s.substring(0, 50)}...`);
      continue;
    }
    
    unique.push(s);
    seenTokens.push(t);
  }
  
  return unique;
}

// 최종 강제 제한 적용: 각 답변을 최대 글자 수 이내로 강제 절삭
function finalizeEnforceLimits(content: string, questions: Array<{question: string, wordLimit?: number}>): string {
  let result = content;
  questions.forEach((question, index) => {
    const hasExplicitLimit = typeof question.wordLimit === 'number' && question.wordLimit > 0;
    const wordLimit = hasExplicitLimit ? (question.wordLimit as number) : WORD_RULE.defaultWordLimit;
    const maxAllowed = hasExplicitLimit ? wordLimit : Number.POSITIVE_INFINITY;

    // 답변 추출 (validateWordLimits와 동일한 핵심 패턴 일부 재사용)
    const patterns = [
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?✍️?\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\n\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (match && match[1]) {
        const original = match[1];
        if (original.length <= maxAllowed) break;

        // 1) 문장 단위(마침표/물음표/느낌표/완결 한글 종결부호) 기준으로 줄이기
        const sentenceSplit = original.split(/(?<=[\.\!\?\u3002\uFF01\uFF1F])/);
        let trimmed = '';
        for (const s of sentenceSplit) {
          if ((trimmed + s).length > maxAllowed) break;
          trimmed += s;
        }
        // 2) 여전히 초과하면 하드 컷
        if (trimmed.length === 0) {
          trimmed = original.slice(0, maxAllowed);
        }

        // 교체
        result = result.replace(original, trimmed);
        break;
      }
    }
  });
  return result;
}

// 간단한 한국어 토큰화 및 유사도 계산(자카드 유사도 기반)
function tokenizeKorean(text: string): string[] {
  const lowered = text
    .replace(/\([^\)]*\)/g, ' ') // 괄호 제거
    .replace(/[\p{P}\p{S}]/gu, ' ') // 구두점 제거
    .toLowerCase();
  const raw = lowered.split(/\s+/).filter(Boolean);
  const stop = new Set(DIVERSITY_RULE.stopwords);
  // 2글자 이상 토큰만 사용 (의미 구별력 향상)
  return raw.filter(w => w.length >= 2 && !stop.has(w));
}

function jaccardSimilarity(aTokens: string[], bTokens: string[]): number {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  let inter = 0;
  for (const t of aSet) if (bSet.has(t)) inter++;
  const union = aSet.size + bSet.size - inter;
  return union === 0 ? 0 : inter / union;
}

// 교차-답변 유사도 억제: 비슷한 답변을 재다양화 요청으로 치환
async function diversifyAcrossAnswers(
  content: string,
  questions: Array<{ question: string; wordLimit?: number }>
): Promise<string> {
  let result = content;

  // 각 답변 추출
  const extractAnswer = (idx: number): { fullMatch: string; answer: string } | null => {
    const patterns = [
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?✍️?\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
    ];
    for (const p of patterns) {
      const m = result.match(p);
      if (m && m[1]) {
        return { fullMatch: m[1], answer: m[1].trim() };
      }
    }
    return null;
  };

  const answers: { index: number; text: string; fullMatch: string }[] = [];
  for (let i = 0; i < questions.length; i++) {
    const ext = extractAnswer(i);
    if (ext) answers.push({ index: i, text: ext.answer, fullMatch: ext.fullMatch });
  }

  // bigram 금지 세트 구축
  const bigrams = (s: string): Set<string> => {
    // 숫자/퍼센트 등을 통일한 토큰 기준으로 bigram 구성
    const toks = tokenizeKorean(s);
    const set = new Set<string>();
    for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]} ${toks[i + 1]}`);
    return set;
  };
  const forbiddenSets: Set<string>[] = [];

  // 유사도 검사 및 필요 시 재다양화
  for (let i = 0; i < answers.length; i++) {
    for (let j = i + 1; j < answers.length; j++) {
      const a = answers[i];
      const b = answers[j];
      const sim = jaccardSimilarity(tokenizeKorean(a.text), tokenizeKorean(b.text));
      if (sim >= DIVERSITY_RULE.similarityThreshold) {
        // 더 짧은 쪽을 우선 재다양화
        const target = a.text.length <= b.text.length ? a : b;
        const other = target === a ? b : a;

        let diversified = target.text;
        let attempt = 0;
        while (attempt < DIVERSITY_RULE.maxDiversifyAttempts) {
          attempt++;
          try {
            const openai = getOpenAIClient();
            // bigram 금지 목록 반영
            const forbid = forbiddenSets[i] || bigrams(other.text);
            const focusHint = target.index === 0
              ? '회사/직무 적합성과 비즈니스 임팩트 중심'
              : target.index === 1
              ? '기술 스택·운영 성과 중심'
              : '문제해결 스토리(원인→대응→지표) 중심';
            const prompt = `두 질문이 유사합니다. 아래 '기존 답변'을 토대로 '${focusHint}' 관점으로 재작성하되, 금지 bigram을 피하고 다른 질문 답변과 겹치지 않게 하세요. ${Math.min(target.text.length + 80, 480)}자 이내.\n금지 bigram: ${Array.from(forbid).slice(0, 80).join(' | ')}\n\n질문: ${questions[target.index].question}\n기존 답변: ${target.text}\n다른 질문의 답변(중복 회피 기준): ${other.text}`;
            const resp = await openai.responses.create({ model: AI_MODEL, input: prompt, reasoning: { effort: 'low' } });
            const candidate = (resp.output_text || '').trim();
            if (candidate) {
              const newSim = jaccardSimilarity(tokenizeKorean(candidate), tokenizeKorean(other.text));
              diversified = candidate;
              if (process.env.NODE_ENV !== 'production') {
                console.log(`Diversify Q${a.index + 1}-Q${b.index + 1}: ${sim.toFixed(2)} -> ${newSim?.toFixed?.(2)}`);
              }
              if (newSim < DIVERSITY_RULE.similarityThreshold * 0.9) break; // 충분히 낮아지면 중단
            } else {
              break;
            }
          } catch (e) {
            console.error('재다양화 중 오류:', e);
            break;
          }
        }

        // 결과 반영 (문서 내 해당 구간 교체)
        result = result.replace(target.fullMatch, diversified);
        // 최신 텍스트 갱신
        target.text = diversified;
        target.fullMatch = diversified;
      }
    }
    // 금지 bigram 누적
    const ext = answers[i];
    if (ext) forbiddenSets.push(bigrams(ext.text));
  }

  return result;
}

// 사후: 빅그램 기반 문항 간 겹침 문장 제거 (재다양화 실패 대비)
function postFilterByBigrams(content: string): string {
  let result = content;
  const extract = (idx: number): { full: string; body: string } | null => {
    const patterns = [
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?✍️?\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${idx + 1}\\][\\s\\S]*?답변:\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
    ];
    for (const p of patterns) {
      const m = result.match(p);
      if (m && m[1]) return { full: m[1], body: m[1].trim() };
    }
    return null;
  };

  const bigrams = (s: string): Set<string> => {
    const toks = tokenizeKorean(s);
    const set = new Set<string>();
    for (let i = 0; i < toks.length - 1; i++) set.add(`${toks[i]} ${toks[i + 1]}`);
    return set;
  };

  const banned = new Set<string>();
  // 질문 수를 동적으로 파악 (최대 10개로 제한)
  for (let i = 0; i < 10; i++) {
    const ext = extract(i);
    if (!ext) continue;
    const sentences = splitSentencesKorean(ext.body);
    const keep: string[] = [];
    for (const s of sentences) {
      const b = bigrams(s);
      let overlap = 0;
      for (const k of b) if (banned.has(k)) { overlap++; if (overlap >= 2) break; }
      if (overlap < 2) keep.push(s);
    }
    const filtered = keep.join(' ');
    result = result.replace(ext.full, filtered);
    // 누적 금지 bigram 갱신
    for (const s of keep) for (const k of bigrams(s)) banned.add(k);
  }

  return result;
}

// 문장 분할 및 정규화 유틸리티 (한국어 중심)
function splitSentencesKorean(text: string): string[] {
  const SEP = new RegExp(String.raw`(?:(?<=[\.!?…])\s+)|(?:(?<=[가-힣](?:다|요|죠|임|함|니다|습니까|니까|했다|했습니다))[\.\?]?\s+)`, 'g');
  return text
    .split(SEP)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeSentence(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function normalizeForSim(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^\)]*\)/g, ' ')
    .replace(/\d+(\.\d+)?%?/g, 'NUM')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokensKO(s: string): string[] {
  const stop = new Set(DIVERSITY_RULE?.stopwords || []);
  return normalizeForSim(s).split(' ').filter(w => w.length >= 2 && !stop.has(w));
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a); const B = new Set(b);
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

// 중복 문장 제거 및 괄호 내용 정리
function cleanupAnswers(content: string, questions: Array<{question: string, wordLimit?: number}>): string {
  let result = content;
  questions.forEach((_, index) => {
    const patterns = [
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?✍️?\\s*\\[답변 시작\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
      new RegExp(`\\[질문 ${index + 1}\\][\\s\\S]*?\\[답변\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[질문|$)`, 'i'),
    ];
    for (const pattern of patterns) {
      const match = result.match(pattern);
      if (!match || !match[1]) continue;
      let answer = match[1];

      // 1) 문장 단위 중복 제거 (정확/근사)
      const sentences = splitSentencesKorean(answer);
      console.log(`[DEBUG] Q${index + 1} 원본 문장 수: ${sentences.length}`);
      console.log(`[DEBUG] Q${index + 1} 첫 2문장:`, sentences.slice(0, 2));
      
      const unique: string[] = [];
      const seenTokens: string[][] = [];
      const seenBiSent = new Set<string>();
      
      for (let idx = 0; idx < sentences.length; idx++) {
        const s = sentences[idx];
        const norm = normalizeSentence(s);
        const t = tokensKO(norm);
        
        // 더 엄격한 중복 검사: 정확 일치 + 근사 유사도
        let isDup = false;
        
        // 1) 정확 일치 검사
        const exactMatch = unique.some(existing => normalizeSentence(existing) === norm);
        if (exactMatch) {
          console.log(`[DEBUG] Q${index + 1} 정확 일치 제거:`, s.substring(0, 50));
          isDup = true;
        }
        
        // 2) 근사 유사도 검사 (더 엄격하게)
        if (!isDup) {
          isDup = seenTokens.some(prev => jaccard(prev, t) >= 0.75); // 0.88 → 0.75로 더 엄격
          if (isDup) {
            console.log(`[DEBUG] Q${index + 1} 근사 유사도 제거:`, s.substring(0, 50));
          }
        }
        
        // 3) 연속 두 문장 단위(2-그램) 중복 검사
        if (!isDup && idx > 0) {
          const prev = normalizeSentence(sentences[idx - 1]);
          const biKey = `${tokensKO(prev).join(' ')} || ${tokensKO(norm).join(' ')}`;
          if (seenBiSent.has(biKey)) {
            console.log(`[DEBUG] Q${index + 1} 2-그램 중복 제거:`, s.substring(0, 50));
            isDup = true;
          }
        }
        
        if (!isDup) {
          if (unique.length > 0) {
            const prev = normalizeSentence(unique[unique.length - 1]);
            const biKey = `${tokensKO(prev).join(' ')} || ${tokensKO(norm).join(' ')}`;
            seenBiSent.add(biKey);
          }
          unique.push(s.trim());
          seenTokens.push(t);
        }
      }
      
      console.log(`[DEBUG] Q${index + 1} 중복 제거 후: ${unique.length}문장`);
      console.log(`[DEBUG] Q${index + 1} 중복 제거된 문장:`, sentences.filter((_, idx) => !unique.includes(sentences[idx])));
      answer = unique.length > 0 ? unique.join(' ') : answer;

      // 2) 과도한 괄호 내 보충 주석 제거: ( ... ) → 동일 문장 반복을 유발하는 괄호 부연 제거
      answer = answer.replace(/\s*\([^\)]{1,120}\)\s*/g, ' ');

      // 공백 정리
      answer = answer.replace(/\s{2,}/g, ' ').trim();

      result = result.replace(match[1], answer);
      break;
    }
  });
  return result;
}

// 모델이 헤더를 부분적으로만 지켰을 때 보정: [질문 N] 바로 뒤에 [답변 시작]이 없으면 삽입
function enforceAnswerHeaders(content: string, questions: Array<{ question: string; wordLimit?: number }>): string {
  let text = content;
  for (let i = 0; i < questions.length; i++) {
    const RE = new RegExp(String.raw`\[질문 ${i + 1}\][^\n]*`, 'i');
    text = text.replace(RE, (m: string) => /\[답변 시작\]/i.test(m) ? m : `${m}\n[답변 시작]`);
  }
  return text.replace(/\[답변 시작\](?:\s*\n\s*\[답변 시작\])+?/g, '[답변 시작]');
}

// 글자 수 검증 함수 (성능 최적화)
function validateWordLimits(content: string, questions: Array<{question: string, wordLimit?: number}>): string {
  const questionBlocks = content.split(/\[질문 \d+\]/).filter(block => block.trim());
  
  if (questionBlocks.length !== questions.length) {
    return content; // 검증 실패 시 원본 반환
  }

  let validatedContent = content;
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
      
      // 질문 제목에 글자 수 표시 (제한이 있는 경우에만)
      const hasExplicitLimit = typeof question.wordLimit === 'number' && question.wordLimit > 0;
      const questionTitle = `[질문 ${index + 1}] ${question.question}`;
      const questionWithCharCount = `${questionTitle} (답변: ${charCount}자/${wordLimit}자)`;
      if (hasExplicitLimit) {
        // 원본에서 질문 제목을 글자 수가 포함된 제목으로 교체
        validatedContent = validatedContent.replace(
          new RegExp(`\\[질문 ${index + 1}\\]\\s*${question.question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
          questionWithCharCount
        );
      }
      
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
        invalidAnswers.push({ 
          questionIndex: index, 
          actual: charCount, 
          minRequired: minRequired,
          maxAllowed: maxAllowed
        });
      }
      // minRequired 미만이거나 maxAllowed 초과인 경우 참고사항으로 표시
      else if (charCount < minRequired || charCount > maxAllowed) {
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

  // 이전에는 초과/부족 현황을 텍스트로 덧붙였으나, 이제는 강제 제한을 적용하므로 안내 문구를 추가하지 않습니다.

  return validatedContent;
}

// 문장 구조 개선: 가독성 향상을 위한 문장 분리 및 정리
function improveSentenceStructure(text: string): string {
  // 1) 너무 긴 문장을 적절한 길이로 분리
  let improved = text
    // 쉼표로만 연결된 긴 문장을 마침표로 분리
    .replace(/([가-힣]다|니다|습니다|습니다|죠|요|임|함)(\s*,\s*)([가-힣])/g, '$1. $3')
    // "또한", "추가로" 등으로 시작하는 부분을 새 문장으로 분리
    .replace(/(\s*)(또한|추가로|여기에|또한|그리고|또한|또한|또한)(\s*)/g, '. $2')
    // "~했습니다", "~했습니다" 등으로 끝나는 부분을 새 문장으로 분리
    .replace(/([가-힣]습니다|했습니다|했습니다)(\s*)([가-힣])/g, '$1. $3')
    // 연속된 쉼표를 마침표로 변경 (가독성 향상)
    .replace(/([가-힣]다|니다|습니다|습니다|죠|요|임|함)(\s*,\s*)([가-힣]다|니다|습니다|습니다|죠|요|임|함)/g, '$1. $3');

  // 2) 문장 길이 조정 (너무 긴 문장 분리)
  const sentences = improved.split(/[.!?]/).filter(s => s.trim());
  const optimizedSentences = sentences.map(sentence => {
    const trimmed = sentence.trim();
    if (trimmed.length > 80) { // 80자 이상 문장 분리
      // 쉼표나 접속사 위치에서 분리
      const splitPoints = [
        /,\s*(또한|추가로|여기에|그리고|또한|또한|또한|또한)/,
        /,\s*(그러나|하지만|그런데|반면에)/,
        /,\s*(예를 들어|구체적으로|실제로|현실적으로)/,
        /,\s*(결과적으로|따라서|그 결과|이를 통해)/
      ];
      
      for (const pattern of splitPoints) {
        if (pattern.test(trimmed)) {
          return trimmed.replace(pattern, '. $1');
        }
      }
      
      // 쉼표가 많은 경우 중간에서 분리
      const commas = (trimmed.match(/,/g) || []).length;
      if (commas >= 3) {
        const parts = trimmed.split(',');
        const midPoint = Math.floor(parts.length / 2);
        const firstPart = parts.slice(0, midPoint).join(',');
        const secondPart = parts.slice(midPoint).join(',');
        return `${firstPart}. ${secondPart}`;
      }
    }
    return trimmed;
  });

  // 3) 최종 정리
  return optimizedSentences
    .filter(s => s.trim())
    .join('. ')
    .replace(/\.\s*\./g, '.') // 연속된 마침표 정리
    .replace(/\s+/g, ' ') // 연속된 공백 정리
    .trim();
}

