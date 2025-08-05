"use client";

import { useState, useRef, useEffect } from 'react';
import {
  Search, Keyboard, Mic, ScanSearch,
  Image as ImageIcon, Video, Wand2, Users
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from './components/Header';

import { useSession } from 'next-auth/react';



export default function Home() {
  // Hydration 문제 해결을 위한 mounted 상태
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    // AI 채팅 페이지로 이동하면서 검색어를 쿼리 파라미터로 전달
    router.push(`/ai-chat?message=${encodeURIComponent(searchQuery)}`);
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // 기능 버튼 클릭 핸들러
  const handleFeatureClick = (path: string) => {
    // 생산성 도구는 로그인 없이도 접근 가능
    if (path === '/productivity') {
      router.push(path);
      return;
    }
    
    // 다른 기능들은 로그인 필요
    if (!session) {
      // 로그인이 필요하다는 알림
      alert('이 기능을 사용하려면 로그인이 필요합니다.');
      router.push('/auth/signin');
      return;
    }
    router.push(path);
  };

  // 기능 버튼 목록
  const featureButtons = [
    { label: '이미지 생성', icon: <ImageIcon className="w-6 h-6 text-yellow-500" />, path: '/image-create' },
    { label: '영상 생성', icon: <Video className="w-6 h-6 text-purple-500" />, path: '/video-create' },
    { label: '생산성 도구', icon: <Wand2 className="w-6 h-6 text-blue-500" />, path: '/productivity' },
    { label: '커뮤니티', icon: <Users className="w-6 h-6 text-green-600" />, path: '/community' },
  ];



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
      <div className="flex">
        {/* 중앙 메인 영역 */}
        <div className="flex flex-col justify-between min-h-[100vh] bg-white transition-all duration-500 items-center w-full">
          {/* 메인 중앙 정렬: MOA 타이틀, 소제목, 입력창, 기능 버튼을 하나의 div로 묶음 */}
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
                  onClick={() => handleFeatureClick(btn.path)}
                >
                  {btn.icon}
                  <span className="mt-2 text-xs text-gray-800 font-medium">{btn.label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}