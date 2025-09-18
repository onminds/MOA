import { Client } from '@notionhq/client';
import fs from 'fs/promises';
import { getConnection } from '@/lib/db';
import { resolveCategoryFromNotion } from '@/config/aiCategories';

// Notion 클라이언트 초기화
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

type Service = any;

let cachedServices: Service[] | null = null;
let lastFetchedAt = 0;
let cachedEtag = '';
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5분

function getTtlMs(): number {
  const v = parseInt(process.env.AI_SERVICES_CACHE_TTL_MS || '', 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_TTL_MS;
}

function stringHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return `W/"${hash.toString(16)}-${input.length}"`;
}

// ---------- text sanitization helpers ----------
function removeControlChars(text: string): string {
  return String(text || '').replace(/[\u0000-\u001F\u007F]/g, '');
}
function normalizeWhitespace(text: string): string {
  return removeControlChars(text).replace(/\s+/g, ' ').trim();
}
function sanitizeText(text: string, maxLen: number): string {
  const t = normalizeWhitespace(text);
  if (!Number.isFinite(maxLen) || maxLen <= 0) return t;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

// 멀티라인 텍스트 정규화: 줄바꿈(\n)은 보존, 공백은 정리
function removeControlExceptNewline(text: string): string {
  return String(text || '').replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '');
}
function sanitizeMultiline(text: string, maxLen: number): string {
  const normalized = removeControlExceptNewline(text)
    .replace(/\r\n?/g, '\n') // CRLF -> LF
    .split('\n')
    .map(line => line.replace(/[\t ]+/g, ' ').trimEnd())
    .join('\n')
    // 번호/단계 표기 뒤 공백만 있고 줄바꿈이 사라진 경우를 보정
    // 예: "1. 단계 설명 2. 다음 단계" -> "1. 단계 설명\n2. 다음 단계"
    .replace(/(\b\d+\.|\b[\d]+\))\s+/g, (m) => m) // 토큰 보존용 일차 처리
    .replace(/(\b\d+\.|\b\d+\))\s+(?=\d+\.|\d+\)|-\s)/g, '$1\n')
    // 하이픈 리스트가 한 줄에 이어붙은 경우 분리: "- 항목1 - 항목2" -> 줄바꿈
    .replace(/-\s+(?=-\s)/g, '- ')
    .replace(/-\s+(?=\w)/g, '- ')
    .replace(/\n{3,}/g, '\n\n') // 과도한 빈줄 축소
    .trim();
  if (!Number.isFinite(maxLen) || maxLen <= 0) return normalized;
  return normalized.length > maxLen ? normalized.slice(0, maxLen) : normalized;
}

// 노션 텍스트 속성 키 후보들 중 처음 채워진 값을 반환
function getFirstTextByKeys(props: any, keys: string[], getter: (p: any) => string): string {
  for (const k of keys) {
    try {
      const v = getter(props[k]);
      if (v && v.trim().length > 0) return v;
    } catch {}
  }
  return '';
}

function sanitizeUrlToDomain(u?: string): string {
  if (!u) return '';
  try {
    const hasProtocol = /^https?:\/\//i.test(u);
    const url = new URL(hasProtocol ? u : `https://${u}`);
    if (!/^https?:$/i.test(url.protocol)) return '';
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (!host) return '';
    return `https://${host}`;
  } catch {
    return '';
  }
}

// Notion 페이지 객체를 AIService 객체로 변환하는 함수
function mapNotionToService(page: any): any {
  const props = page.properties;

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

  const mapCategory = (notionCategories: string[]): string => resolveCategoryFromNotion(notionCategories);

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
    const t = (textHint || '').toLowerCase();
    const addIf = (cond: boolean, key: string) => { if (cond) set.add(key); };
    addIf(/\bfree trial\b|무료체험|체험판|trial|try for free|무료 크레딧|free credits/.test(t), 'trial');
    addIf(/사용량|usage-?based|pay as you go|종량제|per token|per credit|per request|per minute|per image|per word|토큰 단가/.test(t), 'usage');
    addIf(/구독|월 ?정액|연 ?정액|subscription|per month|monthly|annually|per year|\/mo/.test(t), 'subscription');
    addIf(/freemium|부분 ?유료|무료 플랜.*유료|무료\s*\+\s*유료|basic free/.test(t) || (/무료/.test(t) && /유료|paid/.test(t)), 'partial');
    addIf(/\bfree\b|무료(?!체험)/.test(t), 'free');
    return Array.from(set);
  };

  const nameRaw = getTitle(props['도구 이름']);
  const summaryRaw = getPlainTextAll(props['한줄평']);
  const descriptionRaw = getFirstTextByKeys(props, ['상세 내용','설명','Description','요약 상세','사용 방법','사용법','사용 방식'], getPlainTextAll);
  const usageRaw = getFirstTextByKeys(props, ['사용 방법','사용법','사용 방식','How to','Guide'], getPlainTextAll);
  const name = sanitizeText(nameRaw, 120);
  const summary = sanitizeText(summaryRaw, 280);
  const description = sanitizeMultiline(descriptionRaw, 4000);
  const usage = sanitizeMultiline(usageRaw, 4000);
  const textHint = [name, summary, description].join(' ');

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
    usage,
    url: sanitizeUrlToDomain(getUrl(props['URL'])),
    features: getMultiSelect(props['태그']).map((t: string) => sanitizeText(t, 64)).filter(Boolean),
    category: mapCategory(getMultiSelect(props['카테고리'])),
    pricing: mapPricingKeys(getMultiSelect(props['가격 형태']), textHint),
    koreanSupport: getCheckbox(props['한국어 지원']),
    isKoreanService: getCheckbox(props['한국 서비스']),
    apiSupport: getSelect(props['api여부']) === '있음',
    loginMethods: getMultiSelect(props['로그인 방식']),
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

async function fetchAllServicesNoCache(): Promise<Service[]> {
  // 환경 변수 미설정 시 테스트 데이터 반환
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
    const testServices = [
      {
        pageId: 'test-page-1',
        id: 'test-1',
        name: 'FastCut AI',
        summary: 'AI 기반 비디오 편집 도구',
        description: 'FastCut AI는 인공지능을 활용하여 비디오 편집을 자동화하는 도구입니다.',
        url: 'https://fastcut.ai',
        features: ['비디오 편집', 'AI 자동화', '템플릿'],
        category: 'video',
        pricing: ['free', 'trial'],
        koreanSupport: true,
        isKoreanService: false,
        apiSupport: true,
        loginMethods: ['이메일', '구글'],
        rating: 4.5,
        userCount: 1000,
        icon: '',
      }
    ];
    return testServices as Service[];
  }

  // 1) Notion 데이터 전부 가져오기 (장애 시 스냅샷 폴백)
  let servicesFromNotion: any[] = [];
  try {
    const allPages: any[] = [];
    let startCursor: string | undefined = undefined;
    let hasMore = true;
    while (hasMore) {
      const response: any = await notion.databases.query({
        database_id: databaseId,
        filter: {
          property: '도구 이름',
          title: { is_not_empty: true },
        },
        start_cursor: startCursor,
        page_size: 100,
      });
      allPages.push(...(response.results || []));
      hasMore = Boolean(response.has_more);
      startCursor = response.next_cursor || undefined;
    }
    servicesFromNotion = allPages.map(mapNotionToService);
  } catch (e) {
    // 스냅샷 폴백
    try {
      const snapshotPath = process.env.AI_SERVICES_SNAPSHOT_PATH || 'AI_Tools_Website/ai_tools_500_final.json';
      const raw = await fs.readFile(snapshotPath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        servicesFromNotion = data.map((item: any, idx: number) => ({
          pageId: `snapshot-${idx}`,
          id: String(item.id || item.slug || `snap-${idx}`),
          name: sanitizeText(item.name || item.title || '', 120),
          summary: sanitizeText(item.summary || item.description || '', 280),
          description: sanitizeText(item.description || item.summary || '', 4000),
          url: sanitizeUrlToDomain(item.url || item.link || ''),
          features: Array.isArray(item.tags) ? item.tags.map((t: any) => sanitizeText(String(t), 64)) : [],
          category: sanitizeText((item.category || 'productivity').toString().toLowerCase(), 32),
          pricing: Array.isArray(item.pricing) ? item.pricing : [],
          koreanSupport: false,
          isKoreanService: false,
          apiSupport: false,
          loginMethods: [],
          icon: String(item.icon || ''),
        }));
      }
    } catch {
      servicesFromNotion = [];
    }
  }

  // 2) 선택적 DB 평점 병합(타임아웃 5초)
  let ratingMap = new Map<number, { avgRating: number; reviewCount: number }>();
  try {
    const pool = await getConnection();
    const ratingResult = await Promise.race([
      pool.request().query(`
        SELECT 
          tool_id,
          AVG(CAST(rating AS FLOAT)) as avg_rating,
          COUNT(*) as review_count
        FROM ai_reviews 
        WHERE is_deleted = 0
        GROUP BY tool_id
      `),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB 쿼리 타임아웃')), 5000))
    ]) as any;
    ratingResult.recordset.forEach((row: any) => {
      ratingMap.set(Number(row.tool_id), {
        avgRating: Math.round(row.avg_rating * 10) / 10,
        reviewCount: row.review_count,
      });
    });
  } catch {
    // DB 실패 시 무시하고 계속 진행
  }

  const finalServices = servicesFromNotion.map((service: any) => {
    const numericId = extractNumericIdFromUnique(service.id);
    const ratingData = numericId !== null ? ratingMap.get(numericId) : undefined;
    return {
      ...service,
      rating: ratingData ? ratingData.avgRating : 0,
      userCount: ratingData ? ratingData.reviewCount : 0,
    };
  });
  return finalServices as Service[];
}

export async function getAllServicesCached(forceRefresh = false): Promise<{ services: Service[]; etag: string; fromCache: boolean; fetchedAt: number; }>{
  const ttlMs = getTtlMs();
  const now = Date.now();
  if (!forceRefresh && cachedServices && (now - lastFetchedAt) < ttlMs) {
    return { services: cachedServices, etag: cachedEtag, fromCache: true, fetchedAt: lastFetchedAt };
  }

  const services = await fetchAllServicesNoCache();
  const etag = stringHash(JSON.stringify(services));
  cachedServices = services;
  lastFetchedAt = now;
  cachedEtag = etag;
  return { services, etag, fromCache: false, fetchedAt: lastFetchedAt };
}

// 외부에서 목록 캐시를 무효화할 수 있도록 export
export function invalidateAiServicesCache(): void {
  cachedServices = null;
  lastFetchedAt = 0;
  cachedEtag = '';
}

export function findServiceByIdOrDomain(services: Service[], idOrDomain: string): Service | null {
  const idParam = String(idOrDomain);
  const normalizeDomain = (u?: string) => {
    if (!u) return '';
    try {
      const url = new URL(u.startsWith('http') ? u : `https://${u}`);
      return url.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return String(u).replace(/^www\./, '').toLowerCase();
    }
  };
  const foundById = services.find((s: any) => String(s.id) === idParam);
  const foundByDomain = services.find((s: any) => normalizeDomain(s.url) === idParam.toLowerCase());
  return foundById || foundByDomain || null;
}


