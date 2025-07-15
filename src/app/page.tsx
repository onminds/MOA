"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Search, Keyboard, Mic, ScanSearch,
  Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn, Menu,
  Image as ImageIcon, Video, Wand2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from './components/Header';

function ImageCreateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setTimeout(() => {
      setImageUrl("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80");
      setLoading(false);
    }, 1200);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative animate-fade-in">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold"
          onClick={onClose}
          aria-label="닫기"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-center">이미지 생성</h2>
        <div className="flex flex-col md:flex-row gap-8">
          {/* 입력 영역 */}
          <div className="flex-1 flex flex-col gap-4">
            <label className="font-semibold">이미지 설명 <span className="text-blue-500">*</span></label>
            <textarea
              className="w-full h-24 p-4 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none text-gray-900"
              placeholder="예) 우주를 여행하는 강아지 그려줘"
              maxLength={300}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              disabled={loading}
            />
            <div className="text-right text-xs text-gray-400">{prompt.length}/300</div>
            <label className="font-semibold mt-2">가로 세로 비율 <span className="text-blue-500">*</span></label>
            <div className="flex gap-4 mb-2">
              <button
                className={`flex-1 py-2 rounded-lg border ${ratio === "1:1" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-800 border-gray-200"}`}
                onClick={() => setRatio("1:1")}
                disabled={loading}
              >
                1:1
              </button>
              <button
                className={`flex-1 py-2 rounded-lg border ${ratio === "16:9" ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-800 border-gray-200"}`}
                onClick={() => setRatio("16:9")}
                disabled={loading}
              >
                16:9
              </button>
            </div>
            <button
              className="w-full py-3 mt-2 rounded-xl bg-blue-500 text-white font-bold text-lg shadow hover:bg-blue-600 transition-colors disabled:bg-gray-300"
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
            >
              {loading ? "이미지 생성 중..." : "이미지 제작"}
            </button>
          </div>
          {/* 결과 영역 */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <h3 className="text-base font-semibold mb-2">미리보기</h3>
            {imageUrl ? (
              <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col items-center">
                <img
                  src={imageUrl}
                  alt="생성된 이미지"
                  className="rounded-xl object-cover"
                  style={{ width: ratio === "1:1" ? 200 : 300, height: 200 }}
                />
              </div>
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-xl text-gray-400">
                미리보기
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type Message = { role: 'user' | 'assistant'; content: string };
type Conversation = { id: number; title: string; messages: Message[] };

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const [showImageModal, setShowImageModal] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setInput(searchQuery); // 검색창 입력값을 챗봇 input에 동기화
    setTimeout(() => {
      handleSend(); // 챗봇 질문 전송
      setChatStarted(true); // 채팅 시작 상태로 변경
    }, 0);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setInput(e.target.value);
  };

  const sideMenus = [
    { name: '홈', icon: <HomeIcon className="w-5 h-5 mr-2" />, href: '/' },
    { name: '검색', icon: <Search className="w-5 h-5 mr-2" />, href: '#' },
    { name: 'AI 목록', icon: <List className="w-5 h-5 mr-2" />, href: '#' },
    { name: '순위', icon: <BarChart className="w-5 h-5 mr-2" />, href: '#' },
    { name: '광고', icon: <Megaphone className="w-5 h-5 mr-2" />, href: '#' },
    { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5 mr-2" />, href: '#' },
    { name: '문의하기', icon: <MessageCircle className="w-5 h-5 mr-2" />, href: '#' },
    { name: '설정', icon: <Settings className="w-5 h-5 mr-2" />, href: '#' },
  ];

  // 기능 버튼 목록
  const featureButtons = [
    { label: 'AI 검색', icon: <Search className="w-6 h-6 text-blue-600" />, onClick: () => router.push('/ai-chat') },
    { label: '이미지 생성', icon: <ImageIcon className="w-6 h-6 text-yellow-500" />, onClick: () => router.push('/image-create') },
    { label: '영상 생성', icon: <Video className="w-6 h-6 text-purple-500" />, onClick: () => router.push('/video-create') },
    { label: '생산성 도구', icon: <Wand2 className="w-6 h-6 text-blue-500" />, onClick: () => router.push('/productivity') },
  ];

  // 챗봇 상태 및 로직 추가
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 1, title: '새 대화', messages: [] },
  ]);
  const [currentConv] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messages = conversations[currentConv].messages;
  const [chatStarted, setChatStarted] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    const newConvs = [...conversations];
    newConvs[currentConv].messages = [...newConvs[currentConv].messages, userMsg];
    setConversations(newConvs);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content }),
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

  return (
    <>
      <Header />
      <div className="min-h-screen bg-white">
        {/* 헤더 삭제됨 - 공통 Header만 사용 */}
        <div className="flex">
          {/* 왼쪽 배너 - 데스크탑 */}
          <aside className="w-64 bg-gray-50 min-h-screen p-6 flex-col justify-between hidden md:flex">
            <nav className="space-y-2">
              {sideMenus.map((menu) => (
                <a
                  key={menu.name}
                  href={menu.href}
                  className="flex items-center px-4 py-3 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors font-medium"
                >
                  {menu.icon}
                  {menu.name}
                </a>
              ))}
            </nav>
            <div className="mt-8">
              <button className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold">
                <LogIn className="w-5 h-5" /> 로그인
              </button>
            </div>
          </aside>

          {/* 왼쪽 배너 - 모바일 오버레이 */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 flex">
              {/* 오버레이 배경 */}
              <div
                className="fixed inset-0 bg-black bg-opacity-30"
                onClick={() => setSidebarOpen(false)}
                aria-label="사이드바 닫기"
              />
              {/* 사이드바 */}
              <aside className="relative w-72 bg-gray-50 min-h-screen p-6 border-r flex flex-col justify-between animate-slide-in-left shadow-xl">
                <nav className="space-y-2">
                  {sideMenus.map((menu) => (
                    <a
                      key={menu.name}
                      href={menu.href}
                      className="flex items-center px-4 py-3 rounded-lg text-gray-800 hover:bg-gray-200 transition-colors font-medium"
                    >
                      {menu.icon}
                      {menu.name}
                    </a>
                  ))}
                </nav>
                <div className="mt-8">
                  <button className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold">
                    <LogIn className="w-5 h-5" /> 로그인
                  </button>
                </div>
              </aside>
            </div>
          )}

          {/* 중앙 메인 영역 */}
          <div className="flex flex-col justify-between min-h-[100vh] bg-white transition-all duration-500 items-center w-full">
            {/* 메인(채팅 시작 전) 중앙 정렬: MOA 타이틀, 소제목, 입력창, 기능 버튼을 하나의 div로 묶음 */}
            {!chatStarted && (
              <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
                <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-4 text-center">MOA</h1>
                <p className="text-lg md:text-xl text-gray-500 mb-10 text-center">당신에게 맞는 AI를 찾아보세요</p>
                <form
                  onSubmit={handleSearch}
                  className="w-full max-w-2xl transition-all duration-500"
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <div className="flex items-center bg-white border border-gray-200 shadow-lg rounded-full px-6 py-3 focus-within:ring-2 focus-within:ring-blue-200 transition-all w-full">
                    <span className="text-gray-400 mr-4">
                      <Search className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchInput}
                      placeholder="무엇이든 물어보세요"
                      className="flex-1 bg-transparent outline-none text-lg text-gray-900 placeholder-gray-400"
                      disabled={loading || false}
                    />
                    <button type="button" className="ml-4 p-2 rounded-full hover:bg-gray-100 transition-colors" tabIndex={-1}>
                      <Keyboard className="w-5 h-5 text-gray-700" />
                    </button>
                    <button type="button" className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors" tabIndex={-1}>
                      <Mic className="w-5 h-5 text-gray-700" />
                    </button>
                    <button type="submit" className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="검색">
                      <ScanSearch className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                </form>
                <div className="flex flex-row flex-wrap gap-4 mt-8 justify-center w-full max-w-2xl">
                  {featureButtons.map((btn) => (
                    <button
                      key={btn.label}
                      className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm hover:bg-gray-100 transition-colors min-w-[90px]"
                      type="button"
                      onClick={btn.onClick}
                    >
                      {btn.icon}
                      <span className="mt-2 text-xs text-gray-800 font-medium">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {/* 메시지 리스트+입력창: chatStarted가 true일 때만, 하나의 div로 묶고 margin-top 적용 */}
            {chatStarted && (
              <div className="w-full max-w-2xl mx-auto mt-20 mb-0 flex flex-col flex-1">
                <div className="flex flex-col w-full max-w-2xl mx-auto flex-1">
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[200px] max-h-[60vh] bg-white">
                    {messages.map((msg) => (
                      <div
                        key={msg.content}
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
                </div>
                {/* 입력창: margin-bottom만 살짝 */}
                <form
                  onSubmit={handleSend}
                  className="w-full max-w-2xl transition-all duration-500 mb-8"
                  style={{ display: 'flex', justifyContent: 'center' }}
                >
                  <div className="flex items-center bg-white border border-gray-200 shadow-lg rounded-full px-6 py-3 focus-within:ring-2 focus-within:ring-blue-200 transition-all w-full">
                    <span className="text-gray-400 mr-4">
                      <Search className="w-5 h-5" />
                    </span>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="메시지를 입력하세요"
                      className="flex-1 bg-transparent outline-none text-lg text-gray-900 placeholder-gray-400"
                      disabled={loading || false}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) handleSend(e);
                      }}
                    />
                    <button type="button" className="ml-4 p-2 rounded-full hover:bg-gray-100 transition-colors" tabIndex={-1}>
                      <Keyboard className="w-5 h-5 text-gray-700" />
                    </button>
                    <button type="button" className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors" tabIndex={-1}>
                      <Mic className="w-5 h-5 text-gray-700" />
                    </button>
                    <button type="submit" className="ml-1 p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="검색">
                      <ScanSearch className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
