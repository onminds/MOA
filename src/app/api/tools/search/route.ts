import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { searchAITools, type AITool } from '@/lib/notion-client';
import { analyzeUserIntent } from '@/lib/intent-analyzer';
import { isSameHostOrAllowed, safeString, parseNumber, parseBoolean } from '@/lib/validation';

export async function GET(req: NextRequest) {
  try {
    const rl = withRateLimit(req, 'tools_search', 30, 60_000);
    if (!rl.ok) return NextResponse.json({ code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60' } });
    if (!isSameHostOrAllowed(req)) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const q = safeString(searchParams.get('q') || '', 200);
    // 질의 내 숫자 N개를 추출해 count로 사용(우선순위 높음)
    const matched = /(?:^|\s)(\d{1,2})\s*개\b/.exec(String(q||''));
    const requestedCount = matched ? Number(matched[1]) : undefined;
    const count = parseNumber(String(requestedCount ?? searchParams.get('count') ?? '5'), 1, 10, 5);
    const apiOnly = parseBoolean((searchParams.get('apiOnly') || '').toLowerCase());
    const categoryParam = safeString(searchParams.get('category') || '', 60);

    const intent = analyzeUserIntent(q || categoryParam);
    const category = (categoryParam || intent.category || '').trim() || undefined;

    const normalizeKey = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    const tokens = String(q || '').toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean);
    const isDirectNameQuery = !!q && tokens.length === 1 && q.length <= 32;

    // 랜덤 추천 트리거: 카테고리 미감지 + (N개/랜덤/그냥 추천) 표현
    const generalAsk = !category && /(추천|리스트|목록|알려)/.test(String(q||'')) && (/(?:\d{1,2})\s*개\b/.test(String(q||'')) || /랜덤/.test(String(q||'')) || /그냥/.test(String(q||'')));

    // 카테고리가 감지되면 searchQuery를 비워서(AND 충돌 방지) 과도한 필터링을 피함
    // 카테고리가 없을 때만 feature 기반의 짧은 키워드로 보조 검색 수행
    const safeSearchQuery = (() => {
      // 단일 이름 질의로 보이는 경우에는 카테고리가 있더라도 이름 검색을 활성화
      if (category && !isDirectNameQuery) return undefined; // category + query AND 충돌 방지
      const feat = intent.features.join(' ').trim();
      if (!isDirectNameQuery && feat) return feat as any;
      // 너무 긴 자유문은 제외(노션 contains 미스매치 방지)
      const shortQ = (q || '').trim();
      return shortQ && shortQ.length <= 32 ? (shortQ as any) : undefined;
    })();

    let tools: AITool[] = [];
    if (generalAsk) {
      const all = await searchAITools({});
      // 무작위 추출(간단 셔플)
      tools = all.sort(() => Math.random() - 0.5).slice(0, count);
    } else {
      tools = await searchAITools({
        category: category as any,
        searchQuery: safeSearchQuery,
        price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
        features: intent.features.length > 0 ? intent.features : undefined
      });
    }

    // API 필터
    if (apiOnly) {
      tools = tools.filter(t => (t as any).hasAPI === true || (t as any).api === '있음');
    }

    // 간단 랭킹: 이름/설명에 질의 토큰 포함 점수 + API 가점
    const scoreOf = (t: AITool) => {
      const hay = `${t.name || ''} ${(t.description || '')} ${(t.features || []).join(' ')}`.toLowerCase();
      let s = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) s += 2;
        if (new RegExp(`\\b${tok}\\b`, 'i').test(hay)) s += 1;
      }
      if ((t as any).hasAPI) s += 0.5;
      return s;
    };
    if (!generalAsk) {
      tools = tools
        .map(t => ({ t, s: scoreOf(t) }))
        .sort((a, b) => b.s - a.s)
        .map(x => x.t);
    }

    // 정확 이름 우선 보강: 결과에 정확 일치가 없고 요청 개수에 미달 시 이름 중심 재검색 병합
    if (isDirectNameQuery) {
      const wantKey = normalizeKey(q);
      const hasExact = tools.some(t => normalizeKey(t.name) === wantKey);
      if (!hasExact || tools.length < count) {
        const byName = await searchAITools({ searchQuery: q }); // 카테고리 배제, 이름 contains
        const exact = byName.find(t => normalizeKey(t.name) === wantKey);
        if (exact) {
          const deduped = [exact, ...tools.filter(t => normalizeKey(t.name) !== wantKey)];
          tools = deduped;
        } else if (byName.length) {
          // 포함 일치라도 하나 보강
          const candidate = byName.find(t => normalizeKey(t.name).includes(wantKey) || wantKey.includes(normalizeKey(t.name)));
          if (candidate) {
            const deduped = [candidate, ...tools.filter(t => normalizeKey(t.name) !== normalizeKey(candidate.name))];
            tools = deduped;
          }
        }
      }
    }

    // 최종 개수 제한
    tools = tools.slice(0, count);

    const makeOneLine = (t: AITool): string => {
      const first = String(t.description || '').split(/[\.!?\n]/)[0].trim();
      return first.slice(0, 40) || '대표 용도 중심의 AI 도구입니다.';
    };

    const result = tools.map((t, i) => ({
      rank: i + 1,
      name: t.name,
      oneLine: makeOneLine(t),
      api: !!(t as any).hasAPI || (t as any).api === '있음',
      link: t.url || null,
      id: t.id,
      category: t.category,
      price: t.price,
    }));

    const mode: 'category' | 'single' = (q && q.split(' ').length <= 3 && result.length === 1) ? 'single' : 'category';

    return NextResponse.json({
      query: q,
      category: category || null,
      mode,
      count: result.length,
      results: result,
      tools
    }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (err) {
    console.error('[tools/search] error', err);
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}


