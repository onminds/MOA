"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Plus, MessageSquare, Settings, Crown, Star, Zap } from "lucide-react";
import Header from '../components/Header';


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
  const [currentTier, setCurrentTier] = useState<{
    name: string;
    description: string;
    model: string;
  } | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        authenticated: data.authenticated
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
        authenticated: data.authenticated
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
                    {InputBox}
                  </div>
                ) : (
                  <div className="space-y-4 max-w-4xl mx-auto">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`px-4 py-2 rounded-xl max-w-[70%] whitespace-pre-line text-sm md:text-base ${
                            msg.role === "user"
                              ? "bg-black text-white hover:bg-gray-800 transition-colors"
                              : "bg-gray-200 text-gray-900"
                          }`}
                          style={{ wordBreak: 'break-word' }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
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