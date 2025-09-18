import { getConnection } from '@/lib/db';
import { getCategorySynonymsForDb } from '@/config/categorySynonyms';
import sql from 'mssql';

export type AITool = {
  id: string;
  name: string;
  url: string;
  domain?: string;
  serviceId?: string;
  category: string;
  price: 'free' | 'freemium' | 'paid';
  features: string[];
  hasAPI: boolean;
  description: string;
  usageLimit?: string;
  rating?: number;
  imageUrl?: string;
};

function normalizeName(rawName: string | null, domain: string | null, url: string | null): string {
  const isAbsHttp = (v?: string | null): boolean => {
    if (!v) return false;
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  };
  const hostFromUrl = (v?: string | null): string | null => {
    if (!v) return null;
    try { return new URL(v).hostname || null; } catch { return null; }
  };
  let n = String(rawName || '').trim();
  if (isAbsHttp(n)) {
    try { const u = new URL(n); return u.hostname.replace(/^www\./,''); } catch {}
  }
  if (!n) {
    const host = (domain || hostFromUrl(url) || '').replace(/^www\./,'');
    return host;
  }
  if (/\/$/.test(n)) n = n.replace(/\/+$/, '');
  return n;
}

function bestIconFor(iconUrl: string | null, domain: string | null, url: string | null): string {
  const isAbsHttp = (v?: string | null): boolean => {
    if (!v) return false;
    try { const u = new URL(v); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
  };
  const hostFromUrl = (v?: string | null): string | null => {
    if (!v) return null;
    try { return new URL(v).hostname || null; } catch { return null; }
  };
  
  // 1. 데이터베이스의 icon_url이 있으면 우선 사용
  if (iconUrl) {
    // 상대 경로인 경우 절대 경로로 변환
    if (iconUrl.startsWith('/')) {
      console.log('[ICON_DEBUG] Converting relative icon path:', iconUrl);
      return iconUrl; // Next.js가 자동 처리
    }
    if (isAbsHttp(iconUrl)) {
      console.log('[ICON_DEBUG] Using DB icon:', iconUrl);
      return String(iconUrl);
    }
  }
  
  // 2. 도메인 기반 favicon 사용
  const host = domain || hostFromUrl(url) || '';
  if (host) {
    const faviconUrl = `https://${host}/favicon.ico`;
    console.log('[ICON_DEBUG] Using favicon:', faviconUrl);
    return faviconUrl;
  }
  
  // 3. 기본 아이콘
  console.log('[ICON_DEBUG] Using default icon');
  return '/images/default-tool-icon.png';
}

export async function searchAIToolsDb(filters: {
  category?: string;
  price?: 'free' | 'freemium' | 'paid';
  features?: string[];
  searchQuery?: string;
  limit?: number;
}): Promise<AITool[]> {
  const pool = await getConnection();
  const req = pool.request();

  const q = String(filters.searchQuery || '').toLowerCase().trim();
  const category = String(filters.category || '').toLowerCase();
  const price = filters.price;
  const feats = (filters.features || []).map(f => String(f).toLowerCase());
  const limit = Math.min(filters.limit || 100, 100);

  const conds: string[] = [];
  if (q) {
    conds.push("(LOWER(ISNULL(s.name,'')) LIKE @q OR LOWER(ISNULL(s.summary,'')) LIKE @q OR LOWER(ISNULL(s.description,'')) LIKE @q)");
    req.input('q', sql.NVarChar, `%${q}%`);
  }
  if (category) {
    // 카테고리 정확 일치 + 동의어 확장(tag/name/desc)에 대한 느슨한 매칭을 함께 허용
    const syns = getCategorySynonymsForDb(category) || [];
    const ors: string[] = ["LOWER(ISNULL(s.primary_category,'')) = @cat"];
    req.input('cat', sql.NVarChar, category);
    syns.slice(0, 8).forEach((kw, i) => {
      const p = `catSyn${i}`;
      ors.push(`LOWER(ISNULL(s.name,'')) LIKE @${p}`);
      ors.push(`LOWER(ISNULL(s.summary,'')) LIKE @${p}`);
      ors.push(`LOWER(ISNULL(s.description,'')) LIKE @${p}`);
      ors.push(`EXISTS (SELECT 1 FROM dbo.ai_service_tags tg WHERE tg.service_id = s.id AND LOWER(tg.tag) LIKE @${p})`);
      req.input(p, sql.NVarChar, `%${String(kw).toLowerCase()}%`);
    });
    conds.push(`(${ors.join(' OR ')})`);
  }
  if (price) {
    conds.push('EXISTS (SELECT 1 FROM dbo.ai_service_pricing p WHERE p.service_id = s.id AND p.pricing_type = @pricing)');
    req.input('pricing', sql.NVarChar, price);
  }
  // 3D와 노코드 카테고리는 features 필터를 무시
  if (category !== '3d' && category !== 'nocode') {
    feats.slice(0, 5).forEach((t, i) => {
      const p = `feat${i}`;
      conds.push(`EXISTS (SELECT 1 FROM dbo.ai_service_tags tg WHERE tg.service_id = s.id AND LOWER(tg.tag) LIKE @${p})`);
      req.input(p, sql.NVarChar, `%${String(t).toLowerCase()}%`);
    });
  }

  const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const sqlList = `
    SELECT TOP (${limit})
      s.id, s.domain, s.name, s.url, s.summary, s.description, s.primary_category, s.icon_url,
      s.korean_support, s.is_korean_service, s.api_support
    FROM dbo.ai_services s
    ${whereSql}
    ORDER BY s.name ASC;
  `;
  
  // 디버그 로그 추가
  console.log('[DB_DEBUG] SQL Query:', sqlList);
  console.log('[DB_DEBUG] Parameters:', {
    q: filters.searchQuery,
    category: filters.category,
    price: filters.price,
    features: filters.features
  });
  
  // 3D 관련 도구가 있는지 먼저 확인
  if (filters.category === '3d' || (filters.searchQuery && filters.searchQuery.toLowerCase().includes('3d'))) {
    const testQuery = `SELECT TOP 5 s.id, s.name, s.primary_category, s.description FROM dbo.ai_services s WHERE LOWER(s.primary_category) LIKE '%3d%' OR LOWER(s.name) LIKE '%3d%' OR LOWER(s.description) LIKE '%3d%'`;
    const testResult = await pool.request().query(testQuery);
    console.log('[DB_DEBUG] 3D test query results:', testResult.recordset.length, 'rows');
    if (testResult.recordset.length > 0) {
      console.log('[DB_DEBUG] 3D tools found:', testResult.recordset.map(r => ({ name: r.name, category: r.primary_category })));
    }
  }

  // 3D와 노코드 카테고리인 경우 features 필터를 무시하고 단순 검색
  if (filters.category === '3d' || filters.category === 'nocode') {
    console.log(`[DB_DEBUG] ${filters.category} category detected, using simplified search`);
    
    // 3D 카테고리인 경우 여러 검색어로 시도
    if (filters.category === '3d') {
      const searchTerms = ['3d', '3차원', 'avatar', 'mesh', 'blender', 'maya', 'modeling', 'rendering'];
      
      for (const term of searchTerms) {
        const simpleQuery = `
          SELECT TOP (${limit})
            s.id, s.domain, s.name, s.url, s.summary, s.description, s.primary_category, s.icon_url,
            s.korean_support, s.is_korean_service, s.api_support
          FROM dbo.ai_services s
          WHERE (LOWER(ISNULL(s.name,'')) LIKE @q OR LOWER(ISNULL(s.summary,'')) LIKE @q OR LOWER(ISNULL(s.description,'')) LIKE @q)
          ORDER BY s.name ASC;
        `;
        
        const simpleReq = pool.request();
        simpleReq.input('q', sql.VarChar, `%${term}%`);
        
        console.log(`[DB_DEBUG] 3D searching with term: ${term}`);
        
        const { recordset: simpleRows } = await simpleReq.query(simpleQuery);
        console.log(`[DB_DEBUG] 3D search with '${term}':`, simpleRows.length, 'rows found');
        
        if (simpleRows.length > 0) {
          console.log(`[DB_DEBUG] 3D found with '${term}':`, simpleRows.slice(0, 3).map(r => ({ name: r.name, category: r.primary_category })));
          return simpleRows.map(row => ({
            id: row.id,
            name: row.name,
            domain: row.domain,
            url: row.url,
            summary: row.summary,
            description: row.description,
            category: row.primary_category,
            iconUrl: row.icon_url,
            koreanSupport: row.korean_support,
            isKoreanService: row.is_korean_service,
            apiSupport: row.api_support,
            price: 'freemium' as const,
            features: [],
            hasAPI: !!row.api_support,
            imageUrl: bestIconFor(row.icon_url, row.domain, row.url)
          }));
        }
      }
      
      // 모든 검색어로 실패한 경우, 더 넓은 범위로 검색
      console.log('[DB_DEBUG] 3D all search terms failed, using broader query');
      const testQuery = `
        SELECT TOP 10 s.id, s.name, s.primary_category, s.description, s.url, s.domain, s.summary, s.icon_url, s.korean_support, s.is_korean_service, s.api_support 
        FROM dbo.ai_services s 
        WHERE LOWER(s.primary_category) LIKE '%3d%' 
           OR LOWER(s.name) LIKE '%3d%' 
           OR LOWER(s.description) LIKE '%3d%'
           OR LOWER(s.name) IN ('meshy', 'cascadeur', 'avaturn', 'creatie', 'deckspeed', 'a1.art', 'luma ai', 'spline')
           OR LOWER(s.description) LIKE '%model%'
           OR LOWER(s.description) LIKE '%render%'
           OR LOWER(s.description) LIKE '%animation%'
        ORDER BY s.name ASC`;
      const testResult = await pool.request().query(testQuery);
      
      if (testResult.recordset.length > 0) {
        console.log('[DB_DEBUG] 3D using test query results:', testResult.recordset.length, 'tools');
        return testResult.recordset.map(row => ({
          id: row.id,
          name: row.name,
          domain: row.domain,
          url: row.url,
          summary: row.summary,
          description: row.description,
          category: row.primary_category,
          iconUrl: row.icon_url,
          koreanSupport: row.korean_support,
          isKoreanService: row.is_korean_service,
          apiSupport: row.api_support,
          price: 'freemium' as const,
          features: [],
          hasAPI: !!row.api_support,
          imageUrl: bestIconFor(row.icon_url, row.domain, row.url)
        }));
      }
    } else {
      // 노코드 카테고리
      const searchTerm = filters.searchQuery || 'nocode no-code workflow automation';
      const simpleQuery = `
        SELECT TOP (${limit})
          s.id, s.domain, s.name, s.url, s.summary, s.description, s.primary_category, s.icon_url,
          s.korean_support, s.is_korean_service, s.api_support
        FROM dbo.ai_services s
        WHERE (LOWER(ISNULL(s.name,'')) LIKE @q OR LOWER(ISNULL(s.summary,'')) LIKE @q OR LOWER(ISNULL(s.description,'')) LIKE @q)
        ORDER BY s.name ASC;
      `;
      
      const simpleReq = pool.request();
      simpleReq.input('q', sql.VarChar, `%${searchTerm}%`);
      
      console.log(`[DB_DEBUG] nocode simplified query:`, simpleQuery);
      console.log(`[DB_DEBUG] nocode simplified parameters:`, { q: searchTerm });
      
      const { recordset: simpleRows } = await simpleReq.query(simpleQuery);
      console.log(`[DB_DEBUG] nocode simplified results:`, simpleRows.length, 'rows found');
      
      if (simpleRows.length > 0) {
        console.log(`[DB_DEBUG] nocode simplified first few results:`, simpleRows.slice(0, 3).map(r => ({ name: r.name, category: r.primary_category })));
        return simpleRows.map(row => ({
          id: row.id,
          name: row.name,
          domain: row.domain,
          url: row.url,
          summary: row.summary,
          description: row.description,
          category: row.primary_category,
          iconUrl: row.icon_url,
          koreanSupport: row.korean_support,
          isKoreanService: row.is_korean_service,
          apiSupport: row.api_support,
          price: 'freemium' as const,
          features: [],
          hasAPI: !!row.api_support,
          imageUrl: bestIconFor(row.icon_url, row.domain, row.url)
        }));
      }
    }
  }
  
  const { recordset: rows } = await req.query(sqlList);
  console.log('[DB_DEBUG] Query results:', rows.length, 'rows found');
  if (rows.length > 0) {
    console.log('[DB_DEBUG] First few results:', rows.slice(0, 3).map(r => ({ name: r.name, category: r.primary_category, description: r.description?.substring(0, 100) })));
  }

  return rows.map(row => ({
    id: row.id,
    name: normalizeName(row.name, row.domain, row.url),
    domain: row.domain,
    url: row.url,
    summary: row.summary,
    description: row.description,
    category: row.primary_category,
    iconUrl: row.icon_url || bestIconFor(row.icon_url, row.domain, row.url),
    koreanSupport: row.korean_support,
    isKoreanService: row.is_korean_service,
    apiSupport: row.api_support,
    price: 'freemium' as const,
    features: [],
    hasAPI: !!row.api_support,
    usageLimit: undefined,
    rating: undefined,
    imageUrl: bestIconFor(row.icon_url, row.domain, row.url)
  }));
}