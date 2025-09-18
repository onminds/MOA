import { searchAITools as searchNotionTools } from '@/lib/notion-client';
import { searchAIToolsDb, type AITool } from '@/lib/tools-repo-db';
import { getConnection } from '@/lib/db';
import { getCategorySynonymsForDb } from '@/config/categorySynonyms';
import { findNamedToolsInQuery, normalizeToolNameForMatch } from '@/config/toolAliases';
import { analyzeUserIntent } from '@/lib/intent-analyzer';

export async function searchAIToolsUnified(filters: {
  category?: string;
  price?: 'free' | 'freemium' | 'paid';
  features?: string[];
  searchQuery?: string;
  limit?: number;
}): Promise<AITool[]> {
  const source = (process.env.NEXT_AI_TOOLS_SOURCE || 'sql').toLowerCase();
  if (source === 'sql') {
    return searchAIToolsDb(filters);
  }
  return searchNotionTools(filters as any) as unknown as Promise<AITool[]>;
}

// Ratings enrichment using DB when available
export async function enrichRatingsUnified(tools: AITool[]): Promise<AITool[]> {
  const source = (process.env.NEXT_AI_TOOLS_SOURCE || 'sql').toLowerCase();
  if (source !== 'sql') return tools; // Notion 경로: 별도 보강 생략(기존 로직 유지)

  try {
    const pool = await getConnection();
    const ids = tools.map(t => Number(t.serviceId || t.id)).filter(n => Number.isFinite(n));
    const idTable = ids.length ? `(${ids.join(',')})` : '(NULL)';
    const viewExistsReq = await pool.request().query(
      "SELECT 1 AS ok FROM sys.objects WHERE object_id = OBJECT_ID('dbo.vw_service_rating_summary') AND type = 'V'"
    ).catch(() => ({ recordset: [] as any[] }));
    const viewExists = !!viewExistsReq?.recordset?.[0]?.ok;
    let ratingRows: any = { recordset: [] as any[] };
    if (viewExists) {
      ratingRows = await pool.request().query(`SELECT service_id, AVG(CAST(avg_rating AS FLOAT)) AS rating FROM dbo.vw_service_rating_summary WHERE service_id IN ${idTable} GROUP BY service_id`);
    } else {
      const ratingColReq = await pool.request().query(
        "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('score','rating','stars','star','value','rate')"
      ).catch(() => ({ recordset: [] as any[] }));
      const ratingCol = ratingColReq?.recordset?.[0]?.name as string | undefined;
      const fkColReq = await pool.request().query(
        "SELECT TOP 1 name FROM sys.columns WHERE object_id = OBJECT_ID('dbo.ai_reviews') AND name IN ('service_id','tool_id','ai_service_id','service','target_service_id')"
      ).catch(() => ({ recordset: [] as any[] }));
      const reviewsFkCol = fkColReq?.recordset?.[0]?.name as string | undefined;
      if (ratingCol && reviewsFkCol) {
        ratingRows = await pool.request().query(`SELECT [${reviewsFkCol}] AS service_id, AVG(CAST([${ratingCol}] AS FLOAT)) AS rating FROM dbo.ai_reviews WHERE [${reviewsFkCol}] IN ${idTable} GROUP BY [${reviewsFkCol}]`);
      }
    }
    const ratingMap = new Map<number, number>();
    ratingRows.recordset?.forEach((r: any) => {
      ratingMap.set(Number(r.service_id), Number(r.rating ?? 0));
    });
    return tools.map(t => {
      const svcId = Number(t.serviceId || t.id);
      const rating = Number.isFinite(svcId) ? (ratingMap.get(svcId) ?? t.rating ?? 0) : (t.rating ?? 0);
      return { ...t, rating };
    });
  } catch {
    return tools;
  }
}

// ---- 우선순위 재정렬 & 질의 보강 유틸 ----

export function expandCategoryQuery(category?: string | null, features?: string[] | null): string | undefined {
  const cats = getCategorySynonymsForDb(category || undefined);
  const feat = (features || []).filter(Boolean) as string[];
  const parts = [...new Set([...(cats || []), ...feat])];
  return parts.length ? parts.join(' ') : undefined;
}

export function prioritizeToolsByIntent(tools: AITool[], prompt: string): AITool[] {
  if (!Array.isArray(tools) || tools.length === 0) return tools;
  const intent = analyzeUserIntent(prompt || '');
  const aliasHits = findNamedToolsInQuery(prompt || '');
  const aliasSet = new Set(aliasHits.map(normalizeToolNameForMatch));
  const catKey = String(intent.category || '').toLowerCase();
  const tagTokens = (intent.features || []).map(s => String(s).toLowerCase());
  const qTokens = String(prompt || '').toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);

  const score = (t: AITool): number => {
    let s = 0;
    // 1) 카테고리 우선
    if (catKey && (String(t.category || '').toLowerCase().includes(catKey))) s += 100;
    // 2) 태그 매칭
    const hayTags = (t.features || []).map(f => String(f).toLowerCase());
    for (const tg of tagTokens) if (hayTags.some(h => h.includes(tg))) s += 30;
    // 3) 이름/별칭
    const nameN = normalizeToolNameForMatch(t.name || '');
    if (aliasSet.size && aliasSet.has(nameN)) s += 200; // 명시 도구 강제 상단
    if (qTokens.length && nameN && qTokens.some(q => nameN.includes(q))) s += 20;
    // 4) 제목/설명
    const text = `${t.name} ${t.description || ''}`.toLowerCase();
    for (const q of qTokens) if (text.includes(q)) s += 6;
    // 5) 보조 가중치
    if (t.hasAPI) s += 2;
    if ((t.rating ?? 0) > 0) s += Math.min(10, (t.rating || 0));
    return s;
  };
  const sorted = tools.slice().sort((a, b) => score(b) - score(a));
  // 별칭으로 명시된 도구는 맨 앞에 중복 없이 배치
  const front: AITool[] = [];
  if (aliasSet.size) {
    for (const t of sorted) {
      const nn = normalizeToolNameForMatch(t.name || '');
      if (aliasSet.has(nn)) front.push(t);
    }
  }
  const dedup = new Set(front.map(t => t.id));
  const tail = sorted.filter(t => !dedup.has(t.id));
  return front.length ? [...front, ...tail] : sorted;
}

export async function enrichWithAliases(tools: AITool[], prompt: string, fetcher: (q: string)=>Promise<AITool[]>): Promise<AITool[]> {
  const hits = findNamedToolsInQuery(prompt || '');
  if (!hits.length) return tools;
  const have = new Set(tools.map(t => normalizeToolNameForMatch(t.name)));
  const result = tools.slice();
  for (const h of hits) {
    const norm = normalizeToolNameForMatch(h);
    if (have.has(norm)) continue;
    try {
      const found = await fetcher(h);
      if (found && found.length) {
        const pick = found[0];
        result.unshift(pick);
        have.add(normalizeToolNameForMatch(pick.name));
      }
    } catch {}
  }
  // 중복 제거(앞쪽 우선)
  const seenIds = new Set<string>();
  const deduped: AITool[] = [];
  for (const t of result) {
    const key = String(t.id || t.name);
    if (seenIds.has(key)) continue;
    seenIds.add(key);
    deduped.push(t);
  }
  return deduped;
}



