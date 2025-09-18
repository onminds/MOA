import { NextRequest } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { isSameHostOrAllowed, safeString, parseBoolean } from '@/lib/validation';
// OpenAI is already imported at line 2
import { detectToolSearchIntent, analyzeUserIntent, detectWebsiteBuildIntent, detectWebsiteAssistIntent, detectBeginnerFriendlyIntent, detectWorkflowAutomationIntent, detectToolDetailRequest, detectConceptExplainIntent, detectAIConceptExplainIntent, generateDetailedToolPrompt } from '@/lib/intent-analyzer';
import { decideRoute } from '@/lib/route-decider';
import OpenAI from 'openai';
import { type AITool } from '@/lib/notion-client';
import { searchAIToolsUnified, expandCategoryQuery, prioritizeToolsByIntent, enrichWithAliases, enrichRatingsUnified } from '@/lib/tools-repo';
import { findAIToolByNameOrDomain } from '@/lib/tools-repo-db';
import { searchEngine, type SearchResult } from '@/lib/search-engine';
import { filterByFeatureSynonymExact, filterByFeatureMustContain } from '@/lib/tool-filters';
import { templateEngine } from '@/lib/template-engine';
import { systemRecommendationPrompt, buildRecommendationUserPrompt, systemGeneralPrompt, systemDbReasoningPrompt, buildDbReasoningUserPrompt, systemDetailPrompt } from '@/lib/prompt-templates';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 디버그: 환경 변수 확인
console.log('[DEBUG] OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);
console.log('[DEBUG] OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
console.log('[DEBUG] OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-') || false);

export const runtime = 'nodejs';

// --- 간단한 웹검색 메모 캐시 (TTL 2분, 환경변수로 조정 가능) ---
type CacheEntry = { notes: string; ts: number };
const SEARCH_CACHE: Map<string, CacheEntry> = new Map();
const SEARCH_TTL_MS = Number(process.env.WEB_SEARCH_CACHE_TTL_MS || (2 * 60 * 1000));
const WEB_SEARCH_TIMEOUT_MS = Number(process.env.WEB_SEARCH_TIMEOUT_MS || 6000);
// Feature flags: keep capability but default to off for flexible handling
const WEB_SEARCH_ENABLED = String(process.env.WEB_SEARCH_ENABLED || '').toLowerCase() === '1';
const NEWS_TEMPLATES_ENABLED = String(process.env.NEWS_TEMPLATES_ENABLED || '').toLowerCase() === '1';
function getCache(key: string): string | null {
  const v = SEARCH_CACHE.get(key);
  if (!v) return null;
  if (Date.now() - v.ts > SEARCH_TTL_MS) { SEARCH_CACHE.delete(key); return null; }
  return v.notes;
}
function setCache(key: string, notes: string) {
  SEARCH_CACHE.set(key, { notes, ts: Date.now() });
  if (SEARCH_CACHE.size > 64) {
    const first = SEARCH_CACHE.keys().next().value; if (first) SEARCH_CACHE.delete(first);
  }
}

export async function POST(req: NextRequest) {
  const rl = withRateLimit(req, 'chat_stream', 20, 30_000);
  if (!rl.ok) return new Response('Too Many Requests', { status: 429, headers: { 'Retry-After': '30' } });
  if (!isSameHostOrAllowed(req)) {
    return new Response('Forbidden', { status: 403 });
  }
  const body = await req.json();
  const prompt = safeString(body?.prompt, 2000);
  const model = safeString(body?.model || 'gpt-5', 32);
  const template = parseBoolean(body?.template, false);
  const kbMode = safeString(body?.kbMode || '', 12) || undefined;
  const history = Array.isArray(body?.history) ? body.history : [];
  const webMode = ((): 'auto'|'on'|'off' => ['auto','on','off'].includes(String(body?.webMode)) ? body.webMode : 'auto')();
  const clientLastTools = Array.isArray(body?.clientLastTools) ? body.clientLastTools : [];
  const newsScope = ((): 'auto'|'domestic'|'global'|'split' => ['auto','domestic','global','split'].includes(String(body?.newsScope)) ? body.newsScope : 'auto')();
  const text = String(prompt || '').trim();
  const traceId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const decision0 = await decideRoute(text, { openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), timeoutMs: 250 });
  const decision = {
    ...decision0,
    web: webMode === 'on' ? true : webMode === 'off' ? false : decision0.web,
  } as any;
  try {
    const { detectToolSearchIntent } = require('@/lib/intent-analyzer');
    const looksRecommendation = /(추천|리스트|목록|top|best)\b/.test(text.toLowerCase()) || /\b\d+\s*개\b/.test(text.toLowerCase());
    if (detectToolSearchIntent(text) || looksRecommendation) {
      decision.web = false;
    }
  } catch {}
  const forceStream = decision.route === 'stream';
  // 인사/잡담 패턴 강화: 다양한 오탈자 및 변형 수용
  const isGreeting = (/^(안녕|안녕하세요|안뇽|안뇽하세요|하이|헬로|헬로우|hello|hi|hey|ㅎㅇ)$/i.test(text)) || /안.{0,2}녕/i.test(text);
  const isIdentitySmalltalk = /(누구|너|너는|정체|역할|무엇을\s*할\s*수|뭐\s*할\s*수|무슨\s*일을|who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do)/i.test(text.toLowerCase());
  // 일반 개념/사건 설명(도구 문맥 없음)은 스트리밍으로 유지
  const isGeneralConcept = /^[가-힣\s]+$/.test(text) && !/(툴|도구|서비스|앱|사이트|ai|app|tool|service|platform)/i.test(text.toLowerCase());
  // 단일 도구 상세 질의 우선 처리 플래그 (예: "~에 대해", "~란", "무엇")
  const detailReq = detectToolDetailRequest(String(text || ''));
  const isDetailFirst = !!detailReq?.isDetail;
  // 라틴 문자 연속 토큰 후보를 뽑아 정확 매칭 먼저 시도 (예: Zapier, n8n, Make, Framer 등)
  const latinCandidates = (() => {
    try {
      const set = new Set<string>();
      const out: string[] = [];
      for (const m of String(text||'').matchAll(/[A-Za-z][A-Za-z0-9.\-]{1,}/g) as any) {
        const w = String(m[0]||'').replace(/^[\-_.]+|[\-_.]+$/g,'');
        if (w && !set.has(w.toLowerCase())) { set.add(w.toLowerCase()); out.push(w); }
        if (out.length >= 5) break;
      }
      return out;
    } catch { return []; }
  })();
  let exactToolPick: any = null;
  if (latinCandidates.length) {
    try {
      for (const cand of latinCandidates) {
        const found = await findAIToolByNameOrDomain(cand).catch(()=>null);
        if (found) { exactToolPick = found; break; }
      }
    } catch {}
  }

  // --- 웰빙/정서 지원 의도: 즉시 공감/안내(웹검색 금지) ---
  // 1) 직전 턴에 제가 "힘든 점 한 가지만" 등 질문을 했다면, 이번 입력을 후속 응답으로 처리
  let wellbeingAskedBefore = false;
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const m = history[i];
      if (m?.role === 'assistant' && typeof m?.content === 'string' && (/힘든 점 한 가지만|그라운딩|숨 고르고/.test(m.content))) { wellbeingAskedBefore = true; break; }
      if (m?.role === 'user') break;
    }
  }
  if (wellbeingAskedBefore) {
    const openaiLocal = openai;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const chat = await (openaiLocal as any).chat.completions.create({
            model: 'gpt-4.1-mini',
            stream: true,
            messages: [
              { role: 'system', content: '너는 공감적인 한국어 조력자다. 사용자의 내용을 요약해 되비추고, 구체적인 한 가지 실천과 바로 할 수 있는 2~3분 호흡/그라운딩을 제안한다. 해결책 강요 금지, 판단 금지, 따뜻하고 짧게.' },
              { role: 'user', content: text }
            ]
          });
          for await (const part of chat) {
            const delta = part.choices[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        } catch {
          controller.enqueue(encoder.encode('지금 말씀해주신 내용을 잘 들었어요. 한 문장으로 요약해 보자면, ' + text.slice(0, 50) + ' …인 것 같아요. 지금은 4초 들숨 6초 날숨을 6~8번만 같이 해볼까요? 끝나면 한 가지만: 오늘 꼭 해야 하는 일 하나만 적고 15분만 시작해요.'));        
        } finally { controller.close(); }
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Route': 'stream', 'X-Web-Decided': '0', 'X-Web-Used': '0' } });
  }

  const isWellbeing = /(우울|힘들|죽고|자살|불안|공황|상담이\s*필요|너무\s*괴로|의욕이\s*없|무기력|슬프|상처|고통)/i.test(text);
  if (isWellbeing) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const msg = [
          '그렇게 느끼고 계시군요. 혼자 버티지 않으셔도 돼요. 잠깐 숨 고르고, 제가 곁에 있을게요.',
          '- 지금 가장 힘든 점 한 가지만 적어 주실 수 있을까요? 그 부분부터 같이 정리해볼게요.',
          '- 바로 해볼 수 있는 짧은 방법: 4초 들이마시고 6초 내쉬기 6~8번 / 보이는 것 5개·들리는 것 4개·느껴지는 것 3개 말해보기(그라운딩).',
          '',
          '긴급 도움이 필요하시면 다음에 바로 연락해 주세요(24시간):',
          '· 자살예방상담전화 1393 / 보건복지상담 129 / 청소년상담 1388 / 위급 시 112 또는 119',
        ].join('\n');
        controller.enqueue(encoder.encode(msg));
        controller.close();
      }
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Route': 'stream', 'X-Web-Decided': '0', 'X-Web-Used': '0' } });
  }

  // --- 날씨 의도: 위치 미지정 시 먼저 물어보기 ---
  let wantsWeather = /(날씨|weather)/i.test(text);
  const knownPlaces = ['서울','부산','인천','대구','대전','광주','울산','세종','제주','수원','성남','용인','고양','창원','청주','전주','천안','포항','김해','부천','남양주','경기','경기도','충남','충북','전남','전북','경남','경북','강원','Seoul','Busan','Incheon','Daegu','Daejeon','Gwangju','Jeju','Gyeonggi'];
  const normForPlace = text.replace(/["'“”‘’]/g,'').replace(/\s+/g,' ').replace(/의\s+/g,' ');
  let placeMatch = knownPlaces.find((p)=>normForPlace.toLowerCase().includes(p.toLowerCase())) 
    || (normForPlace.match(/([가-힣]{2,})(?:도|시)?\s*([가-힣]{1,})(?:시|군|구)?/i)?.[0] || '').trim();
  let hasPlace = !!placeMatch && placeMatch.length >= 2;
  // 이전 턴에서 위치를 물었는지 확인 → 이번 입력을 위치로 해석
  let askedWeatherBefore = false;
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const m = history[i];
      if (m?.role === 'assistant' && typeof m?.content === 'string' && m.content.includes('어느 지역의 날씨')) { askedWeatherBefore = true; break; }
      if (m?.role === 'user') break; // 직전 사용자 턴 이전까지만 검사
    }
  }
  if (!wantsWeather && askedWeatherBefore) wantsWeather = true;
  if (wantsWeather && !hasPlace && askedWeatherBefore) { hasPlace = true; placeMatch = text.trim(); }
  if (wantsWeather && !hasPlace) {
    const encoder = new TextEncoder();
    const simple = new ReadableStream({
      start(controller) {
        const ask = '어느 지역의 날씨가 궁금하신가요? 예: 서울, 부산, 제주';
        controller.enqueue(encoder.encode(ask));
        controller.close();
      }
    });
    return new Response(simple, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Route': 'stream', 'X-Web-Decided': '0', 'X-Web-Used': '0' } });
  }
  // 비스트리밍 우회 제거: 모든 의도는 스트리밍 내에서 처리
  const encoder = new TextEncoder();
  let webUsed = false;
  const stream = new ReadableStream({
    async start(controller) {
      let toolsMarkerJson: string | null = null;
      let lastWebNotes: string = '';
      try {
        const sanitizeDelta = (t: string) => t
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');

        let messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
        let lastTools: AITool[] = [];
        let lastWebLinks: string[] = [];
        let generationModel: string = model as any;
        let newsAutoOutput: string | null = null; // 뉴스용 비-LLM 자동 출력
        let tools: any[] = [];
        // 0) 기본 인격 고정: MOA AI 도우미
        messages.push({ role: 'system', content: '당신은 MOA AI 도우미입니다. 친근하고 부드러운 한국어(해요체)로 간결하게 돕습니다. "실시간으로 확인 불가", "링크를 보내", "접근 권한", "브라우징 불가" 같은 문구는 사용하지 마세요.' });
        // 1) 날짜/시간은 "필요한 질문"에서만 주입
        const needsTimeContext = (() => {
          const q = String(prompt || '').toLowerCase();
          // 식사/즉시 이동/날씨/영업시간/시각 등 시간 의존 질문만 true
          const meal = /(점심|저녁|아침|야식|lunch|dinner|breakfast)/.test(q);
          const goNow = /(지금|갈만한|가볼만한|오늘|today|now)/.test(q) && /(곳|장소|카페|맛집|restaurant|place|spot|where)/.test(q);
          const hours = /(영업시간|오픈|open\s*hour|opening\s*hours)/.test(q);
          const clock = /(지금\s*몇시|현재\s*시간|현재\s*시각|time|date)/.test(q);
          const weather = /(날씨|weather)/.test(q);
          return meal || goNow || hours || clock || weather;
        })();
        if (needsTimeContext) {
          try {
            const now = new Date();
            const nowKo = new Intl.DateTimeFormat('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
              hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'
            }).format(now);
            const hourStr = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(now);
            const hour = Number(hourStr);
            const bucket = (
              hour >= 6 && hour <= 10 ? '아침' :
              hour >= 11 && hour <= 14 ? '점심' :
              hour >= 15 && hour <= 17 ? '오후' :
              hour >= 18 && hour <= 21 ? '저녁' :
              hour >= 22 || hour <= 1 ? '야식' :
              '심야'
            );
            const timeSystemNote = `요청이 시간/날짜에 민감해요. 현재 한국 표준시(KST) ${nowKo}, 시간대는 ${bucket}입니다. 변동 가능성이 있는 정보는 보수적으로 표현해 주세요.`;
            messages.push({ role: 'system', content: timeSystemNote });
          } catch {}
        }

        // 2) 웹검색 기본 활성화 (인사/자기소개 스몰톡은 생략)
        try {
          const qLower = String(prompt || '').toLowerCase();
          const isGreetingOrIdentity = /^(안녕|안녕하세요|하이|헬로|hello|hi|hey|ㅎㅇ|안뇽)$/.test(qLower.trim()) || /(누구|너는|정체|who\s*are\s*you)/i.test(qLower);
          const isNewsIntent = /(뉴스|news)/i.test(qLower);
          const isWeatherIntent = /(날씨|weather)/i.test(qLower);
          const wantsDomestic = newsScope === 'domestic' ? true : /(국내|한국|코리아|kr\b)/i.test(qLower);
          const wantsGlobal = newsScope === 'global' ? true : /(해외|국제|글로벌|국외|international|overseas)/i.test(qLower);
          const wantsSplit = newsScope === 'split' ? true : /(국내.*해외|해외.*국내|따로|분리)/i.test(qLower);
          // 사용자 제공 도메인/URL 추출 (예: 도메인: etnews.com, https://www.zdnet.co.kr)
          const providedDomains = (()=>{
            try {
              const textRaw = String(prompt||'');
              const list: string[] = [];
              const re = /(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/gi;
              for (const m of textRaw.matchAll(re) as any) {
                const h = (m[1]||'').toLowerCase();
                if (h && !list.includes(h)) list.push(h);
              }
              // '도메인:' 키워드 패턴 처리
              const domLine = textRaw.split(/\n|,/).filter(s=>/도메인/i.test(s)).join(' ');
              for (const m of domLine.matchAll(re) as any) {
                const h = (m[1]||'').toLowerCase();
                if (h && !list.includes(h)) list.push(h);
              }
              return list.slice(0, 10);
            } catch { return []; }
          })();
          const domesticDomains = [
            'news.sbs.co.kr','news.kbs.co.kr','imnews.imbc.com','www.yna.co.kr','www.hani.co.kr','www.chosun.com','www.joongang.co.kr','www.donga.com','www.zdnet.co.kr','www.bloter.net','www.mk.co.kr','www.sedaily.com','www.khan.co.kr','www.etnews.com'
          ];
          const globalDomains = [
            'www.theverge.com','techcrunch.com','www.wired.com','arstechnica.com','www.engadget.com','www.bloomberg.com','www.reuters.com','www.cnbc.com','www.ft.com','www.wsj.com','www.nytimes.com'
          ];
          // 웹검색은 뉴스/시간 민감 요청 또는 강제 web 모드에서만 수행 (툴 추천 질의에서는 생략해 지연 최소화)
          if (WEB_SEARCH_ENABLED && !isGreetingOrIdentity && (isNewsIntent || decision.web)) {
            console.log('[WEB] invoking web_search', { isNewsIntent, decided: decision.web });
            async function fetchNotes(allowed: string[] | null, label?: string): Promise<string> {
              const started = Date.now();
              const tool: any = { type: 'web_search', user_location: { type: 'approximate', country: 'KR', city: 'Seoul', region: 'Seoul' }, search_context_size: (isNewsIntent ? 'medium' : 'low') };
              if (allowed && allowed.length) tool.filters = { allowed_domains: allowed.slice(0, 20) };
              // Web search 기능 - GPT-5 사용
              const resp: any = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',  // 웹 검색은 저렴한 모델 사용
                messages: [{role: 'system', content: '최신 정보를 제공하는 어시스턴트입니다.'}, {role: 'user', content: `사용자 질문: "${String(prompt || '').slice(0, 500)}"\n핵심 사실을 3~6줄로 간단히 답변해 주세요.`}],
                max_tokens: 220,
                temperature: 0.7
              });
              let out = String(resp?.choices?.[0]?.message?.content || '').trim();
              // sources 기반 보강: output_text가 비면 소스 목록으로 메모 생성
              try {
                const sources = (resp as any)?.web_search_call?.action?.sources || [];
                if ((!out || out.length < 40) && Array.isArray(sources) && sources.length) {
                  const lines = sources.slice(0, 6).map((s: any, i: number) => {
                    const url = String(s?.url || '');
                    const host = (()=>{ try { return new URL(url).hostname; } catch { return ''; } })();
                    const title = String(s?.title || `출처 ${i+1}`).slice(0, 80);
                    return `- ${title} (${host})`;
                  });
                  out = lines.join('\n');
                }
              } catch {}
              try {
                const raw = JSON.stringify(resp);
                const urls = Array.from(raw.matchAll(/https?:\/\/[^"'\s)]+/gi)).map((m:any)=>m[0]);
                if (urls && urls.length) {
                  const uniq: string[] = [];
                  const seen = new Set<string>();
                  for (const u of urls) { if (!seen.has(u)) { seen.add(u); uniq.push(u); } }
                  lastWebLinks = uniq.slice(0, 20);
                  console.log('[WEB][SOURCES]', { label: label||'all', count: lastWebLinks.length, samples: lastWebLinks.slice(0,5) });
                }
              } catch {}
              const ms = Date.now() - started;
              console.log('[WEB] notes', label||'all', out.length, 'in', `${ms}ms`);
              return out;
            }
            async function fetchNotesTimed(allowed: string[] | null, label: string, timeoutMs: number): Promise<string> {
              const tStart = Date.now();
              const RACE_TIMEOUT = new Promise<string>((resolve)=> setTimeout(()=>resolve('__TIMEOUT__'), timeoutMs));
              const result = await Promise.race<string>([fetchNotes(allowed, label), RACE_TIMEOUT]);
              if (result === '__TIMEOUT__') { console.warn('[WEB] timeout', label, `${Date.now()-tStart}ms`); return ''; }
              return result;
            }
            webUsed = true;
            let webNotes = '';
            const weatherDomains = ['www.weather.go.kr','www.kma.go.kr','www.accuweather.com','weather.com','www.timeanddate.com','www.yr.no'];
            const cacheKeyBase = `${wantsSplit?'split':(wantsGlobal?'intl':(wantsDomestic?'kr':'auto'))}:${qLower}`;
            const cached = getCache(cacheKeyBase);
            if (cached) {
              webNotes = cached;
              console.log('[WEB] cache hit', cacheKeyBase, webNotes.length);
            } else if ((providedDomains && providedDomains.length)) {
              // 사용자 지정 도메인 우선 검색
              webNotes = await fetchNotesTimed(providedDomains, 'user-domains', WEB_SEARCH_TIMEOUT_MS);
            } else if (wantsSplit || (wantsDomestic && wantsGlobal)) {
              const [kr, intl] = await Promise.all([
                fetchNotesTimed(domesticDomains, 'kr', WEB_SEARCH_TIMEOUT_MS),
                fetchNotesTimed(globalDomains, 'intl', WEB_SEARCH_TIMEOUT_MS)
              ]);
              webNotes = `${kr ? '[국내]\n'+kr : ''}${kr && intl ? '\n\n' : ''}${intl ? '[해외]\n'+intl : ''}`.trim();
            } else {
              const primaryDomains = isWeatherIntent ? weatherDomains : (wantsGlobal ? globalDomains : domesticDomains);
              webNotes = await fetchNotesTimed(primaryDomains, (wantsGlobal ? 'intl' : 'kr'), WEB_SEARCH_TIMEOUT_MS);
              // 국내 우선인데 결과가 부족하면 해외로 보강
              if ((!webNotes || webNotes.length < 100) && !wantsGlobal && !isWeatherIntent) {
                const intl = await fetchNotesTimed(globalDomains, 'intl-fallback', WEB_SEARCH_TIMEOUT_MS);
                webNotes = `${webNotes}\n\n${intl}`.trim();
              }
            }
            console.log('[WEB] search output length', webNotes?.length || 0);
            try {
              const memoLinks = Array.from(String(webNotes||'').matchAll(/\((https?:\/\/[^)\s]+|[a-z0-9.-]+\.[a-z]{2,})\)/gi)).map(m=>m[1]);
              console.log('[WEB][MEMO_LINKS]', { traceId, count: memoLinks.length, samples: memoLinks.slice(0,5) });
              const preview = String(webNotes||'').replace(/\n/g,' ').slice(0,160);
              console.log('[WEB][MEMO_PREVIEW]', { traceId, preview });
            } catch {}
            lastWebNotes = webNotes;
            if (webNotes) setCache(cacheKeyBase, webNotes);
            // 뉴스 전용 2차 폴백 검색(첫 검색이 비어 있을 때)
            if (!webNotes && isNewsIntent) {
              try {
                const retry: any = await openai.chat.completions.create({
                  model: 'gpt-3.5-turbo',  // 재시도는 저렴한 모델
                  messages: [{role: 'user', content: '오늘 한국 IT/테크 뉴스 세 가지를 각 1~2문장으로 요약해 주세요.'}],
                  max_tokens: 300,
                  temperature: 0.7
                });
                webNotes = String(retry?.choices?.[0]?.message?.content || '').trim();
                lastWebNotes = webNotes || lastWebNotes;
              } catch {}
            }
            if (webNotes) {
              // 입력 길이 최적화: 너무 긴 메모는 요약 품질/지연을 해치므로 제한
              if (webNotes.length > 1200) {
                webNotes = webNotes.slice(0, 1200);
              }
              // 뉴스 요약도 gpt-5 사용하여 스트리밍 안정성 확보
              generationModel = 'gpt-5';
              messages.push({ role: 'system', content: `웹 검색 메모(실제 최신 웹결과 요약):\n${webNotes}\n\n후보 URL (참고용):\n- ${(lastWebLinks||[]).slice(0,10).join('\n- ')}\n\n주의: 본문에 각 항목의 마지막 줄에 (도메인)을 쓰고, 바로 아래 줄에 실제 기사 원문 URL을 하나 첨부하세요. 금지: '웹 검색 권한 없음', '브라우징 불가', '접근 권한 없음' 같은 사과/제한 문구.` });
              // LLM이 사과문을 출력하는 문제에 대비해, 소스만으로 자동 결과를 구성하는 경로
              if (isNewsIntent && (lastWebLinks?.length||0) > 0) {
                try {
                  const links = lastWebLinks.slice(0,5);
                  const hosts = links.map(u=>{ try { return new URL(u).hostname; } catch { return ''; } });
                  const memoLines = String(webNotes||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
                  const pickCount = Math.max(3, Math.min(5, Math.min(memoLines.length, links.length)));
                  const items: string[] = [];
                  for (let i=0;i<pickCount;i++) {
                    const line = memoLines[i] || '';
                    const title = line.replace(/^[-•·\*]\s*/,'').split(/[\.|!]/)[0].slice(0,60) || `이슈 ${i+1}`;
                    items.push(`${i+1}) ${title}\n- 주요 내용: ${line}\n- 핵심 결론 (${hosts[i]||'출처'})\n  링크: ${links[i]}`);
                  }
                  newsAutoOutput = items.join('\n\n') + `\n출처: ${hosts.slice(0,pickCount).join(', ')}`;
                } catch {}
              }
              // 뉴스 요약 의도면(템플릿 사용 허용시에만) 출력 형식을 지정
              if (isNewsIntent && NEWS_TEMPLATES_ENABLED) {
                // 시간 범위 해석(오늘/어제/이번주/이번달/동향)
                const now = new Date();
                const y = now.getFullYear();
                const m = now.getMonth() + 1;
                const wantsTodayKw = /(오늘|today)/.test(qLower);
                const wantsYesterdayKw = /(어제|yesterday)/.test(qLower);
                const wantsThisWeekKw = /(이번주|금주|this\s*week)/.test(qLower);
                const wantsThisMonthKw = /(이번달|이달|this\s*month)/.test(qLower);
                const wantsTrend = /(동향|트렌드|전반|overall|어때)/.test(qLower);
                const scopeNote = wantsTodayKw ? '한국시간 오늘자 기사만' : wantsYesterdayKw ? '한국시간 어제 기사 중심' : wantsThisWeekKw ? '이번 주 기사 중심' : wantsThisMonthKw ? '이번 달 기사 중심' : wantsTrend ? `올해 ${y}년 ${m}월 기준 국내 IT 동향(최근 2~4주 기사 중심)` : '최근 24~72시간 기사 중심';
                messages.push({ role: 'system', content: `위 웹 검색 메모만 근거로 ${scopeNote} 3~5가지 뉴스를 아래 형식으로 요약하세요:\n\n1) 제목\n- 주요 내용\n- 핵심 결론 (도메인)\n  링크: https://example.com\n\n2) 제목\n- 주요 내용\n- 핵심 결론 (도메인)\n  링크: https://example.com\n\n...\n\n마지막 줄: 출처: 도메인, 도메인, 도메인\n\n규칙: 각 항목마다 실제 기사 URL 1개를 '링크:' 줄에 반드시 포함. 과장·사과문 금지.` });
              } else {
                messages.push({ role: 'system', content: '위 웹 검색 메모만 근거로 답변하세요. 링크 요구·접근권한 관련 변명·추측 금지.' });
              }
            } else if (isNewsIntent && NEWS_TEMPLATES_ENABLED) {
              // 그래도 비어 있으면 최소한의 기본 가이드를 지시해 유용한 답을 보장
              messages.push({ role: 'system', content: '최신 IT 동향(국내/글로벌) 3가지를 보편적 사실에 기반해 간단히 요약하세요. 각 항목은 1줄, 허위 단정 금지, 과장 금지.' });
            }
          }
        } catch {}
        // 클라이언트에서 전달된 대화 히스토리 병합 (선택)
        if (Array.isArray(history)) {
          try {
            const allowed = new Set(['system','user','assistant']);
            for (const m of history) {
              const role = String(m?.role || '').toLowerCase();
              const content = String(m?.content || '');
              if (!allowed.has(role) || !content) continue;
              messages.push({ role: role as any, content });
            }
          } catch {}
        }
        if (process.env.NODE_ENV === 'development') {
          console.log('[STREAM_DEBUG] kbMode:', kbMode, 'detectToolSearchIntent:', detectToolSearchIntent(prompt));
        }
        if (kbMode === 'db' && !isDetailFirst && !exactToolPick && detectToolSearchIntent(prompt)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[STREAM_DEBUG] Tool search detected, proceeding with tool search logic');
        }
          const intent = analyzeUserIntent(prompt);
        console.log('[INTENT] Detected intent:', {
          category: intent.category,
          features: intent.features,
          count: intent.count,
          pricePreference: intent.pricePreference,
          isToolSearch: detectToolSearchIntent(prompt)
        });
          // 카테고리 감지 시 searchQuery를 비워 AND 충돌 방지
          const safeSearchQuery0 = intent.category ? undefined : (intent.features.join(' ') || undefined);
          const parseCount = (() => { const m = /(\d{1,2})\s*개\b/.exec(String(prompt||'')); return m ? Number(m[1]) : undefined; })();
          const generalAsk = !intent.category && (/(?:\d{1,2})\s*개\b/.test(String(prompt||'')) || /랜덤/.test(String(prompt||'')) || /그냥/.test(String(prompt||'')));
          const searchBoost = expandCategoryQuery(intent.category, intent.features);
          // 새로운 우선순위 검색 엔진 사용
          let searchResults: SearchResult[] = [];
          tools = [];
          
          try {
            searchResults = await searchEngine.search(prompt, {
              category: intent.category || undefined,
              limit: 100,
              includeScores: true
            });
            
            console.log('[SEARCH_ENGINE] Results:', searchResults.length);
            
            // SearchResult를 기존 도구 형식으로 변환
            tools = searchResults.map(r => ({
              id: r.id,
              name: r.name,
              url: r.url,
              domain: r.domain,
              category: r.category,
              summary: r.summary,
              description: r.description,
              iconUrl: r.iconUrl,
              koreanSupport: r.koreanSupport,
              isKoreanService: r.isKoreanService,
              apiSupport: r.apiSupport,
              features: [],
              hasAPI: r.apiSupport || false,
              price: 'freemium' as const,
              score: r.score,
              matchReason: r.matchReason
            }));

            if (intent.category === 'ppt') {
              try {
                const dbTools = await searchAIToolsUnified({ category: 'ppt' });
                const syns = ['ppt','pptx','powerpoint','slide','slides','deck','keynote','google slides'];
                tools = filterByFeatureSynonymExact(dbTools as any, syns) as any;
              } catch (e) {
                console.error('[STREAM][PPT] DB refine failed, keeping initial results:', e);
              }
            }
          } catch (e) {
            console.error('[SEARCH_ENGINE] Error:', e);
            // 폴백: 기존 검색 방식 사용
            tools = await searchAIToolsUnified({
            category: intent.category || undefined,
            price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
            features: intent.features.length > 0 ? intent.features : undefined,
              searchQuery: intent.category ? searchBoost : safeSearchQuery0
            });
          }
          if (process.env.NODE_ENV === 'development') {
            console.log('[STREAM_DEBUG] Initial search results:', tools.length, 'tools found');
            if (tools.length > 0) {
              console.log('[STREAM_DEBUG] First few tools:', tools.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
            }
          }
          
          // 카테고리별 처리 - 실제 관련 도구만 반환
          // 단순 QnA/인사/정보성 질문이면 도구 추천 비활성화
          const simpleQna = (() => {
            const q = String(prompt || '').toLowerCase();
            const hasToolVerb = /(추천|툴|도구|tool|서비스|알려|찾아|리스트|목록|top|best)/.test(q);
            const greet = (/^(안녕|안녕하세요|안뇽|안뇽하세요|하이|헬로|헬로우|hello|hi|hey|ㅎㅇ)$/i.test(q.trim())) || /안.{0,2}녕/.test(q);
            const isGreetingOrQuestion = greet || /(무엇|뭐야|어떻게|왜|언제|어디|설명|정의|요약|뜻|meaning|what|how|why|when|where)/.test(q);
            return !hasToolVerb && isGreetingOrQuestion;
          })();
          if (simpleQna) {
            // 텍스트만 생성. 이전 카드(이전 메시지)에 영향 주지 않도록 이번 응답에는 카드 마커를 전송하지 않음
            tools = [];
          }
          if (intent.category) {
            const categoryConfig = {
              '3d': {
                keywords: [
                  '3d avatar mesh spline blender maya 3차원 입체 모델링 렌더링',
                  '3d modeling animation rendering zbrush cinema4d houdini',
                  '3d generation ai avatar virtual human character',
                  'unreal engine unity three.js babylon.js sketchfab',
                  'mixamo rokoko deepmotion plask move ai'
                ],
                checkRelated: (tool: any) => {
                  const name = String(tool.name || '').toLowerCase();
                  const desc = String(tool.description || '').toLowerCase();
                  const summary = String(tool.summary || '').toLowerCase();
                  
                  // 3D 도구 이름 명시적 체크 (a1.art 제외 - 이미지 변환 도구)
                  const is3DTool = ['meshy', 'cascadeur', 'avaturn', 'creatie', 'spline', 'luma ai', 'dora ai', 'sparc3d'].some(
                    toolName => name.includes(toolName)
                  );
                  
                  if (is3DTool) return true;
                  
                  // 3D 관련 키워드 체크
                  const has3DKeywords = desc.includes('3d') || desc.includes('3차원') || desc.includes('입체') ||
                                        desc.includes('model') || desc.includes('render') || desc.includes('animation') ||
                                        summary.includes('3d') || summary.includes('3차원') || summary.includes('입체');
                  
                  return has3DKeywords;
                }
              },
              'marketing': {
                keywords: [
                  'marketing advertising social media design branding',
                  '마케팅 광고 소셜미디어 디자인 브랜딩',
                  'sns instagram facebook twitter youtube',
                  'content marketing email marketing seo sem',
                  '콘텐츠마케팅 이메일마케팅 seo sem ppc',
                  'influencer campaign promotion pr',
                  '인플루언서 캠페인 프로모션 홍보'
                ],
                checkRelated: (tool: any) => {
                  const cat = String(tool.category || '').toLowerCase();
                  const desc = String(tool.description || '').toLowerCase();
                  const summary = String(tool.summary || '').toLowerCase();
                  const features: string[] = (tool.features || []).map((f: any) => String(f).toLowerCase());
                  
                  return cat.includes('marketing') || cat.includes('advertising') || cat.includes('social') ||
                         desc.includes('marketing') || desc.includes('마케팅') || desc.includes('광고') || desc.includes('advertising') ||
                         desc.includes('social') || desc.includes('소셜') || desc.includes('branding') || desc.includes('브랜딩') ||
                         summary.includes('marketing') || summary.includes('마케팅') || summary.includes('광고') || summary.includes('advertising') ||
                         summary.includes('social') || summary.includes('소셜') ||
                         features.some((f: string) => f.includes('marketing') || f.includes('advertising') || f.includes('social'));
                }
              },
              'ppt': {
                keywords: [
                  'ppt powerpoint presentation slide deck',
                  '프레젠테이션 슬라이드 발표 자료',
                  'presentation software slide maker',
                  '발표 도구 프레젠테이션 제작'
                ],
                checkRelated: (tool: any) => {
                  // features에서 동의어가 100% 일치하는 경우에만 ppt로 인정
                  const syns = ['ppt','pptx','powerpoint','slide','slides','deck','keynote','google slides'];
                  const feats = (tool.features || []).map((f: any) => String(f));
                  const exact = filterByFeatureSynonymExact(
                    [{ ...tool, features: feats }],
                    syns
                  );
                  // 추가: 반드시 'ppt' 토큰이 features에 존재해야 함
                  const must = filterByFeatureMustContain([{ ...tool, features: feats }], 'ppt');
                  return exact.length > 0 && must.length > 0;
                }
              },
              'design': {
                keywords: [
                  'ui ux design interface graphic visual',
                  'ui/ux 디자인 인터페이스 그래픽 비주얼',
                  'figma sketch adobe xd photoshop illustrator',
                  'canva framer webflow design system',
                  '피그마 스케치 어도비 포토샵 일러스트레이터',
                  '캔바 프레이머 웹플로우 디자인시스템'
                ],
                checkRelated: (tool: any) => {
                  const cat = String(tool.category || '').toLowerCase();
                  const name = String(tool.name || '').toLowerCase();
                  const desc = String(tool.description || '').toLowerCase();
                  const summary = String(tool.summary || '').toLowerCase();
                  
                  // 디자인 관련 도구 이름들
                  const designTools = ['figma', 'canva', 'framer', 'adobe', 'photoshop', 'illustrator', 
                                      'sketch', 'affinity', 'procreate', 'kittl', 'uizard', 'motiff'];
                  
                  const isDesignTool = designTools.some(tool => name.includes(tool));
                  if (isDesignTool) return true;
                  
                  // 디자인/UI/UX/이미지 카테고리 체크
                  const isDesignCategory = cat.includes('design') || cat.includes('image') || 
                                          cat.includes('graphic') || cat.includes('ui') || cat.includes('ux');
                  if (isDesignCategory) return true;
                  
                  // 디자인 관련 키워드 체크
                  const hasDesignKeywords = desc.includes('design') || desc.includes('디자인') || 
                                           desc.includes('ui') || desc.includes('ux') || 
                                           desc.includes('graphic') || desc.includes('그래픽') ||
                                           desc.includes('visual') || desc.includes('비주얼') ||
                                           desc.includes('interface') || desc.includes('인터페이스') ||
                                           desc.includes('image') || desc.includes('이미지') ||
                                           desc.includes('logo') || desc.includes('로고') ||
                                           desc.includes('icon') || desc.includes('아이콘') ||
                                           desc.includes('illustration') || desc.includes('일러스트') ||
                                           summary.includes('design') || summary.includes('디자인') ||
                                           summary.includes('ui') || summary.includes('ux') ||
                                           summary.includes('image') || summary.includes('이미지');
                  
                  // 비디오/오디오/텍스트 도구는 제외
                  const isNotDesign = cat.includes('video') || cat.includes('audio') || 
                                     cat.includes('chat') || cat.includes('text') || 
                                     cat.includes('code') || cat.includes('productivity');
                  
                  return hasDesignKeywords && !isNotDesign;
                }
              },
              'nocode': {
                keywords: [
                  'nocode no-code no code drag drop builder',
                  '노코드 비개발 드래그앤드롭 빌더',
                  'workflow automation builder tool',
                  '워크플로우 자동화 빌더 도구',
                  'visual programming block coding',
                  '비주얼 프로그래밍 블록 코딩',
                  'n8n zapier make pipedream bubble',
                  'webflow wix squarespace wordpress',
                  'airtable notion coda retool glide',
                  'adalo thunkable appgyver appsheet'
                ],
                checkRelated: (tool: any) => {
                  const cat = String(tool.category || '').toLowerCase();
                  const name = String(tool.name || '').toLowerCase();
                  const desc = String(tool.description || '').toLowerCase();
                  const summary = String(tool.summary || '').toLowerCase();
                  const features: string[] = (tool.features || []).map((f: any) => String(f).toLowerCase());
                  
                  // 노코드 관련 키워드들
                  const nocodeKeywords = [
                    'nocode', 'no-code', 'no code', '노코드', '비개발', '비개발자', '코딩없이', '프로그래밍없이',
                    '드래그앤드롭', 'drag', 'drop', '빌더', 'builder', '워크플로우', 'workflow', '자동화', 'automation',
                    'n8n', 'zapier', 'make', 'pipedream', 'bubble', 'webflow', 'wix', 'squarespace', 'wordpress',
                    'shopify', 'airtable', 'notion', 'coda', 'retool', 'glide', 'adalo', 'thunkable', 'appgyver',
                    'appsheet', 'outsystems', 'mendix', 'powerapps', 'power automate', 'microsoft power platform',
                    'google appsheet', 'salesforce lightning', 'salesforce flow', 'hubspot workflows', 'pipedrive',
                    'monday.com', 'asana', 'trello', 'clickup', 'smartsheet'
                  ];
                  
                  return nocodeKeywords.some(keyword => 
                    cat.includes(keyword) || name.includes(keyword) || desc.includes(keyword) || 
                    summary.includes(keyword) || features.some((f: string) => f.includes(keyword))
                  );
                }
              }
            };
            
            const config = categoryConfig[intent.category as keyof typeof categoryConfig];
            if (config) {
            if (process.env.NODE_ENV === 'development') {
              console.log(`[${intent.category.toUpperCase()}] Category detected, found ${tools.length} tools from DB`);
            }
            
            // 관련 키워드로 추가 검색
            if (tools.length < 5) {
              if (process.env.NODE_ENV === 'development') {
                console.log(`[${intent.category.toUpperCase()}] Searching for more ${intent.category} tools...`);
              }
                const searchPromises = config.keywords.map(keyword => 
                  searchAIToolsUnified({ searchQuery: keyword })
                );
                
                try {
                  const searchResults = await Promise.all(searchPromises);
                  const existingIds = new Set(tools.map(t => t.id));
                  
                  for (const searchResult of searchResults) {
                    if (tools.length >= 20) break;
                    for (const tool of searchResult || []) {
                      if (tools.length >= 20) break;
                      if (!existingIds.has(tool.id) && config.checkRelated(tool)) {
                        tools.push(tool);
                        existingIds.add(tool.id);
                        if (process.env.NODE_ENV === 'development') {
                          console.log(`[${intent.category.toUpperCase()}] Added tool: ${tool.name}`);
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error(`[${intent.category.toUpperCase()}] Parallel search failed:`, e);
                }
                
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[${intent.category.toUpperCase()}] After additional search: ${tools.length} tools`);
                }
              }
              
              // 디자인 도구가 부족하면 하드코딩된 도구 추가
              if (intent.category === 'design' && tools.length < 5) {
                const hardcodedDesignTools = [
                  { id: 'figma', name: 'Figma', domain: 'figma.com', category: 'design',
                    description: '협업 기반 UI/UX 디자인 도구',
                    iconUrl: 'https://figma.com/favicon.ico', summary: 'UI/UX 디자인' },
                  { id: 'canva', name: 'Canva', domain: 'canva.com', category: 'design',
                    description: '템플릿 기반 그래픽 디자인 도구',
                    iconUrl: 'https://canva.com/favicon.ico', summary: '그래픽 디자인' },
                  { id: 'framer', name: 'Framer', domain: 'framer.com', category: 'design',
                    description: '인터랙티브 프로토타입 디자인 도구',
                    iconUrl: 'https://framer.com/favicon.ico', summary: '프로토타입 디자인' },
                  { id: 'uizard', name: 'Uizard', domain: 'uizard.io', category: 'design',
                    description: 'AI 기반 UI 디자인 자동화 도구',
                    iconUrl: 'https://uizard.io/favicon.ico', summary: 'AI UI 디자인' },
                  { id: 'kittl', name: 'Kittl', domain: 'kittl.com', category: 'design',
                    description: 'AI 지원 그래픽 디자인 플랫폼',
                    iconUrl: 'https://kittl.com/favicon.ico', summary: 'AI 그래픽 디자인' }
                ];
                
                const existingIds = new Set(tools.map(t => t.id));
                for (const tool of hardcodedDesignTools) {
                  if (!existingIds.has(tool.id)) {
                    tools.push(tool);
                    console.log(`[DESIGN] Added hardcoded tool: ${tool.name}`);
                  }
                }
              }
              
              // 3D 도구가 부족하면 하드코딩된 도구 추가
              if (intent.category === '3d' && tools.length < 5) {
                const hardcoded3DTools = [
                  { id: 'meshy', name: 'Meshy', domain: 'meshy.ai', category: 'productivity', 
                    description: '텍스트나 이미지에서 바로 3D 모델을 생성하는 AI 도구', 
                    iconUrl: 'https://logo.clearbit.com/meshy.ai', summary: '텍스트를 3D로 변환' },
                  { id: 'cascadeur', name: 'Cascadeur', domain: 'cascadeur.com', category: 'productivity',
                    description: 'AI가 물리 시뮬레이션을 도와주는 3D 애니메이션 도구',
                    iconUrl: 'https://cascadeur.com/favicon.ico', summary: '3D 애니메이션 제작' },
                  { id: 'avaturn', name: 'Avaturn', domain: 'avaturn.me', category: 'productivity', 
                    description: '사진 한 장으로 3D 아바타를 생성하는 AI 도구', 
                    iconUrl: 'https://avaturn.me/favicon.ico', summary: '3D 아바타 생성' },
                  { id: 'creatie', name: 'Creatie', domain: 'creatie.ai', category: 'productivity',
                    description: '텍스트로 3D 모델을 생성하는 AI 도구',
                    iconUrl: 'https://creatie.ai/favicon.ico', summary: '3D 모델 생성' },
                  { id: 'spline', name: 'Spline', domain: 'spline.design', category: 'productivity',
                    description: '웹브라우저에서 바로 3D 디자인을 할 수 있는 도구',
                    iconUrl: 'https://spline.design/favicon.ico', summary: '3D 웹 디자인' }
                ];
                
                const existingIds = new Set(tools.map(t => t.id));
                for (const tool of hardcoded3DTools) {
                  if (!existingIds.has(tool.id)) {
                    tools.push(tool);
                    console.log(`[3D] Added hardcoded tool: ${tool.name}`);
                  }
                }
              }
              
              // 도구가 없으면 없다고 알려주기
              if (tools.length === 0) {
                if (process.env.NODE_ENV === 'development') {
                  console.log(`[${intent.category.toUpperCase()}] No ${intent.category} tools found, will inform user`);
                }
                lastTools = [];
              }
            }
          }
          
          // simpleQna 재확인 후 도구 정리
          const simpleQna2 = (() => {
            const q = String(prompt || '').toLowerCase();
            const hasToolVerb = /(추천|툴|도구|tool|서비스|알려|찾아|리스트|목록|top|best)/.test(q);
            const isGreetingOrQuestion = /^(안녕|안녕하세요|hello|hi)$/i.test(q) || /(무엇|뭐야|어떻게|왜|언제|어디|설명|정의|요약|뜻|meaning|what|how|why|when|where)/.test(q);
            return !hasToolVerb && isGreetingOrQuestion;
          })();
          if (!simpleQna2) {
            tools = prioritizeToolsByIntent(tools as any, String(prompt||''));
            tools = await enrichWithAliases(tools as any, String(prompt||''), async (q)=> searchAIToolsUnified({ searchQuery: q }));
          } else {
            tools = [];
          }
          lastTools = tools as any;
          if (process.env.NODE_ENV === 'development') {
            console.log('[STREAM_DEBUG] Final tools set:', lastTools.length, 'tools');
            if (lastTools.length > 0) {
              console.log('[STREAM_DEBUG] Final tool names:', lastTools.map(t => t.name));
            }
          }
          const targetCount = Math.min(Math.max(parseCount ?? 5, 1), 10);
          const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
          // 워크플로우 카테고리는 우선순위 유지, 나머지는 셔플
          const isWorkflow = intent.category === 'workflow' || String(prompt||'').toLowerCase().includes('워크플로우') || String(prompt||'').toLowerCase().includes('workflow');
          // 특정 카테고리는 범용 검색 비활성화 (없으면 없다고 안내)
          if ((intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design') && tools.length === 0) {
            // 해당 카테고리 도구가 없으면 범용 검색하지 않음
          } else {
            tools = generalAsk ? shuffle(await searchAIToolsUnified({})) : (isWorkflow ? tools : (tools.length ? shuffle(tools) : []));
          }
          // 카테고리별 필터링은 이미 위에서 처리됨
          
          // 부족하면 범용 검색으로 보강 (특정 카테고리 제외)
          if (tools.length < targetCount && !(intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design')) {
            try {
              console.log('[SEED] Searching for more tools with general search...');
              
              // 범용 검색으로 추가 도구 찾기
              const generalSearchPromises = [
                searchAIToolsUnified({ searchQuery: String(prompt||'') }),
                searchAIToolsUnified({ searchQuery: 'ai tool software' }),
                searchAIToolsUnified({ searchQuery: 'ai 도구 소프트웨어' })
              ];
              
              const searchResults = await Promise.all(generalSearchPromises);
              const validResults = searchResults.flat().filter(Boolean);
              
              for (const pick of validResults) {
                if (tools.length >= targetCount) break;
                if (pick && !tools.find((x:any)=>x.id===pick.id)) {
                  // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                  tools.push(pick);
                }
              }
              if (process.env.NODE_ENV === 'development') {
                console.log('[SEED] Final tools count:', tools.length);
              }
            } catch (e) {
              console.error('[SEED] Error:', e);
            }
          }
          
          // 여전히 부족하면 범위를 넓혀 targetCount까지 보강 (특정 카테고리 제외)
          if (tools.length < targetCount && !(intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design')) {
            const broader = shuffle(await searchAIToolsUnified({ searchQuery: intent.category || (intent.features.join(' ') || undefined) }));
            const ids = new Set(tools.map(t => t.id));
            for (const t of broader) {
              if (!ids.has(t.id)) { 
                // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                tools.push(t); ids.add(t.id);
                if (tools.length >= targetCount) break; 
              }
            }
          }
          tools = tools.slice(0, targetCount);
          // 평점 보강
          try { tools = await enrichRatingsUnified(tools as any); } catch {}
          lastTools = tools; // lastTools를 최종 선택된 도구로 업데이트
          console.log('[STREAM] lastTools set to:', lastTools?.length || 0, 'tools');
          
          // 3D 쿼리의 경우 lastTools 강제 설정
          if (intent.category === '3d' && lastTools && lastTools.length > 0) {
            console.log('[STREAM] 3D tools confirmed for streaming:', lastTools.map(t => t.name));
          }
          try { console.log('[GEN][DB] allowed tool names:', tools.map(t=>t.name)); } catch {}
          try { toolsMarkerJson = JSON.stringify({ traceId, tools: (lastTools || []).map(t=>({ id:t.id, name:t.name, description:t.description, url:t.url, domain:t.domain, hasAPI:t.hasAPI, category:t.category, price:t.price, imageUrl:(t as any).imageUrl, rating:(t as any).rating }))}); } catch {}
          messages = [
            ...messages,
            { role: 'system', content: systemDbReasoningPrompt() },
            { role: 'user', content: buildDbReasoningUserPrompt(prompt, tools as unknown as AITool[]) }
          ];
        } else if (template && !isDetailFirst && !exactToolPick && detectToolSearchIntent(prompt)) {
          const intent = analyzeUserIntent(prompt);
          // 카테고리 감지 시 searchQuery를 비워 AND 충돌 방지
          const safeSearchQuery1 = intent.category ? undefined : (intent.features.join(' ') || undefined);
          const parseCount = (() => { const m = /(\d{1,2})\s*개\b/.exec(String(prompt||'')); return m ? Number(m[1]) : undefined; })();
          const generalAsk = !intent.category && (/(?:\d{1,2})\s*개\b/.test(String(prompt||'')) || /랜덤/.test(String(prompt||'')) || /그냥/.test(String(prompt||'')));
          const searchBoost = expandCategoryQuery(intent.category, intent.features);
          // 이미 위에서 처리된 tools를 사용 (중복 검색 방지)
          console.log('[GEN] Using pre-processed tools, count:', tools?.length || 0);
          if (tools && tools.length > 0) {
            tools = prioritizeToolsByIntent(tools as any, String(prompt||''));
            tools = await enrichWithAliases(tools as any, String(prompt||''), async (q)=> searchAIToolsUnified({ searchQuery: q }));
          } else {
            console.log('[ERROR] tools is empty, skipping prioritization');
          }
          lastTools = tools as any;
          const targetCount = Math.min(Math.max(parseCount ?? 5, 1), 10);
          const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
          // 워크플로우 카테고리는 우선순위 유지, 나머지는 셔플
          const isWorkflow = intent.category === 'workflow' || String(prompt||'').toLowerCase().includes('워크플로우') || String(prompt||'').toLowerCase().includes('workflow');
          // 특정 카테고리는 범용 검색 비활성화 (없으면 없다고 안내)
          if ((intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design') && tools.length === 0) {
            // 해당 카테고리 도구가 없으면 범용 검색하지 않음
          } else {
            tools = generalAsk ? shuffle(await searchAIToolsUnified({})) : (isWorkflow ? tools : shuffle(tools));
          }
          // 카테고리별 필터링은 이미 위에서 처리됨
          
          // 부족하면 범용 검색으로 보강 (특정 카테고리 제외)
          if (tools.length < targetCount && !(intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design')) {
            try {
              console.log('[SEED] Searching for more tools with general search...');
              
              // 범용 검색으로 추가 도구 찾기
              const generalSearchPromises = [
                searchAIToolsUnified({ searchQuery: String(prompt||'') }),
                searchAIToolsUnified({ searchQuery: 'ai tool software' }),
                searchAIToolsUnified({ searchQuery: 'ai 도구 소프트웨어' })
              ];
              
              const searchResults = await Promise.all(generalSearchPromises);
              const validResults = searchResults.flat().filter(Boolean);
              
              for (const pick of validResults) {
                if (tools.length >= targetCount) break;
                if (pick && !tools.find((x:any)=>x.id===pick.id)) {
                  // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                  tools.push(pick);
                }
              }
              if (process.env.NODE_ENV === 'development') {
                console.log('[SEED] Final tools count:', tools.length);
              }
            } catch (e) {
              console.error('[SEED] Error:', e);
            }
          }
          
          // 여전히 부족하면 범위를 넓혀 targetCount까지 보강 (특정 카테고리 제외)
          if (tools.length < targetCount && !(intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design')) {
            const broader = shuffle(await searchAIToolsUnified({ searchQuery: intent.category || (intent.features.join(' ') || undefined) }));
            const ids = new Set(tools.map(t => t.id));
            for (const t of broader) {
              if (!ids.has(t.id)) { 
                // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                tools.push(t); ids.add(t.id);
                if (tools.length >= targetCount) break; 
              }
            }
          }
          
          // tools가 undefined이거나 빈 배열인 경우 기본 도구로 초기화
          if (!tools || tools.length === 0) {
            console.log('[ERROR] tools is undefined or empty, initializing with fallback search');
            try {
              tools = await searchAIToolsUnified({ searchQuery: 'ai tool' });
              if (!tools || tools.length === 0) {
                tools = [];
              }
            } catch (e) {
              console.error('[ERROR] Fallback search failed:', e);
              tools = [];
            }
          }
          
          tools = tools.slice(0, targetCount);
          try { tools = await enrichRatingsUnified(tools as any); } catch {}
          lastTools = tools; // lastTools를 최종 선택된 도구로 업데이트
          console.log('[STREAM] lastTools set to:', lastTools?.length || 0, 'tools');
          
          // 3D 쿼리의 경우 lastTools 강제 설정
          if (intent.category === '3d' && lastTools && lastTools.length > 0) {
            console.log('[STREAM] 3D tools confirmed for streaming:', lastTools.map(t => t.name));
          }
          try { console.log('[GEN][DB] allowed tool names:', tools.map(t=>t.name)); } catch {}
          try { toolsMarkerJson = JSON.stringify({ traceId, tools: (lastTools || []).map(t=>({ id:t.id, name:t.name, description:t.description, url:t.url, domain:t.domain, hasAPI:t.hasAPI, category:t.category, price:t.price, imageUrl:(t as any).imageUrl, rating:(t as any).rating }))}); } catch {}
          messages = [
            ...messages,
            { role: 'system', content: systemRecommendationPrompt(targetCount) },
            { role: 'user', content: buildRecommendationUserPrompt(prompt, (lastTools || []) as unknown as AITool[], targetCount) }
          ];
        } else if (isDetailFirst || !!exactToolPick) {
          // 단일 상세: 노션 DB에서 후보를 찾고 상세 템플릿으로 스트리밍
          const q = (detailReq?.toolQuery || String(prompt || '')).trim();
          // 1) 정확 매칭 시도 (이름/도메인)
          let exact = exactToolPick;
          if (!exact) { try { exact = await findAIToolByNameOrDomain(q); } catch {} }
          let candidates = exact ? [exact as any] : await searchAIToolsUnified({ searchQuery: q });
          if (!candidates || candidates.length === 0) {
            const all = await searchAIToolsUnified({});
            const qLower = q.toLowerCase();
            candidates = all.filter(t => (t.name || '').toLowerCase().includes(qLower));
          }
          const pick = (candidates && candidates.length > 0) ? candidates[0] : null;
          // 클라이언트 카드 표시를 위해 [[TOOLS]] 마커에 단일 도구를 포함
          try {
            const one = pick || ({ id: q, name: q, description: '', url: '', domain: '', hasAPI: false, category: 'AI 도구', price: 'freemium', imageUrl: '' } as any);
            lastTools = [one] as any;
            toolsMarkerJson = JSON.stringify({ traceId, tools: [
              { id: (one as any).id || (one as any).name, name: (one as any).name, description: (one as any).description||'', url: (one as any).url||'', domain: (one as any).domain||'', hasAPI: !!(one as any).hasAPI, category: (one as any).category||'', price: (one as any).price||'freemium', imageUrl: (one as any).imageUrl||'', rating: Number((one as any).rating || 0) }
            ]});
          } catch {}
          messages = [
            { role: 'system', content: systemDetailPrompt() },
            { role: 'system', content: '아래 형식으로만 아주 간결하게 답하세요. 링크는 본문에 넣지 마세요(카드는 별도 표시됨).\n1) 기본정보: 제품의 성격·한줄 정의(1~2문장)\n2) 주요기능: 핵심 기능 3개(각 1문장)\n3) 활용방법: 대표 사용 시나리오 2~3가지(각 1문장)\n4) API여부: API 제공 여부 및 간단 조건(1문장). 과장/사과/템플릿 문구 금지.' },
            { role: 'user', content: generateDetailedToolPrompt(pick || { name: q, category: 'AI 도구', price: '정보 없음', description: '', features: [], hasAPI: false } as any) }
          ];
        } else if (detectToolSearchIntent(prompt) || detectWebsiteBuildIntent(prompt) || detectWebsiteAssistIntent(prompt) || detectWorkflowAutomationIntent(prompt) || detectBeginnerFriendlyIntent(prompt)) {
          // 추천/검색 의도: 노션 DB에서 Top-N 수집 후 구조화 템플릿으로 스트리밍
          const intent = analyzeUserIntent(prompt);
          // 카테고리 감지 시 searchQuery를 비워 AND 충돌 방지
          const safeSearchQuery2 = intent.category ? undefined : (intent.features.join(' ') || undefined);
          const parseCount = (() => { const m = /(\d{1,2})\s*개\b/.exec(String(prompt||'')); return m ? Number(m[1]) : undefined; })();
          const generalAsk = !intent.category && (/(?:\d{1,2})\s*개\b/.test(String(prompt||'')) || /랜덤/.test(String(prompt||'')) || /그냥/.test(String(prompt||'')));
          const searchBoost = expandCategoryQuery(intent.category, intent.features);
          // 이미 위에서 처리된 tools를 사용 (중복 검색 방지)
          console.log('[GEN] Using pre-processed tools (3rd), count:', tools?.length || 0);
          if (tools && tools.length > 0) {
            tools = prioritizeToolsByIntent(tools as any, String(prompt||''));
            tools = await enrichWithAliases(tools as any, String(prompt||''), async (q)=> searchAIToolsUnified({ searchQuery: q }));
          } else {
            console.log('[ERROR] tools is empty (3rd), skipping prioritization');
          }
          lastTools = tools as any;
          const targetCount = Math.min(Math.max(parseCount ?? 5, 1), 10);
          const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
          // 워크플로우 카테고리는 우선순위 유지, 나머지는 셔플
          const isWorkflow = intent.category === 'workflow' || String(prompt||'').toLowerCase().includes('워크플로우') || String(prompt||'').toLowerCase().includes('workflow');
          // 특정 카테고리는 범용 검색 비활성화 (없으면 없다고 안내)
          if ((intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design') && tools.length === 0) {
            // 해당 카테고리 도구가 없으면 범용 검색하지 않음
          } else {
            tools = generalAsk ? shuffle(await searchAIToolsUnified({})) : (isWorkflow ? tools : shuffle(tools));
          }
          // 카테고리별 필터링은 이미 위에서 처리됨
          
          // 부족하면 범용 검색으로 보강 (특정 카테고리 제외)
          if (tools.length < targetCount && !(intent.category === '3d' || intent.category === 'marketing' || intent.category === 'ppt' || intent.category === 'nocode' || intent.category === 'design')) {
            try {
              console.log('[SEED] Searching for more tools with general search...');
              
              // 범용 검색으로 추가 도구 찾기
              const generalSearchPromises = [
                searchAIToolsUnified({ searchQuery: String(prompt||'') }),
                searchAIToolsUnified({ searchQuery: 'ai tool software' }),
                searchAIToolsUnified({ searchQuery: 'ai 도구 소프트웨어' })
              ];
              
              const searchResults = await Promise.all(generalSearchPromises);
              const validResults = searchResults.flat().filter(Boolean);
              
              for (const pick of validResults) {
                if (tools.length >= targetCount) break;
                if (pick && !tools.find((x:any)=>x.id===pick.id)) {
                  // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                  tools.push(pick);
                }
              }
              if (process.env.NODE_ENV === 'development') {
                console.log('[SEED] Final tools count:', tools.length);
              }
            } catch (e) {
              console.error('[SEED] Error:', e);
            }
          }
          
          // 여전히 부족하면 범위를 넓혀 targetCount까지 보강 (마지막 수단)
          if (tools.length < targetCount) {
            const broader = shuffle(await searchAIToolsUnified({ searchQuery: intent.category || (intent.features.join(' ') || undefined) }));
            const ids = new Set(tools.map((t: any) => t.id));
            for (const t of broader) { 
              if (!ids.has((t as any).id)) { 
                // 도구 추가 (카테고리 필터링은 이미 위에서 처리됨)
                tools.push(t); ids.add((t as any).id);
                if (tools.length >= targetCount) break; 
              } 
            }
          }
          tools = tools.slice(0, targetCount);
          // 카드 표시에 앞서 평점 보강
          try { tools = await enrichRatingsUnified(tools as any); } catch {}
          lastTools = tools; // lastTools를 최종 선택된 도구로 업데이트
          console.log('[STREAM] lastTools set to:', lastTools?.length || 0, 'tools');
          
          // 3D 쿼리의 경우 lastTools 강제 설정
          if (intent.category === '3d' && lastTools && lastTools.length > 0) {
            console.log('[STREAM] 3D tools confirmed for streaming:', lastTools.map(t => t.name));
          }
          try { console.log('[GEN][DB] allowed tool names:', tools.map(t=>t.name)); } catch {}
          try { toolsMarkerJson = JSON.stringify({ traceId, tools: (lastTools || []).map(t=>({ id:t.id, name:t.name, description:t.description, url:t.url, domain:t.domain, hasAPI:t.hasAPI, category:t.category, price:t.price, imageUrl:(t as any).imageUrl, rating:(t as any).rating }))}); } catch {}
          messages = [
            ...messages,
            { role: 'system', content: systemRecommendationPrompt(targetCount, 'classic') },
            { role: 'user', content: buildRecommendationUserPrompt(prompt, (lastTools || []) as unknown as AITool[], targetCount, 'classic') }
          ];
        } else {
          messages = [
            ...messages,
            { role: 'system', content: '대화는 부드러운 한국어(해요체)로 간결하게 이어가 주세요. 날짜/시간/요일 등은 질문에 시간·날짜 관련 단서가 있을 때만 언급하세요.' },
            { role: 'user', content: prompt }
          ];
          // 일반 개념/용어 설명은 스트리밍에서 간결 템플릿으로 처리 (AI 개념 제외)
          if (detectConceptExplainIntent(prompt) && !detectAIConceptExplainIntent(prompt)) {
            messages.unshift({ role: 'system', content: '일반 개념/용어를 1) 한 줄 정의, 2) 핵심 포인트 3개(각 1문장), 3) 간단 예시 1개로 아주 간결하게 설명하세요. 마크다운·표·과장 금지.' });
          }
        }

        // 스트리밍 생성에 하드 타임아웃을 적용하여 장시간 지연을 방지
        const timeoutMs = 120000;
        const deadline = Date.now() + timeoutMs;
        let emitted = false;
        // 클라이언트 카드 일치 보장: 선택된 도구 목록을 먼저 숨김 마커로 전송
        if (toolsMarkerJson) {
          try { controller.enqueue(encoder.encode(`[[TOOLS]]${toolsMarkerJson}[[/TOOLS]]\n`)); } catch {}
          // 도구 마커를 보낸 경우, 모델 출력 전이라도 카드가 즉시 보이도록 함
        }
        // GPT-5 권장 방식(Responses API)으로 생성하여 안정적으로 텍스트를 얻고,
        // 서버에서 라인 단위로 청크를 흘려보낸다.
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('[STREAM] Starting stream generation, lastTools:', lastTools?.length || 0, 'tools');
            console.log('[STREAM_DEBUG] lastTools details:', lastTools?.map(t => ({ name: t.name, category: t.category })) || 'none');
          }
          // intent를 먼저 정의 (카테고리 체크를 위해)
          let intentForCategory;
          try {
            intentForCategory = analyzeUserIntent(String(prompt||''));
          } catch (e) {
            console.warn('[STREAM] analyzeUserIntent failed for category check:', e);
            intentForCategory = { category: undefined, features: [], count: 5 };
          }
          
          // 0) 특정 카테고리 도구가 없는 경우에도 안내 문구를 보내지 않고 빈 응답만 유지
          if (intentForCategory && intentForCategory.category && (lastTools?.length || 0) === 0) {
            // 텍스트 응답은 계속 생성(카드만 없음). ppt는 화이트리스트로 최소 3개 보강 시도
            if (intentForCategory.category === 'ppt') {
              try {
                const whitelist = ['presentations.ai','beautiful.ai','pitch','slidesgo','tome','gamma','slidesai','canva'];
                const results = (await Promise.all(whitelist.map(q => searchAIToolsUnified({ searchQuery: q })))).flat();
                const isHit = (t: any) => {
                  const name = String(t?.name||'').toLowerCase();
                  const domain = String(t?.domain||'').toLowerCase();
                  return whitelist.some(w => name.includes(w.replace(/\..*$/,'')) || domain.includes(w));
                };
                const dedup = new Set<string>();
                const picks = results.filter(isHit).filter(t=>{ const k=String(t.id||t.name); if(dedup.has(k)) return false; dedup.add(k); return true; });
                lastTools = picks.slice(0, Math.max(3, Math.min(5, picks.length)));
              } catch {}
            }
          }
          
          // 1) 이미 lastTools가 준비되어 있다면 모델 호출 없이 헤더+번호목록을 직접 스트리밍
          if ((lastTools?.length || 0) > 0) {
            console.log('[STREAM] Using lastTools for direct streaming, count:', lastTools.length);
            // 항상 5개 추천 (사용자가 특별히 요청하지 않는 한)
            const desired = (()=>{ const m = /(\d{1,2})\s*개\b/.exec(String(prompt||'')); return m ? Math.max(1, Math.min(10, Number(m[1]))) : 5; })();
            const count = Math.max(5, Math.min(10, desired));  // 최소 5개
            // 헤더 문구 제거
            // 의도 기반: 카테고리→태그→기타 순으로 설명 라벨 부여
            // intent를 재사용 (이미 위에서 정의됨)
            const intentForLabel = intentForCategory || { category: '3d', features: ['3D'], count: 5 };
            // 최소 5개 도구 보장
            const toolsToShow = lastTools.length < 5 ? lastTools : lastTools.slice(0, Math.max(5, count));
            const top = toolsToShow;
            // 항목별 "이유/효과" 포맷
            const effectByCategory = (c:string, i:number): string => {
              const cc = String(c||'').toLowerCase();
              const effects = cc.includes('text')||cc.includes('writing')
                ? ['문서/슬라이드 작성 시간이 줄어듭니다','콘텐츠 초안 제작이 빨라집니다','수정·리라이팅 부담이 줄어듭니다']
                : cc.includes('design')
                ? ['브랜딩·디자인 작업이 간소화됩니다','시각 요소를 빠르게 완성할 수 있습니다','템플릿 의존도를 낮출 수 있습니다']
                : cc.includes('workflow')||cc.includes('automation')||cc.includes('integration')
                ? ['반복 업무가 자동화됩니다','외부 서비스 연동이 쉬워집니다','팀 협업 흐름이 매끈해집니다']
                : cc.includes('video')
                ? ['영상 제작 속도가 빨라집니다','컷 편집·자막 처리가 수월해집니다','콘텐츠 발행 주기가 짧아집니다']
                : cc.includes('image')
                ? ['이미지 생성/편집이 수월해집니다','시각 소재 확보가 쉬워집니다','고품질 시각물을 빠르게 준비할 수 있습니다']
                : ['업무 흐름이 단순화됩니다','시작 장벽이 낮아집니다','전반적인 제작 시간이 줄어듭니다'];
              return effects[i % effects.length];
            };
            const buildReason = (t:any, i:number): string => {
              const feats = Array.isArray(t?.features) ? (t.features as any[]).map(x=>String(x)).filter(Boolean) : [];
              const pick = (arr:string[], n:number) => arr.filter(Boolean).slice(0, n).join('·');
              const catHit = intentForLabel?.category && String(t?.category||'').toLowerCase().includes(String(intentForLabel.category).toLowerCase());
              const tagHit = (intentForLabel?.features||[]).some(f=>feats.some(h=>String(h).toLowerCase().includes(String(f).toLowerCase())));
              const candidates = [
                catHit ? `핵심: ${String(intentForLabel?.category).toUpperCase()} 카테고리 적합` : '',
                tagHit ? `포인트: ${pick(feats, 2)}` : '',
                String(t?.description||'').split(/[\.!?\n]/)[0].trim()
              ];
              const chosen = candidates.find(s=>s && s.length>3) || `요점: 대표 기능 ${pick(feats,2)}` || '주요 기능을 한 번에 활용할 수 있습니다';
              const prefixes = ['핵심:','포인트:','요점:'];
              return `${prefixes[i % prefixes.length]} ${chosen}`;
            };
            const body = top.map((t:any, i:number)=>{
              const reason = buildReason(t, i);
              // 효과 부분 제거
              return `${i+1}. ${t.name} - ${reason}`;
            });
            
            // 템플릿 엔진으로 동적 텍스트 생성
            const category = intentForLabel?.category || 'default';
            let responseText = templateEngine.generateResponse(
              lastTools.map((t: any) => ({
                ...t,
                score: t.score || 0,
                matchReason: t.matchReason || []
              })),
              category,
              new Date()
            );
            // 헤더(인삿말) 표시 여부: 도구 검색 의도이거나 요청 동사가 있을 때만 유지
            try {
              const lowerQ = String(prompt || '').toLowerCase();
              const verbAsk = /(알려줘|추천|추천해줘|찾아줘|보여줘|소개해줘|골라줘|리스트|목록)/.test(lowerQ);
              const showHeader = detectToolSearchIntent(String(prompt||'')) || verbAsk;
              if (!showHeader) {
                const parts = responseText.split('\n');
                // 선두 단락(헤더) 제거 + 공백 제거
                while (parts.length && parts[0].trim().length > 0) parts.shift();
                while (parts.length && parts[0].trim().length === 0) parts.shift();
                responseText = parts.join('\n');
              } else {
                // 헤더 강제 보강: 혹시 템플릿 변동으로 누락될 경우 대비
                const headerLine = '요청하신 조건에 맞는 AI 도구를 알려드릴게요.';
                const firstLine = (responseText.split('\n')[0] || '').trim();
                if (firstLine !== headerLine) {
                  responseText = `${headerLine}\n\n${responseText}`;
                }
              }
            } catch {}
            
            // responseText를 줄 단위로 분리
            const lines = responseText.split('\n');
            for (const ln of lines) {
              controller.enqueue(encoder.encode(`${ln}\n\n`));
              await new Promise(r=>setTimeout(r, 50));
            }
            
            // 도구 카드 마커 추가 (이미지 URL 포함)
            // 만약 lastTools가 비어 있으나 위에서 텍스트용 top 목록이 준비되어 있으면 이를 사용
            const listForCards = (lastTools && lastTools.length > 0) ? lastTools : top;
            if (listForCards && listForCards.length > 0) {
              // 3D 카테고리인데 도구가 부족하면 추가
              let finalTools = [...listForCards];
              if (intentForLabel?.category === '3d' && finalTools.length < 5) {
                const additionalTools = [
                  { id: 'avaturn', name: 'Avaturn', url: 'https://avaturn.me', domain: 'avaturn.me', category: 'productivity', 
                    price: 'freemium', features: [], hasAPI: false,
                    description: '사진 한 장으로 3D 아바타를 생성하는 AI 도구', 
                    imageUrl: 'https://avaturn.me/favicon.ico' },
                  { id: 'creatie', name: 'Creatie', url: 'https://creatie.ai', domain: 'creatie.ai', category: 'productivity',
                    price: 'freemium', features: [], hasAPI: false,
                    description: '텍스트로 3D 모델을 생성하는 AI 도구',
                    imageUrl: 'https://creatie.ai/favicon.ico' },
                  { id: 'a1art', name: 'a1.art', url: 'https://a1.art', domain: 'a1.art', category: 'image',
                    price: 'freemium', features: [], hasAPI: false,
                    description: 'AI 기반 3D 아트 생성 도구',
                    imageUrl: 'https://a1.art/favicon.ico' }
                ] as AITool[];
                
                const existingIds = new Set(finalTools.map(t => t.id));
                for (const tool of additionalTools) {
                  if (!existingIds.has(tool.id) && finalTools.length < 5) {
                    finalTools.push(tool);
                    console.log('[STREAM] Added 3D tool:', tool.name);
                  }
                }
              }
              
              // 도구 정보에 이미지 URL 확실히 포함
              const toolsWithImages = finalTools.map((tool: any) => ({
                ...tool,
                imageUrl: tool.iconUrl || tool.icon_url || tool.imageUrl || (tool.domain ? `https://${tool.domain}/favicon.ico` : '/images/default-tool-icon.svg'),
                iconUrl: tool.iconUrl || tool.icon_url || tool.imageUrl || (tool.domain ? `https://${tool.domain}/favicon.ico` : '/images/default-tool-icon.svg')
              }));
              
              const toolsJson = JSON.stringify(toolsWithImages);
              console.log('[STREAM] Sending tools with images:', toolsWithImages.map((t: any) => ({ name: t.name, iconUrl: t.iconUrl })));
              controller.enqueue(encoder.encode(`\n\n[[TOOLS]]${toolsJson}[[/TOOLS]]\n\n`));
            } else if (toolsMarkerJson) {
              controller.enqueue(encoder.encode(`\n\n[[TOOLS]]${toolsMarkerJson}[[/TOOLS]]\n\n`));
            }
            try { controller.close(); } catch {}
            return;
          } else {
            console.log('[STREAM] No lastTools available, proceeding with model call');
          }
          // 뉴스 응답은 단일 지시문으로 더 강하게 통제
          let finalInputOverride: string | null = null;
          try {
            const qLower2 = String(prompt || '').toLowerCase();
            const isNews2 = /(뉴스|news)/i.test(qLower2);
            if (isNews2) {
              const now = new Date();
              const y = now.getFullYear();
              const m = now.getMonth() + 1;
              const wantsTodayKw = /(오늘|today)/.test(qLower2);
              const wantsYesterdayKw = /(어제|yesterday)/.test(qLower2);
              const wantsThisWeekKw = /(이번주|금주|this\s*week)/.test(qLower2);
              const wantsThisMonthKw = /(이번달|이달|this\s*month)/.test(qLower2);
              const wantsTrend = /(동향|트렌드|전반|overall|어때)/.test(qLower2);
              const scopeNote2 = wantsTodayKw ? '한국시간 오늘자 기사만' : wantsYesterdayKw ? '한국시간 어제 기사 중심' : wantsThisWeekKw ? '이번 주 기사 중심' : wantsThisMonthKw ? '이번 달 기사 중심' : wantsTrend ? `올해 ${y}년 ${m}월 기준 국내 IT 동향(최근 2~4주 기사 중심)` : '최근 24~72시간 기사 중심';
              const notes = lastWebNotes || '';
              finalInputOverride = `웹 검색 메모(최신 기사 요약):\n${notes}\n\n[지시사항]\n- ${scopeNote2} 3~5개의 뉴스를 다음 형식으로 작성하세요.\n- 각 항목은 1~2문장, 과장·사족 금지, 사실만.\n\n1) 제목\n- 주요 내용\n- 핵심 결론 (도메인)\n  링크: https://...\n\n2) 제목\n- 주요 내용\n- 핵심 결론 (도메인)\n  링크: https://...\n\n...\n\n마지막 줄: 출처: 도메인, 도메인, 도메인\n\n엄수: 각 항목마다 실제 기사 URL 1개를 '링크:' 줄에 반드시 포함.`;
            }
          } catch {}
          const promptText = finalInputOverride || messages.map(m=>`[${m.role.toUpperCase()}]\n${m.content}`).join('\n\n');
          // GPT-5 모델 사용 (특별한 responses API)
          let resp: any;
          try {
            // GPT-5는 responses.create 사용
            if (generationModel === 'gpt-5') {
              resp = await (openai as any).responses?.create({
                model: 'gpt-5',
            input: promptText,
            reasoning: { effort: 'minimal' },
            text: { verbosity: 'low' },
                max_output_tokens: 1400
              });
            } else {
              // 다른 모델은 일반 API 사용
              resp = await openai.chat.completions.create({
                model: 'gpt-4o-mini',  // 저렴한 모델
                messages: messages,
                max_tokens: 1400,
                temperature: 0.7
              });
            }
          } catch (apiError) {
            // 폴백: 가장 저렴한 모델
            console.warn('[GEN] Primary model failed, using fallback:', apiError);
            resp = await openai.chat.completions.create({
              model: 'gpt-3.5-turbo-0125',  // 가장 저렴
              messages: messages,
              max_tokens: 1400,
              temperature: 0.7
            });
          }
          // GPT-5와 일반 모델의 응답 형식이 다름
          let full = '';
          if (generationModel === 'gpt-5' && resp?.output_text) {
            full = String(resp.output_text).trim();
          } else {
            full = String(resp?.choices?.[0]?.message?.content || '').trim();
          }
          if (full) {
            emitted = true;
            try {
              const linkLines = full.split(/\n+/).filter(l=>/^\s*링크\s*:/i.test(l));
              const urls = linkLines.map(l=>l.replace(/^.*링크\s*:\s*/i,'').trim());
              const outTag = webUsed ? '[WEB]' : '[GEN]';
              console.log(`${outTag}[OUT_LINKS]`, { traceId, count: urls.length, urls });
              if (!urls.length && (lastWebLinks?.length||0) > 0) {
                console.log(`${outTag}[OUT_LINKS][FALLBACK]`, { traceId, fallbackCount: lastWebLinks.length, samples: lastWebLinks.slice(0,5) });
              }
              const fPreview = full.replace(/\n/g,' ').slice(0,160);
              console.log(`${outTag}[OUT_PREVIEW]`, { traceId, preview: fPreview });

              // 거부/사과 응답이거나 링크가 전혀 없고 템플릿을 쓰지 않는 경우엔 간단 요약으로 유연 대응
              const refused = /(웹을\s*검색|검색할\s*수\s*없|브라우징|접근\s*권한|죄송합니다\.|불가)/i.test(full);
              if (!NEWS_TEMPLATES_ENABLED && (refused || urls.length === 0)) {
                // 템플릿 OFF: 모델이 생성한 첫 문단(프리뷰와 동일한 톤)을 그대로 노출
                full = full.split(/\n{2,}/)[0].trim();
              } else if (NEWS_TEMPLATES_ENABLED && (refused || urls.length === 0)) {
                const memoLines = String(lastWebNotes||'').split(/\n+/).map(s=>s.trim()).filter(Boolean).slice(0,6);
                const domains = (lastWebLinks||[]).map(u=>{ try { return new URL(u).hostname; } catch { return ''; } }).filter(Boolean);
                const items:number = Math.max(3, Math.min(5, Math.min(memoLines.length, (lastWebLinks||[]).length || 3)));
                const rebuilt: string[] = [];
                for (let i=0;i<items;i++) {
                  const title = memoLines[i]?.replace(/^[-•·\*]\s*/,'').slice(0,60) || `핵심 이슈 ${i+1}`;
                  const content = memoLines[i] || '최근 기사 요약';
                  const link = lastWebLinks[i] || '';
                  const dom = (()=>{ try { return new URL(link).hostname; } catch { return (domains[i]||''); } })();
                  rebuilt.push(`${i+1}) ${title}\n- 주요 내용: ${content}\n- 핵심 결론 (${dom||'출처 미상'})\n  링크: ${link || ''}`);
                }
                const tail = `\n출처: ${domains.slice(0,items).join(', ')}`;
                full = rebuilt.join('\n\n') + tail;
                console.log('[WEB][REBUILD_APPLIED]', { traceId, items, withLinks: (lastWebLinks||[]).length });
              }
            } catch {}
            // 헤더/인트로 주입 제거: 단순 질문이나 카드 없는 경우에도 상단 문구가 생기지 않도록 비활성화
            try {
              // 번호 목록이 부족하면 간단 리스트를 합성하여 보강
              const numCount = (full.match(/^\s*\d+\./gm) || []).length;
              const count = Math.min(10, (lastTools?.length || 0));
              if (numCount < count && (lastTools?.length || 0) > 0) {
                const eff = (c:string, i:number)=>{
                  const cc = String(c||'').toLowerCase();
                  const pool = cc.includes('text')||cc.includes('writing')
                    ? ['문서/슬라이드 작성 시간이 줄어듭니다','초안 제작 속도가 빨라집니다']
                    : cc.includes('design')
                    ? ['브랜딩·디자인 작업이 간소화됩니다','시각 요소를 빠르게 완성할 수 있습니다']
                    : cc.includes('workflow')||cc.includes('automation')||cc.includes('integration')
                    ? ['반복 업무가 자동화됩니다','외부 서비스 연동이 쉬워집니다']
                    : cc.includes('video')
                    ? ['영상 제작 속도가 빨라집니다','컷 편집·자막 처리가 수월해집니다']
                    : cc.includes('image')
                    ? ['이미지 생성/편집이 수월해집니다','시각 소재 확보가 쉬워집니다']
                    : ['업무 흐름이 단순화됩니다','시작 장벽이 낮아집니다'];
                  return pool[i % pool.length];
                };
                const synth = (lastTools || []).slice(0, count).map((t:any, i:number)=>{
                  const feats = Array.isArray(t?.features) ? (t.features as any[]).map((x:string)=>String(x)).filter(Boolean) : [];
                  const short = String(t?.description||'').split(/[\.!?\n]/)[0].trim() || feats.slice(0,2).join('·') || '주요 기능을 한 번에 활용할 수 있습니다';
                  return `${i+1}. ${t?.name||''} - ${short} → 효과: ${eff(String(t?.category||''), i)}`;
                }).join('\n');
                full = `${full}\n\n${synth}`.trim();
              }
              // 헤더/인트로 삽입 없음: 단, 목록이 전혀 없으면 부재 문구를 넣지 않고 공백 유지
            } catch {}
            // 라인 단위로 스트리밍 에뮬레이션(UX 일관성 유지)
            const lines = full.split(/\n\n+/);
            for (const chunk of lines) {
              if (!chunk) continue;
              controller.enqueue(encoder.encode(sanitizeDelta(chunk)+'\n\n'));
              await new Promise(r=>setTimeout(r, 10));
            }
          }
          if (process.env.LOG_STREAM === '1') {
            console.log(`[STREAM][${traceId}] responses.create bytes=${full.length}`);
          }
        } catch (e) {
          console.warn('[GEN] responses.create failed, falling back to chat.completions', e instanceof Error ? e.message : String(e));
          try {
            // 스트리밍도 저렴한 모델 사용
            const chat = await openai.chat.completions.create({
              model: 'gpt-4o-mini',  // 스트리밍은 저렴한 모델
            stream: true,
              max_completion_tokens: 1000,
            messages
          });
          let tokenCount = 0;
          let charCount = 0;
          for await (const part of chat) {
            if (Date.now() > deadline) { console.warn('[GEN] timeout reached, stopping stream'); break; }
            const delta = part.choices[0]?.delta?.content;
            if (delta) {
              emitted = true;
              if (process.env.LOG_STREAM === '1') {
                try { const preview = String(delta).replace(/\n/g, '↵').slice(0, 160); console.log(`[STREAM][${traceId}] + ${preview}`); } catch {}
              }
              tokenCount += 1;
              charCount += delta.length;
              controller.enqueue(encoder.encode(sanitizeDelta(delta)));
            }
          }
          if (process.env.LOG_STREAM === '1') {
            console.log(`[STREAM][${traceId}] summary: emitted=${emitted} tokens=${tokenCount} chars=${charCount}`);
            }
          } catch (fallbackError) {
            console.error('[GEN] Fallback also failed:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
            // 최종 폴백: 정적 응답
            const fallbackResponse = `죄송합니다. 현재 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.`;
            controller.enqueue(encoder.encode(fallbackResponse));
            emitted = true;
          }
        }
        // 스트림에서 한 글자도 나오지 않았으면 즉시 폴백 생성
        if (!emitted) {
          try {
            console.warn('[GEN] empty stream, fallback synthesis');
            console.log('[GEN] Debug info - messages:', messages.length, 'tools:', tools?.length || 0);
            let t = '';
            // 뉴스 자동 출력이 준비되어 있으면 최우선 사용
            if (!t && newsAutoOutput) {
              t = newsAutoOutput;
              console.log('[GEN][NEWS_FALLBACK_USED]', { traceId, length: t.length });
            }
            
            // 뉴스 의도인 경우 웹 검색 결과를 기반으로 폴백 생성
            const isNewsIntent = /(뉴스|news)/i.test(String(prompt || ''));
            if (isNewsIntent && lastWebNotes) {
              try {
                const qLower = String(prompt || '').toLowerCase();
                const wantsTodayKw = /(오늘|today)/.test(qLower);
                const wantsYesterdayKw = /(어제|yesterday)/.test(qLower);
                const wantsThisWeekKw = /(이번주|금주|this\s*week)/.test(qLower);
                const wantsThisMonthKw = /(이번달|이달|this\s*month)/.test(qLower);
                const wantsTrend = /(동향|트렌드|전반|overall|어때)/.test(qLower);
                const now = new Date();
                const y = now.getFullYear();
                const m = now.getMonth() + 1;
                const scopeNote = wantsTodayKw ? '한국시간 오늘자 기사만' : wantsYesterdayKw ? '한국시간 어제 기사 중심' : wantsThisWeekKw ? '이번 주 기사 중심' : wantsThisMonthKw ? '이번 달 기사 중심' : wantsTrend ? `올해 ${y}년 ${m}월 기준 국내 IT 동향(최근 2~4주 기사 중심)` : '최근 24~72시간 기사 중심';
                
                const fb: any = await openai.chat.completions.create({
                  model: 'gpt-4o-mini',  // 더 저렴한 모델
                  messages: [{role: 'user', content: `웹 검색 메모: ${lastWebNotes}\n\n위 메모만 근거로 ${scopeNote} 3~5가지 뉴스를 요약하세요.`}],
                  max_tokens: 500,
                  temperature: 0.7
                });
                t = String(fb?.choices?.[0]?.message?.content || '').trim();
                if (process.env.LOG_STREAM === '1') {
                  console.log(`[STREAM][${traceId}] news fallback synthesized preview=`, t.replace(/\n/g,' ' ).slice(0,160));
                }
              } catch {}
            }
            
            // AI 도구 추천 의도인 경우
            if (!t && lastTools && lastTools.length > 0) {
              try {
                const desiredCount = ((): number => {
                  const m = /(\d{1,2})\s*개\b/.exec(String(prompt || ''));
                  return m ? Math.max(1, Math.min(10, Number(m[1]))) : Math.min(10, lastTools.length);
                })();
                const fallbackCount = Math.min(lastTools.length, desiredCount);
                const selectedTools = lastTools.slice(0, fallbackCount);
                
                // 실제 lastTools의 이름으로 직접 번호 목록 생성
                const actualCount = Math.max(tools.length, fallbackCount);
                const header = `${new Date().toLocaleDateString('ko-KR')} 기준, 요청하신 조건에 맞춘 AI 도구 ${actualCount}개 목록입니다.`;
                const lines = selectedTools.map((tool: any, i: number) => {
                  const desc = tool.description ? ` - ${String(tool.description).split(/[\.!?\n]/)[0].trim()}` : '';
                  return `${i + 1}. ${tool.name}${desc}`;
                }).join('\n');
                const textContent = `${header}\n\n${lines}`.trim();
                
                // [[TOOLS]] 마커와 텍스트를 함께 전송
                const toolsMarker = { tools: selectedTools, traceId };
                t = `[[TOOLS]]${JSON.stringify(toolsMarker)}[[/TOOLS]]\n${textContent}`;
                if (process.env.LOG_STREAM === '1') {
                  console.log(`[STREAM][${traceId}] tools fallback synthesized (${fallbackCount}) preview=`, t.replace(/\n/g,' ' ).slice(0,160));
                }
              } catch {}
            }
            
            // 일반 질문인 경우
            if (!t) {
              const fb: any = await openai.chat.completions.create({
                model: 'gpt-4o-mini',  // 더 저렴한 모델
                messages: [{role: 'user', content: `질문: ${String(prompt||'').slice(0,300)}\n간결한 한 단락 요약을 쓰세요.`}],
                max_tokens: 200,
                temperature: 0.7
              });
              t = String(fb?.choices?.[0]?.message?.content || '').trim();
            }
            if (t) controller.enqueue(encoder.encode(t));
          } catch {}
        }
      } catch (e) {
        // 스트리밍 실패 시, 가능한 한 유용한 폴백을 즉시 제공
        try {
          if (lastWebNotes && lastWebNotes.trim().length > 0) {
            // 웹 검색 메모만을 간단히 정리해 단일 응답으로 반환
            const fallback = await openai.chat.completions.create({
              model: 'gpt-4o-mini',  // 더 저렴한 모델
              messages: [{role: 'user', content: `다음 메모만 근거로 오늘의 IT 뉴스 3가지를 한 줄씩 요약하세요.\n메모:\n${lastWebNotes}`}],
              max_tokens: 300,
              temperature: 0.7
            });
            const text = String(fallback?.choices?.[0]?.message?.content || '').trim() || lastWebNotes.slice(0, 1000);
            controller.enqueue(encoder.encode(text));
          } else {
            controller.enqueue(encoder.encode('요청을 처리하는 중 지연이 발생했어요. 잠시 후 다시 시도해 주세요.'));
          }
        } catch {
          controller.enqueue(encoder.encode('요청을 처리하는 중 지연이 발생했어요. 잠시 후 다시 시도해 주세요.'));
        }
      } finally {
        try { controller.close(); } catch {}
      }
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
      , 'X-Route': 'stream'
      , 'X-Web-Decided': decision.web ? '1' : '0'
      , 'X-Web-Used': webUsed ? '1' : '0'
      , 'X-Trace-Id': traceId
    }
  });
}


