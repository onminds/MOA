import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const url = new URL(request.url);
    const source = url.searchParams.get('source') || process.env.NEXT_USE_SQL_AI || 'sql';
    const { id } = await params;

    if (source !== 'sql') {
      // SQL 전환 기본값이지만, 혹시 모를 폴백: Notion 캐시 경로는 비활성화
      // 항상 SQL 사용을 보장하기 위해 여기서도 SQL로 강제 진행
    }

    const pool = await getConnection();

    // 텍스트 정규화(목록과 동일 규칙)
    const sanitizeText = (text?: string | null): string => {
      let s = (text || '')
        .replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F]/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\uFFFD/g, '')
        .replace(/\r\n?/g, '\n')
        .replace(/[\?\uFF1F]\s*…/g, '…')
        .replace(/[\?\uFF1F](?=\s+[\p{L}\p{N}])/gu, '. ')
        .replace(/[\?\uFF1F\u2047\u2048\u2049]\s*$/g, '')
        .replace(/[\?\uFF1F\u2047\u2048\u2049]/g, '')
        .replace(/[ \t\f\v\u00A0]+/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
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
      if (isAbsHttp(iconUrl)) return iconUrl as string;
      const host = (domain || hostFromUrl(url) || '').replace(/^www\./,'');
      if (host) return `https://logo.clearbit.com/${host}`;
      return '';
    };
    const normalizeName = (rawName: string | null, domain: string | null, urlStr: string | null): string => {
      let n = sanitizeText(rawName);
      if (isAbsHttp(n)) {
        try {
          const u = new URL(n);
          return u.hostname.replace(/^www\./,'');
        } catch {}
      }
      if (!n) {
        const host = (domain || hostFromUrl(urlStr) || '').replace(/^www\./,'');
        return host;
      }
      if (/\/$/.test(n)) n = n.replace(/\/+$/, '');
      return n;
    };

    // 입력값 파싱: 숫자 id 또는 도메인/별칭
    const raw = String(id || '').trim();
    const numericId = /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
    const domOrName = raw.toLowerCase();

    // 우선순위: id → domain → name → alias
    const req = pool.request();
    if (numericId !== null) req.input('id', sql.Int, numericId);
    req.input('dom', sql.NVarChar, domOrName);
    req.input('name', sql.NVarChar, domOrName);

    const findSql = numericId !== null
      ? `SELECT TOP 1 * FROM dbo.ai_services s WHERE s.id = @id`
      : `SELECT TOP 1 s.* FROM dbo.ai_services s
         WHERE LOWER(ISNULL(s.domain,'')) = @dom
            OR LOWER(ISNULL(s.name,'')) = @name
            OR EXISTS (SELECT 1 FROM dbo.ai_service_aliases a WHERE a.service_id = s.id AND LOWER(a.alias_name) = @dom)`;

    const { recordset } = await req.query(findSql);
    if (!recordset || recordset.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const row = recordset[0];

    // 관련 배열 및 평점
    const serviceId = row.id as number;
    const idTable = `(${serviceId})`;

    // 리뷰 테이블 동적 컬럼 탐색
    const ratingColReq = await pool.request().query(
      "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('score','rating','stars','star','value','rate')"
    ).catch(() => ({ recordset: [] as any[] }));
    const ratingCol = ratingColReq?.recordset?.[0]?.name as string | undefined;
    const fkColReq = await pool.request().query(
      "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('service_id','tool_id','ai_service_id','service','target_service_id')"
    ).catch(() => ({ recordset: [] as any[] }));
    const reviewsFkCol = fkColReq?.recordset?.[0]?.name as string | undefined;

    // 동적 컬럼 탐색 (로그인/가격/태그/별칭)
    const [loginColRes, pricingColRes, tagColRes, aliasColRes] = await Promise.all([
      pool.request().query("SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_service_login_methods') AND name IN ('login_type','method','login_method','type','name')"),
      pool.request().query("SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_service_pricing') AND name IN ('pricing_type','type','name','pricing')"),
      pool.request().query("SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_service_tags') AND name IN ('tag','name','tag_name')"),
      pool.request().query("SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_service_aliases') AND name IN ('alias_name','name','alias')"),
    ]).catch(() => [{ recordset: [] }, { recordset: [] }, { recordset: [] }, { recordset: [] }] as any);
    const loginCol = loginColRes?.recordset?.[0]?.name as string | undefined;
    const pricingCol = pricingColRes?.recordset?.[0]?.name as string | undefined;
    const tagCol = tagColRes?.recordset?.[0]?.name as string | undefined;
    const aliasCol = aliasColRes?.recordset?.[0]?.name as string | undefined;

    const [pricingRows, tagRows, loginRows, aliasRows, ratingRows] = await Promise.all([
      pricingCol ? pool.request().query(`SELECT [${pricingCol}] AS v FROM dbo.ai_service_pricing WHERE service_id IN ${idTable}`) : Promise.resolve({ recordset: [] as any[] }),
      tagCol ? pool.request().query(`SELECT [${tagCol}] AS v FROM dbo.ai_service_tags WHERE service_id IN ${idTable}`) : Promise.resolve({ recordset: [] as any[] }),
      loginCol ? pool.request().query(`SELECT [${loginCol}] AS v FROM dbo.ai_service_login_methods WHERE service_id IN ${idTable}`) : Promise.resolve({ recordset: [] as any[] }),
      aliasCol ? pool.request().query(`SELECT [${aliasCol}] AS v FROM dbo.ai_service_aliases WHERE service_id IN ${idTable}`) : Promise.resolve({ recordset: [] as any[] }),
      ratingCol && reviewsFkCol
        ? pool.request().query(`SELECT AVG(CAST([${ratingCol}] AS FLOAT)) AS rating, COUNT(*) AS review_count FROM dbo.ai_reviews WHERE [${reviewsFkCol}] IN ${idTable}`)
        : Promise.resolve({ recordset: [] as any[] }),
    ]);

    const pricing = pricingRows.recordset?.map((r: any) => r.v) || [];
    const features = tagRows.recordset?.map((r: any) => r.v) || [];
    const loginMethods = loginRows.recordset?.map((r: any) => r.v) || [];
    const aliases = aliasRows.recordset?.map((r: any) => r.v) || [];
    const rating = ratingRows.recordset?.[0]?.rating ?? 0;
    const reviewCount = ratingRows.recordset?.[0]?.review_count ?? 0;

    const service = {
      id: String(row.id),
      domain: row.domain,
      name: normalizeName(row.name, row.domain, row.url),
      url: row.url,
      summary: sanitizeText(row.summary),
      description: sanitizeText(row.description),
      category: (row.primary_category || '').trim() || null,
      pricing,
      features,
      koreanSupport: !!row.korean_support,
      isKoreanService: !!row.is_korean_service,
      apiSupport: !!row.api_support,
      icon: bestIconFor(row.icon_url, row.domain, row.url),
      rating,
      reviewCount,
      loginMethods,
      aliases,
      source: 'SQL DB'
    } as any;

    return NextResponse.json({ service });
  } catch (error) {
    console.error('AI 서비스 상세 조회 중 오류:', error);
    return NextResponse.json({ error: 'Unexpected error: ' + (error as Error).message }, { status: 500 });
  }
}


