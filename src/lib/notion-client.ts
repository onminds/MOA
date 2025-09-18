import { Client } from '@notionhq/client';

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
  // 유사도/관련도 점수(검색어 기반 정렬 시 부여)
  relevanceScore?: number;
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
export async function searchAITools(filters: {
  category?: string;
  price?: 'free' | 'freemium' | 'paid';
  features?: string[];
  searchQuery?: string;
}): Promise<AITool[]> {
  try {
    if (!process.env.NOTION_DATABASE_ID) {
      console.error('NOTION_DATABASE_ID is not set');
      // 엄격 모드: 노션 DB가 없으면 카드/추천을 비우고 종료(모크 사용 금지)
      return [];
    }

    const filterConditions: any[] = [];
    
    // 카테고리 필터 (multi_select이므로 contains 사용). 동의어 매핑
    if (filters.category) {
      const categorySynonyms: Record<string, string[]> = {
        video: ['비디오','영상','동영상','video','movie','Video','컷편집','컷','자막','캡션','모션그래픽','모션','motion graphic','렌더','render','시네틱','템플릿 영상','video edit','video editing','비디오 인페인트','인페인트 영상'],
        image: ['이미지','사진','그림','image','photo','picture','Image','포토','포토리얼','photo real','업스케일','upscale','배경제거','배경 제거','background removal','인페인팅','inpainting','아웃페인팅','outpainting','스타일 전이','style transfer','합성'],
        text: ['텍스트','글','문서','text','writing','Writing','writer','Writer','Text','텍스트 AI','글쓰기','카피라이팅','copy','Copy','요약','에세이','보고서','기획안','문서 작성','프롬프트','prompt','프롬프트 템플릿'],
        audio: ['오디오','음성','audio','voice','Audio','보이스오버','voice over','보이스클로닝','voice cloning','보컬 제거','노이즈 제거','noise removal','배경음','bgm','TTS','STT','tts','stt','음성 합성','음성 변환','text to speech','speech to text'],
        code: ['코드','개발','프로그래밍','code','Code','coding','Coding','코딩','programming','Programming','development','Development','개발자','developer','Developer','IDE','ide','리팩토링','테스트 생성','정적분석','static analysis','코드 리뷰','code review','코드스멜','LSP','디버깅','debugging','스니펫'],
        // 디자인: UI/UX 중심. 이미지 생성 계열은 image 카테고리에서 다루며 여기선 제외
        design: ['디자인','design','Design','그래픽','graphic','Graphic','UI','UX','ui/ux','UI/UX','로고','logo','Logo','브랜딩','branding','Branding','일러스트','illustration','Illustration','포토샵','photoshop','Photoshop','피그마','figma','Figma','UX Writing','디자인 시스템','design system','와이어프레임','wireframe','유저플로우','user flow','프로토타입','prototype','프로토타이핑','컴포넌트','component','아이콘세트','icon set'],
        avatar: ['Ai Avata','AI Avata','AI 아바타','ai avata','ai avatar','AI avatar','avatar','아바타','버추얼','virtual','digital human','디지털휴먼'],
        workflow: ['workflow','워크플로우','자동화','integration','Integration','통합','연동','Workflow','automation','Automation','api','API','webhook','Webhook','Zapier','Make','n8n','IFTTT','Pipedream','Workato','Integromat','오토메이션','인티그레이션','인테그레이션','에이전트','AI Agent','agentic','시나리오','파이프라인'],
        // 프레젠테이션/PPT 카테고리
        ppt: ['ppt','PPT','presentation','Presentation','프레젠테이션','발표','슬라이드','slide','slides','Slide','Slides','powerpoint','PowerPoint','deck','Deck','프리젠테이션','파워포인트','슬라이드덱','slide deck','pitch deck','pitch','키노트','Keynote','google slides','google slide','PPTX','pptx','PT','발표자료','발표문','슬라이드 제작'],
        // 고급 카테고리 추가
        database: ['database','데이터베이스','db','sql','mysql','postgresql','mongodb','nosql','redis','sqlite','oracle','mssql','query','쿼리','스키마','schema','데이터 모델링','모델링','ERD','인덱스','index','샤딩','sharding','파티셔닝','partitioning','리플리카','replica','read replica'],
        api: ['api','rest','graphql','webhook','웹훅','endpoint','엔드포인트','swagger','openapi','OpenAPI','postman','http','grpc','soap','microservice','마이크로서비스','RESTful','SDK','API 문서','API 문서화','API 테스트','oauth','OAuth','auth','인증','jwt','JWT','bearer','rate limit','레이트리밋'],
        analytics: ['analytics','분석','통계','statistics','dashboard','대시보드','report','리포트','visualization','시각화','chart','차트','graph','그래프','bi','event','이벤트','퍼널','funnel','코호트','cohort','세그먼트','segment','리텐션','retention','CDP','mixpanel','amplitude','GA','GA4'],
        security: ['security','보안','암호화','encryption','auth','인증','oauth','jwt','ssl','vpn','firewall','방화벽','vulnerability','취약점','SSO','MFA','2FA','IAM','KMS','키 관리','시크릿','secret','penetration test','pentest','WAF','CSP','DLP','취약점 스캐닝','vuln scanning'],
        cloud: ['cloud','클라우드','aws','azure','gcp','serverless','서버리스','lambda','s3','ec2','kubernetes','k8s','docker','도커','container','컨테이너','VPC','Functions','Cloud Functions','Cloud Run','App Engine','EKS','ECS','RDS','Object Storage','오브젝트 스토리지','GKE','AKS'],
        devops: ['devops','ci/cd','deploy','배포','jenkins','github actions','gitlab','build','빌드','pipeline','파이프라인','terraform','ansible','monitoring','logging','tracing','Prometheus','Grafana','알림','Alert','SRE','ArgoCD','Flux','rollback','canary','blue green','blue-green'],
        ai_advanced: ['llm','언어모델','language model','fine-tuning','파인튜닝','embedding','임베딩','vector','벡터','rag','retrieval','semantic','시맨틱','prompt','프롬프트','multimodal','vision','tool use','function calling','LoRA','QLoRA','distillation','MoE','speculative decoding','inference','prompt cache'],
        data: ['etl','crawling','크롤링','scraping','스크래핑','mining','마이닝','warehouse','웨어하우스','data lake','데이터 레이크','big data','빅데이터','ELT','Airflow','dbt','Kafka','카프카','스트리밍','Spark','데이터 품질','data quality','데이터 카탈로그','data catalog'],
        healthcare: ['헬스케어','의료','메디컬','medical','healthcare','의학','병원','medtech','진단','EMR','EHR','의무기록','의료영상','PACS','원격의료','telemedicine','웰니스','건강','patient','환자','clinical'],
        novel: ['소설','novel','스토리','시나리오','플롯','세계관','캐릭터'],
        document: ['문서','document','pdf','PDF','ocr','OCR','스캔','양식','폼','서명','전자서명'],
        webapp: ['웹사이트','웹페이지','landing','랜딩','no-code','builder','사이트 빌더','앱 빌더','app builder'],
        marketing: ['마케팅','seo','SEM','광고','캠페인','콘텐츠 캘린더','해시태그','퍼포먼스','CTR','CPC','CPA'],
        sales: ['세일즈','영업','리드','CRM','파이프라인','인바운드','아웃바운드','제안서'],
        hr: ['인사','HR','채용','리크루팅','러닝','교육','온보딩','평가'],
        legal: ['법무','legal','계약','조항','컴플라이언스','규정','판례'],
        finance: ['재무','회계','영수증','명세서','분개','리포트','결산'],
        science: ['과학','science','바이오','bio','논문','literature','patent','실험노트','유전체','genomics','단백질','proteomics'],
        realestate: ['부동산','real estate','건축','architecture','도면','견적','시뮬레이션'],
        arvr: ['AR','VR','XR','메타버스','가상현실','증강현실'],
        robotics_iot: ['로보틱스','robotics','iot','사물인터넷','엣지','edge ai','예지보전','센서'],
        news: ['뉴스','news','동향','trend','브리핑'],
        productivity: ['생산성','업무','캘린더','회의록','액션아이템','투두','메모'],
        ecommerce: ['전자상거래','이커머스','리테일','상품','카탈로그','리뷰','추천 엔진'],
        search: ['검색','search','웹검색','사이트검색','엔진','인덱스']
      };
      const synonyms = categorySynonyms[filters.category] || [filters.category];
      
      console.log('[DEBUG Notion] Category filter:', {
        requestedCategory: filters.category,
        synonyms: synonyms
      });
      
      // Notion 필터 스키마에 맞게 or 그룹을 상위로 두고 각 항목에 property 포함
      if (filters.category === 'design') {
        const uiuxTagSynonyms = ['UI','UX','ui/ux','UI/UX','피그마','figma','Figma','프로토타입','프로토타이핑','wireframe','와이어프레임','프로토타입'];
        filterConditions.push({
          or: [
            ...synonyms.map((name: string) => ({
              property: '카테고리',
              multi_select: { contains: name }
            })),
            ...uiuxTagSynonyms.map((name: string) => ({
              property: '태그',
              multi_select: { contains: name }
            }))
          ]
        });
      } else {
        filterConditions.push({
          or: synonyms.map((name: string) => ({
            property: '카테고리',
            multi_select: { contains: name }
          }))
        });
      }
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
      filterConditions.push({
        or: [
          { property: '도구 이름', title: { contains: filters.searchQuery } },
          { property: '태그', multi_select: { contains: filters.searchQuery } },
          { property: '한줄평', rich_text: { contains: filters.searchQuery } },
          // 카테고리 필드에서도 검색 (AI 아바타 등을 직접 찾기 위해)
          { property: '카테고리', multi_select: { contains: filters.searchQuery } }
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
        filter: filterConditions.length > 0 ? {
          and: filterConditions
        } : undefined,
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

    // 디자인 카테고리 보정: 결과 0이면 UI/UX 키워드 기반 재조회(카테고리 조건 제거)
    if ((filters.category === 'design') && allResults.length === 0) {
      const uiuxTagSynonyms = ['UI','UX','ui/ux','UI/UX','피그마','figma','Figma','프로토타입','프로토타이핑','wireframe','와이어프레임'];
      const fallbackFilter = {
        or: [
          ...uiuxTagSynonyms.map((name: string) => ({ property: '태그', multi_select: { contains: name } })),
          ...uiuxTagSynonyms.map((name: string) => ({ property: '도구 이름', title: { contains: name } }))
        ]
      } as any;
      let fbResults: any[] = [];
      let fbHasMore = true;
      let fbCursor: string | undefined = undefined;
      while (fbHasMore) {
        const response = await notion.databases.query({
          database_id: process.env.NOTION_DATABASE_ID,
          filter: { and: [fallbackFilter] },
          sorts: [ { property: '도구 이름', direction: 'ascending' } ],
          page_size: 100,
          start_cursor: fbCursor
        });
        fbResults = [...fbResults, ...response.results];
        fbHasMore = response.has_more;
        fbCursor = response.next_cursor || undefined;
      }
      if (process.env.NODE_ENV !== 'production') {
        console.log('[DEBUG Notion] design fallback by UI/UX tags', { totalResults: fbResults.length });
      }
      allResults = fbResults;
    }

    // 워크플로우 카테고리 검색 시 n8n, Make 등 주요 도구 우선 정렬
    if (filters.category === 'workflow' || filters.searchQuery?.toLowerCase().includes('워크플로우') || filters.searchQuery?.toLowerCase().includes('workflow')) {
      const priorityTools = ['n8n', 'Make', 'Zapier', 'Integromat', 'Pipedream', 'IFTTT', 'Workato', 'Activepieces'];
      
      allResults = allResults.sort((a: any, b: any) => {
        const aName = a.properties['도구 이름']?.title?.[0]?.plain_text || '';
        const bName = b.properties['도구 이름']?.title?.[0]?.plain_text || '';
        
        const aIndex = priorityTools.findIndex(tool => aName.toLowerCase().includes(tool.toLowerCase()));
        const bIndex = priorityTools.findIndex(tool => bName.toLowerCase().includes(tool.toLowerCase()));
        
        // 둘 다 우선순위 도구인 경우
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        // a만 우선순위 도구인 경우
        if (aIndex !== -1) return -1;
        // b만 우선순위 도구인 경우
        if (bIndex !== -1) return 1;
        // 둘 다 아닌 경우
        return 0;
      });
    }

    console.log('[DEBUG Notion] Query results:', {
      totalResults: allResults.length,
      firstResult: allResults[0] ? {
        name: allResults[0].properties['도구 이름']?.title?.[0]?.plain_text,
        category: allResults[0].properties['카테고리']?.multi_select?.map((s: any) => s.name)
      } : null
    });

    // PPT/프레젠테이션 요청 시 화면녹화/스크린 레코더 계열 제외 (예: Screen Studio) 및 우선순위 부여
    try {
      const isPptAsk = (filters.category === 'ppt') || /\b(ppt|presentation|powerpoint|프레젠테이션|슬라이드|발표|키노트|deck)\b/i.test(String(filters.searchQuery||''));
      if (isPptAsk) {
        // 1) 제외 필터
        allResults = allResults.filter((p: any) => {
          const name = String(p.properties['도구 이름']?.title?.[0]?.plain_text || '');
          const tags = ((p.properties['태그']?.multi_select || []).map((x: any)=>x?.name).join(' ') || '');
          const cat = ((p.properties['카테고리']?.multi_select || []).map((x: any)=>x?.name).join(' ') || '');
          const desc = String(p.properties['한줄평']?.rich_text?.[0]?.plain_text || '');
          const hay = `${name} ${tags} ${cat} ${desc}`.toLowerCase();
          // 제외 키워드: 화면 녹화/스크린 레코더/캡처 등
          const exclude = /(screen\s*(studio|record|recorder|capture)|스크린\s*레코더|화면\s*녹화|화면녹화|캡처|스크린샷)/i.test(hay);
          return !exclude;
        });
        // 2) 우선순위 정렬: 대표 PPT 생성 도구 우선 노출
        const priority = ['beautiful ai','beautiful.ai','canva','gamma','gamma app','pitch','presentations.ai','tome','prezi','popai','aippt','deckspeed','plus ai','slidesai'];
        allResults = allResults.sort((a: any, b: any) => {
          const aName = String(a.properties['도구 이름']?.title?.[0]?.plain_text || '').toLowerCase();
          const bName = String(b.properties['도구 이름']?.title?.[0]?.plain_text || '').toLowerCase();
          const aIdx = priority.findIndex(x => aName.includes(x));
          const bIdx = priority.findIndex(x => bName.includes(x));
          const aScore = aIdx === -1 ? 999 : aIdx;
          const bScore = bIdx === -1 ? 999 : bIdx;
          return aScore - bScore;
        });
      }
    } catch {}

    // --- 간단 유사도 정렬(쿼리 기반) : 이름/태그/한줄평/카테고리로 스코어링 ---
    try {
      const qRaw = String(filters.searchQuery || '').trim();
      if (qRaw.length > 0) {
        const q = qRaw.toLowerCase();
        const tokens = q.split(/[^a-z0-9가-힣]+/).filter(Boolean);
        const bigrams = (s: string): string[] => {
          const arr: string[] = []; const t = s.replace(/\s+/g,'');
          for (let i=0;i<t.length-1;i++) arr.push(t.slice(i,i+2));
          return arr;
        };
        const jaccard = (a: string, b: string): number => {
          const A = new Set(bigrams(a)); const B = new Set(bigrams(b));
          if (A.size === 0 || B.size === 0) return 0;
          let inter = 0; for (const x of A) if (B.has(x)) inter += 1;
          const uni = A.size + B.size - inter; return inter / uni;
        };
        const scoreOf = (p: any): number => {
          const name = String(p.properties['도구 이름']?.title?.[0]?.plain_text || '');
          const tags = ((p.properties['태그']?.multi_select || []).map((x: any)=>x?.name).join(' ') || '');
          const cat = ((p.properties['카테고리']?.multi_select || []).map((x: any)=>x?.name).join(' ') || '');
          const desc = String(p.properties['한줄평']?.rich_text?.[0]?.plain_text || '');
          const hay = `${name} ${tags} ${cat} ${desc}`.toLowerCase();
          let s = 0;
          // 강한 매칭 우선
          if (name.toLowerCase() === q) s += 100;
          if (name.toLowerCase().startsWith(q)) s += 40;
          if (hay.includes(q)) s += 20;
          for (const t of tokens) {
            if (!t) continue;
            if (hay.includes(t)) s += 6;
            const re = new RegExp(`\\b${t.replace(/[-/\\^$*+?.()|[\]{}]/g,'')}\\b`, 'i');
            if (re.test(hay)) s += 4;
          }
          // 문자 수준 유사도(2-gram 자카드)
          s += Math.min(10, Math.max(0, Math.round(jaccard(name.toLowerCase(), q) * 10)));
          // API 선호 약간 가중치
          const hasAPI = Array.isArray(p.properties['API 여부']?.multi_select) ? p.properties['API 여부'].multi_select.some((x:any)=>String(x?.name||'').toLowerCase().includes('api')) : false;
          if (hasAPI) s += 2;
          return s;
        };
        const idToScore = new Map<string, number>();
        const rankedPairs = allResults
          .map((p:any)=>({ p, s: scoreOf(p) }))
          .sort((a:any,b:any)=> b.s - a.s);
        rankedPairs.forEach((x:any)=>{ try { idToScore.set(String(x.p.id), Number(x.s)||0); } catch {} });
        const rankedPages = rankedPairs.map((x:any)=>x.p);
        if (process.env.NODE_ENV !== 'production') {
          try {
            const topName = rankedPages[0]?.properties?.['도구 이름']?.title?.[0]?.plain_text;
            console.log('[DEBUG Notion] similarity ranking applied', { q: qRaw, count: rankedPages.length, top: topName });
          } catch {}
        }
        (allResults as any) = rankedPages;
        // 점수를 반환 매핑에서 사용할 수 있도록 클로저에 저장
        (globalThis as any).__NOTION_SCORE_MAP__ = idToScore;
      }
    } catch {}
    
    // 노션 응답을 AITool 형식으로 변환 (실제 DB 스키마에 맞게 수정)
    const scoreMap: Map<string, number> | undefined = (globalThis as any).__NOTION_SCORE_MAP__;
    return allResults.map((page: any) => ({
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
      category: page.properties['카테고리']?.multi_select?.map((s: any) => s.name).join(', ') || '',
      price: mapPriceType(page.properties['가격 형태']?.multi_select),
      features: page.properties['태그']?.multi_select?.map((f: any) => f.name) || [],
      hasAPI: page.properties['api여부']?.select?.name === '있음',
      oneLiner: page.properties['한줄평']?.rich_text?.[0]?.plain_text || '',
      // 상세 내용을 우선 사용하여 풍부한 설명 확보, 한줄평은 보조
      description: page.properties['상세 내용']?.rich_text?.[0]?.plain_text || 
                   page.properties['한줄평']?.rich_text?.[0]?.plain_text || '',
      usageLimit: page.properties['사용 방식']?.rich_text?.[0]?.plain_text || '',
      rating: extractRatingFromDescription(page.properties['한줄평']?.rich_text?.[0]?.plain_text),
      imageUrl: page.properties['아이콘 url']?.url || 
                page.properties['아이콘']?.files?.[0]?.file?.url || 
                page.properties['아이콘']?.files?.[0]?.external?.url || '',
      relevanceScore: scoreMap ? scoreMap.get(String(page.id)) : undefined
    }));
  } catch (error) {
    console.error('Notion API error:', error);
    // 엄격 모드: 오류 시에도 모크 금지, 빈 배열 반환
    return [];
  }
}

// 목업 데이터 (노션 연동 실패 시 사용)
function getMockAITools(filters: any): AITool[] {
  const mockTools: AITool[] = [
    // 텍스트/글쓰기 관련 도구 추가
    {
      id: 'notion-ai',
      name: 'Notion AI',
      url: 'https://www.notion.so/product/ai',
      domain: 'notion.so',
      category: 'text',
      price: 'freemium',
      features: ['문서 작성', '요약', '번역', '정리'],
      hasAPI: true,
      description: '노션 문서에서 바로 글쓰기, 요약, 번역을 지원하는 AI 도우미',
      usageLimit: '무료 플랜 일부 제공',
      rating: 4.4
    },
    {
      id: 'jasper',
      name: 'Jasper',
      url: 'https://www.jasper.ai',
      domain: 'jasper.ai',
      category: 'text',
      price: 'paid',
      features: ['카피라이팅', '블로그 글', '마케팅 문구'],
      hasAPI: true,
      description: '마케팅 카피와 블로그 글에 특화된 AI 라이팅 도구',
      usageLimit: '유료 구독',
      rating: 4.3
    },
    {
      id: 'copy-ai',
      name: 'Copy.ai',
      url: 'https://www.copy.ai',
      domain: 'copy.ai',
      category: 'text',
      price: 'freemium',
      features: ['카피라이팅', 'SNS 문구', '블로그 아웃라인'],
      hasAPI: true,
      description: '다양한 템플릿으로 빠르게 문구를 생성하는 카피라이팅 도구',
      usageLimit: '무료 플랜 제공',
      rating: 4.2
    },
    {
      id: 'quillbot',
      name: 'QuillBot',
      url: 'https://quillbot.com',
      domain: 'quillbot.com',
      category: 'text',
      price: 'freemium',
      features: ['문장 교정', '패러프레이징', '요약'],
      hasAPI: false,
      description: '문장을 자연스럽게 바꾸고 요약하는 라이팅 보조 도구',
      usageLimit: '무료 플랜 제공',
      rating: 4.1
    },
    {
      id: 'grammarly',
      name: 'Grammarly',
      url: 'https://grammarly.com',
      domain: 'grammarly.com',
      category: 'text',
      price: 'freemium',
      features: ['문법 교정', '스타일 제안', '플러저리즘 검사'],
      hasAPI: true,
      description: '문법 교정과 스타일 제안을 제공하는 대표적인 라이팅 보조 도구',
      usageLimit: '무료 플랜 제공',
      rating: 4.6
    },
    // 코드/개발 관련 도구 추가
    {
      id: 'github-copilot',
      name: 'GitHub Copilot',
      url: 'https://github.com/features/copilot',
      domain: 'github.com',
      category: 'code',
      price: 'paid',
      features: ['코드 자동완성', 'AI 페어 프로그래밍', 'IDE 통합'],
      hasAPI: true,
      description: 'AI 기반 코드 자동완성 도구. VS Code, JetBrains 등 주요 IDE와 통합되어 실시간으로 코드를 제안합니다.',
      usageLimit: '월 $10-19',
      rating: 4.5
    },
    {
      id: 'cursor',
      name: 'Cursor',
      url: 'https://cursor.sh',
      domain: 'cursor.sh',
      category: 'code',
      price: 'freemium',
      features: ['AI 코드 에디터', '코드 생성', '리팩토링'],
      hasAPI: false,
      description: 'AI 기반 코드 에디터. GPT-4를 활용한 강력한 코드 생성과 편집 기능을 제공합니다.',
      usageLimit: '무료 플랜 제공, Pro $20/월',
      rating: 4.6
    },
    {
      id: 'tabnine',
      name: 'Tabnine',
      url: 'https://www.tabnine.com',
      domain: 'tabnine.com',
      category: 'code',
      price: 'freemium',
      features: ['코드 자동완성', '팀 협업', '온프레미스'],
      hasAPI: true,
      description: 'AI 코드 자동완성 도구. 로컬 모델 실행 옵션과 팀 협업 기능을 제공합니다.',
      usageLimit: '무료 플랜 제공, Pro $12/월',
      rating: 4.2
    },
    // 디자인 관련 도구 추가
    {
      id: 'canva',
      name: 'Canva',
      url: 'https://www.canva.com',
      domain: 'canva.com',
      category: 'design',
      price: 'freemium',
      features: ['템플릿 디자인', 'AI 이미지 생성', '브랜드 키트', 'UI/UX'],
      hasAPI: false,
      description: 'AI 기반 디자인 플랫폼. 템플릿과 AI 도구로 쉽게 디자인을 만들 수 있습니다.',
      usageLimit: '무료 플랜 제공, Pro $12.99/월',
      rating: 4.7
    },
    {
      id: 'figma',
      name: 'Figma',
      url: 'https://www.figma.com',
      domain: 'figma.com',
      category: 'design',
      price: 'freemium',
      features: ['UI/UX 디자인', '협업', '프로토타이핑'],
      hasAPI: true,
      description: '웹 기반 UI/UX 디자인 도구. 실시간 협업과 AI 기능을 지원합니다.',
      usageLimit: '무료 플랜 제공, Professional $12/월',
      rating: 4.8
    },
    {
      id: 'adobe-firefly',
      name: 'Adobe Firefly',
      url: 'https://firefly.adobe.com',
      domain: 'adobe.com',
      category: 'design',
      price: 'freemium',
      features: ['AI 이미지 생성', '텍스트 효과', '색상 편집', 'UI/UX'],
      hasAPI: true,
      description: 'Adobe의 AI 디자인 도구. Creative Cloud와 통합되어 전문적인 디자인 작업을 지원합니다.',
      usageLimit: '월 25 크레딧 무료, Premium 플랜 제공',
      rating: 4.5
    },
    {
      id: 'framer',
      name: 'Framer',
      url: 'https://www.framer.com',
      domain: 'framer.com',
      category: 'design',
      price: 'freemium',
      features: ['웹사이트 빌더', 'UI/UX 디자인', 'AI 생성', '노코드'],
      hasAPI: false,
      description: 'AI 기반 웹사이트 빌더. 디자인과 개발을 동시에 할 수 있는 UI/UX 도구입니다.',
      usageLimit: '무료 플랜 제공, Pro $20/월',
      rating: 4.6
    },
    {
      id: 'sketch',
      name: 'Sketch',
      url: 'https://www.sketch.com',
      domain: 'sketch.com',
      category: 'design',
      price: 'paid',
      features: ['UI/UX 디자인', '벡터 그래픽', '프로토타이핑', '플러그인'],
      hasAPI: true,
      description: '맥 전용 UI/UX 디자인 도구. 풍부한 플러그인과 심볼 시스템을 제공합니다.',
      usageLimit: '월 $9/에디터',
      rating: 4.4
    },
    {
      id: 'webflow',
      name: 'Webflow',
      url: 'https://webflow.com',
      domain: 'webflow.com',
      category: 'design',
      price: 'freemium',
      features: ['웹 디자인', 'UI/UX', '노코드', 'CMS'],
      hasAPI: true,
      description: '비주얼 웹 개발 플랫폼. UI/UX 디자인과 동시에 실제 웹사이트를 만들 수 있습니다.',
      usageLimit: '무료 플랜 제공, Basic $14/월',
      rating: 4.5
    },
    {
      id: 'penpot',
      name: 'Penpot',
      url: 'https://penpot.app',
      domain: 'penpot.app',
      category: 'design',
      price: 'free',
      features: ['UI/UX 디자인', '오픈소스', '협업', '프로토타이핑'],
      hasAPI: false,
      description: '오픈소스 UI/UX 디자인 도구. Figma의 무료 대안으로 사용할 수 있습니다.',
      usageLimit: '완전 무료',
      rating: 4.2
    },
    {
      id: 'lunacy',
      name: 'Lunacy',
      url: 'https://icons8.com/lunacy',
      domain: 'icons8.com',
      category: 'design',
      price: 'free',
      features: ['UI/UX 디자인', 'AI 도구', '아이콘 라이브러리', '크로스플랫폼'],
      hasAPI: false,
      description: '무료 UI/UX 디자인 도구. AI 기능과 방대한 리소스 라이브러리를 제공합니다.',
      usageLimit: '완전 무료',
      rating: 4.3
    },
    // 워크플로우 자동화 도구 추가
    {
      id: 'workflow-1',
      name: 'Zapier',
      url: 'https://zapier.com',
      category: 'workflow',
      price: 'freemium',
      features: ['자동화', '5000+ 앱 연동', 'No-code', 'Webhook', 'API'],
      hasAPI: true,
      description: '5000개 이상의 앱을 코드 없이 연동하는 최고의 자동화 플랫폼',
      usageLimit: '무료: 100 태스크/월',
      rating: 4.7,
      imageUrl: 'https://zapier.com/favicon.ico'
    },
    {
      id: 'workflow-2',
      name: 'Make (Integromat)',
      url: 'https://make.com',
      category: 'workflow',
      price: 'freemium',
      features: ['비주얼 워크플로우', '1000+ 앱', '복잡한 시나리오', 'API'],
      hasAPI: true,
      description: '비주얼 인터페이스로 복잡한 워크플로우를 구축하는 자동화 도구',
      usageLimit: '무료: 1000 작업/월',
      rating: 4.6,
      imageUrl: 'https://make.com/favicon.ico'
    },
    {
      id: 'workflow-3',
      name: 'n8n',
      url: 'https://n8n.io',
      category: 'workflow',
      price: 'freemium',
      features: ['Self-hosted', '오픈소스', '350+ 노드', 'Code 지원'],
      hasAPI: true,
      description: '셀프호스팅 가능한 오픈소스 워크플로우 자동화 플랫폼',
      usageLimit: '무료: Self-hosted 무제한',
      rating: 4.5,
      imageUrl: 'https://n8n.io/favicon.ico'
    },
    {
      id: 'workflow-4',
      name: 'IFTTT',
      url: 'https://ifttt.com',
      category: 'workflow',
      price: 'freemium',
      features: ['간단한 자동화', '700+ 서비스', '모바일 앱', 'IoT 지원'],
      hasAPI: true,
      description: 'If This Then That - 간단한 조건 기반 자동화 서비스',
      usageLimit: '무료: 2개 Applet',
      rating: 4.2,
      imageUrl: 'https://ifttt.com/favicon.ico'
    },
    {
      id: 'workflow-5',
      name: 'Pipedream',
      url: 'https://pipedream.com',
      category: 'workflow',
      price: 'freemium',
      features: ['코드 + No-code', 'Serverless', '500+ 앱', 'Node.js/Python'],
      hasAPI: true,
      description: '개발자 친화적인 서버리스 워크플로우 자동화 플랫폼',
      usageLimit: '무료: 10,000 호출/월',
      rating: 4.4,
      imageUrl: 'https://pipedream.com/favicon.ico'
    },
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
