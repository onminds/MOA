import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { topic, contentType } = await request.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 });
    }

    console.log('이미지 크롤링 시작:', { topic, contentType });

    const imageData = await crawlImages(topic.trim(), contentType);

    return NextResponse.json({ images: imageData });
  } catch (error) {
    console.error('이미지 크롤링 오류:', error);
    return NextResponse.json({ error: '이미지 크롤링 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function crawlImages(topic: string, contentType: string): Promise<any[]> {
  try {
    // 1. AI를 사용하여 검색 키워드 생성
    const searchKeywords = await generateSearchKeywords(topic, contentType);
    
    // 2. 구글과 네이버에서 이미지 검색
    const googleImages = await searchGoogleImages(searchKeywords);
    const naverImages = await searchNaverImages(searchKeywords);
    
    // 3. 결과 합치기 (중복 제거)
    const allImages = [...googleImages, ...naverImages];
    const uniqueImages = removeDuplicateImages(allImages);
    
    // 4. 결과가 없으면 기본 이미지 반환
    if (uniqueImages.length === 0) {
      console.log('크롤링 결과가 없어 기본 이미지를 반환합니다.');
      return generateMockImages(searchKeywords);
    }
    
    return uniqueImages.slice(0, 10); // 최대 10개 반환
  } catch (error) {
    console.error('이미지 크롤링 오류:', error);
    return generateMockImages([topic]);
  }
}

async function generateSearchKeywords(topic: string, contentType: string): Promise<string[]> {
  const contentTypeMap = {
    review: '리뷰',
    info: '정보',
    daily: '일상',
  };

  const prompt = `다음 블로그 주제와 콘텐츠 타입에 맞는 이미지 검색 키워드를 3-5개 생성해주세요.

주제: ${topic}
콘텐츠 타입: ${contentTypeMap[contentType as keyof typeof contentTypeMap]}

요구사항:
1. 한국어 키워드로 작성
2. 이미지 검색에 최적화된 키워드
3. 주제와 관련성이 높은 키워드
4. 각 키워드는 쉼표로 구분

예시 형식: 키워드1, 키워드2, 키워드3, 키워드4`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 이미지 검색 키워드 생성 전문가입니다. 주제에 맞는 최적의 이미지 검색 키워드를 생성해주세요.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content || '';
    const keywords = content.split(',').map(k => k.trim()).filter(k => k.length > 0);
    
    return keywords.length > 0 ? keywords : [topic];
  } catch (error) {
    console.error('키워드 생성 오류:', error);
    return [topic];
  }
}

async function searchGoogleImages(keywords: string[]): Promise<any[]> {
  try {
    const query = keywords.join(' ');
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&tbs=isz:l`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Google 검색 오류: ${response.status}`);
    }

    const html = await response.text();
    const images = extractImagesFromGoogle(html, query);
    
    return images;
  } catch (error) {
    console.error('Google 이미지 검색 오류:', error);
    return [];
  }
}

async function searchNaverImages(keywords: string[]): Promise<any[]> {
  try {
    const query = keywords.join(' ');
    const searchUrl = `https://search.naver.com/search.naver?where=image&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error(`Naver 검색 오류: ${response.status}`);
    }

    const html = await response.text();
    const images = extractImagesFromNaver(html, query);
    
    return images;
  } catch (error) {
    console.error('Naver 이미지 검색 오류:', error);
    return [];
  }
}

function extractImagesFromGoogle(html: string, query: string): any[] {
  const images: any[] = [];
  
  try {
    // Google 이미지 검색 결과에서 이미지 URL 추출 (다양한 패턴 시도)
    const patterns = [
      /\["(https:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
      /"(https:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
      /src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
    ];
    
    let count = 0;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && count < 10) {
        const imageUrl = match[1];
        if (imageUrl && !imageUrl.includes('gstatic.com') && !imageUrl.includes('google.com')) {
          images.push({
            id: `google_${count}`,
            url: imageUrl,
            thumb: imageUrl,
            alt: `${query} 관련 이미지`,
            photographer: 'Google',
            downloadUrl: imageUrl,
            source: 'Google'
          });
          count++;
        }
      }
      if (count >= 10) break;
    }
  } catch (error) {
    console.error('Google 이미지 추출 오류:', error);
  }
  
  return images;
}

function extractImagesFromNaver(html: string, query: string): any[] {
  const images: any[] = [];
  
  try {
    // Naver 이미지 검색 결과에서 이미지 URL 추출 (다양한 패턴 시도)
    const patterns = [
      /"imageUrl":"([^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
      /src="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
      /data-src="([^"]+\.(?:jpg|jpeg|png|gif|webp))"/g,
    ];
    
    let count = 0;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null && count < 10) {
        const imageUrl = match[1];
        if (imageUrl && !imageUrl.includes('naver.com')) {
          images.push({
            id: `naver_${count}`,
            url: imageUrl,
            thumb: imageUrl,
            alt: `${query} 관련 이미지`,
            photographer: 'Naver',
            downloadUrl: imageUrl,
            source: 'Naver'
          });
          count++;
        }
      }
      if (count >= 10) break;
    }
  } catch (error) {
    console.error('Naver 이미지 추출 오류:', error);
  }
  
  return images;
}

function removeDuplicateImages(images: any[]): any[] {
  const seen = new Set();
  return images.filter(img => {
    const key = img.url;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function generateMockImages(keywords: string[]): any[] {
  // 크롤링 실패 시 빈 배열 반환
  return [];
} 