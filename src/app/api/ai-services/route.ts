import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { getConnection } from '@/lib/db';
import { resolveCategoryFromNotion } from '@/config/aiCategories';
import { getAllServicesCached } from '@/lib/ai-services';
import sql from 'mssql';

// Notion 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

// Notion 페이지 객체를 AIService 객체로 변환하는 함수
function mapNotionToService(page: any): any {
  const props = page.properties;

  // 타입별 값 추출 헬퍼 함수
  const getUniqueId = (prop: any): string => {
    if (!prop?.unique_id) return '';
    return `${prop.unique_id.prefix}-${prop.unique_id.number}`;
  };
  
  const getPlainTextAll = (prop: any): string => {
    if (!prop) return '';
    if (Array.isArray(prop.rich_text)) {
      return prop.rich_text.map((t: any) => t?.plain_text || '').join('').trim();
    }
    if (Array.isArray(prop.title)) {
      return prop.title.map((t: any) => t?.plain_text || '').join('').trim();
    }
    return '';
  };
  
  const getTitle = (prop: any): string => {
    if (!prop?.title || !Array.isArray(prop.title)) return '';
    return prop.title[0]?.plain_text || '';
  };
  
  const getUrl = (prop: any): string => prop?.url || '';
  const getFilesFirstUrl = (prop: any): string => {
    try {
      const files = prop?.files;
      if (Array.isArray(files) && files.length > 0) {
        // 외부 링크 우선 선택, 없으면 파일 URL 사용
        const ext = files.find((f: any) => f?.external?.url)?.external?.url;
        if (ext) return ext;
        const f = files.find((f: any) => f?.file?.url)?.file?.url;
        if (f) return f;
      }
    } catch {}
    return '';
  };
  const getUrlOrRichText = (prop: any): string => {
    if (!prop) return '';
    if (typeof prop.url === 'string' && prop.url) return prop.url;
    if (Array.isArray(prop.rich_text)) {
      const txt = prop.rich_text.map((t: any) => t?.plain_text || '').join('').trim();
      return txt;
    }
    return '';
  };
  
  const getMultiSelect = (prop: any): string[] => {
    if (!prop?.multi_select || !Array.isArray(prop.multi_select)) return [];
    return prop.multi_select.map((item: any) => item.name);
  };
  const getSelect = (prop: any): string => prop?.select?.name || '';
  
  const getCheckbox = (prop: any): boolean => prop?.checkbox || false;

  // 카테고리 매핑 (공통 모듈 사용)
  const mapCategory = (notionCategories: string[]): string => resolveCategoryFromNotion(notionCategories);

  // 가격 정책 매핑: 내부 표준 키 ['free','trial','paid','partial','subscription','usage']
  const mapPricingKeys = (notionPricing: string[], textHint?: string): string[] => {
    const mapped = notionPricing.map(p => {
      if (p === '무료') return 'free';
      if (p === '무료체험') return 'trial';
      if (p === '부분무료') return 'partial';
      if (p === '유료') return 'paid';
      if (p === '구독형태') return 'subscription';
      if (p === '사용량 기반 결제') return 'usage';
      return 'paid';
    });

    const set = new Set<string>(mapped);

    // 텍스트 힌트 기반 보강 (노션 누락 대비)
    const t = (textHint || '').toLowerCase();
    const addIf = (cond: boolean, key: string) => { if (cond) set.add(key); };
    addIf(/\bfree trial\b|무료체험|체험판|trial|try for free|무료 크레딧|free credits/.test(t), 'trial');
    addIf(/사용량|usage-?based|pay as you go|종량제|per token|per credit|per request|per minute|per image|per word|토큰 단가/.test(t), 'usage');
    addIf(/구독|월 ?정액|연 ?정액|subscription|per month|monthly|annually|per year|\/mo/.test(t), 'subscription');
    addIf(/freemium|부분 ?유료|무료 플랜.*유료|무료\s*\+\s*유료|basic free/.test(t) || (/무료/.test(t) && /유료|paid/.test(t)), 'partial');
    addIf(/\bfree\b|무료(?!체험)/.test(t), 'free');

    return Array.from(set);
  };

  const name = getTitle(props['도구 이름']);
  const summary = getPlainTextAll(props['한줄평']);
  const description = getPlainTextAll(props['상세 내용']) || getPlainTextAll(props['사용 방식']);
  const textHint = [name, summary, description].join(' ');

  // 페이지 레벨 아이콘(노션 기본 아이콘) 보조 추출
  const getPageIconUrl = (): string => {
    try {
      const icon = page.icon as any;
      if (!icon) return '';
      if (icon.type === 'external' && icon.external?.url) return icon.external.url;
      if (icon.type === 'file' && icon.file?.url) return icon.file.url;
    } catch {}
    return '';
  };

  return {
    pageId: page.id,
    id: getUniqueId(props['ID']),
    name,
    summary,
    description,
    url: getUrl(props['URL']),
    features: getMultiSelect(props['태그']),
    category: mapCategory(getMultiSelect(props['카테고리'])),
    pricing: mapPricingKeys(getMultiSelect(props['가격 형태']), textHint),
    koreanSupport: getCheckbox(props['한국어 지원']),
    isKoreanService: getCheckbox(props['한국 서비스']),
    apiSupport: getSelect(props['api여부']) === '있음',
    loginMethods: getMultiSelect(props['로그인 방식']),
    // 아이콘은 files('아이콘') 우선, 없으면 '아이콘 URL', 마지막으로 페이지 아이콘 사용
    icon: ((): string => {
      const viaFiles = getFilesFirstUrl(props['아이콘']);
      if (viaFiles) return viaFiles;
      const viaUrl = getUrlOrRichText(props['아이콘 URL']);
      if (viaUrl) return viaUrl;
      const viaPageIcon = getPageIconUrl();
      return viaPageIcon || '';
    })(),
    iconSource: ((): 'files' | 'url' | undefined => {
      const viaFiles = getFilesFirstUrl(props['아이콘']);
      if (viaFiles) return 'files';
      const viaUrl = getUrlOrRichText(props['아이콘 URL']);
      if (viaUrl) return 'url';
      return undefined;
    })(),
  };
}

function extractNumericIdFromUnique(uniqueId: string): number | null {
  if (!uniqueId) return null;
  const m = uniqueId.match(/(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isNaN(n) ? null : n;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || process.env.NEXT_USE_SQL_AI || 'sql';
    const forceRefresh = url.searchParams.get('refresh') === '1';

    // 공통 파라미터
    const thin = url.searchParams.get('thin') === '1';
    const pageParam = url.searchParams.get('page');
    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset'); // page 우선, 없으면 offset 사용
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const category = url.searchParams.get('category') || 'all';
    const pricing = url.searchParams.get('pricing') || 'all';
    let sort = (url.searchParams.get('sort') || 'rating') as 'rating' | 'name' | 'users';
    const tagsParam = url.searchParams.get('tags') || '';
    const tags = tagsParam ? tagsParam.split(',').map(t => t.trim()).filter(Boolean) : [];

    // 간단 레이트리밋(IP 당 분당 120요청) 및 파라미터 검증
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
    const now = Date.now();
    // @ts-ignore
    global.__aiListRate__ = global.__aiListRate__ || new Map();
    // @ts-ignore
    const rl: Map<string, { t: number; c: number }> = global.__aiListRate__;
    const rec = rl.get(ip) || { t: now, c: 0 };
    if (now - rec.t > 60_000) { rec.t = now; rec.c = 0; }
    rec.c += 1; rl.set(ip, rec);
    if (rec.c > 120) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }
    if (q.length > 120) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 });
    }
    if (!['rating', 'name', 'users'].includes(sort)) sort = 'rating';
    const safeTags = tags.slice(0, 5).map(s => s.slice(0, 32));

    // SQL 경로 (기본)
    if (source === 'sql') {
      const sanitizeText = (text?: string | null): string => {
        let s = (text || '')
          // 개행 보존: \n,\r은 남기고 나머지 제어문자 제거
          .replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F]/g, ' ')
          .replace(/[\u200B-\u200D\uFEFF]/g, '')         // 제로폭
          .replace(/\uFFFD/g, '')                          // 대체문자
          .replace(/\r\n?/g, '\n')                       // 개행 정규화
          // 물음표 변형들 통합 처리: ? ？ ⁇ ⁈ ⁉
          .replace(/[\?\uFF1F]\s*…/g, '…')
          .replace(/[\?\uFF1F](?=\s+[\p{L}\p{N}])/gu, '. ')
          .replace(/[\?\uFF1F\u2047\u2048\u2049]\s*$/g, '')
          .replace(/[\?\uFF1F\u2047\u2048\u2049]/g, '')
          // 라인 내 공백 정규화 (개행은 보존)
          .replace(/[ \t\f\v\u00A0]+/g, ' ')
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n[ \t]+/g, '\n')
          // 연속 빈 줄 3+ → 2줄로 축약
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        return s;
      };

      const isAbsHttp = (v?: string | null): boolean => {
        if (!v) return false;
        try {
          const u = new URL(v);
          return u.protocol === 'http:' || u.protocol === 'https:';
        } catch { return false; }
      };

      const hostFromUrl = (v?: string | null): string | null => {
        if (!v) return null;
        try { return new URL(v).hostname || null; } catch { return null; }
      };

      const bestIconFor = (iconUrl: string | null, domain: string | null, url: string | null): string => {
        // 1) 원본이 절대 URL이면 그대로
        if (isAbsHttp(iconUrl)) return iconUrl as string;
        const host = (domain || hostFromUrl(url) || '').replace(/^www\./,'');
        if (host) {
          // 2) clearbit 우선, 실패시 프록시에서 404가 나면 프론트가 다시 호출하므로 여기선 후보만 제공
          return `https://logo.clearbit.com/${host}`;
        }
        // 마지막 폴백: 빈 문자열(프론트에서 placeholder 처리)
        return '';
      };

      const normalizeName = (rawName: string | null, domain: string | null, url: string | null): string => {
        let n = sanitizeText(rawName);
        // URL 형태면 호스트만 노출(프로토콜/슬래시 제거)
        if (isAbsHttp(n)) {
          try {
            const u = new URL(n);
            return u.hostname.replace(/^www\./,'');
          } catch { /* fallthrough */ }
        }
        // 이름이 비어있으면 domain → url host
        if (!n) {
          const host = (domain || hostFromUrl(url) || '').replace(/^www\./,'');
          return host;
        }
        // trailing 슬래시 제거
        if (/\/$/.test(n)) n = n.replace(/\/+$/, '');
        return n;
      };
      const pool = await getConnection();

      // 페이지네이션 계산
      let limit = Number.parseInt(limitParam || '20', 10);
      if (!Number.isFinite(limit) || limit <= 0) limit = 20;
      if (limit > 50) limit = 50;
      const page = Number.parseInt(pageParam || '1', 10);
      const offset = Number.isFinite(page) && page > 0
        ? (page - 1) * (Number.isFinite(limit) && limit > 0 ? limit : 20)
        : Number.parseInt(offsetParam || '0', 10) || 0;

      // 동적 필터를 위한 조건/파라미터 구성
      const conds: string[] = [];
      const req = pool.request();
      if (q) {
        conds.push(`(LOWER(s.name) LIKE @q OR LOWER(ISNULL(s.summary,'')) LIKE @q OR LOWER(ISNULL(s.description,'')) LIKE @q)`);
        req.input('q', sql.NVarChar, `%${q}%`);
      }
      if (category !== 'all') {
        conds.push(`LOWER(ISNULL(s.primary_category,'')) = @category`);
        req.input('category', sql.NVarChar, category.toLowerCase());

        // PPT 카테고리는 노이즈 방지를 위해 추가 키워드 필터 적용
        if (category.toLowerCase() === 'ppt') {
          const pptSyns = ['ppt','power point','powerpoint','presentation','presentations','slide','slides','deck','프레젠테이션','슬라이드','발표','파워포인트'];
          const use = pptSyns.slice(0, 6);
          const orConds: string[] = [];
          use.forEach((kw, i) => {
            const p = `ppt${i}`;
            req.input(p, sql.NVarChar, `%${kw}%`);
            orConds.push(`LOWER(ISNULL(s.name,'')) LIKE @${p}`);
            orConds.push(`LOWER(ISNULL(s.summary,'')) LIKE @${p}`);
            orConds.push(`LOWER(ISNULL(s.description,'')) LIKE @${p}`);
            orConds.push(`EXISTS (SELECT 1 FROM dbo.ai_service_tags tg WHERE tg.service_id = s.id AND LOWER(tg.tag) LIKE @${p})`);
          });
          if (orConds.length) {
            conds.push(`(${orConds.join(' OR ')})`);
          }
        }
      }
      if (pricing !== 'all') {
        conds.push(`EXISTS (SELECT 1 FROM dbo.ai_service_pricing p WHERE p.service_id = s.id AND p.pricing_type = @pricing)`);
        req.input('pricing', sql.NVarChar, pricing);
      }
      if (safeTags.length > 0) {
        // 모든 태그 포함
        safeTags.forEach((t, i) => {
          const p = `tag${i}`;
          conds.push(`EXISTS (SELECT 1 FROM dbo.ai_service_tags tg WHERE tg.service_id = s.id AND tg.tag LIKE @${p})`);
          req.input(p, sql.NVarChar, `%${t}%`);
        });
      }

      const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

      // 정렬 키
      let orderBy = 's.id DESC';
      if (sort === 'name') orderBy = 's.name ASC';
      if (sort === 'users') orderBy = 's.id DESC';

      // 총개수
      const countSql = `SELECT COUNT(*) AS total FROM dbo.ai_services s ${whereSql}`;
      const { recordset: countRows } = await req.query(countSql);
      const total = countRows?.[0]?.total ?? 0;

      // 목록 쿼리
      const req2 = pool.request();
      // 동일 파라미터 다시 바인딩
      if (q) req2.input('q', sql.NVarChar, `%${q}%`);
      if (category !== 'all') req2.input('category', sql.NVarChar, category.toLowerCase());
      if (pricing !== 'all') req2.input('pricing', sql.NVarChar, pricing);
      safeTags.forEach((t, i) => req2.input(`tag${i}`, sql.NVarChar, `%${t}%`));
      req2.input('offset', sql.Int, offset);
      req2.input('limit', sql.Int, Number.isFinite(limit) && limit > 0 ? limit : 20);

      const listSql = `
        SELECT s.id, s.domain, s.name, s.url, s.summary, s.description, s.primary_category, s.icon_url,
               s.korean_support, s.is_korean_service, s.api_support
        FROM dbo.ai_services s
        ${whereSql}
        ORDER BY ${orderBy}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;
      const { recordset: rows } = await req2.query(listSql);
      const serviceIds = rows.map(r => r.id);

      // 하위 배열들
      const idTable = serviceIds.length ? `(${serviceIds.join(',')})` : '(NULL)';
      // 평점: 뷰 우선, 없으면 동적 탐색(없으면 0 처리)
      const viewExistsReq = await pool.request().query(
        "SELECT 1 AS ok FROM sys.objects WHERE object_id = OBJECT_ID('dbo.vw_service_rating_summary') AND type = 'V'"
      ).catch(() => ({ recordset: [] as any[] }));
      const viewExists = !!viewExistsReq?.recordset?.[0]?.ok;
      const ratingColReq = await pool.request().query(
        "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('score','rating','stars','star','value','rate')"
      ).catch(() => ({ recordset: [] as any[] }));
      const ratingCol = ratingColReq?.recordset?.[0]?.name as string | undefined;
      const fkColReq = await pool.request().query(
        "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('service_id','tool_id','ai_service_id','service','target_service_id')"
      ).catch(() => ({ recordset: [] as any[] }));
      const reviewsFkCol = fkColReq?.recordset?.[0]?.name as string | undefined;

      const [pricingRows, tagRows, ratingRows] = await Promise.all([
        pool.request().query(`SELECT service_id, pricing_type FROM dbo.ai_service_pricing WHERE service_id IN ${idTable}`),
        pool.request().query(`SELECT service_id, tag FROM dbo.ai_service_tags WHERE service_id IN ${idTable}`),
        viewExists
          ? pool.request().query(`SELECT service_id, AVG(CAST(avg_rating AS FLOAT)) AS rating, SUM(CAST(review_count AS INT)) AS review_count FROM dbo.vw_service_rating_summary WHERE service_id IN ${idTable} GROUP BY service_id`)
          : (ratingCol && reviewsFkCol
              ? pool.request().query(`SELECT [${reviewsFkCol}] AS service_id, AVG(CAST([${ratingCol}] AS FLOAT)) AS rating, COUNT(*) AS review_count FROM dbo.ai_reviews WHERE [${reviewsFkCol}] IN ${idTable} GROUP BY [${reviewsFkCol}]`)
              : Promise.resolve({ recordset: [] as any[] })),
      ]);
      const pricingMap = new Map<number, string[]>();
      pricingRows.recordset?.forEach(r => {
        const arr = pricingMap.get(r.service_id) || [];
        arr.push(r.pricing_type);
        pricingMap.set(r.service_id, arr);
      });
      const tagMap = new Map<number, string[]>();
      tagRows.recordset?.forEach(r => {
        const arr = tagMap.get(r.service_id) || [];
        arr.push(r.tag);
        tagMap.set(r.service_id, arr);
      });
      const ratingMap = new Map<number, { rating: number; reviewCount: number }>();
      ratingRows.recordset?.forEach(r => {
        ratingMap.set(r.service_id, { rating: r.rating ?? 0, reviewCount: r.review_count ?? 0 });
      });

      const services = rows.map(r => {
        const name = normalizeName(r.name, r.domain, r.url);
        return ({
        id: r.id,
        domain: r.domain,
        name,
        url: r.url,
        summary: sanitizeText(r.summary),
        description: sanitizeText(r.description),
        category: (() => {
          const c = (r.primary_category || '').trim();
          if (!c) return null;
          const lower = c.toLowerCase();
          if (lower === '기타' || lower === 'etc' || lower === 'other') return null;
          return c;
        })(),
        pricing: pricingMap.get(r.id) || [],
        features: tagMap.get(r.id) || [],
        koreanSupport: !!r.korean_support,
        isKoreanService: !!r.is_korean_service,
        apiSupport: !!r.api_support,
        // 프론트는 /api/proxy-image?url=<encoded> 로 1회만 래핑해서 사용
        icon: bestIconFor(r.icon_url, r.domain, r.url),
        rating: ratingMap.get(r.id)?.rating ?? 0,
        reviewCount: ratingMap.get(r.id)?.reviewCount ?? 0,
        });
      });

      return NextResponse.json({ services, total });
    }

    // Notion 스냅샷/캐시 경로(폴백)
    const { services, etag, fetchedAt } = await getAllServicesCached(!!forceRefresh);

    // ETag 처리: If-None-Match가 현재 etag와 같으면 304 (강제 새로고침이 아닐 때만 적용)
    if (!forceRefresh) {
      const inm = request.headers.get('if-none-match');
      if (inm && inm === etag) {
        const notModified = new NextResponse(null, { status: 304 });
        notModified.headers.set('ETag', etag);
        notModified.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
        notModified.headers.set('X-Cache-Fetched-At', String(fetchedAt));
        return notModified;
      }
    }

    // thin 응답 + 서버사이드 필터/정렬/페이지네이션
    let list = services.slice();

    // 검색 필터
    if (q) {
      list = list.filter((service: any) => {
        const name = (service.name || '').toLowerCase();
        const summary = (service.summary || '').toLowerCase();
        const description = (service.description || '').toLowerCase();
        const features = Array.isArray(service.features) ? service.features : [];
        return (
          name.includes(q) ||
          summary.includes(q) ||
          description.includes(q) ||
          features.some((feature: string) => (feature || '').toLowerCase().includes(q))
        );
      });
    }

    // 카테고리 필터
    if (category && category !== 'all') {
      list = list.filter((service: any) => service.category === category);
    }

    // 가격 필터
    if (pricing && pricing !== 'all') {
      list = list.filter((service: any) => Array.isArray(service.pricing) && service.pricing.some((p: string) => p === pricing));
    }

    // 태그 필터 (모든 태그 포함)
    if (tags.length > 0) {
      list = list.filter((service: any) => {
        const fs = Array.isArray(service.features) ? service.features : [];
        const lower = fs.map((f: string) => (f || '').toLowerCase());
        return tags.every(tag => lower.some((f: string) => f.includes(tag.toLowerCase())));
      });
    }

    // 정렬
    list.sort((a: any, b: any) => {
      switch (sort) {
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'name':
          return (a.name || '').localeCompare(b.name || '');
        case 'users':
          return (b.userCount || 0) - (a.userCount || 0);
        default:
          return 0;
      }
    });

    const total = list.length;

    // 페이지네이션 계산: page 우선
    const limit = Number.parseInt(limitParam || '20', 10);
    const page = Number.parseInt(pageParam || '1', 10);
    let start = 0;
    if (Number.isFinite(page) && page > 0) {
      start = (page - 1) * (Number.isFinite(limit) && limit > 0 ? limit : 20);
    } else {
      const offset = Number.parseInt(offsetParam || '0', 10);
      if (Number.isFinite(offset) && offset > 0) start = offset;
    }
    const end = start + (Number.isFinite(limit) && limit > 0 ? limit : 20);
    list = list.slice(start, end);

    const body = thin
      ? { services: list.map((s: any) => ({ id: s.id, name: s.name, summary: s.summary || '', description: s.description || '', url: s.url, icon: s.icon, category: s.category, pricing: s.pricing || [], features: s.features || [], rating: s.rating, userCount: s.userCount })), total }
      : { services: list, total };

    const res = NextResponse.json(body);
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    res.headers.set('X-Cache-Fetched-At', String(fetchedAt));
    return res;
  } catch (error) {
    console.error('AI 서비스 목록을 가져오는 중 오류 발생:', error);
    return NextResponse.json({ 
      services: [], 
      error: 'Unexpected error: ' + (error as Error).message
    }, { status: 500 });
  }
}
