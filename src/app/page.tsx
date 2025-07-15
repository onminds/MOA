'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Search, Keyboard, Mic, ScanSearch, Star,
  Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings, LogIn, Menu,
  Image as ImageIcon, Video, Wand2, Heart, Percent, Palmtree, PhoneCall
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type Message = { role: 'user' | 'assistant'; content: string };
type Conversation = { id: number; title: string; messages: Message[] };

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();

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
    { label: '이미지 생성', icon: <ImageIcon className="w-6 h-6 text-yellow-500" /> },
    { label: '영상 생성', icon: <Video className="w-6 h-6 text-purple-500" /> },
    { label: '생산성 도구', icon: <Wand2 className="w-6 h-6 text-blue-500" /> },
  ];

  // 챗봇 상태 및 로직 추가
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: 1, title: '새 대화', messages: [] },
  ]);
  const [currentConv, setCurrentConv] = useState(0);
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
    } catch (err) {
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

  const InputBox = (
    <form
      onSubmit={handleSend}
      className="flex items-center border px-4 py-3 bg-white rounded-2xl shadow-md w-full max-w-xl mx-auto mt-4"
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
        <Search className="w-5 h-5" />
      </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              {/* 햄버거 메뉴 (모바일) */}
              <button
                className="mr-3 md:hidden p-2 rounded hover:bg-gray-100"
                onClick={() => setSidebarOpen(true)}
                aria-label="사이드바 열기"
              >
                <Menu className="w-6 h-6" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900">MOA</h1>
            </div>
            <nav className="hidden md:flex space-x-8">
              <a href="#" className="text-gray-700 hover:text-gray-900">홈</a>
              <a href="#" className="text-gray-700 hover:text-gray-900">AI 목록</a>
              <a href="#" className="text-gray-700 hover:text-gray-900">추천</a>
              <a href="#" className="text-gray-700 hover:text-gray-900">커뮤니티</a>
            </nav>
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900">로그인</button>
              <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
                회원가입
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 왼쪽 배너 - 데스크탑 */}
        <aside className="hidden md:flex w-72 bg-gray-50 min-h-screen p-6 border-r flex-col justify-between">
          <nav className="space-y-2">
            {sideMenus.map((menu, idx) => (
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
                {sideMenus.map((menu, idx) => (
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
                    disabled={loading}
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
                {featureButtons.map((btn, idx) => (
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
                    disabled={loading}
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
  );
}

// tailwind.config.js에 아래 애니메이션 추가 필요
// animation: {
//   'slide-in-left': 'slide-in-left 0.3s ease-out',
// },
// keyframes: {
//   'slide-in-left': {
//     '0%': { transform: 'translateX(-100%)' },
//     '100%': { transform: 'translateX(0)' },
//   },
// },
