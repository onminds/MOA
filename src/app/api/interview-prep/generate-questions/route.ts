import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';
import { checkUsageLimit, incrementUsage } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface QuestionRequest {
  companyName: string;
  jobTitle: string;
  careerLevel: 'junior' | 'mid' | 'senior';
  jobDescription?: string;
  experience?: string;
  skills?: string;
  companyAnalysis?: {
    coreValues: string[];
    idealCandidate: string;
    vision: string;
    businessAreas: string[];
    companyCulture: string;
    keyCompetencies: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    
    // 사용량 체크
    const usageCheck = await checkUsageLimit(user.id, 'interview-prep');
    if (!usageCheck.allowed) {
      return NextResponse.json({ 
        error: '면접 준비 사용량 한도에 도달했습니다.',
        currentUsage: usageCheck.limit - usageCheck.remaining,
        maxLimit: usageCheck.limit,
        resetDate: usageCheck.resetDate
      }, { status: 429 });
    }

    const {
      companyName,
      jobTitle,
      careerLevel,
      jobDescription,
      experience,
      skills,
      companyAnalysis
    }: QuestionRequest = await request.json();

    if (!companyName || !jobTitle) {
      return NextResponse.json({ error: '회사명과 직무명을 입력해주세요.' }, { status: 400 });
    }

    console.log('면접 질문 생성 시작:', { companyName, jobTitle, careerLevel });

    const questions = await generateInterviewQuestions({
      companyName,
      jobTitle,
      careerLevel,
      jobDescription,
      experience,
      skills,
      companyAnalysis
    });

    // 사용량 증가
    await incrementUsage(user.id, 'interview-prep');

    // 증가된 사용량 정보 가져오기
    const updatedUsageCheck = await checkUsageLimit(user.id, 'interview-prep');

    return NextResponse.json({
      success: true,
      questions,
      totalCount: questions.length,
      // 사용량 정보 추가
      usage: {
        current: updatedUsageCheck.limit - updatedUsageCheck.remaining,
        limit: updatedUsageCheck.limit,
        remaining: updatedUsageCheck.remaining
      }
    });

  } catch (error) {
    console.error('면접 질문 생성 오류:', error);
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: '면접 질문 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

async function generateInterviewQuestions({
  companyName,
  jobTitle,
  careerLevel,
  jobDescription,
  experience,
  skills,
  companyAnalysis
}: QuestionRequest) {
  // JSON 응답 안전 파싱 유틸리티
  function cleanAndExtractJson(raw: string): string | null {
    if (!raw) return null;
    let text = raw.trim();

    // 코드펜스 제거
    text = text.replace(/```json\s*/gi, '').replace(/```/g, '');

    // JSON 블록 정규식으로 1차 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let candidate = jsonMatch ? jsonMatch[0] : text;

    // 스마트 따옴표 정규화
    candidate = candidate
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"');

    // 제어문자 정리
    candidate = candidate
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
      .replace(/\u0000/g, '')
      .replace(/\u0001/g, '')
      .replace(/\u0002/g, '')
      .replace(/\u0003/g, '')
      .replace(/\u0004/g, '')
      .replace(/\u0005/g, '')
      .replace(/\u0006/g, '')
      .replace(/\u0007/g, '')
      .replace(/\u0008/g, '')
      .replace(/\u000B/g, '')
      .replace(/\u000C/g, '')
      .replace(/\u000E/g, '')
      .replace(/\u000F/g, '');

    // 마지막 쉼표 제거
    candidate = candidate.replace(/,\s*([}\]])/g, '$1');

    // 비표준 따옴표로 감싼 키를 가능하면 표준화 (간단 케이스)
    // 예: {id:1} -> {"id":1}
    candidate = candidate.replace(/([,{\s])([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

    return candidate.trim();
  }
  const careerLevelText = {
    junior: '신입/주니어 (0-2년)',
    mid: '미드레벨 (3-7년)',
    senior: '시니어 (8년+)'
  };

  const companyInfoSection = companyAnalysis ? `
회사 분석 정보:
- 핵심가치: ${companyAnalysis.coreValues.join(', ')}
- 인재상: ${companyAnalysis.idealCandidate}
- 비전/미션: ${companyAnalysis.vision}
- 주요 사업분야: ${companyAnalysis.businessAreas.join(', ')}
- 회사문화: ${companyAnalysis.companyCulture}
- 중요 역량: ${companyAnalysis.keyCompetencies.join(', ')}` : '';

  const systemPrompt = `당신은 한국 최고의 채용 전문가이자 면접관입니다. 지원자의 정보와 회사 정보를 바탕으로, 실제 면접과 같이 날카롭고 깊이 있는 질문과, 그에 맞는 매우 구체적이고 실용적인 답변 팁을 생성해주세요.

지원자 정보:
- 회사: ${companyName}
- 직무: ${jobTitle}
- 경력 수준: ${careerLevelText[careerLevel]}
${jobDescription ? `- 직무 설명: ${jobDescription}` : ''}
${experience ? `- 주요 경험: ${experience}` : ''}
${skills ? `- 핵심 스킬: ${skills}` : ''}${companyInfoSection}

**질문 및 팁 생성 지침:**

1.  **질문 생성:**
    *   총 8~10개의 질문을 생성합니다.
    *   자기소개, 지원동기, 직무 전문성, 문제 해결 능력, 협업/소통, 성격 및 가치관, 미래 계획 등 다양한 카테고리를 포함해야 합니다.
    *   특히, 지원자의 경험과 회사의 특성(핵심가치, 인재상, 사업분야)을 직접적으로 연결하는 **'맞춤형 꼬리 질문'**을 반드시 포함하세요. (예: "OO 프로젝트 경험이 저희 회사의 핵심 가치인 '도전'과 어떻게 연결되는지 구체적으로 설명해주세요.")
    *   경력 수준에 맞는 난이도와 깊이로 질문을 조절해야 합니다. (신입에게는 잠재력을, 경력직에게는 전문성과 성과를 확인)

2.  **답변 팁 생성 (매우 중요):**
    *   각 질문마다 **행동을 유도하는 구체적인 팁 3가지**를 제공해야 합니다.
    *   **추상적인 조언 ("열심히 하세요", "긍정적으로 답변하세요")은 절대 금지합니다.**
    *   **모든 경험 기반 질문의 팁에는 반드시 'STAR 기법'을 언급하고 설명해야 합니다.**
        *   **S (Situation):** 어떤 상황이었는지 구체적인 배경을 설명하세요.
        *   **T (Task):** 당신의 역할과 목표는 무엇이었나요?
        *   **A (Action):** 그래서 당신이 '실제로 한 행동'은 무엇이었나요?
        *   **R (Result):** 그 행동의 결과는 어땠나요? (가능하면 숫자로 표현: 예: '매출 15% 증가', '업무 시간 20% 단축')
    *   **질문 유형별 팁 예시:**
        *   **지원 동기 팁:** "'${companyName}의 [핵심 가치]'와 자신의 [경험/강점]을 연결하여, 단순한 팬이 아닌 기여할 수 있는 인재임을 어필하세요."
        *   **문제 해결 팁:** "문제를 어떻게 정의했고, 해결 방안을 찾기 위해 어떤 기준을 세웠는지 논리적인 순서로 설명하는 것이 중요합니다."
        *   **협업 팁:** "자신의 의견만 주장하기보다, 동료와 의견 차이가 있을 때 '공동의 목표'를 위해 어떻게 조율했는지 과정을 보여주세요."
        *   **강점/약점 팁:** "강점은 [직무/회사의 인재상]과 연결하고, 약점은 이를 극복하기 위해 '현재 어떤 노력을 하고 있는지'를 함께 제시하세요."
    *   회사 분석 정보가 있다면, **팁에 해당 정보를 직접적으로 활용**하세요. (예: "'${companyAnalysis?.keyCompetencies[0]}' 역량을 보여줄 수 있는 경험을 STAR 기법으로 설명해보세요.")
    *   **지원자의 직무 특성을 반영한 팁을 반드시 포함하세요.**
        *   **(예: 개발자 직무라면)** "답변 시 사용했던 기술 스택의 버전과 그 기술을 선택한 이유를 함께 설명하여 전문성을 어필하세요."
        *   **(예: 마케터 직무라면)** "캠페인의 성공 여부를 어떤 핵심 지표(KPI)로 측정했고, 실제 데이터 기반의 성과가 어땠는지 수치로 보여주는 것이 중요합니다."
        *   **(예: 디자이너 직무라면)** "자신의 디자인 철학을 설명하고, 제출하신 포트폴리오의 어떤 작업물에서 그 철학이 잘 드러나는지 연결하여 설명해보세요."

**출력 형식 (반드시 엄수):**

"questions"라는 키를 가진 JSON 객체 형식으로만 응답해야 합니다. 다른 텍스트나 설명은 절대 포함하지 마세요.

\`\`\`json
{
  "questions": [
    {
      "id": 1,
      "category": "지원동기",
      "question": "왜 다른 많은 회사들 중에서도 저희 ${companyName}에 지원하셨나요? 그리고 ${jobTitle} 직무를 통해 회사에 어떻게 기여하고 싶으신가요?",
      "difficulty": "medium",
      "tips": [
        "회사의 최신 뉴스나 제품, 비전을 언급하며 얼마나 깊이 있는 관심을 가졌는지 보여주세요.",
        "${companyName}의 '${companyAnalysis?.coreValues[0] || '핵심 가치'}'와 자신의 가치관이 어떻게 부합하는지 구체적인 경험과 연결하여 설명하세요.",
        "자신이 가진 '${skills?.split(',')[0] || '핵심 스킬'}'을 활용하여 ${jobTitle} 직무에서 어떤 성과를 낼 수 있을지 구체적인 계획을 제시하세요."
      ]
    }
  ]
}
\`\`\`
`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `위 지침에 따라 ${companyName}의 ${jobTitle} 직무(${careerLevelText[careerLevel]}) 면접 질문과 팁을 생성해주세요. 반드시 "questions" 키를 가진 JSON 객체로만 응답하세요.` }
      ],
      response_format: { type: 'json_object' }
    });

    const result = completion.choices[0]?.message?.content as string | undefined;
    if (!result) {
      throw new Error('질문 생성 결과를 받지 못했습니다.');
    }
    
    let parsedResult: any;
    try {
      parsedResult = JSON.parse(result);
    } catch (_e) {
      const cleaned = cleanAndExtractJson(result);
      if (!cleaned) {
        throw new Error('유효한 JSON 응답을 추출하지 못했습니다.');
      }
      try {
        parsedResult = JSON.parse(cleaned);
      } catch (e2) {
        console.error('JSON 정리 후에도 파싱 실패:', e2);
        throw new Error('질문 목록 JSON 파싱에 실패했습니다.');
      }
    }
    // 안정성 강화: GPT가 반환할 수 있는 다양한 형식을 모두 처리 (e.g., {questions: [...]}, {response: [...]}, [...])
    const questions = parsedResult.questions || parsedResult.response || (Array.isArray(parsedResult) ? parsedResult : null);

    if (!Array.isArray(questions)) {
      console.error("GPT 응답에서 질문 배열을 찾을 수 없습니다:", parsedResult);
      throw new Error("잘못된 형식의 질문 목록을 받았습니다.");
    }
    
    return questions;

  } catch (error) {
    console.error('OpenAI API 호출 오류:', error);
    throw error;
  }
}
