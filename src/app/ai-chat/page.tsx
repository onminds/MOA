"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Plus, MessageSquare, Settings } from "lucide-react";
import Header from '../components/Header';

type Message = { role: 'user' | 'assistant'; content: string };
type Conversation = { id: number; title: string; messages: Message[] };

export default function AIChat() {
  // 대화 목록 (샘플)
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 1, title: "새 대화", messages: [] },
  ]);
  const [currentConv, setCurrentConv] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 현재 대화 메시지
  const messages = conversations[currentConv].messages;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 새 대화 추가
  const handleNewChat = () => {
    setConversations([
      ...conversations,
      { id: Date.now(), title: `새 대화`, messages: [] }
    ]);
    setCurrentConv(conversations.length);
  };

  // 메시지 전송
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
      const assistantMsg: Message = { role: "assistant", content: data.response };
      newConvs[currentConv].messages = [
        ...newConvs[currentConv].messages,
        assistantMsg,
      ];
      setConversations([...newConvs]);
    } catch {
      const assistantMsg: Message = { role: "assistant", content: "오류가 발생했습니다. 다시 시도해 주세요." };
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
    <form
      onSubmit={handleSend}
      className="flex items-center border px-4 py-3 bg-white rounded-2xl shadow-md w-full max-w-xl mx-auto"
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
  );

  return (
    <>
      <Header />
      <div className="min-h-screen flex bg-white">
      {/* 왼쪽 네비게이션 */}
      <aside className="w-64 bg-white border-r flex flex-col h-screen p-4 hidden md:flex">
        <button
          className="flex items-center gap-2 px-4 py-2 mb-4 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
          onClick={handleNewChat}
        >
          <Plus className="w-5 h-5" /> 새 대화
        </button>
        <div className="flex-1 overflow-y-auto space-y-2">
          {conversations.map((conv, idx) => (
            <button
              key={conv.id}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-gray-100 transition-colors ${idx === currentConv ? 'bg-gray-200 font-bold' : ''}`}
              onClick={() => setCurrentConv(idx)}
            >
              <MessageSquare className="w-4 h-4 text-gray-500" />
              <span className="truncate">{conv.title}</span>
            </button>
          ))}
        </div>
        <button className="flex items-center gap-2 px-4 py-2 mt-4 text-gray-600 hover:bg-gray-100 rounded-lg">
          <Settings className="w-5 h-5" /> 설정
        </button>
      </aside>
      {/* 모바일 네비게이션(간단) */}
      <aside className="w-full flex md:hidden items-center justify-between px-4 py-2 bg-white border-b sticky top-0 z-10">
        <button onClick={handleNewChat} className="flex items-center gap-1 text-black font-semibold bg-black/0 hover:bg-gray-100 px-2 py-1 rounded">
          <Plus className="w-5 h-5" />새 대화</button>
        <span className="font-bold text-lg">MOA 챗</span>
        <button className="text-gray-600"><Settings className="w-5 h-5" /></button>
      </aside>
      {/* 오른쪽 대화창 */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-screen px-2 md:px-0">
        {/* 1. 메시지 없을 때: 중앙에 입력창만 */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center w-full h-full">
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 mb-8 text-center">무슨 작업을 하고 계세요?</h2>
            {InputBox}
          </div>
        ) : (
          // 2. 메시지 있을 때: 상단 메시지 리스트, 하단 입력창
          <div className="flex flex-col w-full h-full max-w-2xl mx-auto">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`px-4 py-2 rounded-xl max-w-[70%] whitespace-pre-line text-sm md:text-base ${
                      msg.role === "user"
                        ? "bg-black text-white hover:bg-gray-800 transition-colors"
                        : "bg-gray-200 text-gray-900"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="w-full pb-6 px-2 md:px-0">{InputBox}</div>
          </div>
        )}
      </main>
    </div>
    </>
  );
} 