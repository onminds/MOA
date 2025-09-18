"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Plus, MessageSquare, Settings, Crown, Star, Zap, ExternalLink } from "lucide-react";
import Header from '../components/Header';
import { useRouter } from 'next/navigation';


type AITool = {
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

type Message = { 
  role: 'user' | 'assistant'; 
  content: string;
  tier?: {
    name: string;
    description: string;
    model: string;
  };
  premium?: boolean;
  authenticated?: boolean;
  tools?: AITool[];
  slotPrompt?: { intent: string; message: string; options: { label: string; send: string }[] };
};

type Conversation = { id: number; title: string; messages: Message[] };

export default function AIChat() {
  // Hydration 문제 해결을 위한 mounted 상태
  const [mounted, setMounted] = useState(false);
  
  // 대화 목록 (샘플)
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 1, title: "새 대화", messages: [] },
  ]);
  const [currentConv, setCurrentConv] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [webMode, setWebMode] = useState<'auto'|'on'|'off'>('auto');
  const [newsScope, setNewsScope] = useState<'auto'|'domestic'|'global'|'split'>('auto');
  const [apiOnly, setApiOnly] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailContent, setDetailContent] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentTier, setCurrentTier] = useState<{
    name: string;
    description: string;
    model: string;
  } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const impressionLogged = useRef<boolean>(false);
  const router = useRouter();

  // 본문에서 번호목록 도구명을 추출하고 해당 순서대로 카드 정렬/필터링
  const normalizeKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
  const extractOrderedKeys = (body: string): { nameKey: string; domainKey?: string }[] => {
    try {
      const text = String(body || '');
      const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const out: { nameKey: string; domainKey?: string }[] = [];
      const numLine = /^\s*(?:\d+\s*[\.|\)]|[-•·∙ㆍ])\s*(.+?)\s*(?:[-:–：\(]|$)/; // 확장: 1) 1 ) · ∙ ㆍ 및 한글 콜론
      const domainRe = /([a-z0-9][a-z0-9\-]*\.[a-z]{2,})/i;
      for (const line of lines) {
        const m = line.match(numLine);
        if (m && m[1]) {
          const raw = m[1].trim();
          const d = raw.match(domainRe)?.[1];
          out.push({ nameKey: normalizeKey(raw), domainKey: d ? normalizeKey(d) : undefined });
        }
      }
      return out;
    } catch { return []; }
  };
  const orderAndFilterByBody = (tools: any[], body: string): any[] => {
    try {
      const order = extractOrderedKeys(body);
      if (order.length >= 3) {
        // 1) 엄격 매핑: 번호목록 순서에 맞춰 정확히 그 이름/도메인만 선택
        const pool = [...tools];
        const pickBy = (o: {nameKey: string; domainKey?: string}) => {
          const idx = pool.findIndex((t:any)=>{
            const nameK = normalizeKey(String(t?.name||''));
            const domK = normalizeKey(String(t?.domain||''));
            return (nameK === o.nameKey) || (!!o.domainKey && domK === o.domainKey);
          });
          if (idx >= 0) { const t = pool[idx]; pool.splice(idx,1); return t; }
          // 유사 매칭(포함) 보조
          const idx2 = pool.findIndex((t:any)=>{
            const nameK = normalizeKey(String(t?.name||''));
            return nameK.includes(o.nameKey) || o.nameKey.includes(nameK);
          });
          if (idx2 >= 0) { const t = pool[idx2]; pool.splice(idx2,1); return t; }
          return null;
        };
        const strict = order.map(o=>pickBy(o)).filter(Boolean) as any[];
        if (strict.length >= 1) {
          try { if (process.env.NODE_ENV !== 'production') { console.log('[UI][Order] extracted order keys:', order.map(o=>o.nameKey)); console.log('[UI][Order] final ordered tools (strict):', strict.map(t=>t?.name)); } } catch {}
          return strict;
        }
      }
      // fallback: 본문에서 이름 첫 등장 위치 기반 정렬
      const bodyL = String(body || '').toLowerCase();
      const ordered = [...tools].sort((a: any, b: any) => {
        const ia = bodyL.indexOf(String(a?.name || '').toLowerCase());
        const ib = bodyL.indexOf(String(b?.name || '').toLowerCase());
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      });
      try { if (process.env.NODE_ENV !== 'production') { console.log('[UI][Order][fallback] ordered by first occurrence:', ordered.map(t=>t?.name)); } } catch {}
      return ordered;
    } catch { return tools; }
  };

  // 링크 URL 정규화 (잘못된 링크 방지)
  const normalizeUrl = (url: string): string => {
    try {
      if (!url) return '#';
      const fixed = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      const u = new URL(fixed);
      return u.href;
    } catch {
      return '#';
    }
  };

  // 카드 아이콘 해석: 절대 URL 은 프록시로, 상대 경로는 도메인과 결합, 없으면 favicon → 기본 아이콘
  const resolveToolIcon = (tool: AITool): string => {
    try {
      const raw = String(tool.imageUrl || '').trim();
      if (raw) {
        if (/^https?:\/\//i.test(raw)) return `/api/proxy-image?url=${encodeURIComponent(raw)}`;
        if (raw.startsWith('/')) {
          if (tool.domain) return `https://${String(tool.domain).toLowerCase()}${raw}`;
          return raw;
        }
      }
      if (tool.domain) return `https://${String(tool.domain).toLowerCase()}/favicon.ico`;
      return '/images/default-tool-icon.svg';
    } catch { return '/images/default-tool-icon.svg'; }
  };

  // 본문 내 URL을 자동으로 링크화 (XSS 없이 안전하게)
  const renderWithLinks = (text?: string) => {
    const t = String(text || '');
    const urlRe = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/g;
    const nodes: any[] = [];
    let lastIndex = 0;
    for (const m of t.matchAll(urlRe) as any) {
      const idx = m.index as number;
      const url = m[0] as string;
      if (idx > lastIndex) nodes.push(t.slice(lastIndex, idx));
      const href = url.startsWith('http') ? url : `https://${url}`;
      nodes.push(
        <a key={`${idx}-${url}`} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-words">{url}</a>
      );
      lastIndex = idx + url.length;
    }
    if (lastIndex < t.length) nodes.push(t.slice(lastIndex));
    return nodes;
  };

  // 현재 대화 메시지
  const messages = conversations[currentConv].messages;
  const latestAssistantTools = useMemo(() => {
    try {
      // 가장 최근 assistant 카드가 있는 메시지를 역방향으로 탐색
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i] as any;
        if (m?.role === 'assistant' && Array.isArray(m?.tools) && m.tools.length > 0) {
          return m.tools as any[];
        }
      }
    } catch {}
    return null;
  }, [messages]);

  // 간단 질문/정보성 대화 감지: 텍스트만 생성. 단, 이전 카드가 있으면 유지 표시
  const isSimpleQnA = (() => {
    try {
      const last = messages[messages.length - 1];
      if (!last) return false;
      const text = String(last.content || '').toLowerCase();
      // 도구/추천/알려/찾아 등 검색 의도 키워드가 없고, 인사/설명/질문만 있는 경우
      const hasToolVerb = /(추천|툴|도구|tool|서비스|알려|찾아|찾아줘|리스트|목록|top|best)/.test(text);
      // 인사/잡담: 다양한 변형과 오탈자 포함(안.{0,2}녕), 영문 인사 포함
      const greetingRegex = /^(안녕|안녕하세요|안뇽|안뇽하세요|하이|헬로|헬로우|hello|hi|hey|ㅎㅇ|안녕하세|안녕요|안녕하세용|안녕하세여|안녀|안녕하ㅔ요)$/i;
      const looksLikeGreeting = greetingRegex.test(text.trim()) || /안.{0,2}녕/.test(text);
      const isGreetingOrQuestion = looksLikeGreeting || /(무엇|뭐야|어떻게|왜|언제|어디|설명|정의|요약|뜻|meaning|what|how|why|when|where)/.test(text);
      return !hasToolVerb && isGreetingOrQuestion;
    } catch { return false; }
  })();

  // 단일 상세 질의 감지: '~에 대해', '~란', '뭐야', '무엇', '소개', '설명', '자세히' 등
  const isDetailQnA = (() => {
    try {
      let lastUser = '';
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === 'user') { lastUser = String(messages[i]?.content || ''); break; }
      }
      const s = lastUser.toLowerCase();
      // '에 대해' 뿐 아니라 띄어쓰기 없이 붙는 '대해'도 포착
      const isDetail = /(에?\s*대해|란|뭐야|무엇|소개|설명|자세히)/.test(s);
      const hasListCue = /(비교|대안|추천|리스트|목록|툴|도구|top|best)/.test(s) || /\d+\s*개/.test(s);
      return isDetail && !hasListCue;
    } catch { return false; }
  })();

  useEffect(() => {
    setMounted(true);
    
    // URL 쿼리 파라미터에서 메시지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const messageParam = urlParams.get('message');
    
    if (messageParam && messageParam.trim()) {
      // 메시지가 있으면 즉시 전송 (input 상태 업데이트 없이)
      handleSendWithMessage(messageParam);
      // URL에서 파라미터 제거 (브라우저 히스토리 정리)
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 200;
    if (autoScroll || nearBottom) {
      chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, mounted, autoScroll]);

  // 안전한 노출 이벤트 로깅(스크립트 인젝션 제거)
  useEffect(() => {
    try {
      if (impressionLogged.current) return;
      const hasTools = messages.some(m => m.role === 'assistant' && Array.isArray(m.tools) && m.tools.length > 0);
      if (hasTools) {
        impressionLogged.current = true;
        fetch('/api/analytics/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'tool_impression' }) });
      }
    } catch {}
  }, [messages]);

  // 새 대화 추가
  const handleNewChat = () => {
    setConversations([
      ...conversations,
      { id: Date.now(), title: `새 대화`, messages: [] }
    ]);
    setCurrentConv(conversations.length);
  };

  // 티어 아이콘 컴포넌트
  const getTierIcon = (tierName?: string) => {
    switch (tierName) {
      case '기본 AI':
        return <Zap className="w-4 h-4 text-gray-500" />;
      case '향상된 AI':
        return <Star className="w-4 h-4 text-blue-500" />;
      case '프리미엄 AI':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      default:
        return <Zap className="w-4 h-4 text-gray-500" />;
    }
  };

  // 티어 색상 설정
  const getTierColor = (tierName?: string) => {
    switch (tierName) {
      case '기본 AI':
        return 'text-gray-600 bg-gray-100';
      case '향상된 AI':
        return 'text-blue-600 bg-blue-100';
      case '프리미엄 AI':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // 메시지 전송 (URL 파라미터용)
  const handleSendWithMessage = async (message: string) => {
    if (!message.trim()) return;
    
    const userMsg: Message = { role: "user", content: message };
    
    // 대화에 메시지 추가
    const newConvs = [...conversations];
    newConvs[currentConv].messages = [...newConvs[currentConv].messages, userMsg];
    setConversations(newConvs);
    setInput("");
    setLoading(true);
    
    try {
      // 사전 라우팅 결정(서버 규칙 기반) 시도
      let serverRoute: 'stream' | 'nonstream' | null = null;
      let serverWeb = false;
      // 사전 라우팅 API 제거: 실패/404는 무시
      try { /* no-op: removed */ } catch {}
      // 스트리밍 우회 조건 재사용
      const isToolSearchQuery = (q: string) => {
        const s = q.toLowerCase();
        
        // 마케팅 관련 강화된 패턴 - 백엔드와 동일
        if (/(마케팅|marketing|광고|advertising|홍보|pr|promotion|프로모션|campaign|캠페인|branding|브랜딩|sns|소셜미디어|social\s*media|인플루언서|influencer|콘텐츠마케팅|content\s*marketing|이메일마케팅|email\s*marketing|seo|sem|ppc|디지털마케팅|digital\s*marketing|온라인마케팅|online\s*marketing)/.test(s)) {
          return true;
        }
        
        // 도구 + 알려줘 패턴
        if (/(도구|tool|툴|서비스|ai).*알려/.test(s)) {
          return true;
        }
        
        // 알려줘 + 도구 패턴
        if (/알려.*(도구|tool|툴|서비스|ai)/.test(s)) {
          return true;
        }
        
        // "N개" 패턴 체크 (예: "10개 알려줘", "5개 추천해줘")
        if (/\d+\s*개/.test(s) && /(ai|추천|알려|소개|찾|검색|툴|도구)/.test(s)) {
          return true;
        }
        
        const toolKeys = ['툴','도구','서비스','ai','추천','찾','알려','소개','검색','best','top'];
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const { CATEGORY_PATTERNS } = require('@/config/patterns');
          const hasCategory = CATEGORY_PATTERNS.some((p: any) => p.keywords.some((k: string) => s.includes(String(k).toLowerCase())));
          const hasVerb = CATEGORY_PATTERNS.some((p: any) => p.actions.some((a: string) => s.includes(String(a).toLowerCase())));
          if (hasCategory && hasVerb) return true;
        } catch {}
        const catKeys = ['이미지','영상','비디오','동영상','텍스트','코드','코딩','개발','프로그래밍','ide','에디터','오디오','디자인','로고','썸네일','워크플로우','업무','프로젝트','칸반','todo','생산성','아바타','버추얼','가상'];
        return toolKeys.some(k => s.includes(k)) && catKeys.some(k => s.includes(k));
      };
      const s = message.toLowerCase();
      const isGreeting = /^(안녕|안녕하세요|하이|헬로|hello|hi|hey|ㅎㅇ|안뇽)$/i.test(message.trim());
      const isIdentitySmalltalk = /(누구|너|너는|정체|역할|무엇을\s*할\s*수|뭐\s*할\s*수|무슨\s*일을|who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do)/i.test(s);
      const pageWord = /(웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트)/.test(s);
      const isWebsiteBuild = pageWord && /(만들|제작|생성|build|빌드|만들고\s*싶어|만들어)/.test(s);
      const isWebsiteAssist = pageWord && /(도움|유용|추천|알려|툴|도구|서비스)/.test(s);
      const isDocCreate = /(보고서|문서|기획안|리포트|워드|word|ms\s*word)/.test(s) && /(작성|만들|생성|써)/.test(s);
      const isVideoMake = /(영상|비디오|video)/.test(s) && /(제작|편집|합성|만들|컷|자막|렌더|효과|템플릿|자동|추천|알려)/.test(s);
      const isAudioMake = /(음성|오디오|voice|tts|stt|보이스)/.test(s) && /(수정|편집|변환|합성|클린업|제거|노이즈|더빙|보이스오버|voiceover|튜닝|pitch|복제|clone|synthesis)/.test(s);
      const isCodeReview = /(코드|code)/.test(s) && /(리뷰|검토|정적|static|lint|linter)/.test(s);
      const looksLikeDetail = (/(자세히|상세|설명|소개|가이드|뭐야|무엇|란)/.test(s) && !isGreeting && !isIdentitySmalltalk);
      const shouldBypass = !isGreeting && !isIdentitySmalltalk && (isDocCreate || isVideoMake || isAudioMake || isCodeReview || isWebsiteBuild || isWebsiteAssist || looksLikeDetail);

      const forceStream = isToolSearchQuery(message);
      if (useStreaming && !shouldBypass && (serverRoute !== 'nonstream' || forceStream)) {
        // 스트리밍 경로 사용
        const newConvsStreaming = [...newConvs];
        // 도구 검색이 아닐 때만 빈 메시지 추가 (도구 검색은 [[TOOLS]] 파싱 후 추가)
        if (!isToolSearchQuery(message)) {
          newConvsStreaming[currentConv].messages = [...newConvsStreaming[currentConv].messages, { role: 'assistant', content: '' } as any];
          setConversations(newConvsStreaming);
        }
        setAutoScroll(true);
        const res = await fetch('/api/chat/stream', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: message, kbMode: (isToolSearchQuery(message) ? 'db' : undefined), clientLastTools: (latestAssistantTools || undefined) })
        });
        if (res.status !== 409) {
          if (!res.ok || (res.headers.get('content-type')||'').includes('text/html')) {
            // HTML 에러 페이지나 실패 응답은 사용자 친화 메시지로 대체
            setConversations((prev)=>{
              const next=[...prev];
              const msgs=[...next[currentConv].messages];
              const lastIdx=msgs.length-1;
              if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
                msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' } as any;
                next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
              }
              return next as any;
            });
            setLoading(false);
            return;
          }
          // 보이는 버블(assistant) 확보
          setConversations((prev)=>{
            const next=[...prev];
            const msgs=[...next[currentConv].messages];
            const lastIdx=msgs.length-1;
            if (!(lastIdx>=0 && msgs[lastIdx].role==='assistant')) {
              msgs.push({ role:'assistant', content:'' } as any);
              next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            }
            return next as any;
          });
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let done = false;
          const SHOW_TEXT = true; // 텍스트 노출: assistant 측에만 출력
          const sanitize = (t: string) => t
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/_(.*?)_/g, '$1')
            .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');
          let queue = '';
          let typingTimer: any = null;
          let fullBody = '';
          let htmlLeakDetected = false;
          let suppressToolsBlock = false;
          let toolsBuffer = '';
          let toolsFromStream: any[] | null = null;
          const startTyping = () => {
            if (typingTimer) return;
            typingTimer = setInterval(() => {
              if (!queue.length) return;
              const ch = queue.slice(0, 1);
              queue = queue.slice(1);
              fullBody += ch;
              if (SHOW_TEXT) {
                setConversations((prev)=>{
                  const next = [...prev];
                  const msgs = [...next[currentConv].messages];
                  const lastIdx = msgs.length - 1;
                  if (lastIdx >= 0 && (msgs[lastIdx] as any)?.role === 'assistant') {
                    msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: ((msgs[lastIdx] as any).content || '') + ch } as any;
                    next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
                  }
                  return next as any;
                });
              }
            }, 12);
          };
          // 카드 주입은 스트리밍 완료 후로 지연
          while (!done && reader) {
            const { value, done: d } = await reader.read();
            done = d;
            if (!value) continue;
            const raw = decoder.decode(value, { stream: true });
            if (/(<!DOCTYPE|<html|<head|<body)/i.test(raw)) { htmlLeakDetected = true; break; }
            let display = raw;
            if (suppressToolsBlock) {
              const endIdx = display.indexOf('[[/TOOLS]]');
              if (endIdx >= 0) {
                toolsBuffer += display.slice(0, endIdx);
                suppressToolsBlock = false;
                display = display.slice(endIdx + '[[/TOOLS]]'.length);
              } else {
                toolsBuffer += display;
                display = '';
              }
            }
            if (!suppressToolsBlock) {
              const startIdx = display.indexOf('[[TOOLS]]');
              if (startIdx >= 0) {
                const endIdx = display.indexOf('[[/TOOLS]]', startIdx + 9);
                if (endIdx >= 0) {
                  // parse and drop inline tools block
                  const jsonStr = display.slice(startIdx + 9, endIdx);
                  try {
                    const parsed = JSON.parse(jsonStr);
                    if (Array.isArray(parsed)) toolsFromStream = parsed;
                    else if (parsed && Array.isArray(parsed.tools)) toolsFromStream = parsed.tools;
                  } catch {}
                  display = display.slice(0, startIdx) + display.slice(endIdx + '[[/TOOLS]]'.length);
                } else {
                  suppressToolsBlock = true;
                  toolsBuffer = display.slice(startIdx + 9);
                  display = display.slice(0, startIdx);
                }
              }
            }
            const chunk = sanitize(display).replace(/<[^>]+>/g,'');
            if (chunk) { queue += chunk; startTyping(); }
          }
          await new Promise((resolve)=>{ const check=()=>{ if(!queue.length){ try{clearInterval(typingTimer);}catch{} resolve(null);} else setTimeout(check,20);}; check(); });
          if (htmlLeakDetected) {
            setConversations((prev)=>{
              const next=[...prev];
              const msgs=[...next[currentConv].messages];
              const lastIdx=msgs.length-1;
              if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
                msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' } as any;
                next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
              }
              return next as any;
            });
            setLoading(false);
            return;
          }
          // 스트리밍 종료 후: [[TOOLS]] 블록이 남아 있으면 제거
          // 종료 후 본문 재세팅은 생략(형식 전환을 유발하므로 skip)
          // 스트리밍 종료 후: 누적된 [[TOOLS]] 버퍼를 파싱(청크 분할 대비)
          if (suppressToolsBlock && toolsBuffer) {
            try {
              const parsed = JSON.parse(toolsBuffer);
              if (Array.isArray(parsed)) toolsFromStream = parsed;
              else if (parsed && Array.isArray(parsed.tools)) toolsFromStream = parsed.tools;
            } catch {}
          }
          // 카드 주입: 서버가 보낸 도구 배열을 최종 assistant 메시지에 붙임
          if (Array.isArray(toolsFromStream) && toolsFromStream.length) {
            const m = /(\d{1,2})\s*개\b/.exec(String(message||''));
            const desired = Math.max(5, m ? Math.max(1, Math.min(10, Number(m[1]))) : toolsFromStream.length);
            const capped = Math.min(10, desired);
            const slice = toolsFromStream.slice(0, desired).map((t:any)=>({
              id: t.id, 
              name: t.name, 
              description: t.description||'', 
              url: t.url||'', 
              domain: t.domain||'', 
              hasAPI: !!t.hasAPI, 
              category: t.category||'', 
              price: t.price||'freemium', 
              imageUrl: t.iconUrl || t.imageUrl || t.icon_url || '',
              rating: Number(t.rating ?? 4)
            }));
            setConversations((prev:any)=>{
              const next=[...prev];
              const msgs=[...next[currentConv].messages];
              const lastIdx=msgs.length-1;
              if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
                msgs[lastIdx] = { ...(msgs[lastIdx] as any), tools: slice } as any;
                next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
              } else {
                msgs.push({ role:'assistant', content:'', tools: slice } as any);
                next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
              }
              return next as any;
            });
          }
          // 스트리밍 종료 후: 외부 검색 엔드포인트는 호출하지 않음(404 방지)
          setLoading(false);
          return;
        }
        // 409면 비스트리밍 폴백
      }

      // 비스트리밍 경로 제거: 스트림만 사용
      const data: any = { response: '', tools: [], tier: null, premium: false, authenticated: false };
      console.log('[DEBUG Frontend] Received data:', { 
        hasResponse: !!data.response, 
        responseLength: data.response?.length,
        toolsCount: data.tools?.length,
        responsePreview: data.response?.substring(0, 100)
      });
      
      const assistantMsg: Message = { 
        role: "assistant", 
        content: data.response,
        tier: data.tier,
        premium: data.premium,
        authenticated: data.authenticated,
        tools: data.tools,
        slotPrompt: data.slotPrompt
      };
      
      // 현재 티어 정보 업데이트
      if (data.tier) {
        setCurrentTier(data.tier);
        setIsPremium(data.premium || false);
        setIsAuthenticated(data.authenticated || false);
      }
      
      newConvs[currentConv].messages = [
        ...newConvs[currentConv].messages,
        assistantMsg,
      ];
      setConversations([...newConvs]);
    } catch {
      const assistantMsg: Message = { 
        role: "assistant", 
        content: "오류가 발생했습니다. 다시 시도해 주세요." 
      };
      newConvs[currentConv].messages = [
        ...newConvs[currentConv].messages,
        assistantMsg,
      ];
      setConversations([...newConvs]);
    } finally {
      setLoading(false);
    }
  };

  // 메시지 전송 (일반용)
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg: Message = { role: "user", content: input };
    
    // 대화에 메시지 추가
    const newConvs = [...conversations];
    newConvs[currentConv].messages = [...newConvs[currentConv].messages, userMsg];
    setConversations(newConvs);
    setInput("");
    setLoading(true);
    
    try {
      // 서버 라우팅 선결정 시도
      let serverRoute: 'stream' | 'nonstream' | null = null;
      let serverWeb = false;
      let serverAmb = 0;
      // 사전 라우팅 API 제거: 실패/404는 무시
      try { /* no-op: removed */ } catch {}

      // 툴 추천 질의 감지 함수를 먼저 선언
      const isToolSearchQuery = (q: string) => {
          const s = q.toLowerCase();
          
          // 마케팅 관련 강화된 패턴 - 백엔드와 동일
          if (/(마케팅|marketing|광고|advertising|홍보|pr|promotion|프로모션|campaign|캠페인|branding|브랜딩|sns|소셜미디어|social\s*media|인플루언서|influencer|콘텐츠마케팅|content\s*marketing|이메일마케팅|email\s*marketing|seo|sem|ppc|디지털마케팅|digital\s*marketing|온라인마케팅|online\s*marketing)/.test(s)) {
            return true;
          }
          
          // 도구 + 알려줘 패턴
          if (/(도구|tool|툴|서비스|ai).*알려/.test(s)) {
            return true;
          }
          
          // 알려줘 + 도구 패턴
          if (/알려.*(도구|tool|툴|서비스|ai)/.test(s)) {
            return true;
          }
          
          // "N개" 패턴 체크 (예: "10개 알려줘", "5개 추천해줘")
          if (/\d+\s*개/.test(s) && /(ai|추천|알려|소개|찾|검색|툴|도구)/.test(s)) {
            return true;
          }
          
          const toolKeys = ['툴','도구','서비스','ai','추천','찾','알려','소개','검색','best','top'];
          try {
            // 공통 패턴을 사용하여 카테고리+동사 동시 감지
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { CATEGORY_PATTERNS } = require('@/config/patterns');
            const hasCategory = CATEGORY_PATTERNS.some((p: any) => p.keywords.some((k: string) => s.includes(String(k).toLowerCase())));
            const hasVerb = CATEGORY_PATTERNS.some((p: any) => p.actions.some((a: string) => s.includes(String(a).toLowerCase())));
            if (hasCategory && hasVerb) return true;
          } catch {}
          const catKeys = [
            '이미지','영상','비디오','동영상','텍스트','코드','코딩','개발','프로그래밍','ide','에디터','오디오','디자인','로고','썸네일',
            '워크플로우','업무','업무관리','프로젝트','칸반','todo','생산성','아바타','버추얼','가상','엑셀','스프레드시트','워드','파워포인트','ppt','오피스',
            '음성','보이스','tts','stt','더빙','voiceover',
            'image','video','audio','voice','text','code','coding','dev','developer','programming','ide','editor','design','workflow','project','kanban','productivity','avatar','virtual','excel','spreadsheet','sheets','word','powerpoint','office'
          ];
          return toolKeys.some(k => s.includes(k)) && catKeys.some(k => s.includes(k));
      };

      const forceStream2 = isToolSearchQuery(input);
      if (useStreaming && (serverRoute !== 'nonstream' || forceStream2)) {
        // 스트리밍만 사용: 비스트리밍 재라우팅 분기 제거
        const newConvsStreaming = [...newConvs];
        // 텍스트 말풍선은 추가하지 않음(카드만 표시)
        setConversations(newConvsStreaming);

        const shouldBypassStream = (() => {
          const s = input.toLowerCase();
          // 문서 작성/워드 관련은 비스트리밍으로 템플릿 칩을 빠르게 제공
          const isDocCreate = /(보고서|문서|기획안|리포트|워드|word|ms\s*word)/.test(s) && /(작성|만들|생성|써)/.test(s);
          // 영상 제작/편집 의도도 추천 템플릿이 더 적합 → 비스트리밍으로 안내 카드 즉시 제공
          const isVideoMake = /(영상|비디오|video)/.test(s) && /(제작|편집|합성|만들|컷|자막|렌더|효과|템플릿|자동|추천|알려)/.test(s);
          // 오디오/음성 변환·합성·클린업 등은 추천 템플릿 경로로
          const isAudioMake = /(음성|오디오|voice|tts|stt|보이스)/.test(s) && /(수정|편집|변환|합성|클린업|제거|노이즈|더빙|보이스오버|voiceover|튜닝|pitch|복제|clone|synthesis)/.test(s);
          // 코드 리뷰/정적분석 관련도 추천 경로가 적합
          const isCodeReview = /(코드|code)/.test(s) && /(리뷰|검토|정적|static|lint|linter)/.test(s);
          // 웹페이지 제작/보조 의도는 비스트리밍으로 바로 추천 경로
          const pageWord = /(웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트)/.test(s);
          const isWebsiteBuild = pageWord && /(만들|제작|생성|build|빌드|만들고\s*싶어|만들어)/.test(s);
          const isWebsiteAssist = pageWord && /(도움|유용|추천|알려|툴|도구|서비스)/.test(s);
          // 인사/자기소개형 스몰톡은 스트리밍 유지
          const isGreeting = /^(안녕|안녕하세요|하이|헬로|hello|hi|hey|ㅎㅇ|안뇽)$/i.test(input.trim());
          const isIdentitySmalltalk = /(누구|너|너는|정체|역할|무엇을\s*할\s*수|뭐\s*할\s*수|무슨\s*일을|who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do)/i.test(s);
          // 단일 상세 템플릿(제품명 질의/소개/자세히/뭐야/란) 우회. 단, 스몰톡은 제외
          const looksLikeDetail = (/(자세히|상세|설명|소개|가이드|뭐야|무엇|란)/.test(s) && !isGreeting && !isIdentitySmalltalk);
          return !isGreeting && !isIdentitySmalltalk && (isDocCreate || isVideoMake || isAudioMake || isCodeReview || isWebsiteBuild || isWebsiteAssist || looksLikeDetail);
        })();
        // 비스트리밍 우회 제거: 항상 스트림

        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 노션 DB 기반 추천을 강제
          body: JSON.stringify({ prompt: input, webMode, newsScope, kbMode: (isToolSearchQuery(input) ? 'db' : undefined), clientLastTools: (latestAssistantTools || undefined) })
        });
        if (res.status === 409) {
          // 스트리밍 강제 정책: 409 발생 시에도 폴백 없이 종료 처리
          setConversations((prev) => {
            const next = [...prev];
            const msgs = [...next[currentConv].messages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant' && (msgs[lastIdx].content || '') === '') {
              msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: '잠시 후 다시 시도해 주세요.' } as any;
              next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            }
            return next as any;
          });
          setLoading(false);
          return;
        }
        // 항상 스트리밍을 우선 사용하고, 이후 카드만 별도로 붙임
        if (!res.ok || (res.headers.get('content-type')||'').includes('text/html')) {
          setConversations((prev)=>{
            const next=[...prev];
            const msgs=[...next[currentConv].messages];
            const lastIdx=msgs.length-1;
            if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
              msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' } as any;
              next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            }
            return next as any;
          });
          setLoading(false);
          return;
        }
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        const sanitizeStream = (t: string) => t
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');
        // 타입라이터: 청크를 글자 큐로 쌓아 일정 속도로 소비
        let queue = '';
        let typingTimer: any = null;
        let fullBody = '';
        let fullRaw = '';
        let toolsFromStream: any[] | null = null;
        let traceIdFromStream: string | null = null;
        let suppressToolsBlock = false; // [[TOOLS]] 블록 출력 억제 플래그
        let toolsBuffer = '';
        const startTyping = () => {
          if (typingTimer) return;
          typingTimer = setInterval(() => {
            if (!queue.length) return;
            const ch = queue.slice(0, 1);
            queue = queue.slice(1);
            fullBody += ch;
            setConversations((prev) => {
              const next = [...prev];
              const msgs = [...next[currentConv].messages];
              const lastIdx = msgs.length - 1;
              const last = msgs[lastIdx] as Message;
              // assistant 메시지가 있을 때만 업데이트, 없으면 새로 추가
              if (lastIdx >= 0 && last && last.role === 'assistant') {
                msgs[lastIdx] = { ...last, content: (last.content || '') + ch };
              } else if (lastIdx < 0 || !last || last.role !== 'assistant') {
                // assistant 메시지가 없으면 새로 추가 (도구 검색의 경우)
                msgs.push({ role: 'assistant', content: ch } as any);
              }
              next[currentConv] = { ...next[currentConv], messages: msgs } as any;
              return next as any;
            });
          }, 12); // 타자 속도(ms) 조절
        };
        // 중간 카드 주입 제거: 본문이 모두 생성된 뒤에만 카드 생성

        while (!done && reader) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const raw = decoder.decode(value, { stream: true });
            fullRaw += raw;
            // [[TOOLS]] 마커 추출 및 출력 억제
            let display = raw;
            if (suppressToolsBlock) {
              // 마커 종료를 찾을 때까지 모든 출력 억제
              const endIdx = display.indexOf('[[/TOOLS]]');
              if (endIdx >= 0) {
                // 현재 청크까지 누적한 버퍼 + 이번 청크의 이전 부분을 합쳐 파싱
                toolsBuffer += display.slice(0, endIdx);
                try {
                  const parsed = JSON.parse(toolsBuffer);
                  if (!toolsFromStream) {
                    if (Array.isArray(parsed)) toolsFromStream = parsed;
                    else if (parsed && Array.isArray(parsed.tools)) {
                      toolsFromStream = parsed.tools;
                      traceIdFromStream = parsed.traceId || null;
                    }
                    console.log('[DEBUG] [[TOOLS]] parsed:', {
                      tools: toolsFromStream,
                      isToolSearch: isToolSearchQuery(input),
                      queueLength: queue?.length
                    });
                    // [[TOOLS]] 파싱 완료 시 대기 중인 큐 타이핑 시작
                    if (toolsFromStream && isToolSearchQuery(input) && queue) {
                      console.log('[DEBUG] Starting typing after [[TOOLS]] parse');
                      startTyping();
                    }
                  }
                } catch {}
                toolsBuffer = '';
                suppressToolsBlock = false;
                display = display.slice(endIdx + '[[/TOOLS]]'.length);
              } else {
                // 계속 누적
                toolsBuffer += display;
                display = '';
              }
            }
            if (!suppressToolsBlock) {
              const startIdx = display.indexOf('[[TOOLS]]');
              if (startIdx >= 0) {
                const endIdx = display.indexOf('[[/TOOLS]]', startIdx + 9);
                if (endIdx >= 0) {
                  const jsonStr = display.slice(startIdx + 9, endIdx);
                  if (!toolsFromStream) {
                    try {
                      const parsed = JSON.parse(jsonStr);
                      if (Array.isArray(parsed)) {
                        toolsFromStream = parsed;
                      } else if (parsed && Array.isArray(parsed.tools)) {
                        toolsFromStream = parsed.tools;
                        traceIdFromStream = parsed.traceId || null;
                      }
                      console.log('[DEBUG] [[TOOLS]] parsed (single chunk):', {
                        tools: toolsFromStream,
                        isToolSearch: isToolSearchQuery(input),
                        queueLength: queue?.length,
                        jsonStr: jsonStr.slice(0, 100)
                      });
                      // [[TOOLS]] 파싱 완료 시 대기 중인 큐 타이핑 시작
                      if (toolsFromStream && isToolSearchQuery(input) && queue) {
                        console.log('[DEBUG] Starting typing after [[TOOLS]] parse (single)');
                        startTyping();
                      }
                    } catch (err) {
                      console.error('[DEBUG] [[TOOLS]] parse error:', err, jsonStr?.slice(0, 100));
                    }
                  }
                  display = display.slice(0, startIdx) + display.slice(endIdx + '[[/TOOLS]]'.length);
                } else {
                  // 블록이 다음 청크로 이어짐 → 이후 출력 억제
                  suppressToolsBlock = true;
                  toolsBuffer = display.slice(startIdx + 9);
                  display = display.slice(0, startIdx);
                }
              }
            }
            const chunk = sanitizeStream(display);
            if (chunk) {
              // 도구 검색이고 아직 [[TOOLS]]를 파싱하지 못했으면 큐에만 쌓고 타이핑은 대기
              if (isToolSearchQuery(input) && !toolsFromStream) {
                queue += chunk;
                // [[TOOLS]] 파싱 후에 타이핑 시작
              } else {
                queue += chunk;
                startTyping();
              }
            }
          }
        }
        // 남은 큐 플러시
        await new Promise((resolve)=>{
          const check = () => {
            if (queue.length === 0) { clearInterval(typingTimer); resolve(null); }
            else setTimeout(check, 20);
          };
          check();
        });
        console.log('[DEBUG] After stream complete:', {
          isToolSearchQuery: isToolSearchQuery(input),
          toolsFromStream,
          hasToolsMarker: fullBody?.includes('[[TOOLS]]'),
          fullBody: fullBody?.slice(0, 200)
        });
        // [[TOOLS]] 블록 제거하여 화면에 노출되지 않도록 정리
        if (/\[\[TOOLS\]\]/.test(fullBody)) {
          const cleaned = fullBody.replace(/\n?\[\[TOOLS\]\][\s\S]*?\[\[\/TOOLS\]\]\n?/g, '').trim();
          // cleaned가 비어있지 않을 때만 업데이트 (빈 메시지 방지)
          if (cleaned) {
            setConversations((prev)=>{
              const next=[...prev];
              const msgs=[...next[currentConv].messages];
              const lastIdx=msgs.length-1;
              if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
                msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: cleaned } as any;
                next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
              }
              return next as any;
            });
          }
          fullBody = cleaned;
        }
        // 본문 동기화 제거: 스트림 종료 후 재구성은 형식 전환을 유발하므로 skip
        if (false && isToolSearchQuery(input) && Array.isArray(toolsFromStream) && ((toolsFromStream?.length ?? 0) > 0)) {
          const countStr = /(\d{1,2})\s*개\b/.exec(String(input || ''))?.[1];
          const desired = countStr ? Math.max(1, Math.min(10, Number(countStr))) : Math.min(10, (toolsFromStream?.length ?? 0));
          const slice = (toolsFromStream ?? []).slice(0, desired);
          const header = `${new Date().toLocaleDateString('ko-KR')} 기준, 요청하신 조건에 맞춘 AI 도구 ${desired}개 목록입니다.`;
          const lines = slice.map((t:any, i:number)=>{
            const one = String(t?.description||'').split(/[\.!?\n]/)[0].trim();
            const desc = one ? ` - ${one}` : '';
            return `${i+1}. ${t?.name||''}${desc}`;
          }).join('\n');
          const synthesized = `${header}\n\n${lines}`.replace(/\n{3,}/g,'\n\n').trim();
          setConversations((prev)=>{
            const next=[...prev];
            const msgs=[...next[currentConv].messages];
            const lastIdx=msgs.length-1;
            if (lastIdx>=0 && msgs[lastIdx].role==='assistant') {
              // 기존 assistant 메시지가 있으면 업데이트
              msgs[lastIdx] = { ...(msgs[lastIdx] as any), content: synthesized } as any;
            } else {
              // assistant 메시지가 없으면 새로 추가
              msgs.push({ role: 'assistant', content: synthesized } as any);
            }
            next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            return next as any;
          });
          // analytics 전송은 스트림 UI 확정 이후 200ms 지연 전송(경합 방지)
          try {
            if (traceIdFromStream) {
              setTimeout(()=>{
                const analyticsData = { 
                  type:'tool_cards', 
                  traceId: traceIdFromStream, 
                  meta: {
                    cards: slice.map((t:any)=>({name: t.name})),
                    order: []
                  }
                };
                fetch('/api/analytics/events', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(analyticsData) }).catch(()=>{});
              }, 200);
            }
          } catch {}
          fullBody = synthesized;
        }
        // 스트리밍 종료 후: 모호도 칩/버튼 표시
        // 인사/자기소개형 입력에는 모호도 슬롯을 표시하지 않음
        const sSmall = String(input||'').toLowerCase();
        const isGreetSmall = /^(안녕|안녕하세요|하이|헬로|hello|hi|hey|ㅎㅇ|안뇽)$/i.test(String(input||'').trim());
        const isIdentitySmall = /(누구|너|너는|정체|역할|무엇을\s*할\s*수|뭐\s*할\s*수|무슨\s*일을|who\s*are\s*you|what\s*are\s*you|what\s*can\s*you\s*do)/i.test(sSmall);
        if (serverAmb >= 0.45 && serverAmb <= 0.6 && !isGreetSmall && !isIdentitySmall) {
          setConversations((prev)=>{
            const next=[...prev];
            const msgs=[...next[currentConv].messages];
            const lastIdx=msgs.length-1;
            const slot:any={
              role:'assistant',
              content:'원하시는 방식으로 이어갈까요?',
              slotPrompt:{
                intent:'route_disambiguation',
                message:'선택해 주세요',
                options:[
                  { label:'실시간 뉴스 요약(웹검색)', send: '__STREAM__/web:on' },
                  { label:'내 문서 요약(업로드/붙여넣기)', send: '__NAV__/productivity/ai-summary' }
                ]
              }
            };
            msgs.push(slot);
            next[currentConv]={...(next[currentConv] as any), messages:msgs} as any;
            return next as any;
          });
        }
        // 스트리밍 종료 후: 툴 검색 의도일 때만 카드 요청
        console.log('[DEBUG] Card injection check:', { 
          isToolSearch: isToolSearchQuery(input), 
          toolsFromStream, 
          length: toolsFromStream?.length 
        });
        if (Array.isArray(toolsFromStream) && toolsFromStream.length > 0 && !isDetailQnA) {
          try {
            // 상세 질의에서는 카드 표시 안 함 (위 if 조건에서도 차단)
            // 서버 스트림에서 전달된 도구가 있으면 이를 우선 사용
            if (Array.isArray(toolsFromStream) && toolsFromStream.length) {
              const m2 = /(\d{1,2})\s*개\b/.exec(String(input||''));
              const desired2 = m2 ? Math.max(1, Math.min(10, Number(m2[1]))) : Math.min(10, toolsFromStream.length);
              const merged = toolsFromStream.slice(0, desired2).map((t:any)=>({
                id: t.id, name: t.name, description: t.description||'', url: t.url||'', domain: t.domain||'', hasAPI: !!t.hasAPI, category: t.category||'', price: t.price||'freemium', imageUrl: t.imageUrl||'', rating: Number(t.rating ?? 4)
              }));
              // 마지막 assistant 메시지에 카드 추가
              console.log('[DEBUG] Adding cards to message:', { merged, count: merged.length });
            
              setConversations((prev:any)=>{
                const next=[...prev];
                const msgs=[...next[currentConv].messages];
                const lastIdx = msgs.length - 1;
                console.log('[DEBUG] Message state:', { 
                  lastIdx, 
                  hasAssistant: lastIdx >= 0 && msgs[lastIdx]?.role === 'assistant',
                  lastMessage: msgs[lastIdx]
                });
                if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant') {
                  // 기존 메시지에 tools 추가
                  msgs[lastIdx] = { ...msgs[lastIdx], tools: merged } as any;
                  console.log('[DEBUG] Updated existing message with tools');
                } else {
                  // assistant 메시지가 없으면 새로 추가 (fallback)
                  msgs.push({ role:'assistant', content:'', tools: merged } as any);
                  console.log('[DEBUG] Added new message with tools');
                }
                next[currentConv]={...(next[currentConv] as any), messages:msgs} as any;
                return next as any;
              });
            }
          } catch {}
        }
        setLoading(false);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const data = await res.json();
      
      const assistantMsg: Message = { 
        role: "assistant", 
        content: data.response,
        tier: data.tier,
        premium: data.premium,
        authenticated: data.authenticated,
        tools: data.tools
      };
      
      // 현재 티어 정보 업데이트
      if (data.tier) {
        setCurrentTier(data.tier);
        setIsPremium(data.premium || false);
        setIsAuthenticated(data.authenticated || false);
      }
      
      newConvs[currentConv].messages = [
        ...newConvs[currentConv].messages,
        assistantMsg,
      ];
      setConversations([...newConvs]);
    } catch {
      const assistantMsg: Message = { 
        role: "assistant", 
        content: "오류가 발생했습니다. 다시 시도해 주세요." 
      };
      newConvs[currentConv].messages = [
        ...newConvs[currentConv].messages,
        assistantMsg,
      ];
      setConversations([...newConvs]);
    } finally {
      setLoading(false);
    }
  };

  // 입력창 컴포넌트 (중앙/하단 위치 모두에서 사용)
  const InputBox = (
    <div className="w-full max-w-xl mx-auto">
      {/* 티어 정보 표시 */}
      {mounted && currentTier && (
        <div className="mb-3 flex justify-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getTierColor(currentTier.name)}`}>
            {getTierIcon(currentTier.name)}
            <span>{currentTier.name}</span>
            <span className="text-xs opacity-70">• {currentTier.description}</span>
          </div>
        </div>
      )}
      
      <form
        onSubmit={handleSend}
        className="flex items-center border px-4 py-3 bg-white rounded-2xl shadow-md"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="무엇이든 물어보세요"
          className="flex-1 px-4 py-2 rounded-full border bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-200 text-gray-900"
          disabled={loading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSend(e);
          }}
        />
        <button
          type="submit"
          className="ml-2 p-2 rounded-full bg-black text-white hover:bg-gray-800 disabled:bg-gray-300"
          disabled={loading || !input.trim()}
          aria-label="전송"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );

  // 컴포넌트가 마운트되기 전까지는 로딩 표시
  if (!mounted) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex bg-white">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">로딩 중...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        <div className="flex">
          {/* 메인 콘텐츠 */}
          <div className="flex-1 flex flex-col">
            {/* 상단 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <button
                  onClick={handleNewChat}
                  className="flex items-center space-x-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>새 대화</span>
                </button>
                <h1 className="text-xl font-semibold text-gray-900">AI 채팅</h1>
              </div>
              <div className="flex items-center space-x-3">
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={apiOnly} onChange={(e)=>setApiOnly(e.target.checked)} />
                  API 있는 도구만
                </label>
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 채팅 영역 */}
            <div className="flex-1 flex flex-col">
              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-6" ref={scrollRef} onScroll={(e)=>{
                try{
                  const el = e.currentTarget as HTMLDivElement;
                  const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 40;
                  setAutoScroll(nearBottom);
                }catch{}
              }}>
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-6">
                    <div className="text-center">
                      <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">AI와 대화를 시작하세요</h2>
                      <p className="text-gray-600 mb-6">무엇이든 물어보세요. AI가 도와드릴게요.</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {[
                        '무료 이미지 생성 AI 추천해줘',
                        'API 지원하는 텍스트 AI 툴 알려줘',
                        '영상 편집 자동화에 좋은 AI 뭐가 있어?',
                      ].map((q) => (
                        <button
                          key={q}
                          onClick={() => handleSendWithMessage(q)}
                          className="px-3 py-1.5 text-sm rounded-full border hover:bg-gray-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                    {InputBox}
                  </div>
                ) : (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {messages.map((msg, index) => (
                      <div key={index} className="space-y-3 animate-fadeIn">
                        {/* 최신 메시지가 카드가 없을 때도 직전 카드가 같은 위치에 유지되도록, 카드 블록을 먼저 고정 렌더 */}
                        {false && msg.role === "assistant" && index === messages.length - 1 && ((msg.tools?.length ?? 0) === 0) && Array.isArray(latestAssistantTools) && (latestAssistantTools?.length ?? 0) > 0 && (
                           <div className="w-full max-w-[70%]">
                             <div className="text-sm text-gray-600 font-medium mb-3 ml-1">추천 AI 툴 ({(latestAssistantTools?.length ?? 0)}개)</div>
                             <div className="relative">
                               <button
                                 type="button"
                                 className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border shadow hover:bg-gray-50"
                                 onClick={(e) => {
                                   const parent = e.currentTarget.parentElement as HTMLElement;
                                   const container = parent?.querySelector('.tool-scroll') as HTMLElement | null;
                                   container?.scrollBy({ left: -320, behavior: 'smooth' });
                                 }}
                                 aria-label="왼쪽으로 이동"
                               >
                                 ‹
                               </button>
                               <div
                                 className="tool-scroll flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory"
                                 style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}
                               >
                                 {(latestAssistantTools ?? []).map((tool: any) => (
                                   <a
                                     key={`${tool.id}-persist`}
                                     href={(()=>{ try{ if(tool.domain){ return `/ai-tool/${String(tool.domain).toLowerCase()}`;} if(tool.id){ return `/ai-tool/${encodeURIComponent(String(tool.id))}`;} return '#'; }catch{ return '#'; } })()}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="group flex-shrink-0"
                                   >
                                     <div className="w-80 border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all bg-white snap-center">
                                       <div className="flex flex-col h-full">
                                         <div className="flex items-center gap-3 mb-3">
                                           <div className="flex-shrink-0">
                                             {resolveToolIcon(tool) ? (
                                               <img
                                                 src={(resolveToolIcon(tool) || '').startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(resolveToolIcon(tool))}` : resolveToolIcon(tool)}
                                                 alt={tool.name}
                                                 className="w-10 h-10 rounded-lg object-cover"
                                                 onError={(e) => {
                                                   (e.target as HTMLImageElement).style.display = 'none';
                                                   (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                 }}
                                               />
                                             ) : null}
                                             <div className="hidden w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                               {tool.name.charAt(0).toUpperCase()}
                                             </div>
                                           </div>
                                           <div className="flex-1 min-w-0">
                                             <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 text-sm">{tool.name}</h3>
                                             <div className="flex items-center gap-1 mt-1">
                                               <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                 tool.price === 'free' ? 'bg-green-100 text-green-700' :
                                                 tool.price === 'freemium' ? 'bg-blue-100 text-blue-700' :
                                                 'bg-gray-100 text-gray-700'
                                               }`}>
                                                 {tool.price === 'free' ? '무료' : tool.price === 'freemium' ? '무료+유료' : '유료'}
                                               </span>
                                               {tool.hasAPI && (
                                                 <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">API</span>
                                               )}
                                             </div>
                                           </div>
                                           <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                                         </div>
                                         <p className="text-sm text-gray-600 mb-3 flex-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                           {tool.description}
                                         </p>
                                         <div className="flex items-center gap-1">
                                           <div className="flex">
                                             {[...Array(5)].map((_, i) => (
                                               <Star key={i} className={`w-3 h-3 ${i < Math.floor(Number(tool.rating ?? 4)) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                                             ))}
                                           </div>
                                           <span className="text-xs text-gray-500 ml-1">{Number(tool.rating ?? 4).toFixed(1)}</span>
                                         </div>
                                       </div>
                                     </div>
                                   </a>
                                 ))}
                               </div>
                               <button
                                 type="button"
                                 className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border shadow hover:bg-gray-50"
                                 onClick={(e) => {
                                   const parent = e.currentTarget.parentElement as HTMLElement;
                                   const container = parent?.querySelector('.tool-scroll') as HTMLElement | null;
                                   container?.scrollBy({ left: 320, behavior: 'smooth' });
                                 }}
                                 aria-label="오른쪽으로 이동"
                               >
                                 ›
                               </button>
                             </div>
                           </div>
                        )}
                        <div
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`px-4 py-2 rounded-xl max-w-[70%] whitespace-pre-line text-sm md:text-base ${
                              msg.role === "user"
                                ? "bg-black text-white hover:bg-gray-800 transition-colors"
                                : "bg-gray-200 text-gray-900"
                            }`}
                          >
                            <div className="break-words message-content leading-relaxed">
                              {renderWithLinks(msg.content?.trim())}
                            </div>
                          </div>
                        </div>
                        
                        {/* AI 툴 추천 카드 렌더링 */}
                        {msg.role === "assistant" && msg.tools && msg.tools.length > 0 && !(index === messages.length - 1 && isSimpleQnA) && (
                          <div className="w-full max-w-[70%]">
                            <div className="text-sm text-gray-600 font-medium mb-3 ml-1">
                              추천 AI 툴 ({msg.tools.length}개)
                            </div>
                            {/* 가로 스크롤 + 네비게이션 버튼 컨테이너 */}
                            <div className="relative">
                              {/* 좌측 버튼 */}
                              <button
                                type="button"
                                className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border shadow hover:bg-gray-50"
                                onClick={(e) => {
                                  const parent = e.currentTarget.parentElement as HTMLElement;
                                  const container = parent?.querySelector('.tool-scroll') as HTMLElement | null;
                                  container?.scrollBy({ left: -320, behavior: 'smooth' });
                                }}
                                aria-label="왼쪽으로 이동"
                              >
                                ‹
                              </button>
                              <div 
                                className="tool-scroll flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x snap-mandatory"
                                style={{
                                  scrollBehavior: 'smooth',
                                  WebkitOverflowScrolling: 'touch'
                                }}
                              >
                                {msg.tools.map((tool) => (
                                  <a
                                    key={tool.id}
                                    href={(()=>{ try{ if(tool.domain){ return `/ai-tool/${String(tool.domain).toLowerCase()}`;} if(tool.id){ return `/ai-tool/${encodeURIComponent(String(tool.id))}`;} return '#'; }catch{ return '#'; } })()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group flex-shrink-0"
                                    onClick={async (e) => {
                                      // 상세 페이지로 이동, 딥링크 우선
                                      try {
                                        fetch('/api/analytics/events', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ type: 'tool_click', toolId: tool.id, toolName: tool.name })
                                        });
                                      } catch {}
                                    }}
                                  >
                                    <div className="w-80 border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all bg-white snap-center">
                                      <div className="flex flex-col h-full">
                                        {/* 아이콘/로고 영역 */}
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="flex-shrink-0">
                                            {resolveToolIcon(tool) ? (
                                              <img 
                                                src={(resolveToolIcon(tool) || '').startsWith('http') ? `/api/proxy-image?url=${encodeURIComponent(resolveToolIcon(tool))}` : resolveToolIcon(tool)}
                                                alt={tool.name}
                                                className="w-10 h-10 rounded-lg object-cover"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                              />
                                            ) : null}
                                            {/* 폴백 이니셜: 이미지가 실패할 경우 onError에서 hidden 제거 */}
                                            <div className="hidden w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                              {tool.name.charAt(0).toUpperCase()}
                                            </div>
                                          </div>
                                          
                                          <div className="flex-1 min-w-0">
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 text-sm">
                                              {tool.name}
                                            </h3>
                                            <div className="flex items-center gap-1 mt-1">
                                              <span className={`px-2 py-0.5 text-xs rounded-full ${
                                                tool.price === 'free' ? 'bg-green-100 text-green-700' :
                                                tool.price === 'freemium' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                              }`}>
                                                {tool.price === 'free' ? '무료' :
                                                 tool.price === 'freemium' ? '무료+유료' : '유료'}
                                              </span>
                                              {tool.hasAPI && (
                                                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                                                  API
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                                        </div>
                                        
                                        {/* 설명 */}
                                        <p className="text-sm text-gray-600 mb-3 flex-1 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as any }}>
                                          {tool.description}
                                        </p>
                                        
                                        {/* 사용 제한 */}
                                        {tool.usageLimit && (
                                          <p className="text-xs text-gray-500 mb-3">
                                            {tool.usageLimit}
                                          </p>
                                        )}
                                        
                                        {/* 태그와 평점 */}
                                        <div className="mt-auto">
                                          <div className="flex flex-wrap gap-1 mb-2">
                                            {(tool.features || []).slice(0, 3).map((feature, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                                              >
                                                {feature}
                                              </span>
                                            ))}
                                            {((tool.features || []).length > 3) && (
                                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                                +{(tool.features || []).length - 3}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-1">
                                            <div className="flex">
                                              {[...Array(5)].map((_, i) => (
                                                <Star
                                                  key={i}
                                                  className={`w-3 h-3 ${
                                                    i < Math.floor(Number(tool.rating ?? 4))
                                                      ? 'text-yellow-400 fill-current'
                                                      : 'text-gray-300'
                                                  }`}
                                                />
                                              ))}
                                            </div>
                                            <span className="text-xs text-gray-500 ml-1">
                                              {Number(tool.rating ?? 4).toFixed(1)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                ))}
                              </div>
                              {/* 노출 이벤트는 useEffect에서 안전하게 처리 */}
                              {/* 후속 질문 텍스트 - 말풍선 형태 (다중 카드일 때만 표시, 상세 질의는 숨김) */}
                              {msg.tools.length > 1 && !isDetailQnA && (
                                <div className="mt-3 flex">
                                  <div className="relative bg-gray-100 text-gray-700 text-sm px-3 py-2 rounded-xl max-w-full">
                                    어떤 AI가 더 궁금하세요? 이름을 알려주시면 더 자세히 안내해 드릴게요.
                                    <span className="absolute -top-2 left-4 w-0 h-0 border-l-8 border-l-transparent border-b-8 border-b-gray-100 border-r-8 border-r-transparent" />
                                  </div>
                                </div>
                              )}
                              
                              {/* 우측 버튼 */}
                              <button
                                type="button"
                                className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-7 h-7 rounded-full bg-white border shadow hover:bg-gray-50"
                                onClick={(e) => {
                                  const parent = e.currentTarget.parentElement as HTMLElement;
                                  const container = parent?.querySelector('.tool-scroll') as HTMLElement | null;
                                  container?.scrollBy({ left: 320, behavior: 'smooth' });
                                }}
                                aria-label="오른쪽으로 이동"
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        )}
                        {/* 최근 추천 툴 유지(중복/이동 이슈로 비활성화) */}

                        {/* 상세 모달 */}
                        {detailOpen && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                            <div className="bg-white rounded-2xl shadow-xl w-[92%] max-w-2xl p-6">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold text-gray-900">{detailTitle}</h3>
                                <button onClick={()=>setDetailOpen(false)} className="px-3 py-1 text-sm rounded-full bg-gray-100 hover:bg-gray-200">닫기</button>
                              </div>
                              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed" style={{maxHeight:'60vh', overflowY:'auto'}}>
                                {detailLoading ? '로딩 중...' : detailContent}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 슬롯 칩: PPT 의도 프레이밍이 있을 때 표시 */}
                        {msg.role === 'assistant' && msg.slotPrompt && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {msg.slotPrompt.options.map((opt, idx) => (
                              <button
                                key={idx}
                                onClick={()=>{
                                  if (opt.send.startsWith('__NAV__/')) {
                                    const path = opt.send.replace('__NAV__','');
                                    router.push(path);
                                  } else {
                                    handleSendWithMessage(opt.send);
                                  }
                                }}
                                className={`px-3 py-1 text-xs rounded-full border ${opt.send.startsWith('__NAV__/') ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' : 'bg-gray-100 hover:bg-gray-50'}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 로딩 중 표시 */}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="px-4 py-2 rounded-xl bg-gray-200 max-w-[70%]">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* 입력 영역 (메시지가 있을 때만 하단에 표시) */}
              {messages.length > 0 && (
                <div className="p-6 border-t border-gray-200">
                  {InputBox}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 