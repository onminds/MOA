import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PPTDraftRequest {
  topic: string;
  presentationType: 'business' | 'academic' | 'educational' | 'sales' | 'project';
  targetAudience?: string;
  duration: number;
  keyPoints?: string;
  objectives?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      presentationType,
      targetAudience,
      duration,
      keyPoints,
      objectives
    }: PPTDraftRequest = await request.json();

    if (!topic) {
      return NextResponse.json(
        { success: false, error: '발표 주제를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('PPT 초안 생성 시작:', { topic, presentationType, duration });

    const result = await generatePPTDraft({
      topic,
      presentationType,
      targetAudience,
      duration,
      keyPoints,
      objectives
    });

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('PPT 초안 생성 오류:', error);
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false,
      error: 'PPT 초안 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

async function generatePPTDraft({
  topic,
  presentationType,
  targetAudience,
  duration,
  keyPoints,
  objectives
}: PPTDraftRequest) {
  
  const presentationTypeDescriptions = {
    business: '비즈니스 프레젠테이션 - 전문적이고 간결하며 데이터 중심',
    academic: '학술 발표 - 논리적이고 체계적이며 근거 중심',
    educational: '교육용 자료 - 이해하기 쉽고 단계적이며 실습 중심',
    sales: '영업/마케팅 - 설득력 있고 매력적이며 고객 중심',
    project: '프로젝트 발표 - 구체적이고 일정 중심이며 결과 지향'
  };

  // 발표 시간에 따른 슬라이드 수 계산 (대략 1분당 1-2슬라이드)
  const estimatedSlideCount = Math.max(3, Math.min(20, Math.ceil(duration * 1.5)));

  const systemPrompt = `당신은 전문적인 프레젠테이션 기획자입니다. 주어진 정보를 바탕으로 ${presentationTypeDescriptions[presentationType]} 스타일의 PPT 초안을 작성해주세요.

발표 시간: ${duration}분 (권장 슬라이드 수: ${estimatedSlideCount}개)
${targetAudience ? `대상 청중: ${targetAudience}` : ''}
${keyPoints ? `핵심 포함 내용: ${keyPoints}` : ''}
${objectives ? `발표 목적: ${objectives}` : ''}

응답 형식은 반드시 다음 JSON 형태로만 제공하세요:
{
  "title": "발표 제목",
  "subtitle": "발표 부제목",
  "outline": ["목차 항목1", "목차 항목2", "목차 항목3"],
  "chapters": [
    {
      "id": 1,
      "title": "챕터 제목",
      "description": "챕터 설명",
      "slideCount": 2,
      "color": "#3B82F6"
    }
  ],
  "slides": [
    {
      "id": 1,
      "title": "슬라이드 제목",
      "content": ["핵심 포인트1", "핵심 포인트2", "핵심 포인트3"],
      "notes": "발표자 노트 (선택사항)",
      "chapterId": 1,
      "layout": "content"
    }
  ],
  "designSuggestions": ["디자인 제안1", "디자인 제안2", "디자인 제안3"],
  "presentationTips": ["발표 팁1", "발표 팁2", "발표 팁3"],
  "estimatedDuration": "예상 발표 시간"
}

각 슬라이드는 다음 구조를 고려하세요:
1. 제목 슬라이드 (제목, 발표자, 날짜)
2. 목차/개요
3. 문제 제기 또는 배경
4. 핵심 내용 (여러 슬라이드로 분할)
5. 결론/요약
6. Q&A (필요시)

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  const userPrompt = `
주제: ${topic}
발표 유형: ${presentationType}
발표 시간: ${duration}분
${targetAudience ? `대상 청중: ${targetAudience}` : ''}
${keyPoints ? `꼭 포함할 내용: ${keyPoints}` : ''}
${objectives ? `발표 목적: ${objectives}` : ''}

위 정보를 바탕으로 ${presentationTypeDescriptions[presentationType]} 스타일의 완전한 PPT 초안을 작성해주세요.
각 슬라이드는 구체적이고 실용적인 내용으로 구성하되, 발표 시간(${duration}분)에 맞는 적절한 분량으로 조절해주세요.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
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
    max_tokens: 4000,
    temperature: 0.7, // 창의성을 위해 적당한 값 사용
  });

  const response = completion.choices[0].message.content;
  
  if (!response) {
    throw new Error('PPT 초안 응답이 없습니다.');
  }

  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    
    // 파싱 실패 시 기본 응답 반환
    return getDefaultPPTDraft(topic, presentationType, duration);
  }
}

// 기본 PPT 초안 (API 실패 시 백업용)
function getDefaultPPTDraft(topic: string, presentationType: string, duration: number) {
  return {
    title: topic,
    subtitle: "AI가 생성한 프레젠테이션 초안",
    outline: [
      "소개",
      "현황 분석",
      "핵심 내용",
      "결론 및 제안",
      "Q&A"
    ],
    chapters: [
      {
        id: 1,
        title: "도입부",
        description: "발표 시작과 주제 소개",
        slideCount: 2,
        color: "#3B82F6"
      },
      {
        id: 2,
        title: "본론",
        description: "핵심 내용 전달",
        slideCount: 1,
        color: "#10B981"
      },
      {
        id: 3,
        title: "마무리",
        description: "결론 및 정리",
        slideCount: 1,
        color: "#F59E0B"
      }
    ],
    slides: [
      {
        id: 1,
        title: "제목 슬라이드",
        content: [topic, "발표자: [이름]", "날짜: [날짜]"],
        notes: "청중에게 인사하고 발표 주제를 소개합니다.",
        chapterId: 1,
        layout: "title"
      },
      {
        id: 2,
        title: "목차",
        content: ["발표 개요", "주요 내용", "결론", "Q&A"],
        notes: "발표의 전체 구성을 설명합니다.",
        chapterId: 1,
        layout: "content"
      },
      {
        id: 3,
        title: "핵심 내용",
        content: ["주요 포인트 1", "주요 포인트 2", "주요 포인트 3"],
        notes: "핵심 내용을 명확하게 전달합니다.",
        chapterId: 2,
        layout: "content"
      },
      {
        id: 4,
        title: "결론",
        content: ["요약", "향후 계획", "감사 인사"],
        notes: "발표 내용을 정리하고 마무리합니다.",
        chapterId: 3,
        layout: "content"
      }
    ],
    designSuggestions: [
      "깔끔하고 전문적인 템플릿 사용",
      "일관된 색상 테마 적용",
      "가독성 좋은 폰트 선택",
      "적절한 이미지와 차트 활용"
    ],
    presentationTips: [
      "청중과 아이컨택 유지하기",
      "명확하고 천천히 말하기",
      "핵심 포인트 강조하기",
      "시간 관리에 주의하기"
    ],
    estimatedDuration: `${duration}분`
  };
} 