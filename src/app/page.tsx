"use client";

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Search, Keyboard, Mic, ScanSearch,
  Image as ImageIcon, Video, Wand2, Users,
  Paperclip, Send, Grid, MessageCircle,
  Sparkles, Palette, Camera, Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from './components/Header';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSession } from 'next-auth/react';

// 애니메이션을 위한 CSS 스타일
const animationStyles = `
  @keyframes slideInFromTop {
    from {
      transform: translateY(-100%);
    }
    to {
      transform: translateY(0);
    }
  }
  
  @keyframes slideInFromLeft {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(0);
    }
  }
  
  .animate-slide-in-top {
    animation: slideInFromTop 0.6s ease-out forwards;
  }
  
  .animate-slide-in-left {
    animation: slideInFromLeft 0.5s ease-out forwards;
  }
  
  .feature-card {
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.5s ease-out;
  }
  
  .feature-card.show {
    opacity: 1;
    transform: translateY(0);
  }
`;

export default function Home() {
  // Hydration 문제 해결을 위한 mounted 상태
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFeatureIcons, setShowFeatureIcons] = useState(true);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, currentBackground } = useLanguage();

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

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const toggleFeatureIcons = () => {
    setShowFeatureIcons(!showFeatureIcons);
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
      alert(t('login_required') || '이 기능을 사용하려면 로그인이 필요합니다.');
      router.push('/auth/signin');
      return;
    }
    router.push(path);
  };

  // 드롭다운용 아이콘 데이터
  const dropdownIcons = [
    { 
      icon: (
        <img 
          src="/images/image-gen.jpg" 
          alt="이미지 생성" 
          className="w-6 h-6 object-contain"
        />
      ), 
      path: '/image-create',
      tooltip: '이미지 생성'
    },
    { 
      icon: (
        <img 
          src="/images/video-gen.mp4" 
          alt="비디오 생성" 
          className="w-6 h-6 object-contain"
        />
      ), 
      path: '/video-create',
      tooltip: '비디오 생성'
    },
    { 
      icon: (
        <img 
          src="/images/productivity.png" 
          alt="생산성 도구" 
          className="w-6 h-6 object-contain"
        />
      ), 
      path: '/productivity',
      tooltip: '생산성 도구'
    },
    { 
      icon: (
        <img 
          src="/images/community.jpg" 
          alt="커뮤니티" 
          className="w-6 h-6 object-contain"
        />
      ), 
      path: '/community',
      tooltip: '커뮤니티'
    },
  ];

  // 기능 버튼 목록 - 업그레이드된 디자인
  const featureButtons = [
    { 
      label: t('feature_image_generation') || '이미지 생성', 
      icon: (
        <div className="w-12 h-10 flex items-center justify-center bg-white rounded">
          <img 
            src="/images/image-gen.jpg" 
            alt="이미지 생성" 
            className="w-full h-full object-contain p-1"
          />
        </div>
      ), 
      path: '/image-create',
      description: 'AI로 창의적인 이미지 생성'
    },
    { 
      label: t('feature_video_generation') || '비디오 생성', 
      icon: (
        <div className="w-12 h-10 flex items-center justify-center bg-white rounded">
          <img 
            src="/images/video-gen.mp4" 
            alt="비디오 생성" 
            className="w-full h-full object-contain p-1"
          />
        </div>
      ), 
      path: '/video-create',
      description: '텍스트로 동영상 제작'
    },
    { 
      label: t('feature_productivity') || '생산성 도구', 
      icon: (
        <div className="w-12 h-10 flex items-center justify-center bg-white rounded">
          <img 
            src="/images/productivity.png" 
            alt="생산성 도구" 
            className="w-full h-full object-contain p-1"
          />
        </div>
      ), 
      path: '/productivity',
      description: '업무 효율성 향상 도구'
    },
    { 
      label: t('feature_community') || '커뮤니티', 
      icon: (
        <div className="w-12 h-10 flex items-center justify-center bg-white rounded">
          <img 
            src="/images/community.jpg" 
            alt="커뮤니티" 
            className="w-full h-full object-contain p-1"
          />
        </div>
      ), 
      path: '/community',
      description: '사용자들과 소통하고 공유'
    },
  ];

  // 컴포넌트가 마운트되기 전까지는 로딩 표시
  if (!mounted) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('loading')}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style jsx>{animationStyles}</style>
      <Header />
      <div className="flex flex-col min-h-screen">
        {/* 중앙 메인 영역 */}
        <div className="flex flex-col justify-between flex-1 items-center w-full">
          {/* 메인 중앙 정렬: MOA 타이틀, 소제목, 입력창, 기능 버튼을 하나의 div로 묶음 */}
          <div className="flex flex-col items-center justify-center min-h-[80vh] w-full">
            <h1 
              className={`text-5xl md:text-6xl font-extrabold mb-4 text-center ${
                currentBackground === 'default' ? 'text-gray-900' : 'text-white'
              }`}
              style={
                currentBackground === 'nature' 
                  ? { 
                      textShadow: '4px 4px 8px rgba(0,0,0,0.95), 0 0 30px rgba(0,0,0,0.9), 0 0 50px rgba(0,0,0,0.7)'
                    }
                  : currentBackground === 'space' || currentBackground === 'geometric'
                  ? { filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))' }
                  : {}
              }
            >MOA</h1>
            <p 
              className={`text-lg md:text-xl text-center font-medium mb-10 ${
                currentBackground === 'default' ? 'text-gray-500' : 'text-white'
              }`}
              style={
                currentBackground === 'nature' 
                  ? { 
                      textShadow: '3px 3px 6px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.8), 0 0 35px rgba(0,0,0,0.6)'
                    }
                  : currentBackground === 'space' || currentBackground === 'geometric'
                  ? { filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.7))' }
                  : {}
              }
            >{t('search_subtitle') || '당신에게 맞는 AI를 찾아보세요'}</p>
            
            {/* 새로운 입력창 - 이미지와 같은 느낌 */}
            <div className="w-full max-w-2xl mb-4 relative">
              {/* 1. 입력창 영역 (고정) */}
              <div className={`relative z-20 bg-white border border-gray-200 shadow-lg p-4 transition-all duration-300 ${showFeatureIcons ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                <form onSubmit={handleSearch} className="flex flex-col justify-between min-h-[104px]">
                  {/* 상단 입력 영역 */}
                  <div className="flex-1 mb-3 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchInput}
                      placeholder="메시지를 입력하세요..."
                      className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base pr-12"
                    />
                    <button type="button" className="absolute top-0 right-0 p-2 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="w-5 h-5 text-gray-500 flex items-center justify-center">
                        <span className="text-xl font-bold">+</span>
                      </div>
                    </button>
                  </div>
                  {/* 하단 버튼 영역 */}
                  <div className="flex items-center justify-between">
                    <button type="button" className="flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                      <span className="text-sm text-gray-700">GPT-4o</span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button type="submit" className="p-2 rounded-lg bg-black hover:bg-gray-800 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. 확장되는 기능 아이콘 영역 */}
              {showFeatureIcons && (
                <div className="absolute w-full top-full left-0 z-10 -mt-2">
                  <div className="bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-lg px-4 pt-8 pb-1">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full px-8">
                      {featureButtons.map((btn, index) => (
                        <button
                          key={btn.label}
                          className="group rounded-xl px-4 py-1 flex flex-col items-center text-center"
                          type="button"
                          onClick={() => handleFeatureClick(btn.path)}
                        >
                          <div className="mb-3 flex justify-center">{btn.icon}</div>
                          <h3 className="font-bold text-gray-800 text-sm group-hover:text-gray-900 transition-colors">
                            {btn.label}
                          </h3>
                        </button>
                      ))}
                    </div>
                    {/* 올리기 아이콘 */}
                    <div className="flex justify-center mt-2">
                      <button
                        onClick={toggleFeatureIcons}
                        className="w-10 h-10 flex items-center justify-center hover:scale-110 transition-transform duration-200 cursor-pointer"
                      >
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. 기능 바로가기 버튼 (확장 토글) */}
              {!showFeatureIcons && (
                <div 
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 cursor-pointer"
                  onClick={toggleFeatureIcons}
                >
                  <div className="bg-white border border-gray-200 rounded-full shadow-lg p-2 hover:bg-gray-50 transition-colors">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* 기존 검색창 (숨김 처리) */}
            <form
              onSubmit={handleSearch}
              className="w-full max-w-2xl transition-all duration-500 hidden"
              style={{ display: 'none' }}
            >
              <div className="flex items-center bg-white border border-gray-200 shadow-lg rounded-full px-6 py-3 focus-within:ring-2 focus-within:ring-blue-200 transition-all w-full">
                <span className="text-gray-400 mr-4">
                  <Search className="w-5 h-5" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchInput}
                  placeholder={t('search_placeholder')}
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

            {/* 업그레이드된 기능 버튼들 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 w-full max-w-lg px-4 hidden">
              {featureButtons.map((btn, index) => (
                <button
                  key={btn.label}
                  className="group bg-white border border-gray-200 rounded-xl px-2 py-3 hover:shadow-lg transition-all duration-300 hover:scale-105 flex flex-col items-center text-center"
                  type="button"
                  onClick={() => handleFeatureClick(btn.path)}
                >
                  {/* 아이콘 */}
                  <div className="mb-2 flex justify-center">
                    {btn.icon}
                  </div>
                  
                  {/* 라벨 */}
                  <h3 className="font-bold text-gray-800 text-xs group-hover:text-gray-900 transition-colors">
                    {btn.label}
                  </h3>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 우측 플로팅 버튼들 */}
        <div className="fixed right-6 top-1/2 transform -translate-y-1/2 space-y-4 z-10">
          <button className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <Grid className="w-6 h-6 text-gray-700" />
          </button>
          <button className="w-12 h-12 bg-purple-500 rounded-full shadow-lg flex items-center justify-center hover:bg-purple-600 transition-colors">
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="bg-black text-white py-8 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* 회사 정보 */}
            <div className="space-y-4 lg:col-span-2">
              <h3 className="text-xl font-bold text-white">MOA</h3>
              <div className="space-y-2 text-sm text-white">
                <p>주식회사 온마인즈</p>
                <p>대표이사 : 오명훈</p>
                <p>사업자등록번호 : 452-88-03583</p>
                <p>사업장주소 : 수원시 통달구 갓매산로 51, 6층</p>
                <p>010-7451-4477 company@onminds.net</p>
              </div>
            </div>

            {/* 서비스 링크 */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-white">서비스</h4>
              <div className="space-y-2 text-sm text-white">
                <a href="/terms" className="block hover:text-gray-300 transition-colors">서비스약관</a>
                <a href="/privacy" className="block hover:text-gray-300 transition-colors">개인정보처리방침</a>
                <a href="/refund-policy" className="block hover:text-gray-300 transition-colors">환불 규정</a>
                <a href="/settings" className="block hover:text-gray-300 transition-colors">회원 탈퇴</a>
              </div>
            </div>

            {/* 빈 공간 (레이아웃 균형을 위해) */}
            <div></div>
          </div>

          {/* 저작권 정보 */}
          <div className="mt-8 pt-6 text-center">
            <p className="text-sm text-gray-300">
              Copyright © Onminds  All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}