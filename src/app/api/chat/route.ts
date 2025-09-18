import { NextRequest, NextResponse } from 'next/server';
import { filterToolsByCategoryExclusions, filterBySynonymSimilarity, filterByFeatureSynonymExact, filterByFeatureMustContain } from '@/lib/tool-filters';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";
import OpenAI from 'openai';
import { type AITool } from '@/lib/notion-client';
import { searchAIToolsUnified, enrichRatingsUnified } from '@/lib/tools-repo';
import { analyzeUserIntent, detectToolSearchIntent, generateStructuredPrompt, detectToolDetailRequest, generateDetailedToolPrompt, inferIntentV2, computeAmbiguity, detectWebsiteBuildIntent, detectWebsiteAssistIntent, detectWorkflowAutomationIntent, generateNameOnlyDetailPrompt, detectBeginnerFriendlyIntent } from '@/lib/intent-analyzer';
import { INTENT_REGISTRY } from '@/config/intents';
import { buildChipsForKey } from '@/lib/chips';
import { moderateInput } from '@/lib/moderation';
import { sanitizeText } from '@/lib/sanitize';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/rate-limiter';
import { DEFAULT_AI_TIERS } from '@/config/aiTiers';
import { sendAlert } from '@/lib/alerts';
import { systemRecommendationPrompt, buildRecommendationUserPrompt, systemDetailPrompt, systemGeneralPrompt, systemDbReasoningPrompt, buildDbReasoningUserPrompt, systemGeneralPromptByStyle } from '@/lib/prompt-templates';
import { getAllServicesCached } from '@/lib/ai-services';

// 도구 평점 가져오기 헬퍼 함수
async function getToolRating(toolName: string): Promise<number | null> {
  try {
    const { services } = await getAllServicesCached(false);
    const service = services.find(s => 
      s.name.toLowerCase() === toolName.toLowerCase() ||
      s.name.toLowerCase().replace(/\s+/g, '') === toolName.toLowerCase().replace(/\s+/g, '')
    );
    const rating = service?.averageRating || null;
    console.log('[DEBUG] getToolRating for', toolName, ':', rating);
    return rating;
  } catch (error) {
    console.error('[ERROR] getToolRating failed:', error);
    return null;
  }
}
import { resolveExperiment } from '@/config/experiments';
import { classifyDialogAct, selectRoutingStrategy } from '@/config/patterns';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI 티어 타입 정의
type AITier = {
  model: string;
  name: string;
  description: string;
  maxTokens: number;
  longFormMaxTokens: number;
  temperature: number;
};
// 별점 연동: AI 목록(서비스 캐시)의 평점을 추천 카드에도 반영
async function enrichRatingsForTools(tools: AITool[]): Promise<AITool[]> {
  try {
    const { services } = await getAllServicesCached(false);
    console.log('[DEBUG] Services loaded:', services.length, 'services');
    
    const normalizeHost = (u?: string): string => {
      if (!u) return '';
      try { const url = new URL(u.startsWith('http') ? u : `https://${u}`); return url.hostname.replace(/^www\./, '').toLowerCase(); } catch { return String(u).replace(/^www\./, '').toLowerCase(); }
    };
    const normalizeName = (s?: string): string => String(s || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9가-힣]/g, '')
      .replace(/^chatgpt$/, 'chatgpt');
    const idToRating = new Map<string, number>();
    const domainToRating = new Map<string, number>();
    const nameToRating = new Map<string, number>();
    
    for (const s of services as any[]) {
      const rating = Number(s.averageRating || 0);
      if (s?.id) idToRating.set(String(s.id), rating);
      if (s?.url) domainToRating.set(normalizeHost(String(s.url)), rating);
      if (s?.name) {
        nameToRating.set(normalizeName(String(s.name)), rating);
        // Chat GPT 특별 처리
        if (s.name.toLowerCase().includes('chatgpt') || s.name.toLowerCase().includes('chat gpt')) {
          nameToRating.set('chatgpt', rating);
          nameToRating.set('chat gpt', rating);
        }
        // VEO3, Synthesis AI 등 특별 처리
        if (s.name.toLowerCase().includes('veo')) {
          nameToRating.set('veo3', rating);
          nameToRating.set('veo', rating);
        }
        if (s.name.toLowerCase().includes('synthesis')) {
          nameToRating.set('synthesisai', rating);
          nameToRating.set('synthesis', rating);
        }
      }
    }
    
    console.log('[DEBUG] Rating maps created:', {
      idCount: idToRating.size,
      domainCount: domainToRating.size,
      nameCount: nameToRating.size,
      sampleNames: Array.from(nameToRating.entries()).slice(0, 5)
    });
    
    const enrichedTools = tools.map((t: any) => {
      const idKey = String(t.serviceId || '');
      const byId = idKey ? idToRating.get(idKey) : undefined;
      const byDomain = domainToRating.get(normalizeHost(t.domain || t.url));
      const byName = nameToRating.get(normalizeName(t.name));
      
      // 기본 평점이 없으면 카테고리별 기본값 제공
      let defaultRating = 0;
      if (!byId && !byDomain && !byName) {
        // 카테고리별 기본 평점 설정
        const category = String(t.category || '').toLowerCase();
        if (category.includes('video')) defaultRating = 4.2;
        else if (category.includes('image')) defaultRating = 4.3;
        else if (category.includes('text')) defaultRating = 4.1;
        else if (category.includes('audio')) defaultRating = 4.0;
        else defaultRating = 3.8;
      }
      
      const rating = (byId ?? byDomain ?? byName ?? t.rating ?? defaultRating);
      
      // 디버깅용 로그 (영상 카테고리 도구만)
      if (t.category && t.category.toLowerCase().includes('video')) {
        console.log('[DEBUG] Video tool rating:', t.name, ':', {
          byId,
          byDomain,
          byName,
          defaultRating,
          final: rating
        });
      }
      
      return { ...t, rating } as AITool;
    });
    
    console.log('[DEBUG] Enriched tools sample:', enrichedTools.slice(0, 3).map(t => ({
      name: t.name,
      category: t.category,
      rating: t.rating
    })));
    
    return enrichedTools;
  } catch (error) {
    console.error('[ERROR] enrichRatingsForTools failed:', error);
    // 에러 시에도 기본 평점 제공
    return tools.map(t => ({
      ...t,
      rating: t.rating ?? 4.0
    }));
  }
}

// AI 모델 티어 정의
const AI_TIERS: Record<string, AITier> = {
  GUEST: {
    model: 'gpt-5-mini',
    name: DEFAULT_AI_TIERS.GUEST.name,
    description: DEFAULT_AI_TIERS.GUEST.description,
    maxTokens: DEFAULT_AI_TIERS.GUEST.maxTokens,
    longFormMaxTokens: DEFAULT_AI_TIERS.GUEST.longFormMaxTokens,
    temperature: DEFAULT_AI_TIERS.GUEST.temperature
  },
  USER: {
    model: 'gpt-5-mini',
    name: DEFAULT_AI_TIERS.USER.name,
    description: DEFAULT_AI_TIERS.USER.description,
    maxTokens: DEFAULT_AI_TIERS.USER.maxTokens,
    longFormMaxTokens: DEFAULT_AI_TIERS.USER.longFormMaxTokens,
    temperature: DEFAULT_AI_TIERS.USER.temperature
  },
  PREMIUM: {
    model: 'gpt-5-mini',
    name: DEFAULT_AI_TIERS.PREMIUM.name,
    description: DEFAULT_AI_TIERS.PREMIUM.description,
    maxTokens: DEFAULT_AI_TIERS.PREMIUM.maxTokens,
    longFormMaxTokens: DEFAULT_AI_TIERS.PREMIUM.longFormMaxTokens,
    temperature: DEFAULT_AI_TIERS.PREMIUM.temperature
  }
};

export async function POST(request: NextRequest) {
  try {
    // trace id
    const traceId = crypto.randomUUID();

    // Rate limit early
    const rateLimitMiddleware = createRateLimitMiddleware(rateLimitConfigs.aiChat);
    const rateLimited = rateLimitMiddleware(request);
    if (rateLimited) {
      return new NextResponse(rateLimited.body, {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-Id': traceId,
          ...Object.fromEntries(rateLimited.headers?.entries() || [])
        }
      });
    }
    const { message, template, toolsOnly, kbMode } = await request.json();
    const dialogAct = classifyDialogAct(String(message || ''));
    let isToolSearch = detectToolSearchIntent(message);
    const strategy = selectRoutingStrategy(dialogAct, { isToolSearch });
    const exp = resolveExperiment(request);

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { traceId, code: 'BAD_REQUEST', message: '메시지가 필요합니다.' },
        { status: 400 }
      );
    }

    // Moderation (fail-open with gentle downgrade)
    const mod = await moderateInput(message);
    if (!mod.allowed) {
      return NextResponse.json(
        { 
          traceId, 
          code: 'CONTENT_BLOCKED', 
          message: '요청하신 내용은 정책에 의해 처리할 수 없습니다. 다른 방식으로 질문해 주세요.' 
        },
        { status: 400 }
      );
    }

    // 세션 확인
    const session = await getServerSession(authOptions);
    
    // 사용자 티어 결정
    let userTier: AITier = AI_TIERS.GUEST;
    let isPremium = false;
    let userId = null;

    if (session?.user?.email) {
      // 로그인한 사용자 - 결제 상태 확인
      const db = await getConnection();
      const userResult = await db.request()
        .input('email', session.user.email)
        .query(`
          SELECT u.id, p.plan_type
          FROM users u
          LEFT JOIN (
            SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
            FROM payments 
            WHERE status = 'completed'
          ) p ON u.id = p.user_id AND p.rn = 1
          WHERE u.email = @email
        `);

      if (userResult.recordset.length > 0) {
        const user = userResult.recordset[0];
        userId = user.id;
        // 최근 결제 내역이 있으면 프리미엄
        isPremium = !!user.plan_type;
        userTier = isPremium ? AI_TIERS.PREMIUM : AI_TIERS.USER;
      }
    }

    // 간단한 서킷 브레이커 상태 (메모리 기반)
    const breaker = getBreakerState();
    if (breaker.open) {
      // 열림 상태면 비용이 낮은 모델로 강제 다운스케일
      userTier = AI_TIERS.GUEST;
    }

    // AI 툴 검색/상세 의도 감지
    // 스트리밍 후 카드만 요청하는 경우, 의도 감지가 약해도 강제로 추천 경로 사용
    if (!isToolSearch && toolsOnly) {
      isToolSearch = true;
    }
    const detailDetect = detectToolDetailRequest(message.toLowerCase());
    let recommendedTools: AITool[] = [];
    
    // 명령형(해줘/만들어줘 등) 요청 감지: 질문이 아니고 '추천/알려/소개'가 없으면 실행 대신 안내
    const imperative = /해줘|만들어줘|작성해줘|생성해줘|제작해줘|요약해줘|번역해줘|써줘|정리해줘/.test(message) 
      && !/[?？]$/.test(message) 
      && !/(추천|알려|소개)/.test(message);
    if (imperative) {
      const msgLower = message.toLowerCase();
      const internal: { pattern: RegExp; path: string; label: string }[] = [
        { pattern: /(ppt|슬라이드|발표자료|프레젠)/i, path: '/ppt-create', label: 'PPT 생성기' },
        { pattern: /(요약|정리)/i, path: '/productivity/ai-summary', label: '문서 요약' },
        { pattern: /(이메일|메일)/i, path: '/productivity/email-assistant', label: '이메일 도우미' },
        { pattern: /(보고서|리포트|기획안|문서 작성)/i, path: '/productivity/report-writers', label: '문서/보고서 작성' },
        { pattern: /(코드).*생성|스크립트.*만들/i, path: '/code-generate', label: '코드 생성' },
        { pattern: /(코드).*리뷰|검토/i, path: '/productivity/code-review', label: '코드 리뷰' },
        { pattern: /(인터뷰|면접)/i, path: '/productivity/interview-prep', label: '면접 준비' },
        { pattern: /(강의.?노트|노트 정리)/i, path: '/productivity/lecture-notes', label: '강의 노트' },
        { pattern: /(발표.*스크립트|대본)/i, path: '/productivity/presentation-script', label: '발표 스크립트' }
      ];
      const hit = internal.find(it => it.pattern.test(msgLower));
      if (hit) {
        let ask = `${hit.label}에서 더 빠르고 안전하게 진행할 수 있어요. 아래 버튼으로 이동해 주세요.`;
        const pref = buildNicknamePrefix(session);
        if (pref) ask = `${pref}${ask}`;
        return NextResponse.json({
          response: sanitizeText(ask),
          slotPrompt: {
            intent: 'navigate',
            message: ask,
            options: [
              { label: `${hit.label}로 이동`, send: `__NAV__${hit.path}` }
            ]
          },
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      } else {
        // 내부 도구 매칭이 없으면 관련 AI 툴 소개 모드로 전환
        isToolSearch = true;
      }
    }
    const high = inferIntentV2(message);
    const ambiguity = computeAmbiguity(message);

    const sanitizeResponse = (text: string, allowed: string[]): string => {
      try {
        const lines = text.split(/\r?\n/);
        const allowedLower = allowed.map(n => n.toLowerCase());
        // 1) 번호 목록 기반 섹션 필터링
        const sections: string[][] = [];
        let current: string[] = [];
        const isNumbered = (s: string) => /^\s*\d+\./.test(s);
        for (const ln of lines) {
          if (isNumbered(ln)) {
            if (current.length > 0) sections.push(current);
            current = [ln];
          } else {
            current.push(ln);
          }
        }
        if (current.length > 0) sections.push(current);

        let keep: string[] = [];
        if (sections.length > 1) {
          const filtered = sections.filter(sec => allowedLower.some(name => (sec[0] || '').toLowerCase().includes(name)));
          if (filtered.length > 0) keep = filtered.flat();
        }

        // 2) 하이픈/불릿 항목 정리: 허용되지 않은 도구명을 포함한 불릿만 유지
        if (keep.length === 0) {
          const out: string[] = [];
          for (const ln of lines) {
            const trimmed = ln.trimStart();
            const isBullet = /^[-•\u2013\u2014]/.test(trimmed); // -, •, –, —
            if (!isBullet) { out.push(ln); continue; }
            const lower = trimmed.toLowerCase();
            const hasAllowed = allowedLower.some(name => lower.includes(name));
            if (hasAllowed) out.push(ln);
          }
          keep = out;
        }

        const joined = (keep.length > 0 ? keep.join('\n') : text);
        // 어색한 직함 호칭 정리("마케터님은" → 문장형)
        return joined.replace(/마케터님은\s*/g, '');
      } catch {
        return text;
      }
    };

    // 번호 목록 개수를 사용자 요청 개수에 맞춰 강제로 잘라내는 후처리
    const enforceExactNumberedSections = (text: string, count: number | null | undefined): string => {
      try {
        const n = typeof count === 'number' && count > 0 ? Math.floor(count) : 0;
        if (!n) return text;
        const lines = String(text || '').split(/\r?\n/);
        const out: string[] = [];
        let sections = 0;
        let enumerationStarted = false;
        for (const ln of lines) {
          const isNumbered = /^\s*\d+\./.test(ln);
          if (isNumbered) {
            sections += 1;
            enumerationStarted = true;
            if (sections > n) break; // 이후 섹션 및 결론/기타 제거
          }
          // 번호 목록 시작 이후의 '기타/추가/참고' 문구는 제거
          if (enumerationStarted && /^\s*(기타|추가|참고)/.test(ln)) continue;
          out.push(ln);
        }
        return out.join('\n');
      } catch {
        return text;
      }
    };

    // 각 번호 섹션을 최대 N줄로 압축
    const compactNumberedSections = (text: string, maxBodyLines: number): string => {
      try {
        const lines = String(text || '').split(/\r?\n/);
        const out: string[] = [];
        let i = 0;
        let seenNumbered = false;
        while (i < lines.length) {
          const ln = lines[i];
          const isHeader = /^\s*\d+\./.test(ln);
          if (!seenNumbered && !isHeader) {
            out.push(ln); // 리드/도입 유지
            i += 1;
            continue;
          }
          if (isHeader) {
            seenNumbered = true;
            out.push(ln);
            i += 1;
            // 본문 최대 N줄만 유지 (빈 줄/기타/참고 제거)
            let kept = 0;
            while (i < lines.length && !/^\s*\d+\./.test(lines[i])) {
              const cur = lines[i];
              if (/^\s*(기타|추가|참고)/.test(cur)) { i += 1; continue; }
              if (cur.trim().length === 0) { i += 1; continue; }
              if (kept < Math.max(0, maxBodyLines)) {
                out.push(cur);
                kept += 1;
              }
              i += 1;
            }
            continue;
          }
          // 번호 시작 후 번호가 아닌 긴 본문은 스킵
          if (seenNumbered) { i += 1; continue; }
        }
        return out.join('\n');
      } catch {
        return text;
      }
    };

    // 추천 응답 템플릿을 유연하게 선택하기 위한 헬퍼
    const chooseVariant = (msg: string, countHint: number): 'classic' | 'compare' | 'pros_cons' | 'checklist' | 'quickstart' | 'summary' | 'guide_plus' => {
      const q = String(msg || '').toLowerCase();
      const asksCompare = /(비교|차이|대안|vs|versus)/.test(q);
      const asksProsCons = /(장단점|장점|단점|pros|cons)/.test(q);
      const asksChecklist = /(체크리스트|조건|기준|고려|checklist)/.test(q);
      const asksQuickstart = /(바로\s*시작|빠르게\s*시작|how\s*to|시작\s*방법|가이드|온보딩|튜토리얼|quick\s*start)/.test(q);
      const asksSummary = /(요약|한줄|간단히)/.test(q);
      
      // 일반적인 추천 요청은 classic 템플릿 사용
      const isSimpleRecommend = /(추천|소개|알려|찾아|ai\s*툴|도구)/.test(q) && 
                                !asksCompare && !asksProsCons && !asksChecklist && !asksQuickstart && !asksSummary;
      
      if (isSimpleRecommend) return 'classic';
      if (asksCompare && countHint > 1) return 'compare';
      if (asksProsCons && countHint > 1) return 'pros_cons';
      if (asksChecklist && countHint > 1) return 'checklist';
      if (asksQuickstart) return 'quickstart';
      if (asksSummary) return 'summary';
      return 'classic'; // 기본값을 guide_plus에서 classic으로 변경
    };

    // 모델 출력 앞에 의도 기반 리드 문구를 붙이는 헬퍼
    const prependLeadIfMissing = (text: string, lead: string): string => {
      try {
        const t = String(text || '');
        if (!t.trim()) return lead;
        const first = t.trimStart();
        // 이미 가이드/요약/번호 목록으로 시작하면 유지
        if (/^(바로 도움이 되는 가이드|요약|먼저|1\)|①)/.test(first)) return t;
        return `${lead}\n\n${t}`;
      } catch {
        return text;
      }
    };

    // "이름만 나열" 의도 감지 (예: 나열, 리스트, 이름만, 목록, bullet 등)
    const detectListOnly = (msg: string): boolean => {
      const q = String(msg || '').toLowerCase();
      return /(나열|리스트|이름만|목록|list\s*only|names\s*only|bullet|불릿)/.test(q);
    };
    const listOnly = detectListOnly(message);
    // 노션 DB 기반만 사용(합성/큐레이션 금지) 요청 감지
    const detectNotionOnly = (msg: string): boolean => {
      const q = String(msg || '').toLowerCase();
      return /(노션|notion).*(기반|데이터|db|디비|있는)|\bnotion\s*only\b/.test(q);
    };
    const notionOnly = detectNotionOnly(message);
    const buildNameListResponse = (tools: AITool[]): string => {
      const names = (tools || []).map(t => `- ${t.name}`).join('\n');
      return names || '- (결과 없음)';
    };
    const buildMinimalIntro = (tools: AITool[], lead: string): string => {
      const lines: string[] = [];
      if (lead && lead.trim()) lines.push(lead.trim());
      const picks = (tools || []).slice(0, 3);
      for (const t of picks) {
        const oneline = String(t.description || '').split(/[\.!\n]/)[0].trim();
        lines.push(`${t.name} — ${oneline || '주요 용도 중심으로 활용되는 도구입니다.'}`);
      }
      return lines.join('\n\n');
    };
    // 운동/헬스/PT 의도 간단 감지
    const detectFitnessCoachIntent = (msg: string): boolean => {
      const q = String(msg || '').toLowerCase();
      return /(운동|헬스|피트니스|pt|트레이너|트레이닝|코칭|코치|다이어트|칼로리|체지방|웨이트|유산소)/.test(q);
    };
    
    // 1) 사용자가 특정 툴을 "자세히" 요청한 경우: 도구 상세 응답 경로 (카테고리 언급 없어도 처리)
    console.log('[DEBUG] Detail detection:', detailDetect, 'for message:', message);
    if (detailDetect.isDetail) {
      const q = (detailDetect.toolQuery || '').trim() || message.trim();
      // 노션에서 이름 포함 검색 → 없으면 전체 불러와 이름 유사 매칭
      let candidates = await searchAIToolsUnified({ searchQuery: q });
      if (!candidates || candidates.length === 0) {
        const all = await searchAIToolsUnified({});
        const qLower = q.toLowerCase();
        candidates = all.filter(t => t.name.toLowerCase().includes(qLower));
        if (candidates.length === 0) {
          const exact = all.find(t => t.name.toLowerCase() === qLower);
          if (exact) candidates = [exact];
        }
      }
      const pick = candidates && candidates.length > 0 ? candidates[0] : null;
      if (!pick) {
        // 이름만으로 상세 템플릿 생성 (보수적 표현)
        const longMax = getLongFormMaxTokens(userTier);
        const modelForCost = userTier.model;
        const completion = await openai.chat.completions.create({
          model: modelForCost as any,
          messages: [
            { role: 'system', content: systemDetailPrompt() },
            { role: 'user', content: generateNameOnlyDetailPrompt(q) }
          ],
          max_completion_tokens: longMax,
          
        });
        recordSuccess();
        let response = completion.choices[0].message.content || '';
        if (session) response = prependPersonalizedLead(response, session, '도구 상세 정보'); else response = addLoginPromptMessage(response);
        return NextResponse.json({
          response: sanitizeText(response),
          tools: [],
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session
        });
      }
      const detailedPrompt = generateDetailedToolPrompt(pick);
      // 코스트/지연 단축: 상세 템플릿은 토큰 상한 축소
      const longMax = Math.max(600, Math.floor(getLongFormMaxTokens(userTier) * 0.6));
      const modelForCost = userTier.model;
      
      let response = '';
      try {
        const completionParams: any = {
          model: modelForCost as any,
          messages: [
            { role: 'system', content: systemDetailPrompt() },
            { role: 'user', content: detailedPrompt }
          ],
          max_completion_tokens: longMax
        };
        
        // temperature는 에러가 자주 발생하므로 제거
        
        const completion = await openai.chat.completions.create(completionParams);
        recordSuccess();
        response = completion.choices[0].message.content || '';
      } catch (error: any) {
        console.error('[ERROR] OpenAI API call failed:', error);
        // 에러 발생 시 도구 이름에 맞는 기본 응답 생성 (4개 섹션 형식)
        const toolName = pick.name || 'AI 도구';
        const category = pick.category || 'AI';
        const price = pick.price || '정보 없음';
        const description = pick.description || '상세 정보를 확인 중입니다.';
        
        response = `1) 기본정보\n`;
        response += `${toolName}는 ${category} 카테고리의 도구입니다. `;
        response += `${description} `;
        response += `가격은 ${price}입니다.\n\n`;
        
        response += `2) 주요 기능\n`;
        if (pick.features && pick.features.length > 0) {
          pick.features.slice(0, 5).forEach((f: string) => {
            response += `${f}을(를) 지원합니다. `;
          });
        } else {
          response += `다양한 AI 기능을 제공합니다. 텍스트 처리, 분석, 생성 등의 작업을 수행할 수 있습니다.`;
        }
        response += `\n\n`;
        
        response += `3) 활용방법\n`;
        response += `웹 브라우저를 통해 접속하여 사용할 수 있습니다. `;
        response += `회원가입 후 무료 또는 유료 플랜을 선택하여 이용 가능합니다. `;
        response += `다양한 템플릿과 예시를 활용하면 더욱 효과적입니다.\n\n`;
        
        response += `4) API 여부\n`;
        const hasApi = typeof (pick as any).hasAPI === 'boolean'
          ? (pick as any).hasAPI
          : ((pick as any).api === '있음' || (pick as any).api === true || (pick as any).api === 'true');
        if (hasApi) {
          response += `API가 제공되어 개발자가 직접 통합하여 사용할 수 있습니다.`;
        } else {
          response += `현재 API 제공 여부는 확인이 필요합니다.`;
        }
      }
      // 로그인 안내 메시지만 추가
      if (!session) {
        response = addLoginPromptMessage(response);
      }
      // 출력 모더레이션(상세 경로)
      try {
        const modOut = await moderateInput(response);
        if (!modOut.allowed) {
          response = '생성된 응답 중 일부가 정책에 부합하지 않아 표시되지 않았습니다. 질문을 조금 바꿔 다시 시도해 주세요.';
        }
      } catch {}
      console.log('[DEBUG] Returning single tool detail for:', pick.name);
      console.log('[DEBUG] Response content preview:', response.substring(0, 200));
      
      // 단일 도구 정보도 함께 전달하여 링크카드 표시
      const toolWithRating = {
        ...pick,
        rating: await getToolRating(pick.name)
      };
      
      return NextResponse.json({
        response: sanitizeText(response),
        tools: [toolWithRating], // 단일 도구를 배열로 전달하여 카드 표시
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId
      });
    }
    
    // 웹페이지 제작 전용 분기: 사용자가 "웹페이지를 만들고 싶다"고 말하면, 반드시 웹사이트 제작 특화 툴만 추천
    if (detectWebsiteBuildIntent(message)) {
      const base = await searchAIToolsUnified({});
      const pageTools = base.filter(t => {
        const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
        return /웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트|no[- ]?code|website|webflow|framer|wordpress|wix|bubble|weweb|webstudio/.test(hay);
      });
      const reqCount = analyzeUserIntent(message).count;
      const rotateKey2 = 'web_build';
      const top = pickRotated(pageTools, reqCount ? Math.min(10, Math.max(1, reqCount)) : 5, rotateKey2);
      if (top.length === 0) {
        return NextResponse.json({
          response: '죄송합니다. 검색된 내용이 존재하지 않습니다.',
          tools: [],
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      // 질문이 "도움이 될만한"지 여부에 관계없이, 제작 특화로 좁혀 카드만 반환하거나 설명을 생성
      if (toolsOnly) {
        const enriched = await enrichRatingsUnified(top as any);
        return NextResponse.json({
          response: '',
          tools: enriched,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      const variantWeb = chooseVariant(message, top.length);
      const completion = await openai.chat.completions.create({
        model: userTier.model as any,
        messages: [
          { role: 'system', content: systemRecommendationPrompt(top.length, variantWeb) },
          { role: 'user', content: buildRecommendationUserPrompt(message, top, top.length, variantWeb) }
        ],
        max_completion_tokens: getLongFormMaxTokens(userTier),
        
      });
      recordSuccess();
      if (listOnly) {
        const text = buildNameListResponse(top);
        return NextResponse.json({
          response: text,
          tools: await enrichRatingsUnified(top as any),
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }
      let response = completion.choices[0].message.content || '';
      const leadWeb = '웹 앱/웹페이지 제작에 맞는 도구를 소개합니다. 각 도구의 용도를 확인하고 바로 사용해 보세요.';
      response = prependLeadIfMissing(response, leadWeb);
      if (session) response = prependPersonalizedLead(response, session, toKoCategoryLabel('code')); else response = addLoginPromptMessage(response);
      const smallResult = top.length > 0 && top.length < 3;
      return NextResponse.json({
        response: sanitizeText(response),
        tools: await enrichRatingsForTools(top),
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId,
        ...(smallResult ? {
          slotPrompt: {
            intent: 'tool_search',
            message: '조건을 조금 완화하면 더 많은 결과를 볼 수 있어요.',
            options: [
              { label: '웹페이지에 도움이 되는 도구', send: '웹페이지 제작에 도움이 되는 ai툴 추천해줘' },
              { label: '랜딩페이지 빌더', send: '랜딩페이지 빌더 ai툴 추천해줘' },
              { label: 'AI 목록으로 이동', send: '__NAV__/ai-list' }
            ]
          }
        } : {})
      });
    }

    // "웹페이지에 도움이 될만한 ai툴이 있어?" 같은 보조 의도: 제작을 직접 대체/자동화하거나 제작 과정에 유용한 툴을 소개
    if (detectWebsiteAssistIntent(message)) {
      const base = await searchAIToolsUnified({});
      const pageHelpful = base.filter(t => {
        const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
        // 빌더 + 지원형(카피/디자인/이미지/아이콘/컴포넌트) 모두 포함
        return /웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트|no[- ]?code|website|webflow|framer|wordpress|wix|bubble|weweb|webstudio|tailwind|ui\s*kit|컴포넌트|component|카피|카피라이팅|copy|hero\s*section|lottie|아이콘|icon|일러스트|illustration/.test(hay);
      });
      const reqCount2 = analyzeUserIntent(message).count;
      const count = reqCount2 ? Math.min(10, Math.max(1, reqCount2)) : 5;
      const rotateKey = 'web_assist';
      const top = pickRotated(pageHelpful, count, rotateKey);
      if (top.length === 0) {
        return NextResponse.json({
          response: '죄송합니다. 검색된 내용이 존재하지 않습니다.',
          tools: [],
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      if (toolsOnly) {
        const enriched = await enrichRatingsUnified(top as any);
        return NextResponse.json({
          response: '',
          tools: enriched,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      const variantAssist = chooseVariant(message, top.length);
      const completion = await openai.chat.completions.create({
        model: userTier.model as any,
        messages: [
          { role: 'system', content: systemRecommendationPrompt(top.length, variantAssist) },
          { role: 'user', content: buildRecommendationUserPrompt('웹페이지 제작에 유용한 AI 도구를 소개해 주세요.', top, top.length, variantAssist) }
        ],
        max_completion_tokens: getLongFormMaxTokens(userTier),
        
      });
      recordSuccess();
      if (listOnly) {
        const text = buildNameListResponse(top);
        return NextResponse.json({
          response: text,
          tools: await enrichRatingsUnified(top as any),
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }
      let response = completion.choices[0].message.content || '';
      const leadAssist = '웹페이지 제작에 도움이 되는 도구를 소개합니다. 필요에 맞게 선택해 활용해 보세요.';
      response = prependLeadIfMissing(response, leadAssist);
      if (session) response = prependPersonalizedLead(response, session, '웹페이지 제작에 도움이 되는 AI'); else response = addLoginPromptMessage(response);
      return NextResponse.json({
        response: sanitizeText(response),
        tools: await enrichRatingsUnified(top as any),
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId
      });
    }

    // 워크플로우 자동화 전용 분기: n8n/Make/Zapier/Pipedream/IFTTT/Workato 등만 엄격 추천
    if (detectWorkflowAutomationIntent(message)) {
      const all = await searchAIToolsUnified({});
      // 자동화 신호 키워드(너무 광범위한 'api'는 제외하여 오탐을 줄임)
      const autoKeys = ['automation','automate','workflow','integration','integrations','zapier','make','integromat','n8n','pipedream','ifttt','workato','webhook'];
      let filtered = all.filter(t => {
        const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
        return autoKeys.some(k => hay.includes(k));
      });
      // 사용자가 특정 이름을 명시(n8n, make 등)하면 해당 도구를 최우선으로 포함
      const nameHints = ['n8n','make','zapier','pipedream','ifttt','workato'];
      const msgLower = message.toLowerCase();
      const wanted = nameHints.filter(n => msgLower.includes(n));
      if (wanted.length > 0) {
        const byName = all.filter(t => wanted.some(w => (t.name || '').toLowerCase().includes(w)));
        const idSet = new Set(filtered.map(t => t.id));
        let prepend = byName.filter(t => !idSet.has(t.id));
        // DB에 없을 경우를 대비해 합성 카드 주입
        const knownMap: Record<string, any> = {
          'n8n': { id: 'synthetic:n8n', name: 'n8n', url: 'https://n8n.io', category: 'productivity', price: 'free', features: ['automation','workflow','integration'], hasAPI: true, description: '오픈소스 워크플로우 자동화 도구. 노코드/로우코드로 다양한 서비스 연동과 백엔드 자동화를 구현할 수 있습니다.' },
          'make': { id: 'synthetic:make', name: 'Make', url: 'https://www.make.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: 'Make(구 Integromat). 드래그 앤 드롭으로 워크플로우를 설계하고 수백 개의 앱을 연동할 수 있는 자동화 플랫폼입니다.' },
          'zapier': { id: 'synthetic:zapier', name: 'Zapier', url: 'https://zapier.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: '업계 표준 자동화 플랫폼. 수천 개의 앱을 연결하여 다양한 업무를 자동화할 수 있습니다.' },
          'pipedream': { id: 'synthetic:pipedream', name: 'Pipedream', url: 'https://pipedream.com', category: 'productivity', price: 'freemium', features: ['automation','serverless','integration'], hasAPI: true, description: '서버리스 자동화/통합 플랫폼. 코드와 노코드를 혼합해 강력한 워크플로우를 만들 수 있습니다.' },
          'ifttt': { id: 'synthetic:ifttt', name: 'IFTTT', url: 'https://ifttt.com', category: 'productivity', price: 'freemium', features: ['automation','integration'], hasAPI: true, description: '개인·소규모 자동화에 적합한 간편 통합 서비스.' },
          'workato': { id: 'synthetic:workato', name: 'Workato', url: 'https://www.workato.com', category: 'productivity', price: 'paid', features: ['automation','enterprise','integration'], hasAPI: true, description: '엔터프라이즈급 자동화/통합 플랫폼.' }
        };
        for (const w of wanted) {
          const exists = filtered.some(t => (t.name || '').toLowerCase().includes(w));
          if (!exists) {
            const tool = knownMap[w];
            if (tool) prepend.unshift(tool);
          }
        }
        if (prepend.length > 0) {
          filtered = [...prepend, ...filtered];
        }
      }
      // 핵심 자동화 툴 세트 우선 추천(필터 결과에 없으면 앞에 추가)
      const baseSet = ['n8n','make'];
      if (true) {
        const knownMap: Record<string, any> = {
          'n8n': { id: 'synthetic:n8n', name: 'n8n', url: 'https://n8n.io', category: 'productivity', price: 'free', features: ['automation','workflow','integration'], hasAPI: true, description: '오픈소스 워크플로우 자동화 도구.' },
          'make': { id: 'synthetic:make', name: 'Make', url: 'https://www.make.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: 'Make(구 Integromat) 자동화 플랫폼.' },
          'zapier': { id: 'synthetic:zapier', name: 'Zapier', url: 'https://zapier.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: '대중적인 업무 자동화 플랫폼.' },
          'pipedream': { id: 'synthetic:pipedream', name: 'Pipedream', url: 'https://pipedream.com', category: 'productivity', price: 'freemium', features: ['automation','serverless','integration'], hasAPI: true, description: '서버리스 기반 자동화/통합.' },
          'ifttt': { id: 'synthetic:ifttt', name: 'IFTTT', url: 'https://ifttt.com', category: 'productivity', price: 'freemium', features: ['automation','integration'], hasAPI: true, description: '간단한 개인 자동화.' }
        };
        const nameLowerSet = new Set(filtered.map(t => (t.name || '').toLowerCase()));
        const corePrepend = baseSet
          .filter(k => !nameLowerSet.has(k))
          .map(k => knownMap[k]);
        if (corePrepend.length > 0) {
          filtered = [...corePrepend, ...filtered];
        }
      }
      // 필터 결과가 여전히 비어 있으면 기본 세트를 사용
      if (!filtered || filtered.length === 0) {
        const baseDefault = ['n8n','make','zapier','pipedream','ifttt'];
        const defMap: Record<string, any> = {
          'n8n': { id: 'synthetic:n8n', name: 'n8n', url: 'https://n8n.io', category: 'productivity', price: 'free', features: ['automation','workflow','integration'], hasAPI: true, description: '오픈소스 워크플로우 자동화 도구.' },
          'make': { id: 'synthetic:make', name: 'Make', url: 'https://www.make.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: 'Make(구 Integromat) 자동화 플랫폼.' },
          'zapier': { id: 'synthetic:zapier', name: 'Zapier', url: 'https://zapier.com', category: 'productivity', price: 'freemium', features: ['automation','workflow','integration'], hasAPI: true, description: '대중적인 업무 자동화 플랫폼.' },
          'pipedream': { id: 'synthetic:pipedream', name: 'Pipedream', url: 'https://pipedream.com', category: 'productivity', price: 'freemium', features: ['automation','serverless','integration'], hasAPI: true, description: '서버리스 기반 자동화/통합.' },
          'ifttt': { id: 'synthetic:ifttt', name: 'IFTTT', url: 'https://ifttt.com', category: 'productivity', price: 'freemium', features: ['automation','integration'], hasAPI: true, description: '간단한 개인 자동화.' }
        };
        filtered = baseDefault.map(k => defMap[k]);
      }
      const reqAuto = analyzeUserIntent(message).count;
      const count = reqAuto ? Math.min(10, Math.max(1, reqAuto)) : 5;
      const top = filtered.slice(0, count);
      if (toolsOnly) {
        const enriched = await enrichRatingsUnified(top as any);
        return NextResponse.json({
          response: enriched.length === 0 ? '죄송합니다. 검색된 내용이 존재하지 않습니다.' : '',
          tools: enriched,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      const variantAuto = chooseVariant(message, top.length);
      const completion = await openai.chat.completions.create({
        model: userTier.model as any,
        messages: [
          { role: 'system', content: systemRecommendationPrompt(top.length, variantAuto) },
          { role: 'user', content: buildRecommendationUserPrompt('자동화 워크플로우에 특화된 도구를 소개해 주세요.', top, top.length, variantAuto) }
        ],
        max_completion_tokens: getLongFormMaxTokens(userTier),
        
      });
      recordSuccess();
      if (listOnly) {
        const text = buildNameListResponse(top);
        return NextResponse.json({
          response: text,
          tools: await enrichRatingsUnified(top as any),
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }
      let response = completion.choices[0].message.content || '';
      const leadAuto = '자동화 워크플로우에 특화된 도구를 소개합니다. 반복 업무를 연결·자동화해 생산성을 높여 보세요.';
      response = prependLeadIfMissing(response, leadAuto);
      if (session) response = prependPersonalizedLead(response, session, toKoCategoryLabel('workflow')); else response = addLoginPromptMessage(response);
      return NextResponse.json({
        response: sanitizeText(response),
        tools: await enrichRatingsForTools(top),
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId
      });
    }

    // 초보자 친화: 쉬운 AI만 우선 추천 (로그인/결제 없이 바로 사용, 한글 UI 등 키워드 기반)
    if (detectBeginnerFriendlyIntent(message)) {
      const all = await searchAIToolsUnified({});
      const easyKeys = ['free','trial','부분무료','무료','no sign','로그인 없이','쉽게','쉬운','초보','one click','template','preset','템플릿','한글','korean','ko'];
      const isEasy = (t: AITool): boolean => {
        const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
        return easyKeys.some(k => hay.includes(k.toLowerCase()));
      };
      const candidates = all.filter(isEasy);
      const reqBeg = analyzeUserIntent(message).count;
      const count = reqBeg ? Math.min(10, Math.max(1, reqBeg)) : 5;
      const top = candidates.slice(0, count);
      if (toolsOnly) {
        const enriched = await enrichRatingsUnified(top as any);
        return NextResponse.json({
          response: enriched.length === 0 ? '죄송합니다. 검색된 내용이 존재하지 않습니다.' : '',
          tools: enriched,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId
        });
      }
      const completion = await openai.chat.completions.create({
        model: userTier.model as any,
        messages: [
          { role: 'system', content: systemRecommendationPrompt(top.length, 'guide_plus') },
          { role: 'user', content: buildRecommendationUserPrompt('초보자도 바로 시작하기 쉬운 AI를 소개해 주세요.', top, top.length, 'guide_plus') }
        ],
        max_completion_tokens: getLongFormMaxTokens(userTier),
        
      });
      recordSuccess();
      let response = completion.choices[0].message.content || '';
      if (session) response = prependPersonalizedLead(response, session, '초보자 친화 AI'); else response = addLoginPromptMessage(response);
      return NextResponse.json({
        response: sanitizeText(response),
        tools: await enrichRatingsForTools(top),
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId
      });
    }

    if (isToolSearch || kbMode === 'db') {
      // 의도 분석
      const intent = analyzeUserIntent(message);
      console.log('[DEBUG] Intent analysis:', intent, 'for message:', message);
      const fitnessAsk = detectFitnessCoachIntent(message);
      
      // 단순 QnA/인사/정보성 질문이어도 텍스트 응답은 생성하고 카드만 비울 수 있도록, 여기서는 차단하지 않음

      // 노션/DB 검색 (일부 카테고리는 전용 분기 처리).
      // avatar는 노션 DB에 'Ai Avata'로 저장되어 있지만 카테고리 필터가 제대로 안 됨
      const knownCategories = ['image','text','video','audio','code','design','ppt'];
      const isKnownCategory = intent.category ? knownCategories.includes(intent.category) : false;
      const workflowSynonyms = ['workflow','업무','업무관리','프로젝트','project','칸반','kanban','todo','생산성','productivity','자동화','연동','통합','integration','api','webhook','zapier','make','integromat','n8n','pipedream','ifttt','workato'];
      const avatarSynonyms = ['AI 아바타', 'AI Avata', 'avatar','아바타','버추얼','버츄얼','virtual','디지털휴먼','digital human','vtuber','v-tuber','가상캐릭터','virtual human'];
      const categorySearch = intent.category === 'workflow'
        ? workflowSynonyms.join(' ')
        : intent.category === 'avatar'
        ? avatarSynonyms.join(' ')
        : (intent.category || '');
      // avatar는 노션 DB에 'ai avatar'로 저장되어 있으므로 카테고리 필터 사용
      console.log('[DEBUG] Avatar search intent:', { 
        category: intent.category, 
        isKnownCategory, 
        categorySearch: categorySearch.slice(0, 100) 
      });
      
      // avatar는 노션 DB에 'Ai Avata'로 저장되어 있음
      // 코드 카테고리도 노션 DB에서 제대로 검색되지 않을 수 있음
      let tools: AITool[] = [];
      
      // 사용자 요청 개수 반영. 기본은 5개, 최대 10개 - 미리 선언
      const targetCount = Math.min(Math.max(intent.count ?? 5, 1), 10);
      
      if (intent.category === 'avatar') {
        // 아바타 카테고리는 전체 검색 후 필터링
        const allTools = await searchAIToolsUnified({});
        tools = allTools.filter(tool => {
          const cat = (tool.category || '').toLowerCase();
          return cat.includes('avata') || cat.includes('아바타');
        });
        console.log('[DEBUG] Avatar filtered tools:', tools.length);
      } else if (intent.category === 'code') {
        // 먼저 카테고리 필터로 시도
        console.log('[DEBUG] Searching for code category tools...');
        tools = await searchAIToolsUnified({
          category: 'code',
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined
        });
        console.log('[DEBUG] Code category search result:', tools.length, 'tools');
        
        // 결과가 없으면 전체 검색 후 필터링
        if (tools.length === 0) {
          console.log('[DEBUG] Code category empty, searching all tools and filtering...');
          const allTools = await searchAIToolsUnified({});
          console.log('[DEBUG] Total tools available:', allTools.length);
          
          tools = allTools.filter(tool => {
            const cat = (tool.category || '').toLowerCase();
            const name = (tool.name || '').toLowerCase();
            const desc = (tool.description || '').toLowerCase();
            const features = (tool.features || []).join(' ').toLowerCase();
            
            // 카테고리가 code/coding이거나 이름/설명에 코딩 관련 키워드가 있는 경우
            const isCode = cat.includes('code') || cat.includes('coding') || cat.includes('코드') || cat.includes('개발') ||
                   name.includes('code') || name.includes('copilot') || name.includes('cursor') || name.includes('github') || name.includes('tabnine') ||
                   desc.includes('코드') || desc.includes('개발') || desc.includes('프로그래밍') || desc.includes('code') || desc.includes('programming') ||
                   features.includes('code') || features.includes('programming') || features.includes('development') || features.includes('ide');
            
            if (isCode && tool.name) {
              console.log('[DEBUG] Found code tool:', tool.name, 'category:', cat);
            }
            return isCode;
          });
          console.log('[DEBUG] Code tools after filtering:', tools.length, 'tools found');
        }
        
        // 그래도 없으면 키워드 검색으로 재시도
        if (tools.length === 0) {
          console.log('[DEBUG] Still no code tools, trying keyword search');
          tools = await searchAIToolsUnified({
            searchQuery: 'code coding 코드 개발 프로그래밍 programming development copilot cursor github IDE'
          });
          console.log('[DEBUG] Keyword search result:', tools.length, 'tools');
        }
      } else if (intent.category === 'workflow') {
        // 워크플로우 카테고리 특별 처리 - 항상 5개 이상 확보
        console.log('[DEBUG] Searching for workflow category tools...');
        
        // 0차: 핵심 3사 우선 확보(zapier/make/n8n)
        const coreVendors = ['zapier','make','n8n'];
        const coreResults = (await Promise.all(coreVendors.map(v => searchAIToolsUnified({ searchQuery: v })))).flat();
        const coreDedup = new Map<string, any>();
        for (const t of coreResults) {
          const key = String(t.id || t.name);
          if (!coreDedup.has(key)) coreDedup.set(key, t);
        }
        let tools: AITool[] = Array.from(coreDedup.values());
        
        // 1차: 키워드로 검색
        const keywordFirst = await searchAIToolsUnified({
          searchQuery: 'workflow 워크플로우 자동화 automation zapier make n8n 통합 연동 integration 업무 프로젝트 칸반 생산성',
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined
        });
        // 핵심 3사를 앞으로 유지하면서 나머지 결합
        const exist = new Set(tools.map(t => t.id));
        for (const t of keywordFirst) { if (!exist.has(t.id)) { tools.push(t); exist.add(t.id); } }
        console.log('[DEBUG] Workflow keyword search result:', tools.length, 'tools');
        
        // 2차: 전체에서 워크플로우 관련 도구 필터링(주요기능 동의어 우선)
        if (tools.length < targetCount) {
          console.log('[DEBUG] Need more workflow tools, searching all tools...');
          const allTools = await searchAIToolsUnified({});
          const synonyms = ['workflow','automation','integrations','integration','webhook','zapier','make','n8n','ifttt','pipedream','workato'];
          const isWorkflow = (t: AITool): boolean => {
            const cat = (t.category || '').toLowerCase();
            const name = (t.name || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const feats = (t.features || []).map(f => String(f).toLowerCase());
            // 주요기능 우선: features에 동의어가 정확/부분 포함
            const featureHit = feats.some(f => synonyms.some(s => f.includes(s)));
            if (featureHit) return true;
            return cat.includes('workflow') || cat.includes('automation') || cat.includes('integration') ||
                   synonyms.some(s => name.includes(s) || desc.includes(s));
          };
          const workflowTools = allTools.filter(isWorkflow);
          for (const t of workflowTools) { if (!exist.has(t.id)) { tools.push(t); exist.add(t.id); if (tools.length >= targetCount) break; } }
          console.log('[DEBUG] Workflow tools after filtering:', tools.length, 'tools found');
        }
        
        // 3차: 그래도 부족하면 프로젝트 관리 도구에서 보충
        if (tools.length < targetCount) {
          console.log('[DEBUG] Still need more tools, checking project management tools...');
          const projectTools = await searchAIToolsUnified({ 
            searchQuery: 'project 프로젝트 task 업무 관리 management notion jira asana trello monday clickup' 
          });
          for (const t of projectTools) { if (!exist.has(t.id)) { tools.push(t); exist.add(t.id); if (tools.length >= targetCount) break; } }
        }
        
        // 4차: 최종 보충
        if (tools.length < targetCount) {
          console.log('[DEBUG] Final fallback with broader search');
          const broadTools = await searchAIToolsUnified({
            searchQuery: 'api webhook slack teams 협업 collaboration productivity 생산성'
          });
          for (const t of broadTools) { if (!exist.has(t.id)) { tools.push(t); exist.add(t.id); if (tools.length >= targetCount) break; } }
        }
        
        // 우선순위 정렬: core vendors → 나머지
        const isCore = (t: AITool) => /\b(zapier|make|n8n)\b/i.test(String(t.name||'')) || /\b(zapier|make|n8n)\b/i.test(String(t.domain||''));
        const core = tools.filter(isCore);
        const rest = tools.filter(t => !isCore(t));
        tools = [...core, ...rest];
      } else if (intent.category === 'text') {
        // 텍스트/글쓰기 카테고리 특별 처리 - 항상 5개 이상 확보
        console.log('[DEBUG] Searching for text category tools...');

        // 1차: 카테고리로 검색
        tools = await searchAIToolsUnified({
          category: 'text',
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined
        });
        console.log('[DEBUG] Text category search result:', tools.length, 'tools');

        // 2차: 전체에서 텍스트 관련 도구 필터링 (글쓰기/요약/번역/카피라이팅 등)
        if (tools.length < targetCount) {
          console.log('[DEBUG] Need more text tools, searching all tools...');
          const allTools = await searchAIToolsUnified({});
          const textTools = allTools.filter(tool => {
            const cat = (tool.category || '').toLowerCase();
            const name = (tool.name || '').toLowerCase();
            const desc = (tool.description || '').toLowerCase();
            const features = (tool.features || []).join(' ').toLowerCase();
            const isText = cat.includes('text') || cat.includes('writing') || cat.includes('문서') || cat.includes('텍스트') ||
              name.includes('write') || name.includes('writing') || name.includes('writer') || name.includes('copy') || name.includes('grammarly') || name.includes('quillbot') || name.includes('jasper') || name.includes('notion') ||
              desc.includes('글') || desc.includes('문서') || desc.includes('요약') || desc.includes('번역') || desc.includes('카피') || desc.includes('카피라이팅') || desc.includes('writing') || desc.includes('summary') || desc.includes('translate') ||
              features.includes('writing') || features.includes('text') || features.includes('summary') || features.includes('translation') || features.includes('번역') || features.includes('요약');
            return isText;
          });
          const existingIds = new Set(tools.map(t => t.id));
          for (const tool of textTools) {
            if (!existingIds.has(tool.id)) {
              tools.push(tool);
              existingIds.add(tool.id);
              if (tools.length >= targetCount) break;
            }
          }
          console.log('[DEBUG] Text tools after filtering:', tools.length, 'tools found');
        }

        // 3차: 키워드 검색으로 최종 보충
        if (tools.length < targetCount) {
          console.log('[DEBUG] Final fallback with keyword search for text');
          const keywordTools = await searchAIToolsUnified({
            searchQuery: 'text 글쓰기 writing writer 요약 summary 번역 translation 카피 copy 문서 정리 문장 교정 grammar grammarly quillbot jasper notion copy.ai'
          });
          const existingIds = new Set(tools.map(t => t.id));
          for (const tool of keywordTools) {
            if (!existingIds.has(tool.id)) {
              tools.push(tool);
              existingIds.add(tool.id);
              if (tools.length >= targetCount) break;
            }
          }
        }

        console.log('[DEBUG] Final text tools count:', tools.length);
      } else if (intent.category === 'design') {
        // 디자인 카테고리도 특별 처리 - 항상 5개 이상 확보
        console.log('[DEBUG] Searching for design category tools...');
        
        // 1차: 카테고리로 검색
        tools = await searchAIToolsUnified({
          category: 'design',
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined
        });
        console.log('[DEBUG] Design category search result:', tools.length, 'tools');
        
        // 1-보강: 주요기능에 "디자인" AND ("제작"|"생성") 조합이 있으면 최우선으로 정렬
        const featureDesignCreate = (t: AITool): boolean => {
          const feats = (t.features || []).map(f => String(f).toLowerCase());
          if (!feats.length) return false;
          const joined = feats.join(' ');
          const hasDesign = /(디자인|design|브랜딩|로고|그래픽|illustration|ui|ux)/.test(joined);
          const hasCreate = /(제작|생성|만들|create|generate|generation|builder|production)/.test(joined);
          return hasDesign && hasCreate;
        };
        if (tools.length) {
          const first = tools.filter(featureDesignCreate);
          const ids = new Set(first.map(t => t.id));
          const rest = tools.filter(t => !ids.has(t.id));
          if (first.length) tools = [...first, ...rest];
        }
        
        // 2차: 전체에서 디자인 관련 도구 필터링
        if (tools.length < targetCount) {
          console.log('[DEBUG] Need more design tools, searching all tools...');
          const allTools = await searchAIToolsUnified({});
          
          const designTools = allTools.filter(tool => {
            const cat = (tool.category || '').toLowerCase();
            const name = (tool.name || '').toLowerCase();
            const desc = (tool.description || '').toLowerCase();
            const features = (tool.features || []).join(' ').toLowerCase();
            
            // 디자인 관련 키워드 체크
            const isDesign = cat.includes('design') || cat.includes('디자인') || cat.includes('그래픽') || cat.includes('graphic') ||
                   cat.includes('ui') || cat.includes('ux') || cat.includes('일러스트') || cat.includes('illustration') ||
                   name.includes('design') || name.includes('figma') || name.includes('canva') || name.includes('adobe') || 
                   name.includes('photoshop') || name.includes('illustrator') || name.includes('sketch') || name.includes('framer') ||
                   desc.includes('디자인') || desc.includes('design') || desc.includes('그래픽') || desc.includes('ui') || desc.includes('ux') ||
                   features.includes('design') || features.includes('graphic') || features.includes('ui') || features.includes('ux');
            
            // 주요기능 "디자인" AND ("제작"|"생성") 조합 우선
            const featsHit = featureDesignCreate(tool);
            return isDesign || featsHit;
          });
          
          // 기존 도구와 중복 제거하며 추가
          const existingIds = new Set(tools.map(t => t.id));
          for (const tool of designTools) {
            if (!existingIds.has(tool.id)) {
              tools.push(tool);
              existingIds.add(tool.id);
              if (tools.length >= targetCount) break;
            }
          }
          console.log('[DEBUG] Design tools after filtering:', tools.length, 'tools found');
        }
        
        // 3차: 그래도 부족하면 이미지 카테고리에서 보충
        if (tools.length < targetCount) {
          console.log('[DEBUG] Still need more tools, checking image category...');
          const imageTools = await searchAIToolsUnified({ category: 'image' });
          const existingIds = new Set(tools.map(t => t.id));
          
          for (const tool of imageTools) {
            if (!existingIds.has(tool.id)) {
              tools.push(tool);
              existingIds.add(tool.id);
              if (tools.length >= targetCount) break;
            }
          }
        }
        
        // 4차: 키워드 검색으로 최종 보충
        if (tools.length < targetCount) {
          console.log('[DEBUG] Final fallback with keyword search');
          const keywordTools = await searchAIToolsUnified({
            searchQuery: 'design 디자인 그래픽 graphic UI UX 로고 브랜딩 일러스트 figma canva photoshop adobe'
          });
          const existingIds = new Set(tools.map(t => t.id));
          
          for (const tool of keywordTools) {
            if (!existingIds.has(tool.id)) {
              tools.push(tool);
              existingIds.add(tool.id);
              if (tools.length >= targetCount) break;
            }
          }
        }
        
        console.log('[DEBUG] Final design tools count:', tools.length);
      } else if (intent.category === 'ppt') {
        // PPT/프레젠테이션 카테고리: 동의어 기반 카테고리 검색 우선
        console.log('[DEBUG] Searching for ppt category tools...');
        tools = await searchAIToolsUnified({
          category: 'ppt',
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined
        });
        console.log('[DEBUG] PPT category search result:', tools.length, 'tools');

        // 부족하면 전체에서 PPT 관련 키워드로 필터링(일반어 제외, 핵심어만)
        if (tools.length < targetCount) {
          const allTools = await searchAIToolsUnified({});
          const kw = ['ppt','pptx','powerpoint','slide','slides','deck','keynote','google slides'];
          const isPptLike = (t: AITool) => {
            const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
            return kw.some(k => hay.includes(k));
          };
          const filtered = allTools.filter(isPptLike);
          const ids = new Set(tools.map(t => t.id));
          for (const t of filtered) {
            if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; }
          }
          console.log('[DEBUG] PPT tools after filtering:', tools.length);
        }

        // 그래도 부족하면 키워드 검색
        if (tools.length < targetCount) {
          const keywordTools = await searchAIToolsUnified({
            searchQuery: 'ppt pptx powerpoint slide slides deck keynote google slides'
          });
          const ids = new Set(tools.map(t => t.id));
          for (const t of keywordTools) { if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; } }
        }
      } else {
        // 다른 카테고리는 기존 방식대로
        tools = await searchAIToolsUnified({
          category: isKnownCategory ? (intent.category as any) : undefined,
          price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
          features: intent.features.length > 0 ? intent.features : undefined,
          searchQuery: [categorySearch, intent.features.join(' ')].filter(Boolean).join(' ')
        });
      }

      // 공통 후처리: 카테고리 기반 배제 + 동의어 유사도 임계(>=0.9)
      tools = filterToolsByCategoryExclusions(tools, intent.category);
      if (intent.category) {
        const isPpt = intent.category === 'ppt';
        const syns = [
          intent.category,
          ...(isPpt
            ? [
                'ppt','pptx','powerpoint','slide','slides','deck','keynote','google slides',
                'ppt 제작','프레젠테이션 제작','슬라이드 제작','슬라이드 생성','발표자료 제작','발표자료 생성','pitch deck','슬라이드 자동 생성'
              ]
            : []
          )
        ];
        // 1) ppt 는 features에서 동의어가 100% 일치 + 반드시 'ppt' 토큰 포함
        tools = isPpt ? filterByFeatureMustContain(filterByFeatureSynonymExact(tools, syns), 'ppt') : filterBySynonymSimilarity(tools, syns, 0.9);
        // ppt: 필터로 비워진 경우 안전 화이트리스트로 최소 3~5개 보강
        if (isPpt && tools.length === 0) {
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
            tools = picks.slice(0, Math.max(3, Math.min(5, picks.length)));
          } catch {}
        }
      }
      
      console.log('[DEBUG] Search results:', { 
        toolCount: tools.length,
        firstFewTools: tools.slice(0, 3).map(t => ({ name: t.name, category: t.category }))
      });
      // 운동/PT 질의 시 헬스케어/코칭 신호 기반으로 후처리 필터링
      if (fitnessAsk) {
        const coachKeys = ['fitness','health','coach','trainer','workout','운동','헬스','트레이너','코치','pt','calorie','칼로리','체지방'];
        const isCoach = (t: AITool): boolean => {
          const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
          return coachKeys.some(k => hay.includes(k));
        };
        tools = tools.filter(isCoach);
      }
      
      // targetCount는 이미 위에서 선언됨
      const minFallbackCount = 3;
      // 다양성 확보를 위해 셔플 후 카테고리 매칭 우선
      const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
      tools = shuffle(tools);
      // 워크플로우 자동화 의도 시, 자동화/연동형 키워드가 포함된 도구를 우선 정렬
      const preferWorkflowAutomation = /(워크플로우|workflow|자동화|노코드|no\s*code|통합|연동|integration)/i.test(message);
      if (preferWorkflowAutomation) {
        const autoKeys = ['automation','automate','workflow','integration','integrations','zapier','make','integromat','n8n','pipedream','ifttt','workato','webhook','api'];
        const isAutomation = (t: AITool): boolean => {
          const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
          return autoKeys.some(k => hay.includes(k));
        };
        const first = tools.filter(isAutomation);
        const rest = tools.filter(t => !isAutomation(t));
        if (first.length > 0) tools = [...first, ...rest];
      }
      // 협업툴(슬랙/팀즈/노션/지라 등) 연동을 원할 때 통합 우선 정렬
      const wantsCollabIntegrations = /(협업|slack|슬랙|teams|팀즈|microsoft\s*teams|notion|노션|jira|지라|asana|trello|clickup|monday|confluence|google\s*(workspace|drive|docs|cal|calendar|gmail)|dropbox|box|github|gitlab|zapier|make\.com|make)/i.test(message);
      if (wantsCollabIntegrations) {
        const integrationKeywords = ['slack','teams','microsoft teams','notion','jira','asana','trello','clickup','monday','confluence','google','workspace','drive','docs','calendar','gmail','dropbox','box','github','gitlab','zapier','make'];
        const hasIntegration = (t: AITool): boolean => {
          const hay = `${(t.name||'')} ${(t.description||'')} ${(t.features||[]).join(' ')}`.toLowerCase();
          return integrationKeywords.some(k => hay.includes(k));
        };
        const preferred = tools.filter(hasIntegration);
        const others = tools.filter(t => !hasIntegration(t));
        if (preferred.length > 0) tools = [...preferred, ...others];
      }
      const categoryAliasMatches = (toolCategory: string | undefined, want: string | null): boolean => {
        if (!want) return true;
        const tc = String(toolCategory || '').toLowerCase();
        const w = String(want || '').toLowerCase();
        if (w === 'text') return tc.includes('text') || tc.includes('writing');
        if (w === 'image') return tc.includes('image');
        if (w === 'video') return tc.includes('video');
        if (w === 'audio') return tc.includes('audio') || tc.includes('voice');
        if (w === 'code') return tc.includes('code') || tc.includes('coding');
        if (w === 'design') return tc.includes('design');
        if (w === 'workflow') return tc.includes('workflow') || tc.includes('automation') || tc.includes('integration') || tc.includes('업무') || tc.includes('프로젝트');
        if (w === 'avatar') return tc.includes('avatar') || tc.includes('아바타') || tc.includes('virtual') || tc.includes('버추얼') || tc.includes('디지털휴먼');
        return tc.includes(w);
      };
      const matchesCategory = (t: AITool) => !isKnownCategory || categoryAliasMatches(t.category, intent.category);
      // 중복 제거 후 카테고리 매칭
      const dedupeById = (arr: AITool[]) => {
        const seen = new Set<string>();
        return arr.filter((t) => {
          const key = String((t as any).id || (t as any).name || '');
          if (!key) return false;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      };
      // 특별 처리된 카테고리들은 이미 처리했으므로 그대로 사용
      if (intent.category === 'design' || intent.category === 'code' || intent.category === 'avatar' || intent.category === 'workflow' || intent.category === 'text') {
        // 이미 특별 처리된 카테고리들은 tools를 그대로 사용
        recommendedTools = dedupeById(tools).slice(0, targetCount);
      } else {
        // 다른 카테고리는 기존 방식대로 필터링
        tools = dedupeById(tools);
        recommendedTools = dedupeById(tools.filter(matchesCategory)).slice(0, targetCount);
      }

      // 전역 정책: 결과가 없으면 바로 빈 응답(어중간한 대체/보충 금지)
      if (recommendedTools.length === 0) {
        return NextResponse.json({
          response: '죄송합니다. 검색된 내용이 존재하지 않습니다.',
          tools: [],
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }

      // 운동/헬스/PT 의도에서는 어중간한 대체 추천을 하지 않고, 없으면 즉시 '없습니다'로 응답
      if (fitnessAsk && recommendedTools.length === 0) {
        return NextResponse.json({
          response: '죄송합니다. 검색된 내용이 존재하지 않습니다.',
          tools: [],
          tier: {
            name: userTier.name,
            description: userTier.description,
            model: userTier.model
          },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }

      // 부족하면 필터를 점진적으로 완화해 targetCount 확보
      const enableFallbacks = true; // 최소 추천 개수 보장 위해 폴백 허용
      if (enableFallbacks && !fitnessAsk && recommendedTools.length < targetCount) {
        const broader = shuffle(await searchAIToolsUnified({
          searchQuery: intent.category || (intent.features.join(' ') || undefined)
        }));
        const ids = new Set(recommendedTools.map(t => t.id));
        for (const t of broader) {
          if (!ids.has(t.id) && matchesCategory(t)) {
            recommendedTools.push(t);
            ids.add(t.id);
            if (recommendedTools.length >= targetCount) break;
          }
        }
      }
      if (enableFallbacks && !fitnessAsk && recommendedTools.length < targetCount) {
        const all = shuffle(await searchAIToolsUnified({}));
        const ids = new Set(recommendedTools.map(t => t.id));
        for (const t of all) {
          if (!ids.has(t.id) && matchesCategory(t)) {
            recommendedTools.push(t);
            ids.add(t.id);
            if (recommendedTools.length >= targetCount) break;
          }
        }
      }

      // 최종 폴백: 카테고리 제약을 무시하고 키워드 유사도 Top-K로 채움
      // 사용자가 개수를 명시했으면 그 개수만 맞추고, 명시하지 않았을 때만 최소 3개를 보장
      let fallbackUsed = false;
      const askedCountForFallback = intent.count;
      const fallbackMin = (askedCountForFallback != null) ? 1 : minFallbackCount;
      const threshold = Math.max(fallbackMin, Math.min(targetCount, 5));
      if (enableFallbacks && recommendedTools.length < threshold) {
        const all = await searchAIToolsUnified({});
        const existingIds = new Set(recommendedTools.map(t => t.id));
        const baseKeywords = [
          ...(intent.features || []),
          ...(intent.category ? [intent.category] : []),
          ...String(message).toLowerCase().split(/[^a-z0-9가-힣]+/).filter(Boolean)
        ];
        const scoreOf = (t: AITool) => {
          const hay = `${t.name || ''} ${t.description || ''} ${(t.features || []).join(' ')}`.toLowerCase();
          let score = 0;
          for (const kw of baseKeywords) {
            if (!kw) continue;
            if (hay.includes(kw.toLowerCase())) score += 2;
            // simple token overlap bonus
            const re = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '')}\\b`, 'i');
            if (re.test(hay)) score += 1;
          }
          if (t.hasAPI) score += 1; // slight preference
          return score;
        };
        const ranked = all
          .filter(t => !existingIds.has(t.id))
          .map(t => ({ t, s: scoreOf(t) }))
          .sort((a, b) => b.s - a.s)
          .map(x => x.t);
        for (const t of ranked) {
          if (recommendedTools.find(rt => rt.id === t.id)) continue;
          recommendedTools.push(t);
          if (recommendedTools.length >= Math.max(fallbackMin, targetCount)) break;
        }
        fallbackUsed = true;
      }

      // 최종 안전장치: 중복 제거 후 상한 적용
      const finalSeen = new Set<string>();
      recommendedTools = recommendedTools.filter((t) => {
        const k = String((t as any).id || (t as any).name || '');
        if (!k || finalSeen.has(k)) return false;
        finalSeen.add(k);
        return true;
      }).slice(0, targetCount);

      // 추가 세분화: 사용자가 IDE/에디터 기반을 물으면 IDE 관련 도구로 1차 필터
      const ideQuery = /(\bide\b|브라우저\s*ide|코드\s*에디터|에디터|vscode|visual\s*studio\s*code|jetbrains|intellij|sublime|vim)/i.test(message);
      let strictListForIde = false;
      if (ideQuery) {
        // IDE 관련 도구 필터링 개선
        const hasIdeTag = (t: AITool): boolean => {
          const feats = Array.isArray((t as any)?.features) ? (t as any).features : [];
          const name = String(t.name || '').toLowerCase();
          const desc = String(t.description || '').toLowerCase();
          const hasIde = feats.some((f: string) => String(f || '').toLowerCase().includes('ide')) ||
                        name.includes('ide') || name.includes('editor') || name.includes('vscode') ||
                        desc.includes('ide') || desc.includes('editor') || desc.includes('에디터');
          const isCode = String(t.category || '').toLowerCase().includes('code') ||
                        String(t.category || '').toLowerCase().includes('coding');
          return hasIde || isCode;
        };
        // 1) 현 후보 중 IDE 태그가 있는 항목만 남기기
        const onlyIde = recommendedTools.filter(hasIdeTag);
        if (onlyIde.length > 0) {
          recommendedTools = onlyIde.slice(0, targetCount);
        } else {
          // 2) 전체에서 IDE 태그 기반으로 보강 (노션 데이터만 사용)
          const all = await searchAIToolsUnified({});
          let ideAll = all.filter(hasIdeTag);
          ideAll = ideAll.slice(0, targetCount);
          if (ideAll.length > 0) {
            recommendedTools = ideAll;
          }
        }
        // 3) 큐레이션/합성 카드 보강은 사용하지 않습니다(노션 데이터 우선).
        // IDE 전용 질의에서는 목록 확장 금지(모자란 개수 임의 보충 방지)
        strictListForIde = true;
      }
      
      // 구조화된 프롬프트 생성 (상세 요청이 있으면 단일 툴 상세 프롬프트)
      let structuredPrompt = generateStructuredPrompt(intent, recommendedTools);
      if (detailDetect.isDetail && detailDetect.toolQuery) {
        // 도구 이름 유사 매칭
        const q = detailDetect.toolQuery.toLowerCase();
        const pick = recommendedTools.find(t => t.name.toLowerCase().includes(q))
          || (await searchAIToolsUnified({ searchQuery: q }))[0];
        if (pick) {
          structuredPrompt = generateDetailedToolPrompt(pick);
          recommendedTools = [pick];
        }
      }
      
      // 사용자가 '1개만' 요청했거나 특정 AI 이름을 직접 물어본 경우 단일 템플릿
      const userAskedOne = (intent.count ?? null) === 1;
      
      // ChatGPT, Claude 등 유명 AI 이름을 직접 물어본 경우
      const famousAINames = ['chatgpt', 'chat gpt', 'claude', 'bard', 'gemini', 'copilot', 'perplexity'];
      const msgLower = message.toLowerCase().replace(/\s+/g, '');
      const isAskingFamousAI = famousAINames.some(name => {
        const nameNormalized = name.replace(/\s+/g, '');
        return msgLower.includes(nameNormalized) || msgLower === nameNormalized;
      });
      
      // 검색 결과가 1개이고 메시지가 짧은 경우 (도구 이름만 물어본 것으로 추정)
      const isSpecificToolQuery = (recommendedTools.length === 1 && message.trim().split(' ').length <= 3) || isAskingFamousAI;
      
      console.log('[DEBUG] Single template check:', { userAskedOne, isSpecificToolQuery, toolCount: recommendedTools.length, message });
      
      if ((userAskedOne || isSpecificToolQuery) && recommendedTools.length > 0) {
        const pick = recommendedTools[0];
        const longMax = Math.max(600, Math.floor(getLongFormMaxTokens(userTier) * 0.6));
        const completion = await openai.chat.completions.create({
          model: userTier.model as any,
          messages: [
            { role: 'system', content: systemDetailPrompt() },
            { role: 'user', content: generateDetailedToolPrompt(pick) }
          ],
          max_completion_tokens: longMax,
          
        });
        recordSuccess();
        let response = completion.choices[0].message.content || '';
        if (session) response = prependPersonalizedLead(response, session, '단일 도구 상세'); else response = addLoginPromptMessage(response);
        try {
          const modOut = await moderateInput(response);
          if (!modOut.allowed) response = '생성된 응답 중 일부가 정책에 부합하지 않아 표시되지 않았습니다. 질문을 조금 바꿔 다시 시도해 주세요.';
        } catch {}
        
        // 단일 도구도 평점 정보를 포함하여 카드로 표시
        const enrichedSingleTool = await enrichRatingsForTools([pick]);
        
        return NextResponse.json({
          response: sanitizeText(response),
          tools: enrichedSingleTool, // 단일 도구도 카드로 표시하기 위해 배열로 전달
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId
        });
      }

      // toolsOnly 요청이면 모델 호출 없이 카드만 반환
      if (toolsOnly) {
        const enriched = await enrichRatingsForTools(recommendedTools);
        return NextResponse.json({
          response: enriched.length === 0 ? '죄송합니다. 검색된 내용이 존재하지 않습니다.' : '',
          tools: enriched,
          tier: {
            name: userTier.name,
            description: userTier.description,
            model: userTier.model
          },
          premium: isPremium,
          authenticated: !!session,
          traceId,
          fallbackUsed
        });
      }

      // DB 추론 모드: 템플릿을 서술형으로 변경
      if (kbMode === 'db') {
        const completion = await openai.chat.completions.create({
          model: userTier.model as any,
          messages: [
            { role: 'system', content: systemDbReasoningPrompt() },
            { role: 'user', content: buildDbReasoningUserPrompt(message, recommendedTools) }
          ],
          max_completion_tokens: getLongFormMaxTokens(userTier),
          
        });
        recordSuccess();
        let response = completion.choices[0].message.content || '';
        if (session) response = prependPersonalizedLead(response, session, '데이터베이스 기반 추천'); else response = addLoginPromptMessage(response);
        // 출력 모더레이션
        try {
          const modOut = await moderateInput(response);
          if (!modOut.allowed) response = '생성된 응답 중 일부가 정책에 부합하지 않아 표시되지 않았습니다. 질문을 조금 바꿔 다시 시도해 주세요.';
        } catch {}
        return NextResponse.json({
          response: sanitizeText(response),
          tools: recommendedTools,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          act: dialogAct,
          strategy,
          traceId,
          kbMode: 'db'
        });
      }

      // AI 응답 생성 (툴 추천용)
      const modelForCost2 = userTier.model;
      // 주요 카테고리는 항상 classic 템플릿 사용
      let variantGen = exp.flags.recommend_compare_style ? 'compare' : chooseVariant(message, targetCount);
      if (intent.category === 'design' || intent.category === 'code' || intent.category === 'ppt' || intent.category === 'workflow') {
        variantGen = 'classic'; // 디자인, 코드, PPT, 워크플로우는 classic 템플릿 사용
      }
      
      console.log('[DEBUG] Template variant:', { 
        category: intent.category, 
        variant: variantGen,
        targetCount,
        toolCount: recommendedTools.length 
      });
      
      if (listOnly) {
        const text = buildNameListResponse(recommendedTools);
        return NextResponse.json({
          response: text,
          tools: recommendedTools,
          tier: {
            name: userTier.name,
            description: userTier.description,
            model: userTier.model
          },
          premium: isPremium,
          authenticated: !!session,
          traceId,
          fallbackUsed
        });
      }
      // 평점 정보를 미리 추가
      const enrichedRecommendedTools = await enrichRatingsUnified(recommendedTools as any);
      
      const completion = await openai.chat.completions.create({
        model: modelForCost2 as any,
        messages: [
          { role: 'system', content: systemRecommendationPrompt(targetCount, variantGen) },
          { role: 'user', content: buildRecommendationUserPrompt(message, enrichedRecommendedTools, targetCount, variantGen) }
        ],
        max_completion_tokens: getLongFormMaxTokens(userTier),
        
      });
      recordSuccess();
      let response = completion.choices[0].message.content || '';
      const categoryLeadMap: Record<string, string> = {
        image: '이미지 생성/편집에 유용한 AI 도구를 소개합니다.',
        text: '글쓰기/요약/번역 등 텍스트 작업에 유용한 AI 도구를 소개합니다.',
        video: '영상 생성/편집에 유용한 AI 도구를 소개합니다.',
        audio: '음성/오디오 작업에 유용한 AI 도구를 소개합니다.',
        code: ideQuery ? 'IDE/에디터 기반 코딩에 유용한 AI 도구를 소개합니다.' : '코딩/리뷰/자동화에 유용한 AI 도구를 소개합니다.',
        design: '디자인/브랜딩 작업에 유용한 AI 도구를 소개합니다.',
      } as any;
      const leadGeneric = categoryLeadMap[intent.category || ''] || '요청하신 목적에 맞는 AI 도구를 소개합니다.';
      response = prependLeadIfMissing(response, leadGeneric);
      // 만약 모델 응답이 공백 또는 매우 짧으면, 카드 1~3개를 기반으로 간단 소개를 보강
      if (!response || response.trim().length < 10) {
        response = buildMinimalIntro(recommendedTools, leadGeneric);
      }
      let finishReason = (completion.choices[0] as any).finish_reason as string | undefined;

      // 응답이 길이 제한으로 끊긴 경우, 최대 3회까지 이어서 작성 요청
      let continueAttempts = 0;
      while (continueAttempts < 3 && (finishReason === 'length' || /[\.!?\u3002\uFF01\uFF1F]$/.test(response) === false)) {
        const followUp = await openai.chat.completions.create({
          model: modelForCost2 as any,
          messages: [
            {
              role: 'system',
              content: '바로 이전 응답의 마지막 문장을 자연스럽게 끝맺고, 누락된 문단이 있다면 간결하게 이어서 작성하세요. 반복 없이 이어쓰기만 하세요.'
            },
            { role: 'assistant', content: response }
          ],
          max_completion_tokens: Math.floor(getLongFormMaxTokens(userTier) * 0.75),
          
        });
        recordSuccess();
        const more = followUp.choices[0].message.content || '';
        response = `${response}${more.startsWith('\n') ? '' : '\n'}${more}`.trim();
        finishReason = (followUp.choices[0] as any).finish_reason as string | undefined;
        continueAttempts += 1;
      }

      // 모델 출력에서 허용되지 않은 도구 섹션 제거 (안전망)
      const allowedNames = recommendedTools.map(t => t.name).filter(Boolean);
      response = sanitizeResponse(response, allowedNames);
      // 요청 개수에 맞춰 번호 목록 섹션을 강제로 제한하고, 불필요한 '기타' 섹션 제거
      response = enforceExactNumberedSections(response, intent.count);
      // 각 섹션을 최대 2줄로 압축(가독성 향상)
      response = compactNumberedSections(response, 2);

      // 폴백 안내 문구 제거 (요청에 따라 비표시)
      
      // 후속 질문은 본문에 추가하지 않음 (프론트 말풍선으로만 표시)

      // 모델이 만든 목록 개수와 카드 개수 맞추기 (최대 10개)
      const askedCountForList = intent.count ?? null;
      const listedCount = askedCountForList || (response.match(/^\s*\d+\./gm) || []).length;
      if (enableFallbacks && !strictListForIde && listedCount > recommendedTools.length) {
        const need = Math.min(listedCount, 10) - recommendedTools.length;
        if (need > 0) {
          const all = await searchAIToolsUnified({});
          const ids = new Set(recommendedTools.map(t => t.id));
          for (const t of all) {
            if (!ids.has(t.id)) {
              recommendedTools.push(t);
              ids.add(t.id);
              if (recommendedTools.length >= Math.min(listedCount, 10)) break;
            }
          }
        }
      }

      // 후속 질문을 붙여 대화를 유도 (텍스트는 프론트에서 링크 카드 아래에 표시)
      // 이미 위에서 추가했으므로 중복 추가는 하지 않음

      // 비로그인 사용자에게 로그인 유도 메시지 추가
      if (session) {
        const topicKo = toKoCategoryLabel(intent.category, ideQuery);
        response = prependPersonalizedLead(response, session, topicKo);
      } else { response = addLoginPromptMessage(response); }
      
      // 출력 모더레이션 추가 확인 (안전망)
      try {
        const modOut = await moderateInput(response);
        if (!modOut.allowed) {
          response = '생성된 응답 중 일부가 정책에 부합하지 않아 표시되지 않았습니다. 질문을 조금 바꿔 다시 시도해 주세요.';
        }
      } catch {}
      // 텍스트가 비면 기본 안내 문구 제공(카드만 보일 때 대비)
      if (!response || response.trim().length === 0) {
        response = recommendedTools.length === 0
          ? '죄송합니다. 검색된 내용이 존재하지 않습니다.'
          : '요청하신 조건에 맞춰 아래에서 AI 툴을 추천했어요. 필요하면 칩으로 조건을 바로 바꿀 수 있어요.';
      }
      return NextResponse.json({
        response: sanitizeText(response),
        tools: enrichedRecommendedTools, // 평점이 추가된 도구 목록 반환
        tier: {
          name: userTier.name,
          description: userTier.description,
          model: userTier.model
        },
        premium: isPremium,
        authenticated: !!session,
        act: dialogAct,
        strategy,
        traceId,
        fallbackUsed,
        slotPrompt: {
          intent: 'tool_search',
          message: '조건을 바꾸고 싶다면 아래에서 빠르게 선택하세요.',
          options: buildChipsForKey('tool_search', { intent })
        }
      , exp });
    }

    // PPT 생성 의도: 슬롯 질의 프레이밍 후 종료
    if (high.label === 'ppt_generate' && high.confidence >= 0.45) {
      const tpl = INTENT_REGISTRY.ppt_generate.replyTemplate;
      let ask = `${tpl?.intro || ''} 주제와 분량(예: ${high.slots.slides ?? 10}장), 톤(격식/친근)만 알려주세요.`.trim();
      const pref1 = buildNicknamePrefix(session);
      if (pref1) ask = `${pref1}${ask}`;
      return NextResponse.json({
        response: sanitizeText(ask),
        slotPrompt: {
          intent: 'ppt_generate',
          message: ask,
          options: [
            { label: '격식 톤', send: `ppt ${high.slots.slides ?? 10}장 격식 톤으로 만들어줘` },
            { label: '친근 톤', send: `ppt ${high.slots.slides ?? 10}장 친근 톤으로 만들어줘` },
            { label: '10장', send: 'ppt 10장으로 만들어줘' },
            { label: '15장', send: 'ppt 15장으로 만들어줘' },
            { label: '20장', send: 'ppt 20장으로 만들어줘' },
            { label: '생성 페이지로 이동', send: '__NAV__/ppt-create' }
          ]
        },
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        traceId
      });
    }

    // 이미지 생성 의도: 칩 제안
    if (high.label === 'image_generate' && high.confidence >= 0.45) {
      const tpl = INTENT_REGISTRY.image_generate.replyTemplate;
      let ask = `${tpl?.intro || '어떤 이미지를 만들까요?'} 간단한 설명, 스타일(실사/애니), 사이즈를 알려주세요.`.trim();
      const pref2 = buildNicknamePrefix(session);
      if (pref2) ask = `${pref2}${ask}`;
      return NextResponse.json({
        response: sanitizeText(ask),
        slotPrompt: {
          intent: 'image_generate',
          message: ask,
          options: INTENT_REGISTRY.image_generate.chips
        },
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        traceId
      });
    }

    // 툴 검색 의도: 칩 제안
    if (high.label === 'search_tools' && high.confidence >= 0.45) {
      const tpl = INTENT_REGISTRY.tool_search.replyTemplate;
      let ask = (ambiguity.score >= 0.6)
        ? '어떤 분야의 AI 툴이 필요하신가요? 예: 이미지/영상/코드 등과 개수(예: 5개), 가격(무료/유료)을 알려주세요.'
        : `${tpl?.intro || '어떤 분야의 AI 툴이 필요하신가요?'} 카테고리와 개수, 가격 조건을 알려주세요.`.trim();
      const pref3 = buildNicknamePrefix(session);
      if (pref3) ask = `${pref3}${ask}`;
      return NextResponse.json({
        response: sanitizeText(ask),
        slotPrompt: {
          intent: 'tool_search',
          message: ask,
          options: buildChipsForKey('tool_search', { intent: analyzeUserIntent(message) })
        },
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        traceId
      });
    }

    // 문서 작성 의도: 칩 제안 (워드/Word 포함, 별도 confidence 요구 없음)
    const msgLowerForDoc = message.toLowerCase();
    if (/(보고서|문서|기획안|리포트|워드|word|ms\s*word)/.test(msgLowerForDoc) && /(작성|만들|생성|써)/.test(msgLowerForDoc)) {
      // 문맥상 '해달라'는 명령형이면 내부 도구 안내 또는 툴 추천으로 라우팅
      const imperativeLike = /(해줘|해주|해주세요|해라|해|만들어|작성해|써줘|생성해)/.test(msgLowerForDoc);
      if (imperativeLike) {
        // 내부 도구 매칭이 없으면 툴 검색 의도로 전환하여 추천 결과를 반환
        const intent = analyzeUserIntent(message);
        const knownCategories = ['image','text','video','audio','code','design'];
        const isKnownCategory = intent.category ? knownCategories.includes(intent.category) : false;
        const tools = await searchAIToolsUnified({
          category: isKnownCategory ? (intent.category as any) : undefined,
          searchQuery: [intent.category || 'text', 'document', 'word'].filter(Boolean).join(' ')
        });
        const targetCount = Math.min(Math.max(intent.count ?? 5, 1), 10);
        const recs = tools.slice(0, targetCount);
        return NextResponse.json({
          response: '요청하신 목적에 맞춰 아래 AI 문서 작성/편집 관련 툴을 추천했어요.',
          tools: recs,
          tier: { name: userTier.name, description: userTier.description, model: userTier.model },
          premium: isPremium,
          authenticated: !!session,
          traceId,
          slotPrompt: {
            intent: 'tool_search',
            message: '필요하면 조건을 바꿔 다시 추천받을 수 있어요.',
            options: INTENT_REGISTRY.tool_search.chips
          }
        });
      }
      const tpl = INTENT_REGISTRY.doc_create.replyTemplate;
      let ask = `${tpl?.intro || '어떤 문서를 작성할까요?'} 문서 유형(기획안/보고서), 분량, 톤을 알려주세요.`.trim();
      const pref4 = buildNicknamePrefix(session);
      if (pref4) ask = `${pref4}${ask}`;
      return NextResponse.json({
        response: sanitizeText(ask),
        slotPrompt: {
          intent: 'doc_create',
          message: ask,
          options: INTENT_REGISTRY.doc_create.chips
        },
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        traceId
      });
    }

    // 이메일 작성 의도: 칩 제안
    if (/이메일|메일/.test(message.toLowerCase()) && /(작성|보내|초안|생성)/.test(message.toLowerCase())) {
      const tpl = INTENT_REGISTRY.email_write.replyTemplate;
      let ask = `${tpl?.intro || '이메일을 작성해볼게요.'} 누구에게 어떤 목적으로 보낼 메일인가요?`.trim();
      const pref5 = buildNicknamePrefix(session);
      if (pref5) ask = `${pref5}${ask}`;
      return NextResponse.json({
        response: sanitizeText(ask),
        slotPrompt: {
          intent: 'email_write',
          message: ask,
          options: INTENT_REGISTRY.email_write.chips
        },
        tier: { name: userTier.name, description: userTier.description, model: userTier.model },
        premium: isPremium,
        authenticated: !!session,
        traceId
      });
    }

    // 일반 채팅 처리 (기존 로직)
    const modelForCost3 = userTier.model;
    const completion = await openai.chat.completions.create({
      model: modelForCost3 as any,
      messages: [
        { role: 'system', content: systemGeneralPromptByStyle(userTier.name, 'general') },
        { role: 'user', content: message }
      ],
      max_completion_tokens: getMaxTokens(userTier),
      
    });
    recordSuccess();

    let response = completion.choices[0].message.content || '';
    
    // 비로그인 사용자에게 로그인 유도 메시지 추가
    if (!session) {
      response = addLoginPromptMessage(response);
    }

    return NextResponse.json({
      response: sanitizeText(response),
      tier: {
        name: userTier.name,
        description: userTier.description,
        model: userTier.model
      },
      premium: isPremium,
      authenticated: !!session,
      act: dialogAct,
      strategy,
      traceId,
      exp
    });

  } catch (error) {
    console.error('Chat API Error:', error);
    try { recordFailure(); } catch {}
    
    // OpenAI API 할당량 초과 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('quota') || error.message.includes('rate limit')) {
        try { await sendAlert('Rate limit/quota error in /api/chat', { message: error.message }); } catch {}
        return NextResponse.json(
          { traceId: crypto.randomUUID(), code: 'RATE_LIMIT', message: '서비스 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
          { status: 429 }
        );
      }
    }
    
    const traceId = crypto.randomUUID();
    try { await sendAlert('Internal error in /api/chat', {}); } catch {}
    return NextResponse.json(
      { traceId, code: 'INTERNAL_ERROR', message: 'AI 응답 생성 중 오류가 발생했습니다.' },
      { status: 500, headers: { 'X-Trace-Id': traceId } }
    );
  }
}

// 티어별 시스템 프롬프트
function getUserSystemPrompt(tier: AITier, isPremium: boolean): string {
  const basePrompt = "당신은 MOA의 AI 검색 도우미입니다.";
  
  if (tier === AI_TIERS.GUEST) {
    return `${basePrompt} 간단하고 기본적인 답변을 제공해주세요. 가능한 한 짧고 명확하게 답변하세요.`;
  } else if (tier === AI_TIERS.USER) {
    return `${basePrompt} 친근하고 도움이 되는 답변을 제공해주세요. 적절한 수준의 상세함으로 답변하세요.`;
  } else if (tier === AI_TIERS.PREMIUM) {
    return `${basePrompt} 매우 상세하고 창의적이며 전문적인 답변을 제공해주세요. 다양한 관점과 실용적인 조언을 포함하여 최고 품질의 답변을 작성하세요.`;
  }
  
  return basePrompt;
}

// 티어별 최대 토큰 수
function getMaxTokens(tier: AITier): number {
  return tier.maxTokens;
}

// 툴 추천 등 장문 응답에 사용
function getLongFormMaxTokens(tier: AITier): number {
  return tier.longFormMaxTokens;
}

// 티어별 창의성 수준
function getTemperature(tier: AITier): number {
  return tier.temperature;
}

// 비로그인 사용자용 로그인 유도 메시지 추가
function addLoginPromptMessage(response: string): string {
  const loginPrompts = [
    "\n\n💡 **더 정확하고 상세한 답변을 원하시나요?** 로그인하시면 동일한 GPT-5-mini 모델로 더 긴 맥락과 풍부한 답변을 받을 수 있어요!",
    "\n\n🎯 **로그인하면 더 스마트한 AI와 대화할 수 있어요!** 지금보다 훨씬 정확하고 창의적인 답변을 경험해보세요.",
    "\n\n✨ **프리미엄 AI 경험을 원하신다면?** 로그인 후 결제하시면 더 넉넉한 토큰 한도와 고급 기능을 이용할 수 있어요!",
    "\n\n🚀 **이건 기본 AI의 답변이에요.** 로그인하면 동일 모델에서 더 긴 답변을 받아보실 수 있어요!",
    "\n\n📈 **더 나은 AI 경험을 원하시나요?** 로그인 시 토큰 한도가 늘어나고 응답 품질이 향상됩니다!",
    "\n\n🎨 **현재는 기본 버전입니다.** 로그인하면 더 창의적이고 정확한 AI 답변을 받아보세요!"
  ];
  
  const randomPrompt = loginPrompts[Math.floor(Math.random() * loginPrompts.length)];
  return response + randomPrompt;
} 

// 로그인 사용자 닉네임 접두사 추가
function getNickname(session: any): string | null {
  try {
    const name = (session?.user?.name || (session?.user as any)?.nickname || '').trim();
    if (name) return name;
    const email: string | undefined = session?.user?.email;
    if (email) return String(email).split('@')[0];
  } catch {}
  return null;
}

function addNicknamePrefix(response: string, session: any): string {
  // 호칭 접두어 제거 정책: 닉네임을 문장 앞에 붙이지 않음
  return response;
}

function buildNicknamePrefix(session: any): string {
  // 호칭 접두어 제거 정책: 빈 문자열 반환
  return '';
}

// 카테고리 한글 라벨 생성
function toKoCategoryLabel(category: string | null, ideQuery = false): string {
  const map: Record<string, string> = {
    image: '이미지 AI',
    text: '텍스트 AI',
    video: '영상 AI',
    audio: '오디오 AI',
    code: ideQuery ? 'IDE/에디터 기반 코딩 AI' : '코드/개발 AI',
    design: '디자인 AI',
    workflow: '자동화 워크플로우 AI',
    ppt: 'PPT 생성 AI',
    spreadsheet: '스프레드시트 AI',
    avatar: '아바타/버추얼 휴먼 AI'
  };
  if (!category) return ideQuery ? 'IDE/에디터 기반 코딩 AI' : 'AI 툴';
  return map[category] || 'AI 툴';
}

// 개인화된 서문 생성 후 본문 앞에 붙이기 (닉네임 줄 + 공백 줄)
function prependPersonalizedLead(text: string, session: any, topicKo: string): string {
  // 호칭 접두어 제거 정책: 개인화 서문을 붙이지 않음
  return String(text || '');
}

// 도구 이름 위주의 간단 번호 목록 응답 생성
function buildSimpleNumberedList(tools: AITool[], topicKo: string, session: any): string {
  const lead = `${topicKo} 추천 목록입니다.`;
  const items = (tools || []).map((t, i) => {
    const oneLine = String(t.description || '').split(/\.|!|\n/)[0].trim();
    const price = t.price === 'free' ? '무료' : (t.price === 'freemium' ? '부분무료' : '유료');
    const api = t.hasAPI ? 'API 제공' : 'API 미제공';
    return `${i + 1}. ${t.name} — ${oneLine || '간단한 소개'} (${price}, ${api})`;
  }).join('\n');
  return `${lead}\n\n${items}`;
}

// --- 서킷 브레이커 (간단 메모리 구현) ---
type BreakerState = { open: boolean; failures: number; lastFailureAt: number };
const breakerState: BreakerState = { open: false, failures: 0, lastFailureAt: 0 };

function getBreakerState(): BreakerState { return breakerState; }

function recordFailure() {
  breakerState.failures += 1;
  breakerState.lastFailureAt = Date.now();
  if (breakerState.failures >= 5) {
    breakerState.open = true;
    setTimeout(() => {
      breakerState.open = false;
      breakerState.failures = 0;
    }, 60 * 1000);
  }
}

function recordSuccess() {
  breakerState.failures = 0;
  breakerState.open = false;
}

// --- 간단 회전 선택 상태 (사용자가 "다른"을 요청할 때 목록을 돌려 보여주기) ---
const rotateState: Record<string, number> = Object.create(null);
function pickRotated<T>(items: T[], count: number, key: string, advance = true): T[] {
  if (items.length === 0 || count <= 0) return [];
  const idx = (rotateState[key] || 0) % items.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, items.length); i += 1) {
    out.push(items[(idx + i) % items.length]);
  }
  if (advance) rotateState[key] = (idx + count) % items.length;
  return out;
}