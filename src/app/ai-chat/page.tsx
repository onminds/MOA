"use client";
import { useState, useRef, useEffect } from "react";
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
  const [currentTier, setCurrentTier] = useState<{
    name: string;
    description: string;
    model: string;
  } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  // 현재 대화 메시지
  const messages = conversations[currentConv].messages;

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
    if (mounted) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, mounted]);

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
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message }),
      });
      const data = await res.json();
      
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
      if (useStreaming) {
        // 툴 추천/검색 의도가 강하면 스트리밍 대신 정식 추천 경로로 우회
        const isToolSearchQuery = (q: string) => {
          const s = q.toLowerCase();
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
        if (isToolSearchQuery(input)) {
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
            tools: data.tools,
            slotPrompt: data.slotPrompt
          };
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
          setLoading(false);
          return;
        }
        const newConvsStreaming = [...newConvs];
        newConvsStreaming[currentConv].messages = [
          ...newConvsStreaming[currentConv].messages,
          { role: 'assistant', content: '' }
        ];
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
          return isDocCreate || isVideoMake || isAudioMake || isCodeReview || isWebsiteBuild || isWebsiteAssist;
        })();
        if (shouldBypassStream) {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input })
          });
          const data = await res.json();
          const assistantMsg: Message = {
            role: 'assistant',
            content: data.response,
            tier: data.tier,
            premium: data.premium,
            authenticated: data.authenticated,
            tools: data.tools,
            slotPrompt: data.slotPrompt
          };
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
          setLoading(false);
          return;
        }

        const res = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input })
        });
        if (res.status === 409) {
          // 스트리밍 우회 신호: 플레이스홀더 제거 후 비스트리밍 경로로 재요청
          setConversations((prev) => {
            const next = [...prev];
            const msgs = [...next[currentConv].messages];
            const lastIdx = msgs.length - 1;
            if (lastIdx >= 0 && msgs[lastIdx].role === 'assistant' && (msgs[lastIdx].content || '') === '') {
              msgs.pop();
              next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            }
            return next as any;
          });
          const reroute = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: input })
          });
          const data = await reroute.json();
          setConversations((prev) => {
            const next = [...prev];
            const msgs = [...next[currentConv].messages];
            const assistantMsg: any = {
              role: 'assistant',
              content: data.response,
              tier: data.tier,
              premium: data.premium,
              authenticated: data.authenticated,
              tools: data.tools,
              slotPrompt: data.slotPrompt
            };
            msgs.push(assistantMsg);
            next[currentConv] = { ...(next[currentConv] as any), messages: msgs } as any;
            return next as any;
          });
          if (data.tier) {
            setCurrentTier(data.tier);
            setIsPremium(data.premium || false);
            setIsAuthenticated(data.authenticated || false);
          }
          setLoading(false);
          return;
        }
        // 항상 스트리밍을 우선 사용하고, 이후 카드만 별도로 붙임
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let done = false;
        const sanitizeStream = (t: string) => t
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');
        while (!done && reader) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = sanitizeStream(decoder.decode(value, { stream: true }));
            setConversations((prev) => {
              const next = [...prev];
              const msgs = [...next[currentConv].messages];
              const lastIdx = msgs.length - 1;
              const last = msgs[lastIdx] as Message;
              msgs[lastIdx] = { ...last, content: (last.content || '') + chunk };
              next[currentConv] = { ...next[currentConv], messages: msgs } as any;
              return next as any;
            });
          }
        }
        // 스트리밍 종료 후: 툴 검색 의도일 때만 카드 요청
        if (isToolSearchQuery(input)) {
          try {
            const toolsRes = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: input, toolsOnly: true })
            });
            const toolsData = await toolsRes.json();
            if (toolsData?.tools?.length) {
              const convs = [...newConvsStreaming];
              const lastIdx = convs[currentConv].messages.length - 1;
              convs[currentConv].messages[lastIdx] = {
                ...convs[currentConv].messages[lastIdx],
                tools: toolsData.tools
              } as Message;
              setConversations(convs);
            }
          } catch (e) {
            console.error('toolsOnly fetch failed', e);
          }
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
              <div className="flex items-center space-x-2">
                <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                  <Settings className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* 채팅 영역 */}
            <div className="flex-1 flex flex-col">
              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto p-6">
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
                              {msg.content}
                            </div>
                          </div>
                        </div>
                        
                        {/* AI 툴 추천 카드 렌더링 */}
                        {msg.role === "assistant" && msg.tools && msg.tools.length > 0 && (
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
                                    href={`/ai-tool/${encodeURIComponent(tool.domain || tool.serviceId || tool.id)}`}
                                    target="_blank"
                                    rel="nofollow noopener noreferrer"
                                    className="group flex-shrink-0"
                                    onClick={(e) => {
                                      try {
                                        fetch('/api/analytics/events', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            type: 'tool_click',
                                            toolId: tool.id,
                                            toolName: tool.name
                                          })
                                        });
                                      } catch {}
                                    }}
                                  >
                                    <div className="w-80 border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-lg transition-all bg-white snap-center">
                                      <div className="flex flex-col h-full">
                                        {/* 아이콘/로고 영역 */}
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="flex-shrink-0">
                                            {tool.imageUrl ? (
                                              <img 
                                                src={tool.imageUrl} 
                                                alt={tool.name}
                                                className="w-10 h-10 rounded-lg object-cover"
                                                onError={(e) => {
                                                  (e.target as HTMLImageElement).style.display = 'none';
                                                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                                }}
                                              />
                                            ) : null}
                                            <div className={`${tool.imageUrl ? 'hidden' : ''} w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm`}>
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
                                        <p className="text-sm text-gray-600 mb-3 flex-1">
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
                                            {tool.features.slice(0, 3).map((feature, idx) => (
                                              <span
                                                key={idx}
                                                className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
                                              >
                                                {feature}
                                              </span>
                                            ))}
                                            {tool.features.length > 3 && (
                                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                                +{tool.features.length - 3}
                                              </span>
                                            )}
                                          </div>
                                          
                                          <div className="flex items-center gap-1">
                                            <div className="flex">
                                              {[...Array(5)].map((_, i) => (
                                                <Star
                                                  key={i}
                                                  className={`w-3 h-3 ${
                                                    i < Math.floor(Number(tool.rating ?? 0))
                                                      ? 'text-yellow-400 fill-current'
                                                      : 'text-gray-300'
                                                  }`}
                                                />
                                              ))}
                                            </div>
                                            <span className="text-xs text-gray-500 ml-1">
                                              {Number(tool.rating ?? 0).toFixed(1)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </a>
                                ))}
                              </div>
                              {/* 노출 이벤트 (최초 렌더 시 1회 기록) */}
                              <script dangerouslySetInnerHTML={{ __html: `
                                (function(){
                                  try{
                                    if(!window.__moa_imp_logged){
                                      window.__moa_imp_logged = true;
                                      fetch('/api/analytics/events', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({type:'tool_impression'})});
                                    }
                                  }catch(e){}
                                })();
                              `}} />
                              {/* 후속 질문 텍스트 - 말풍선 형태 */}
                              <div className="mt-3 flex">
                                <div className="relative bg-gray-100 text-gray-700 text-sm px-3 py-2 rounded-xl max-w-full">
                                  어떤 AI가 더 궁금하세요? 이름을 알려주시면 더 자세히 안내해 드릴게요.
                                  <span className="absolute -top-2 left-4 w-0 h-0 border-l-8 border-l-transparent border-b-8 border-b-gray-100 border-r-8 border-r-transparent" />
                                </div>
                              </div>
                              
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