import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SNSRequest {
  platform: string;
  contentType: string;
  topic: string;
  keywords?: string;
  targetAudience?: string;
  tone: string;
  includeHashtags: boolean;
  includeEmoji: boolean;
  charLimit: number;
  platforms?: string[]; // 다중 플랫폼 생성용
}

interface PlatformInfo {
  name: string;
  style: string;
  features: string[];
  guidelines: string;
  maxHashtags: number;
  hasTitle?: boolean;
}

const platformInstructions: Record<string, PlatformInfo> = {
  instagram: {
    name: '인스타그램',
    style: '감성적이고 시각적인 스토리텔링에 중점을 두며, 라이프스타일과 브랜드 스토리를 자연스럽게 전달합니다. 과도한 이모지보다는 진정성 있는 텍스트를 선호합니다.',
    features: ['진정성 있는 스토리', '라이프스타일 중심', '브랜드 스토리', '시각적 컨텐츠 설명'],
    guidelines: '• 이모지는 1-2개만 사용 • 해시태그는 의미있는 것만 선별 • 개인적이고 진솔한 톤 • 시각적 요소에 대한 설명 포함',
    maxHashtags: 12
  },
  twitter: {
    name: '트위터(X)',
    style: '간결하고 명확한 메시지 전달에 집중합니다. 시사적이고 즉시성 있는 내용으로 토론과 공감을 유도하며, 불필요한 장식보다는 핵심 메시지를 강조합니다.',
    features: ['간결한 메시지', '즉시성', '토론 유도', '핵심 정보 전달'],
    guidelines: '• 이모지 사용 최소화 • 명확하고 직설적인 표현 • 질문이나 의견 요청으로 참여 유도 • 뉴스나 트렌드와 연관성',
    maxHashtags: 2
  },
  facebook: {
    name: '페이스북',
    style: '친근하고 개인적인 톤으로 일상과 경험을 공유합니다. 가족, 친구들과의 소통을 중심으로 하며 따뜻하고 인간적인 메시지를 전달합니다.',
    features: ['개인적 경험 공유', '일상 이야기', '소통과 공감', '따뜻한 톤'],
    guidelines: '• 이모지는 감정 표현용으로 1-2개만 • 개인적인 경험과 감정 공유 • 친구들과의 소통 유도 • 진솔하고 따뜻한 어조',
    maxHashtags: 3
  },
  linkedin: {
    name: '링크드인',
    style: '전문적이고 비즈니스 중심의 인사이트를 제공합니다. 업계 경험과 전문 지식을 바탕으로 한 가치있는 콘텐츠로 네트워킹과 비즈니스 성장에 기여합니다.',
    features: ['전문적 인사이트', '비즈니스 가치', '업계 경험 공유', '전문성 강화'],
    guidelines: '• 이모지 사용 금지 (전문성 유지) • 비즈니스 관련 용어 적절히 사용 • 경험과 학습 내용 공유 • 업계 동료들과의 토론 유도',
    maxHashtags: 3
  },
  youtube: {
    name: '유튜브',
    style: '제목은 SEO를 고려한 간결하고 매력적인 키워드 중심으로, 설명은 영상 내용을 상세히 설명하고 시청자 참여를 유도합니다.',
    features: ['제목: 간결하고 매력적', '설명: 상세한 내용 설명', 'SEO 최적화', '시청자 참여 유도'],
    guidelines: '• 제목: 60자 이내, 키워드 포함, 매력적인 표현 • 설명: 영상 내용 상세 설명, 타임스탬프, CTA 포함 • 이모지는 섹션 구분용으로만 최소 사용',
    maxHashtags: 8,
    hasTitle: true
  },
  tiktok: {
    name: '틱톡',
    style: '젊고 트렌디한 톤으로 짧고 임팩트 있는 메시지를 전달합니다. 최신 트렌드와 챌린지를 활용하되, 과도한 이모지보다는 재치있는 텍스트로 주목도를 높입니다.',
    features: ['트렌드 활용', '짧고 임팩트 있는 메시지', '젊은 감성', '바이럴 요소'],
    guidelines: '• 이모지는 포인트용으로 1개만 • 트렌드와 밈 활용 • 짧고 기억하기 쉬운 문구 • Z세대 언어와 표현 사용',
    maxHashtags: 5
  }
};

const contentTypeInstructions = {
  promotion: '홍보나 마케팅 목적으로 제품/서비스의 장점을 어필하고 구매를 유도합니다.',
  education: '교육적 가치를 제공하며 유용한 정보나 팁을 공유합니다.',
  entertainment: '재미있고 즐거운 내용으로 사용자의 관심을 끕니다.',
  news: '최신 소식이나 업데이트를 알리며 정보를 전달합니다.',
  personal: '개인적인 경험이나 스토리를 진솔하게 공유합니다.',
  business: '비즈니스나 업무와 관련된 전문적인 내용을 다룹니다.'
};

// 유튜브 제목 생성 함수
async function generateYouTubeTitle(topic: string, keywords: string, tone: string, contentInfo: string) {
  const titlePrompt = `유튜브 영상 제목을 생성해주세요.

**요구사항:**
- 주제: ${topic}
${contentInfo ? `- 콘텐츠 유형: ${contentInfo}` : ''}
${keywords ? `- 키워드: ${keywords}` : ''}
- 톤앤매너: ${tone}

**제목 작성 규칙:**
- 60자 이내로 작성
- SEO를 고려한 키워드 포함
- 클릭을 유도하는 매력적인 표현
- 이모지 사용 금지
- 과장되지 않고 정확한 정보 전달

제목만 작성해주세요.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "당신은 유튜브 SEO 전문가입니다. 검색에 잘 노출되고 클릭률이 높은 제목을 만듭니다."
      },
      {
        role: "user",
        content: titlePrompt
      }
    ],
    max_tokens: 100,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

// 다중 플랫폼 생성 함수
async function generateMultiplePlatforms(platforms: string[], requestData: SNSRequest) {
  const results: Record<string, {
    post?: string;
    title?: string;
    description?: string;
    platform: string;
    charCount: number | { title: number; description: number };
    charLimit?: number | null;
  }> = {};
  
  for (const platform of platforms) {
    const platformInfo = platformInstructions[platform as keyof typeof platformInstructions];
    if (!platformInfo) continue;

    const result = await generateSinglePlatform(platform, requestData);
    results[platform] = result;
  }
  
  return results;
}

// 단일 플랫폼 생성 함수
async function generateSinglePlatform(platform: string, requestData: SNSRequest) {
  const {
    contentType,
    topic,
    keywords,
    targetAudience,
    tone,
    includeHashtags,
    includeEmoji
  } = requestData;

  const platformInfo = platformInstructions[platform as keyof typeof platformInstructions];
  const contentInfo = contentTypeInstructions[contentType as keyof typeof contentTypeInstructions];

  // 유튜브의 경우 제목과 설명 분리 생성
  if (platform === 'youtube' && platformInfo.hasTitle) {
    const title = await generateYouTubeTitle(topic, keywords || '', tone, contentInfo || '');
    const description = await generateYouTubeDescription(topic, keywords || '', targetAudience || '', tone, contentInfo || '', includeHashtags, includeEmoji, platformInfo);
    
    return {
      title,
      description,
      platform: platformInfo.name,
      charCount: {
        title: title.length,
        description: description.length
      }
    };
  }

  // 다른 플랫폼들은 기존 방식으로 생성
  return await generateRegularPost(platform, requestData);
}

// 유튜브 설명 생성 함수
async function generateYouTubeDescription(topic: string, keywords: string, targetAudience: string, tone: string, contentInfo: string, includeHashtags: boolean, includeEmoji: boolean, platformInfo: PlatformInfo) {
  const prompt = `유튜브 영상 설명을 작성해주세요.

**영상 정보:**
- 주제: ${topic}
${contentInfo ? `- 콘텐츠 유형: ${contentInfo}` : ''}
${keywords ? `- 관련 키워드: ${keywords}` : ''}
${targetAudience ? `- 타겟 대상: ${targetAudience}` : ''}
- 톤앤매너: ${tone}

**작성 규칙:**
- 영상 내용을 상세히 설명
- 시청자에게 제공하는 가치 명시
- 자연스러운 구독/좋아요 유도
- 타임스탬프 형식 포함 (예: 00:00 인트로)
- ${includeEmoji ? '이모지는 섹션 구분용으로만 최소 사용' : '이모지 사용 안 함'}
- ${includeHashtags ? `해시태그 ${platformInfo.maxHashtags}개 이하 포함` : '해시태그 사용 안 함'}

영상 설명만 작성해주세요.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "당신은 유튜브 콘텐츠 전문가입니다. 시청자의 관심을 끌고 참여를 유도하는 설명을 작성합니다."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

// 일반 게시물 생성 함수
async function generateRegularPost(platform: string, requestData: SNSRequest) {
  const {
    contentType,
    topic,
    keywords,
    targetAudience,
    tone,
    includeHashtags,
    includeEmoji,
    charLimit
  } = requestData;

  const platformInfo = platformInstructions[platform as keyof typeof platformInstructions];
  const contentInfo = contentTypeInstructions[contentType as keyof typeof contentTypeInstructions];

  const prompt = `당신은 각 SNS 플랫폼의 특성을 정확히 이해하는 전문 콘텐츠 크리에이터입니다. 다음 조건에 맞는 ${platformInfo.name} 게시물을 한국어로 작성해주세요.

**플랫폼 분석:**
- 플랫폼: ${platformInfo.name}
- 플랫폼 특성: ${platformInfo.style}
- 핵심 요소: ${platformInfo.features.join(', ')}
- 글자 수 제한: ${charLimit === 63206 ? '제한없음' : `${charLimit}자 이내`}

**필수 준수사항:**
${platformInfo.guidelines}

**게시물 요구사항:**
- 주제: ${topic}
${contentInfo ? `- 콘텐츠 유형: ${contentInfo}` : ''}
${keywords ? `- 관련 키워드: ${keywords}` : ''}
${targetAudience ? `- 타겟 대상: ${targetAudience}` : ''}
- 톤앤매너: ${tone}

**이모지 사용 규칙:**
${includeEmoji ? `- 이모지는 ${platformInfo.name === '링크드인' ? '사용하지 마세요 (전문성 유지)' : platformInfo.name === '인스타그램' ? '최대 1-2개만 사용하여 감정이나 포인트 강조' : platformInfo.name === '트위터(X)' ? '가능한 사용하지 말고 텍스트로 표현' : platformInfo.name === '페이스북' ? '감정 표현용으로 1-2개만 사용' : platformInfo.name === '틱톡' ? '포인트 강조용으로 1개만 사용' : '섹션 구분용으로만 최소 사용'}` : '- 이모지를 전혀 사용하지 마세요'}

**해시태그 규칙:**
${includeHashtags ? `- 해시태그는 ${platformInfo.maxHashtags}개 이하로 제한하고, 실제로 검색되고 의미있는 것만 선별해서 사용` : '- 해시태그를 사용하지 마세요'}

오직 게시물 내용만 작성하세요.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `당신은 ${platformInfo.name} 전문 콘텐츠 크리에이터입니다. 해당 플랫폼의 문화와 사용자 특성을 완벽히 이해하고 자연스러운 콘텐츠를 만듭니다.`
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 800,
    temperature: 0.7,
  });

  const generatedPost = completion.choices[0]?.message?.content?.trim() || '';
  
  return {
    post: generatedPost,
    platform: platformInfo.name,
    charCount: generatedPost.length,
    charLimit: charLimit === 63206 ? null : charLimit
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SNSRequest = await request.json();
    
    const {
      platform,
      platforms,
      topic
    } = body;

    if (!topic.trim()) {
      return NextResponse.json(
        { error: '주제는 필수 입력 사항입니다.' },
        { status: 400 }
      );
    }

    // 다중 플랫폼 생성 요청인 경우
    if (platforms && platforms.length > 0) {
      const results = await generateMultiplePlatforms(platforms, body);
      return NextResponse.json({ results });
    }

    // 단일 플랫폼 생성 요청인 경우
    if (!platform) {
      return NextResponse.json(
        { error: '플랫폼을 선택해주세요.' },
        { status: 400 }
      );
    }

    const platformInfo = platformInstructions[platform as keyof typeof platformInstructions];
    if (!platformInfo) {
      return NextResponse.json(
        { error: '지원하지 않는 플랫폼입니다.' },
        { status: 400 }
      );
    }

        const result = await generateSinglePlatform(platform, body);
    return NextResponse.json(result);

  } catch (error) {
    console.error('SNS 게시물 생성 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 