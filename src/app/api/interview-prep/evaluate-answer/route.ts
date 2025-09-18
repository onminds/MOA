import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';
import { checkUsageLimit, incrementUsage } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnswerEvaluationRequest {
  question: string;
  answer: string;
  category: string;
  jobTitle: string;
  companyName: string;
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    


    const {
      question,
      answer,
      category,
      jobTitle,
      companyName
    }: AnswerEvaluationRequest = await request.json();

    if (!question || !answer) {
      return NextResponse.json({ error: '질문과 답변을 입력해주세요.' }, { status: 400 });
    }

    if (answer.trim().length < 10) {
      return NextResponse.json({ error: '답변이 너무 짧습니다. 더 자세히 작성해주세요.' }, { status: 400 });
    }

    console.log('답변 평가 시작:', { question, category, answerLength: answer.length });

    const evaluation = await evaluateAnswer({
      question,
      answer,
      category,
      jobTitle,
      companyName
    });

    return NextResponse.json({
      success: true,
      evaluation
    });

  } catch (error) {
    console.error('답변 평가 오류:', error);
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: '답변 평가 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

async function evaluateAnswer({
  question,
  answer,
  category,
  jobTitle,
  companyName
}: AnswerEvaluationRequest) {
  const systemPrompt = `당신은 면접 전문가이자 HR 컨설턴트입니다. 주어진 면접 질문에 대한 지원자의 답변을 평가하고 구체적인 피드백을 제공해주세요.

평가 기준:
1. 명확성: 답변이 명확하고 이해하기 쉬운가?
2. 구체성: 구체적인 사례나 수치가 포함되어 있는가?
3. 관련성: 질문과 직무에 관련된 내용인가?
4. 구조화: 논리적으로 잘 구성되어 있는가?
5. 전달력: 설득력 있고 인상적인가?

각 항목을 1-10점으로 평가하고, 전체 점수는 평균으로 계산해주세요.

응답 형식은 반드시 다음 JSON 형태로만 제공하세요:
{
  "totalScore": 전체점수(1-10),
  "scores": {
    "clarity": 명확성점수(1-10),
    "specificity": 구체성점수(1-10),
    "relevance": 관련성점수(1-10),
    "structure": 구조화점수(1-10),
    "impact": 전달력점수(1-10)
  },
  "strengths": ["강점1", "강점2", "강점3"],
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "recommendations": ["추천사항1", "추천사항2", "추천사항3"],
  "improvedExample": "개선된 답변 예시 (200-300자)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  const userPrompt = `
면접 정보:
- 회사: ${companyName}
- 직무: ${jobTitle}
- 질문 카테고리: ${category}

질문: ${question}

지원자 답변: ${answer}

위 답변을 평가하고 피드백을 제공해주세요.`;

  console.log('OpenAI API 호출 시작...', {
    questionLength: question.length,
    answerLength: answer.length,
    category,
    jobTitle,
    companyName
  });

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 1500,
    });
  } catch (apiError) {
    console.error('OpenAI API 호출 오류:', apiError);
    console.log('기본 평가로 대체합니다.');
    return getDefaultEvaluation(answer);
  }

  console.log('OpenAI API 응답 받음:', {
    choices: completion.choices?.length,
    finishReason: completion.choices?.[0]?.finish_reason,
    hasContent: !!completion.choices?.[0]?.message?.content
  });

  const response = completion.choices?.[0]?.message?.content;
  
  if (!response) {
    console.error('OpenAI 응답이 비어있음:', {
      completion: JSON.stringify(completion, null, 2)
    });
    console.log('기본 평가로 대체합니다.');
    return getDefaultEvaluation(answer);
  }

  console.log('응답 내용 길이:', response.length);

  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    
    // 파싱 실패 시 기본 평가 반환
    return getDefaultEvaluation(answer);
  }
}

// 기본 평가 (API 실패 시 백업용)
function getDefaultEvaluation(answer: string) {
  const wordCount = answer.trim().split(/\s+/).length;
  const hasNumbers = /\d/.test(answer);
  const hasExamples = answer.includes('예를 들어') || answer.includes('예시') || answer.includes('사례');
  
  let totalScore = 5; // 기본 점수
  
  if (wordCount > 50) totalScore += 1;
  if (wordCount > 100) totalScore += 1;
  if (hasNumbers) totalScore += 1;
  if (hasExamples) totalScore += 1;
  
  totalScore = Math.min(10, totalScore);
  
  return {
    totalScore,
    scores: {
      clarity: totalScore,
      specificity: hasNumbers || hasExamples ? totalScore : totalScore - 1,
      relevance: totalScore,
      structure: wordCount > 50 ? totalScore : totalScore - 1,
      impact: totalScore
    },
    strengths: [
      '질문에 성실히 답변하셨습니다',
      '기본적인 내용을 포함하고 있습니다'
    ],
    improvements: [
      '더 구체적인 사례나 수치를 포함해보세요',
      'STAR 기법을 활용해 구조화된 답변을 해보세요',
      '답변의 길이를 조금 더 늘려보세요'
    ],
    recommendations: [
      'Situation, Task, Action, Result 순서대로 답변을 구성해보세요',
      '구체적인 성과나 수치를 포함하여 신뢰성을 높이세요',
      '지원 직무와의 연관성을 더 명확히 표현해보세요'
    ],
    improvedExample: '답변을 개선하려면 구체적인 상황, 맡은 업무, 취한 행동, 그리고 결과를 순서대로 설명하는 STAR 기법을 활용해보세요. 또한 구체적인 수치나 성과를 포함하여 더욱 설득력 있는 답변을 만들 수 있습니다.'
  };
}
