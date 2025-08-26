import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { Client as NotionClient } from '@notionhq/client';

// In-memory de-dup and cache (simple, process-local)
const inflightMap = new Map<string, Promise<NextResponse>>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In-memory 캐시 (간단)
    // 모듈 레벨 변수에 캐시 저장
  } catch {}
  try {
    await params; // 현재는 id를 사용하지 않지만 프로젝트의 컨벤션과 타입 체킹을 맞추기 위해 대기
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const id = searchParams.get('id');
    const domain = searchParams.get('domain');

    if (!name) {
      return NextResponse.json({ error: 'Name parameter is required' }, { status: 400 });
    }

    // 1) 노션 릴리즈 DB 우선 조회 (예전 동작 호환)
    try {
      const releasesDbId = process.env.NOTION_RELEASES_DB_ID || process.env.NOTION_RELEASES_DATABASE_ID;
      if (process.env.NOTION_API_KEY && releasesDbId) {
        const notion = new NotionClient({ auth: process.env.NOTION_API_KEY });
        const databaseId = releasesDbId;
        const normalize = (v: string) => (v || '').toLowerCase().trim();
        const getBaseDomain = (host: string): string => {
          try {
            const h = host.replace(/^https?:\/\//, '').split('/')[0];
            const parts = h.split('.').filter(Boolean);
            if (parts.length >= 2) return parts.slice(-2).join('.');
            return parts.join('.') || host;
          } catch {
            return host;
          }
        };
        const nameLower = normalize(name || '');
        const idLower = normalize(id || '');
        const domainLower = normalize(domain || '');
        const baseDomainLower = getBaseDomain(domainLower);

        const getText = (prop: any): string => {
          try {
            if (Array.isArray(prop?.title)) return prop.title.map((t: any) => t?.plain_text || '').join('');
            if (Array.isArray(prop?.rich_text)) return prop.rich_text.map((t: any) => t?.plain_text || '').join('');
            if (typeof prop?.url === 'string') return prop.url;
            if (typeof prop?.select?.name === 'string') return prop.select.name;
            if (Array.isArray(prop?.multi_select)) return prop.multi_select.map((m: any) => m?.name || '').join(' ');
          } catch {}
          return '';
        };
        const getMulti = (prop: any): string[] => {
          try {
            if (Array.isArray(prop?.multi_select)) return prop.multi_select.map((m: any) => m?.name || '').filter(Boolean);
          } catch {}
          return [];
        };

        // 노션 최신 스키마(확인됨): 버전명(title), 릴리즈 일자(date), 한줄평(rich_text), 상태(multi_select), 문서 링크(url), 도구(select)
        const mapRelease = (page: any, idx: number) => {
          const p = page.properties || {};
          const version = getText(p['버전명']) || getText(p['Version']) || '';
          const date = (p['릴리즈 일자']?.date?.start || p['날짜']?.date?.start || p['Date']?.date?.start || '') as string;
          const summary = getText(p['한줄평']) || getText(p['요약']) || getText(p['Summary']) || '';
          const detailsText = getText(p['상세']) || getText(p['Details']) || '';
          const details = detailsText
            ? detailsText.split(/\r?\n|•|\u2022/).map(s => s.trim()).filter(Boolean).slice(0, 12)
            : [] as string[];
          const status = getText(p['상태']) || getText(p['Status']) || undefined;
          const url = getText(p['문서 링크']) || getText(p['URL']) || undefined;
          const toolName = getText(p['도구']) || getText(p['Tool']) || getText(p['도구 이름']) || getText(p['Name']);
          const toolDomain = getText(p['도메인']) || getText(p['Domain']) || '';
          const toolBase = getBaseDomain(toolDomain.toLowerCase());
          const toolId = getText(p['ID']) || getText(p['UniqueId']) || '';
          // 이름 태그/관련 태그/태그 등 다수 필드 지원
          const tagFields: string[][] = [
            getMulti(p['이름 태그']), getMulti(p['관련 태그']), getMulti(p['태그']), getMulti(p['Tags']), getMulti(p['Tool Tag'])
          ];
          const allTags = tagFields.flat().filter(Boolean);
          return {
            id: String(page.id || idx + 1),
            version: String(version || ''),
            date: date ? String(date) : '',
            summary: String(summary || ''),
            details,
            status: status || undefined,
            url,
            _match: [toolName, toolDomain, toolBase, toolId, page?.url, ...allTags].join(' ').toLowerCase(),
          };
        };

        // 우선: 도구(select) 이름으로 직접 필터하여 페이지네이션 조회 (정확 매칭)
        let preciseResults: any[] = [];
        try {
          if (name) {
            const resp: any = await notion.databases.query({
              database_id: databaseId,
              page_size: 30,
              filter: {
                property: '도구',
                select: { equals: name }
              }
            });
            preciseResults = resp.results || [];
          }
        } catch {}

        let results: any[] = preciseResults;
        // 폴백: 전체 스캔 후 로컬 매칭 (스키마 변형 대비)
        if (results.length === 0) {
          const allPages: any[] = [];
          let start_cursor: string | undefined = undefined;
          let has_more = true;
          while (has_more) {
            const resp: any = await notion.databases.query({ database_id: databaseId, page_size: 50, start_cursor });
            allPages.push(...(resp.results || []));
            has_more = Boolean(resp.has_more);
            start_cursor = resp.next_cursor || undefined;
            if (allPages.length > 300) break;
          }
          results = allPages;
        }

        const all = results.map(mapRelease);

        // 쿼리 키 확장: 서비스명 동의어/브랜드, 베이스 도메인 포함
        const keys = new Set<string>();
        if (nameLower) keys.add(nameLower);
        if (idLower) keys.add(idLower);
        if (domainLower) keys.add(domainLower);
        if (baseDomainLower) keys.add(baseDomainLower);
        const nameSynonyms: Record<string, string[]> = {
          'chatgpt': ['openai', 'openai api', 'gpt', 'gpt-4', 'gpt-4o', 'gpt4o'],
          'bard': ['gemini', 'google', 'google ai'],
          'gemini': ['google', 'google ai', 'bard'],
          'claude': ['anthropic'],
          'perplexity': ['perplexity ai'],
        };
        Object.entries(nameSynonyms).forEach(([k, arr]) => {
          if (nameLower.includes(k)) arr.forEach(t => keys.add(t));
        });

        const matched = all
          .filter(r => Array.from(keys).some(k => k && r._match.includes(k)))
          .sort((a, b) => (new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()))
          .map(({ _match, ...rest }) => rest)
          .slice(0, 30);

        if (matched.length > 0) {
          const etag = 'W/"' + Math.abs(JSON.stringify(matched).split('').reduce((h, c) => ((h<<5)-h + c.charCodeAt(0))|0, 0)).toString(16) + '"';
          const inm = request.headers.get('if-none-match');
          if (inm && inm === etag) {
            return new NextResponse(null, { status: 304, headers: { 'ETag': etag, 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=300' } });
          }
          const res = NextResponse.json({ releases: matched });
          res.headers.set('ETag', etag);
          res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
          return res;
        }
      }
    } catch (notionErr) {
      console.error('Releases Notion fetch error:', notionErr);
      // Notion 실패 시 DB로 폴백
    }

    // 2) DB 폴백 조회 (환경변수로 비활성화 가능)
    if (process.env.AI_RELEASES_DISABLE_DB !== '1') {
      try {
        const pool = await getConnection();

        // 테이블 존재 여부 확인 후 동적 쿼리 (SQL Server)
        const tableCheck = await pool.request().query(`
          SELECT COUNT(*) AS cnt FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ai_tool_releases]') AND type in (N'U')
        `);
        const hasTable = Number(tableCheck.recordset?.[0]?.cnt || 0) > 0;

        if (hasTable) {
          // 이름 정규화 (소문자, 공백/하이픈 제거)
          const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, ' ').trim();
          const nameLower = normalize(name || '');
          const idLower = (id || '').toLowerCase();
          const domainLower = (domain || '').toLowerCase();

          // tool_name 일치/유사(LIKE) 우선 검색
          const result = await pool.request()
            .input('nameEq', nameLower)
            .input('nameLike', `%${nameLower}%`)
            .input('idEq', idLower)
            .input('domainEq', domainLower)
            .query(`
              SELECT TOP 30 *
              FROM ai_tool_releases WITH (NOLOCK)
              WHERE (
                LOWER(tool_name) = @nameEq OR LOWER(tool_name) LIKE @nameLike
                OR LOWER(tool_unique_id) = @idEq
                OR LOWER(tool_domain) = @domainEq
              )
              ORDER BY 
                CASE WHEN TRY_CONVERT(datetime2, release_date) IS NOT NULL THEN 0 ELSE 1 END,
                TRY_CONVERT(datetime2, release_date) DESC,
                ISNULL(updated_at, created_at) DESC
            `);

          const rows = result.recordset || [];
          const releases = rows.map((row: any, idx: number) => {
            // 관용 필드 매핑 (스키마 차이를 허용)
            const version = row.version || row.model_version || row.tag || '';
            const date = row.release_date || row.date || row.created_at || row.updated_at || null;
            const summary = row.summary || row.title || row.notes || '';
            const status = row.status || row.phase || undefined;
            const url = row.url || row.reference_url || undefined;
            let details: string[] = [];
            try {
              if (typeof row.details === 'string') {
                const parsed = JSON.parse(row.details);
                if (Array.isArray(parsed)) details = parsed.map((v: any) => String(v));
                else if (parsed && typeof parsed === 'object') details = Object.values(parsed).map(v => String(v));
              } else if (Array.isArray(row.details)) {
                details = row.details.map((v: any) => String(v));
              }
            } catch {}
            if (details.length === 0 && row.changes) {
              details = String(row.changes).split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean).slice(0, 10);
            }
            return {
              id: String(row.id ?? idx + 1),
              version: String(version || ''),
              date: date ? String(date) : '',
              summary: String(summary || ''),
              details,
              status: status ? String(status) : undefined,
              url: url ? String(url) : undefined,
            };
          }).filter((r: any) => r.version || r.summary || r.details.length > 0);

          return NextResponse.json({ releases });
        }
      } catch (dbErr) {
        console.error('Releases DB fetch error:', dbErr);
        // DB 실패 시 아래 폴백으로 이동
      }
    }

    // 3) 최종 폴백: 목 허용 시에만 제공, 기본은 빈 배열
    if (process.env.AI_RELEASES_ENABLE_MOCK === '1') {
      const mockReleases = [
        {
          id: 1,
          version: '2.1.0',
          date: '2024-01-15',
          summary: '성능 개선 및 새로운 기능 추가',
          details: ['향상된 AI 모델', '새로운 템플릿', '성능 최적화'],
          status: 'stable'
        }
      ];
      return NextResponse.json({ releases: mockReleases });
    }

    return NextResponse.json({ releases: [] });

  } catch (error) {
    console.error('Releases fetch error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch releases',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
