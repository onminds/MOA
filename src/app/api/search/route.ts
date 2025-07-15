import { NextRequest, NextResponse } from 'next/server';

// 샘플 AI 서비스 데이터
const sample_ai_services = [
  {
    id: 1,
    name: "ChatGPT",
    description: "OpenAI의 대화형 AI 모델로 텍스트 생성 및 대화 기능을 제공합니다.",
    category: "챗봇",
    rating: 4.8,
    url: "https://chat.openai.com",
    features: ["텍스트 생성", "대화", "코딩 도움", "번역"]
  },
  {
    id: 2,
    name: "Midjourney",
    description: "AI 기반 이미지 생성 서비스로 고품질의 예술적 이미지를 생성합니다.",
    category: "이미지 생성",
    rating: 4.7,
    url: "https://midjourney.com",
    features: ["이미지 생성", "예술적 스타일", "고해상도"]
  },
  {
    id: 3,
    name: "Claude",
    description: "Anthropic의 안전하고 유용한 AI 어시스턴트입니다.",
    category: "텍스트 생성",
    rating: 4.6,
    url: "https://claude.ai",
    features: ["텍스트 생성", "분석", "안전성", "대화"]
  },
  {
    id: 4,
    name: "DALL-E",
    description: "OpenAI의 이미지 생성 AI로 텍스트 설명으로부터 이미지를 생성합니다.",
    category: "이미지 생성",
    rating: 4.5,
    url: "https://openai.com/dall-e-2",
    features: ["이미지 생성", "텍스트 기반", "다양한 스타일"]
  }
];

export async function POST(request: NextRequest) {
  try {
    const { query, category } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    const searchQuery = query.toLowerCase();
    const results = [];

    for (const service of sample_ai_services) {
      // 카테고리 필터링
      if (category && service.category !== category) {
        continue;
      }

      // 검색어 매칭
      if (
        searchQuery.includes(service.name.toLowerCase()) ||
        searchQuery.includes(service.description.toLowerCase()) ||
        service.features.some(feature => 
          searchQuery.includes(feature.toLowerCase())
        )
      ) {
        results.push(service);
      }
    }

    return NextResponse.json({
      results,
      total: results.length
    });

  } catch (error) {
    console.error('Search API Error:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 