import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      contentType,
      postTopic,
      tone,
      toneExample,
      useSearchResults,
      useExampleImage,
      keyContent,
      selectedImages,
      autoImages,
    } = await request.json();

    if (!postTopic || !postTopic.trim()) {
      return NextResponse.json({ error: '게시물 주제를 입력해주세요.' }, { status: 400 });
    }

    if (!toneExample || !toneExample.trim()) {
      return NextResponse.json({ error: '말투 예시 문장을 입력해주세요.' }, { status: 400 });
    }

    console.log('블로그 생성 시작:', { contentType, postTopic, tone });

    const blogContent = await generateBlogContent({
      contentType,
      postTopic: postTopic.trim(),
      tone,
      toneExample: toneExample.trim(),
      useSearchResults,
      useExampleImage,
      keyContent: keyContent.trim(),
      selectedImages: selectedImages || [],
      autoImages: autoImages || [],
    });

    return NextResponse.json({ blogContent });
  } catch (error) {
    console.error('블로그 생성 오류:', error);
    return NextResponse.json({ error: '블로그 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function generateBlogContent({
  contentType,
  postTopic,
  tone,
  toneExample,
  useSearchResults,
  useExampleImage,
  keyContent,
  selectedImages,
  autoImages,
}: {
  contentType: string;
  postTopic: string;
  tone: string;
  toneExample: string;
  useSearchResults: boolean;
  useExampleImage: boolean;
  keyContent: string;
  selectedImages: string[];
  autoImages: Array<{
    id: string;
    url: string;
    alt: string;
    photographer: string;
  }>;
}): Promise<string> {
  const contentTypeMap = {
    review: '리뷰',
    info: '정보',
    daily: '일상',
  };

  const toneMap = {
    haeyo: '~해요체',
    seupnida: '~습니다체',
    banmal: '반말',
  };

  // 이미지 정보 처리
  const hasImages = selectedImages.length > 0 || autoImages.length > 0;
  const imageDescriptions = autoImages.map((img, index) => 
    `이미지 ${index + 1}: ${img.alt || '관련 이미지'}`
  ).join('\n');

  const systemPrompt = `당신은 전문적인 한국형 블로그 작성 AI입니다. 사용자가 제공한 정보를 바탕으로 매력적이고 읽기 쉬운 블로그 포스트를 작성해주세요.

작성 규칙:
1. 제목은 매력적이고 클릭을 유도하는 제목으로 작성
2. 내용은 사용자가 지정한 말투를 정확히 따라야 함
3. 한국형 블로그 스타일로 친근하고 구체적으로 작성
4. 개인적인 경험이나 후기를 포함하여 신뢰성 있는 내용으로 작성
5. 실용적인 정보와 팁을 많이 포함
6. 적절한 단락 구분과 가독성을 고려
7. 실제 블로그에 올릴 수 있는 수준의 품질로 작성
8. 이모지나 특수문자는 사용하지 않음
9. 마크다운 형식은 사용하지 않고 일반 텍스트로 작성
10. 최소 2000자 이상으로 상세하게 작성
11. 소제목을 사용하여 내용을 체계적으로 구성하되, ## 표시는 사용하지 않음
12. 구체적인 장소명, 가격, 시간 등의 정보 포함
13. 개인적인 감상과 추천 사유를 포함
14. 가게, 음식점, 카페 등이 언급되면 다음 정보를 포함:
    - 정확한 상호명과 위치
    - 영업시간과 연락처 (가능한 경우)
    - 대표 메뉴와 가격대
    - 방문 시기와 대기 시간
    - 개인적인 추천 이유
15. 관광지, 명소 등이 언급되면 다음 정보를 포함:
    - 정확한 주소와 교통편
    - 입장료와 운영시간
    - 방문 추천 시기
    - 개인적인 체험 후기
16. 제품이나 서비스가 언급되면 다음 정보를 포함:
    - 정확한 제품명과 브랜드
    - 가격과 구매처
    - 사용 후기와 추천 이유
    - 대안 제품 정보

${useSearchResults ? '인터넷 검색 결과를 활용하여 최신 정보와 트렌드를 반영해주세요.' : ''}
${useExampleImage && hasImages ? `다음 이미지들을 텍스트 중간에 자연스럽게 삽입해주세요:\n${imageDescriptions}\n\n이미지는 "markdown-image"라는 키워드로 표시하고, 그 아래에 "이미지 출처"라는 텍스트를 추가해주세요. 이미지는 관련된 내용이 나온 후에 삽입해주세요.` : ''}
${keyContent ? `다음 요구사항을 반드시 포함해주세요: ${keyContent}` : ''}

한국형 블로그 구조:
- 매력적인 제목
- 개요/소개 (왜 이 주제를 선택했는지)
- 상세한 본문 내용 (소제목 포함, ## 표시 없이)
  * 준비사항이나 알아두면 좋은 점
  * 구체적인 경험담과 후기
  * 실용적인 팁과 조언
  * 개인적인 추천 사유
- 추천/팁 (실용적인 정보)
- 마무리 (전체적인 후기)
- 태그
- 참고 자료`;

  const userPrompt = `다음 정보를 바탕으로 한국형 블로그 포스트를 작성해주세요:

콘텐츠 타입: ${contentTypeMap[contentType as keyof typeof contentTypeMap]}
주제: ${postTopic}
말투: ${toneMap[tone as keyof typeof toneMap]}
말투 예시: ${toneExample}

${useSearchResults ? '인터넷 검색을 통해 관련 정보를 포함해주세요.' : ''}
${useExampleImage && hasImages ? `포함할 이미지 개수: ${selectedImages.length + autoImages.length}개 - 이미지들을 텍스트 중간에 자연스럽게 배치하고 "markdown-image" 키워드로 표시해주세요.` : ''}
${keyContent ? `특별히 포함해야 할 내용: ${keyContent}` : ''}

한국형 블로그는 다음 구조로 상세하게 작성해주세요:
1. 매력적인 제목
2. 개요/소개 (왜 이 주제를 선택했는지, 개인적인 동기)
3. 상세한 본문 내용
   - 준비사항이나 알아두면 좋은 점
   - 구체적인 경험담과 후기 (시간, 장소, 가격 등 포함)
   - 실용적인 팁과 조언
   - 개인적인 추천 사유
4. 추천/팁 (실용적인 정보)
5. 마무리 (전체적인 후기)
6. 태그
7. 참고 자료

특별 주의사항:
- ## 표시는 절대 사용하지 마세요
- 가게, 음식점, 카페 등이 나오면 상호명, 위치, 메뉴, 가격, 추천 이유를 자세히 포함
- 관광지, 명소 등이 나오면 주소, 교통편, 입장료, 운영시간, 방문 후기를 포함
- 제품이나 서비스가 나오면 제품명, 브랜드, 가격, 구매처, 사용 후기를 포함
- 모든 정보는 실제 방문자나 사용자처럼 구체적이고 신뢰성 있게 작성

최소 2000자 이상으로 구체적이고 상세하게 작성해주세요. 개인적인 경험과 실용적인 정보를 많이 포함해주세요.

이미지는 "markdown-image"라는 키워드로 표시하고, 그 아래에 "이미지 출처" 텍스트를 추가해주세요.`;

  try {
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
      max_tokens: 4000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    if (!content.trim()) {
      throw new Error('블로그 내용을 생성하지 못했습니다.');
    }

    return content;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    throw new Error('블로그 생성 중 오류가 발생했습니다.');
  }
} 