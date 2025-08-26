import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CATEGORY_SYNONYMS } from '@/config/aiCategories';
import { Client } from '@notionhq/client';
import { getConnection } from '@/lib/db';
import { resolveCategoryFromNotion } from '@/config/aiCategories';
import { getAllServicesCached } from '@/lib/ai-services';

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
    // 간단한 IP 기반 레이트리밋 (메모리)
    const rateLimited = checkRateLimit(request);
    if (rateLimited.limited) {
      const res = new NextResponse('Too Many Requests', { status: 429 });
      res.headers.set('Retry-After', String(rateLimited.retryAfterSec));
      res.headers.set('X-RateLimit-Limit', String(rateLimited.limit));
      res.headers.set('X-RateLimit-Remaining', String(Math.max(0, rateLimited.remaining)));
      return res;
    }

    const { services, etag, fetchedAt, fromCache } = await getAllServicesCached(false);

    // ETag 처리: If-None-Match가 현재 etag와 같으면 304
    const inm = request.headers.get('if-none-match');
    if (inm && inm === etag) {
      const notModified = new NextResponse(null, { status: 304 });
      notModified.headers.set('ETag', etag);
      notModified.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
      notModified.headers.set('X-Cache-Fetched-At', String(fetchedAt));
      return notModified;
    }

    // thin 응답 + 서버사이드 필터/정렬/페이지네이션 + 쿼리 유효성 검증
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());

    const QuerySchema = z.object({
      thin: z.literal('1').optional(),
      page: z.string().regex(/^\d+$/).transform(Number).optional(),
      limit: z.string().regex(/^\d+$/).transform(Number).optional(),
      offset: z.string().regex(/^\d+$/).transform(Number).optional(),
      cursor: z.string().optional(),
      q: z.string().trim().max(100).optional(),
      category: z.enum(['all','chat','image','video','audio','avatar','writing','coding','productivity']).optional(),
      // freemium 은 partial 로 매핑
      pricing: z.enum(['all','free','trial','partial','paid','subscription','usage','freemium']).optional(),
      sort: z.enum(['rating','name','users']).optional(),
      tags: z.string().optional(),
    });

    const parsed = QuerySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters', issues: parsed.error.flatten() }, { status: 400 });
    }
    const qp = parsed.success ? parsed.data : {} as any;

    const thin = qp.thin === '1';
    const pageParam = qp.page ? String(qp.page) : undefined;
    const limitParam = qp.limit ? String(qp.limit) : undefined;
    const offsetParam = qp.offset ? String(qp.offset) : undefined;
    const cursorParam = qp.cursor ? String(qp.cursor) : undefined;
    const q = (qp.q || '').toLowerCase();
    const category = qp.category || 'all';
    const pricingRaw = qp.pricing || 'all';
    const pricing = pricingRaw === 'freemium' ? 'partial' : pricingRaw;
    const sort = (qp.sort || 'rating') as 'rating' | 'name' | 'users';
    const tagsParam = qp.tags || '';
    const tags = sanitizeTags(tagsParam);

    if (tags.length > 10 || tags.some(t => t.length > 32)) {
      return NextResponse.json({ error: 'Invalid tags parameter' }, { status: 400 });
    }

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
        const lower: string[] = fs.map((f: string) => String(f || '').toLowerCase());
        return tags.every((tag: string) => lower.some((f: string) => f.includes(tag.toLowerCase())));
      });
    }

    // 동의어 기반 카테고리 부스팅 (q에서 유추, category=all 일 때만)
    const inferredCategory: string | null = inferCategoryFromQuery(q);

    // 정렬 (부스팅 우선 적용 후 정렬 기준)
    list.sort((a: any, b: any) => {
      const boostA = (category === 'all' && inferredCategory) ? (a.category === inferredCategory ? 1 : 0) : 0;
      const boostB = (category === 'all' && inferredCategory) ? (b.category === inferredCategory ? 1 : 0) : 0;
      if (boostA !== boostB) return boostB - boostA;
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

    let total = list.length;

    // 페이지네이션 계산: cursor 우선, 없으면 page/offset
    const limit = Number.parseInt(limitParam || '20', 10);
    let start = 0;
    if (cursorParam) {
      const parsedCursor = parseCursor(cursorParam);
      start = parsedCursor?.o && Number.isFinite(parsedCursor.o) ? Math.max(0, parsedCursor.o) : 0;
    } else {
      const page = Number.parseInt(pageParam || '1', 10);
      if (Number.isFinite(page) && page > 0) {
        start = (page - 1) * (Number.isFinite(limit) && limit > 0 ? limit : 20);
      } else {
        const offset = Number.parseInt(offsetParam || '0', 10);
        if (Number.isFinite(offset) && offset > 0) start = offset;
      }
    }
    const usedLimit = (Number.isFinite(limit) && limit > 0 ? limit : 20);
    const end = start + usedLimit;
    let nextCursor = end < total ? makeCursor({ o: end }) : null;
    list = list.slice(start, end);

    // 제로결과 방지 폴백: 필터 완화 → 키워드 중심 추천, 최소 3개 보장
    let fallback: 'none' | 'relaxed' | 'keyword' = 'none';
    const MIN_K = 3;
    if (list.length === 0) {
      // 1단계: 카테고리 무시, 태그 매칭을 any-match 로 완화하여 재검색
      const anyTagMatch = (svc: any) => {
        if (tags.length === 0) return true;
        const fs: unknown[] = Array.isArray(svc.features) ? svc.features : [];
        const lower: string[] = fs.map((f: any) => String(f || '').toLowerCase());
        return tags.some((tag: string) => lower.some((f: string) => f.includes(tag.toLowerCase())));
      };
      let relaxed = services.filter((svc: any) => {
        const name = (svc.name || '').toLowerCase();
        const summary = (svc.summary || '').toLowerCase();
        const description = (svc.description || '').toLowerCase();
        const matchesQ = q ? (name.includes(q) || summary.includes(q) || description.includes(q)) : true;
        const matchesPricing = pricing && pricing !== 'all' ? (Array.isArray(svc.pricing) && svc.pricing.some((p: string) => p === pricing)) : true;
        const matchesTags = anyTagMatch(svc);
        return matchesQ && matchesPricing && matchesTags;
      });

      // 정렬 유지
      relaxed.sort((a: any, b: any) => {
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

      if (relaxed.length > 0) {
        fallback = 'relaxed';
        total = relaxed.length;
        list = relaxed.slice(0, Math.max(MIN_K, Math.min(limit, relaxed.length)));
      }
    }

    if (list.length === 0) {
      // 2단계: 키워드 유사도 기반 Top-K (전역)
      const keyword = q.trim();
      const score = (svc: any): number => {
        if (!keyword) return 0;
        const fields = [svc.name, svc.summary, svc.description, ...(Array.isArray(svc.features) ? svc.features : [])]
          .map((v: any) => String(v || '').toLowerCase());
        let s = 0;
        for (const f of fields) {
          if (!f) continue;
          if (f === keyword) s += 5;
          else if (f.includes(keyword)) s += 2;
        }
        return s;
      };
      const ranked = services
        .map(svc => ({ svc, s: score(svc) }))
        .sort((a, b) => b.s - a.s)
        .filter(x => x.s > 0)
        .map(x => x.svc);
      if (ranked.length > 0) {
        fallback = 'keyword';
        total = ranked.length;
        list = ranked.slice(0, Math.max(MIN_K, Math.min(limit, ranked.length)));
      }
    }

    if (list.length === 0) {
      // 3단계: 전체에서 기본 정렬 기준으로 Top-K 보장
      const base = services.slice();
      base.sort((a: any, b: any) => {
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
      list = base.slice(0, Math.max(MIN_K, Math.min(limit, base.length)));
      total = services.length;
      if (list.length > 0) fallback = fallback === 'none' ? 'keyword' : fallback; // 최소 배지 유지
    }

    // 폴백 발생 시 nextCursor 재계산 (폴백은 항상 0부터 usedLimit까지 슬라이스)
    if (fallback !== 'none') {
      const effectiveStart = 0;
      const effectiveEnd = effectiveStart + usedLimit;
      nextCursor = effectiveEnd < total ? makeCursor({ o: effectiveEnd }) : null;
    }

    const body = thin
      ? { services: list.map((s: any) => ({ id: s.id, name: s.name, summary: s.summary || '', description: s.description || '', url: s.url, icon: s.icon, category: s.category, pricing: s.pricing || [], features: s.features || [], rating: s.rating, userCount: s.userCount })), total, nextCursor, fallback }
      : { services: list, total, nextCursor, fallback };

    const res = NextResponse.json(body);
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    res.headers.set('X-Cache-Fetched-At', String(fetchedAt));
    res.headers.set('Vary', 'Accept-Encoding');
    res.headers.set('X-Result-Fallback', fallback);
    res.headers.set('X-Result-Source', fromCache ? 'cache' : 'live');
    return res;
  } catch (error) {
    console.error('AI 서비스 목록을 가져오는 중 오류 발생:', error);
    return NextResponse.json({ 
      services: [], 
      error: 'Unexpected error: ' + (error as Error).message
    }, { status: 500 });
  }
}

// ---------- helpers ----------
const limiterStore: Map<string, { tokens: number; updatedAt: number }> = new Map();
const RL_CAP = 60; // 분당 60 요청
const RL_REFILL_MS = 60 * 1000;
function checkRateLimit(request: NextRequest): { limited: boolean; retryAfterSec: number; limit: number; remaining: number } {
  const ip = getClientIp(request) || 'unknown';
  const now = Date.now();
  const entry = limiterStore.get(ip) || { tokens: RL_CAP, updatedAt: now };
  // 토큰 리필
  const elapsed = now - entry.updatedAt;
  if (elapsed >= RL_REFILL_MS) {
    entry.tokens = RL_CAP;
    entry.updatedAt = now;
  }
  if (entry.tokens <= 0) {
    const retryAfter = Math.ceil((entry.updatedAt + RL_REFILL_MS - now) / 1000);
    limiterStore.set(ip, entry);
    return { limited: true, retryAfterSec: Math.max(1, retryAfter), limit: RL_CAP, remaining: 0 };
  }
  entry.tokens -= 1;
  limiterStore.set(ip, entry);
  return { limited: false, retryAfterSec: 0, limit: RL_CAP, remaining: entry.tokens };
}

function getClientIp(request: NextRequest): string | null {
  const xf = request.headers.get('x-forwarded-for');
  if (xf) return xf.split(',')[0].trim();
  // @ts-ignore
  return (request as any).ip || null;
}

function sanitizeTags(tagsParam: string): string[] {
  if (!tagsParam) return [];
  return Array.from(new Set(
    tagsParam
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      // 한글/영문/숫자/공백/하이픈/언더스코어만 허용 (유니코드 프로퍼티 미사용)
      .map(t => t.replace(/[^a-zA-Z0-9가-힣\- _]/g, ''))
      .filter(t => t.length > 0)
  ))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 10);
}

function inferCategoryFromQuery(q: string): string | null {
  if (!q) return null;
  const ql = q.toLowerCase();
  for (const [key, arr] of Object.entries(CATEGORY_SYNONYMS)) {
    for (const syn of arr) {
      if (ql.includes(String(syn).toLowerCase())) return key;
    }
  }
  return null;
}

function makeCursor(obj: { o: number }): string {
  try {
    return Buffer.from(JSON.stringify(obj)).toString('base64url');
  } catch {
    return '';
  }
}

function parseCursor(s: string): { o: number } | null {
  try {
    const json = Buffer.from(s, 'base64url').toString('utf8');
    const obj = JSON.parse(json);
    if (typeof obj?.o === 'number' && Number.isFinite(obj.o)) return { o: obj.o };
    return null;
  } catch {
    return null;
  }
}
