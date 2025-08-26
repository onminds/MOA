import { Client } from '@notionhq/client';
import { resolveCategoryFromNotion } from '@/config/aiCategories';

// 노션 클라이언트 초기화
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// AI 툴 데이터 타입 정의
export interface AITool {
  id: string;
  name: string;
  url: string;
  domain?: string;
  serviceId?: string; // Notion Unique ID(서비스 상세와 연결용)
  category: string;
  price: 'free' | 'freemium' | 'paid';
  features: string[];
  hasAPI: boolean;
  description: string;
  usageLimit?: string;
  rating?: number; // 0이면 평점 없음 처리
  imageUrl?: string;
}

// 가격 형태 매핑 함수
function mapPriceType(priceMultiSelect: any): 'free' | 'freemium' | 'paid' {
  if (!priceMultiSelect || priceMultiSelect.length === 0) return 'free';
  
  const prices = priceMultiSelect.map((p: any) => p.name.toLowerCase());
  
  if (prices.includes('무료')) return 'free';
  if (prices.includes('부분무료') || prices.includes('무료+유료') || prices.includes('무료체험') || prices.includes('freemium')) return 'freemium';
  if (prices.includes('유료') || prices.includes('구독형태') || prices.includes('구독') || prices.includes('유료만')) return 'paid';
  
  return 'freemium'; // 기본값
}

// 한줄평에서 평점 추출 (간단한 휴리스틱)
function extractRatingFromDescription(description: string | undefined): number {
  if (!description) return 0;
  
  // 긍정적 키워드가 많으면 높은 점수
  const positiveKeywords = ['혁신', '최고', '완벽', '강력', '뛰어난', '표준', '필수'];
  const negativeKeywords = ['아직', '부족', '제한', '단순'];
  
  let score = 0;
  positiveKeywords.forEach(keyword => {
    if (description.includes(keyword)) score += 0.2;
  });
  negativeKeywords.forEach(keyword => {
    if (description.includes(keyword)) score -= 0.2;
  });
  
  // 0~5 사이로 클램핑
  return Math.min(5.0, Math.max(0, score));
}

// 노션 DB에서 AI 툴 검색
const cache = new Map<string, { at: number; data: AITool[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10분

export async function searchAITools(filters: {
  category?: string;
  price?: 'free' | 'freemium' | 'paid';
  features?: string[];
  searchQuery?: string;
}): Promise<AITool[]> {
  try {
    // 메모리 캐시 조회 (간단 버전)
    const key = JSON.stringify(filters || {});
    const hit = cache.get(key);
    const now = Date.now();
    if (hit && (now - hit.at) < CACHE_TTL_MS) {
      return hit.data;
    }
    if (!process.env.NOTION_DATABASE_ID) {
      console.error('NOTION_DATABASE_ID is not set');
      return getMockAITools(filters);
    }

    const filterConditions: any[] = [];
    
    // 카테고리 필터 (multi_select이므로 contains 사용). 동의어 매핑
    if (filters.category) {
      const categorySynonyms: Record<string, string[]> = {
        video: ['비디오', '영상', '동영상', 'video', 'movie'],
        image: ['이미지', '사진', '그림', 'image', 'photo', 'picture'],
        text: ['텍스트', '글', '문서', 'text', 'writing'],
        audio: ['오디오', '음성', 'audio', 'voice'],
        code: ['코드', '개발', '프로그래밍', 'code'],
      };
      const synonyms = categorySynonyms[filters.category] || [filters.category];
      // 올바른 Notion 필터 형태: or 배열 내 각 조건에 property 포함
      filterConditions.push({
        or: synonyms.map((name: string) => ({
          property: '카테고리',
          multi_select: { contains: name }
        }))
      });
    }
    
    // 가격 필터 (multi_select에서 해당 값 포함 여부)
    if (filters.price) {
      const priceKeywords = {
        'free': '무료',
        'freemium': '부분무료',
        'paid': '유료'
      };
      filterConditions.push({
        property: '가격 형태',
        multi_select: { contains: priceKeywords[filters.price] || '무료' }
      });
    }
    
    // 검색어 필터 (도구 이름/태그/설명 포함 검색)
    if (filters.searchQuery) {
      const q = String(filters.searchQuery);
      filterConditions.push({
        or: [
          { property: '도구 이름', title: { contains: q } as any },
          { property: '태그', multi_select: { contains: q } },
          { property: '한줄평', rich_text: { contains: q } as any }
        ]
      });
    }

    // 노션 API는 한 번에 최대 100개까지만 반환하므로 페이지네이션 처리
    let allResults: any[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;
    
    while (hasMore) {
      const response = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        // 안전성을 위해 서버측 필터를 임시 비활성화하고, 결과를 클라이언트에서 필터링
        // filter: filterConditions.length > 0 ? { and: filterConditions as any } : undefined,
        sorts: [
          {
            property: '도구 이름',
            direction: 'ascending'
          }
        ],
        page_size: 100,
        start_cursor: startCursor
      });
      
      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    }

    // 노션 응답을 AITool 형식으로 변환 (실제 DB 스키마에 맞게 수정)
    let mapped = allResults.map((page: any) => ({
      id: page.id,
      name: page.properties['도구 이름']?.title?.[0]?.plain_text || '',
      url: page.properties['URL']?.url || '',
      domain: ((): string => {
        try {
          const u = page.properties['URL']?.url || '';
          if (!u) return '';
          const parsed = new URL(u.startsWith('http') ? u : `https://${u}`);
          return parsed.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
          return '';
        }
      })(),
      serviceId: ((): string => {
        try {
          const uid = page.properties['ID']?.unique_id;
          if (uid && typeof uid.number === 'number') {
            return `${uid.prefix || ''}-${uid.number}`;
          }
        } catch {}
        return '';
      })(),
      // 카테고리: 노션 다중 선택을 표준 키(image|text|video|audio|code|design|productivity 등)로 정규화
      category: ((): string => {
        try {
          const arr = page.properties['카테고리']?.multi_select?.map((s: any) => s.name) || [];
          return resolveCategoryFromNotion(arr);
        } catch {
          return (page.properties['카테고리']?.multi_select?.map((s: any) => s.name).join(', ') || '').toLowerCase();
        }
      })(),
      price: mapPriceType(page.properties['가격 형태']?.multi_select),
      features: page.properties['태그']?.multi_select?.map((f: any) => f.name) || [],
      hasAPI: page.properties['api여부']?.select?.name === '있음',
      description: page.properties['한줄평']?.rich_text?.[0]?.plain_text || 
                   page.properties['상세 내용']?.rich_text?.[0]?.plain_text || '',
      usageLimit: page.properties['사용 방식']?.rich_text?.[0]?.plain_text || '',
      rating: extractRatingFromDescription(page.properties['한줄평']?.rich_text?.[0]?.plain_text),
      imageUrl: page.properties['아이콘 url']?.url || 
                page.properties['아이콘']?.files?.[0]?.file?.url || 
                page.properties['아이콘']?.files?.[0]?.external?.url || ''
    }));
    // 클라이언트 사이드 필터링 적용 (서버 필터 비활성화 대체)
    if (filters.category) {
      mapped = mapped.filter(t => (t.category || '').toLowerCase().includes(filters.category!.toLowerCase()) || t.category === filters.category);
    }
    if (filters.price) {
      mapped = mapped.filter(t => t.price === filters.price || (filters.price === 'free' && t.price === 'freemium'));
    }
    if (filters.features && filters.features.length > 0) {
      mapped = mapped.filter((t: AITool) =>
        filters.features!.some((f: string) => t.features.some((tf: string) => String(tf || '').includes(f)))
      );
    }
    if (filters.searchQuery) {
      const q = String(filters.searchQuery).toLowerCase();
      mapped = mapped.filter((t: AITool) =>
        t.name.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        t.features.some((f: string) => String(f || '').toLowerCase().includes(q))
      );
    }

    cache.set(key, { at: now, data: mapped });
    return mapped;
  } catch (error) {
    console.error('Notion API error:', error);
    // 에러 시 목업 데이터 반환
    const mapped = getMockAITools(filters);
    try { cache.set(JSON.stringify(filters || {}), { at: Date.now(), data: mapped }); } catch {}
    return mapped;
  }
}

// 목업 데이터 (노션 연동 실패 시 사용)
function getMockAITools(filters: any): AITool[] {
  const mockTools: AITool[] = [
    {
      id: '1',
      name: 'Playground AI',
      url: 'https://playgroundai.com',
      category: 'image',
      price: 'freemium',
      features: ['실사', '고품질', '스타일 다양성'],
      hasAPI: true,
      description: '하루 1000장 무료 생성 가능한 고품질 이미지 AI',
      usageLimit: '무료: 1000장/일',
      rating: 4.5,
      imageUrl: 'https://playgroundai.com/favicon.ico'
    },
    {
      id: '2',
      name: 'Leonardo AI',
      url: 'https://leonardo.ai',
      category: 'image',
      price: 'freemium',
      features: ['실사', '게임 아트', '3D'],
      hasAPI: true,
      description: '게임 및 실사 이미지 전문 AI 생성 도구',
      usageLimit: '무료: 150 크레딧/일',
      rating: 4.7,
      imageUrl: 'https://leonardo.ai/favicon.ico'
    },
    {
      id: '3',
      name: 'Bing Image Creator',
      url: 'https://www.bing.com/create',
      category: 'image',
      price: 'free',
      features: ['실사', 'DALL-E 3', '무제한'],
      hasAPI: false,
      description: 'Microsoft의 DALL-E 3 기반 무료 이미지 생성',
      usageLimit: '무료: 무제한 (부스트 제한)',
      rating: 4.2,
      imageUrl: 'https://www.bing.com/favicon.ico'
    },
    {
      id: '4',
      name: 'Ideogram',
      url: 'https://ideogram.ai',
      category: 'image',
      price: 'freemium',
      features: ['텍스트 렌더링', '실사', '타이포그래피'],
      hasAPI: false,
      description: '텍스트 렌더링에 특화된 이미지 생성 AI',
      usageLimit: '무료: 25장/일',
      rating: 4.4,
      imageUrl: 'https://ideogram.ai/favicon.ico'
    },
    {
      id: '5',
      name: 'Lexica',
      url: 'https://lexica.art',
      category: 'image',
      price: 'freemium',
      features: ['실사', '아트', '검색 가능'],
      hasAPI: false,
      description: 'Stable Diffusion 기반 이미지 생성 및 검색',
      usageLimit: '무료: 100장/월',
      rating: 4.0,
      imageUrl: 'https://lexica.art/favicon.ico'
    },
    {
      id: '6',
      name: 'Claude',
      url: 'https://claude.ai',
      category: 'text',
      price: 'freemium',
      features: ['대화', '코드 생성', '분석', '한국어'],
      hasAPI: true,
      description: 'Anthropic의 고급 대화형 AI 어시스턴트',
      usageLimit: '무료: 제한적 사용',
      rating: 4.8,
      imageUrl: 'https://claude.ai/favicon.ico'
    },
    {
      id: '7',
      name: 'Perplexity',
      url: 'https://perplexity.ai',
      category: 'text',
      price: 'freemium',
      features: ['검색', '실시간 정보', '출처 제공'],
      hasAPI: false,
      description: 'AI 기반 실시간 검색 엔진',
      usageLimit: '무료: 기본 검색 무제한',
      rating: 4.6,
      imageUrl: 'https://perplexity.ai/favicon.ico'
    },
    {
      id: '8',
      name: 'Runway',
      url: 'https://runwayml.com',
      category: 'video',
      price: 'freemium',
      features: ['비디오 생성', '편집', 'Gen-2'],
      hasAPI: true,
      description: 'AI 기반 비디오 생성 및 편집 플랫폼',
      usageLimit: '무료: 125 크레딧',
      rating: 4.3,
      imageUrl: 'https://runwayml.com/favicon.ico'
    }
  ];

  // 필터 적용
  let filtered = [...mockTools];
  
  if (filters.category) {
    filtered = filtered.filter(tool => tool.category === filters.category);
  }
  
  if (filters.price) {
    filtered = filtered.filter(tool => tool.price === filters.price || 
      (filters.price === 'free' && tool.price === 'freemium'));
  }
  
  if (filters.features && filters.features.length > 0) {
    filtered = filtered.filter(tool => 
      filters.features.some((feature: string) => 
        tool.features.some(f => f.includes(feature))
      )
    );
  }
  
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(tool => 
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.features.some(f => f.toLowerCase().includes(query))
    );
  }
  
  return filtered;
}
