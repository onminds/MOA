import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

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

interface InterviewQuestion {
  category: string;
  question: string;
  difficulty: 'easy' | 'medium' | 'hard';
  tips: string[];
}

export async function POST(request: NextRequest) {
  try {
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

    // 경력 수준별 맞춤 질문 생성
    const questions = await generateInterviewQuestions({
      companyName,
      jobTitle,
      careerLevel,
      jobDescription,
      experience,
      skills,
      companyAnalysis
    });

    return NextResponse.json({
      success: true,
      questions,
      totalCount: questions.length
    });

  } catch (error) {
    console.error('면접 질문 생성 오류:', error);
    
    // OpenAI API 에러 처리
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
  const careerLevelText = {
    junior: '신입/주니어 (0-2년)',
    mid: '미드레벨 (3-7년)',
    senior: '시니어 (8년+)'
  };

  const companyInfoSection = companyAnalysis ? `

회사 분석 정보 (공식 사이트 조사 결과):
- 핵심가치: ${companyAnalysis.coreValues.join(', ')}
- 인재상: ${companyAnalysis.idealCandidate}
- 비전/미션: ${companyAnalysis.vision}
- 주요 사업분야: ${companyAnalysis.businessAreas.join(', ')}
- 회사문화: ${companyAnalysis.companyCulture}
- 중요 역량: ${companyAnalysis.keyCompetencies.join(', ')}` : '';

  const systemPrompt = `당신은 면접 전문가입니다. 지원자의 정보와 회사 공식 사이트에서 분석한 정보를 바탕으로 실제 면접에서 나올 가능성이 높은 맞춤형 질문을 생성해주세요.

지원자 정보:
- 회사: ${companyName}
- 직무: ${jobTitle}
- 경력 수준: ${careerLevelText[careerLevel]}
${jobDescription ? `- 직무 설명: ${jobDescription}` : ''}
${experience ? `- 주요 경험: ${experience}` : ''}
${skills ? `- 핵심 스킬: ${skills}` : ''}${companyInfoSection}

질문 생성 규칙:
1. 총 8-10개의 질문을 생성하세요
2. 다음 카테고리들을 포함하세요: 자기소개, 지원동기, 기술/전문성, 문제해결, 협업/소통, 미래계획, 상황대처
3. 경력 수준에 맞는 적절한 난이도로 조정하세요
4. 실제 ${companyName}의 ${jobTitle} 면접에서 나올만한 현실적인 질문으로 구성하세요
5. 회사 분석 정보가 있다면 해당 회사의 핵심가치, 인재상, 문화에 맞는 질문을 포함하세요
6. 각 질문마다 실용적인 답변 팁을 3개씩 제공하세요${companyAnalysis ? 
`\n7. 특히 "${companyAnalysis.coreValues.join(', ')}"와 관련된 질문과 "${companyAnalysis.keyCompetencies.join(', ')}" 역량을 평가할 수 있는 질문을 포함하세요` : ''}

응답 형식은 반드시 다음 JSON 배열 형태로만 제공하세요:
[
  {
    "category": "카테고리명",
    "question": "면접 질문",
    "difficulty": "easy|medium|hard",
    "tips": ["팁1", "팁2", "팁3"]
  }
]

JSON 배열만 응답하고 다른 텍스트는 포함하지 마세요.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: `${companyName}의 ${jobTitle} 직무에 지원하는 ${careerLevelText[careerLevel]} 지원자를 위한 면접 질문을 생성해주세요.`
      }
    ],
    max_tokens: 2000,
    temperature: 0.7, // 창의적이면서도 일관성 있는 질문 생성
  });

  const response = completion.choices[0].message.content;
  
  if (!response) {
    throw new Error('질문 생성 응답이 없습니다.');
  }

  try {
    // JSON 파싱
    const questions = JSON.parse(response) as InterviewQuestion[];
    
    // ID 추가하여 반환
    return questions.map((q: InterviewQuestion, index: number) => ({
      id: index + 1,
      ...q
    }));
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    
    // 파싱 실패 시 기본 질문 반환
    return getDefaultQuestions(companyName, jobTitle);
  }
}

// 기본 질문 (API 실패 시 백업용)
function getDefaultQuestions(companyName: string, jobTitle: string) {
  return [
    {
      id: 1,
      category: '자기소개',
      question: '간단히 자기소개를 해주세요.',
      difficulty: 'easy',
      tips: [
        '1-2분 내외로 간결하게 설명하세요',
        '지원 직무와 관련된 경험을 중심으로 말하세요',
        '회사에 어떤 가치를 제공할 수 있는지 포함하세요'
      ]
    },
    {
      id: 2,
      category: '지원 동기',
      question: `왜 ${companyName}에서 ${jobTitle} 직무를 지원하셨나요?`,
      difficulty: 'medium',
      tips: [
        '회사의 비전과 본인의 목표가 어떻게 일치하는지 설명하세요',
        '구체적인 사례나 경험을 들어 설명하세요',
        '단순한 복리후생보다는 성장 가능성에 중점을 두세요'
      ]
    },
    {
      id: 3,
      category: '기술/전문성',
      question: `${jobTitle} 직무에 필요한 핵심 역량은 무엇이라고 생각하시나요?`,
      difficulty: 'medium',
      tips: [
        '직무 분석을 통해 파악한 핵심 역량을 언급하세요',
        '본인이 보유한 관련 경험이나 스킬을 연결하세요',
        '지속적인 학습 의지를 보여주세요'
      ]
    },
    {
      id: 4,
      category: '문제 해결',
      question: '업무 중 가장 어려웠던 문제와 그것을 어떻게 해결했는지 말씀해주세요.',
      difficulty: 'hard',
      tips: [
        'STAR 기법을 활용하세요 (Situation, Task, Action, Result)',
        '구체적인 수치나 결과를 포함하세요',
        '본인의 역할과 기여도를 명확히 하세요'
      ]
    },
    {
      id: 5,
      category: '미래 계획',
      question: '5년 후 본인의 모습을 어떻게 그리고 계시나요?',
      difficulty: 'medium',
      tips: [
        '현실적이면서도 도전적인 목표를 제시하세요',
        '회사의 성장과 함께하는 모습을 그려주세요',
        '구체적인 계획과 준비 과정을 언급하세요'
      ]
    }
  ];
} 