"use client";

import React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  Search, Keyboard, Mic, ScanSearch,
  Image as ImageIcon, Video, Wand2, Users,
  Paperclip, Send, Grid,
  Sparkles, Palette, Camera, Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from './components/Header';
import OnboardingTour from '@/components/OnboardingTour';
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
  const [isInputFocused, setIsInputFocused] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { t, currentBackground } = useLanguage();
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 첫 로그인 사용자를 위한 온보딩 투어 표시
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (status === 'authenticated') {
      const done = localStorage.getItem('moa_onboarding_done_v1');
      const force = localStorage.getItem('moa_onboarding_force');
      if (!done || force === '1') {
        setTimeout(() => setIsTourOpen(true), 300);
      }
    }
  }, [status]);

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

  // 빠른 프롬프트 칩
  const quickPrompts = [
    '블로그 아이디어 3개 제안',
    'PPT 제작을 위한 AI 추천',
    '오늘의 점심 추천'
  ];

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
            
            {/* 새로운 입력창 - 강화된 UI */}
            <div className="w-full max-w-2xl mb-4 relative">
              {/* 1. 입력창 영역 (고정) */}
              <div className={`relative z-20 bg-white/90 backdrop-blur-sm border ${isInputFocused ? 'border-blue-300 ring-4 ring-blue-100' : 'border-gray-200'} shadow-xl p-4 transition-all duration-300 ${showFeatureIcons ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                <form onSubmit={handleSearch} className="flex flex-col justify-between min-h-[124px]">
                  {/* 상단: 빠른 프롬프트 칩 */}
                  <div className="mb-2 -mt-1 flex flex-wrap gap-2">
                    {quickPrompts.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSearchQuery(q)}
                        className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors border border-gray-200"
                        title="클릭하여 입력창에 넣기"
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* 중단: 입력 영역 */}
                  <div className="flex-1 mb-3 relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={handleSearchInput}
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      placeholder="메시지를 입력하세요..."
                      className="w-full bg-transparent outline-none text-gray-900 placeholder-gray-400 text-base pr-24"
                      data-tour="search-input"
                    />
                  </div>

                  {/* 하단: 보조 버튼 + 글자 수 + 전송 */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"></div>

                    <button type="submit" className="px-3 py-2 rounded-lg bg-black hover:bg-gray-800 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    </button>
                  </div>
                </form>
              </div>

              {/* 2. 확장되는 기능 아이콘 영역 (슬라이드 애니메이션) */}
              <div
                className={`absolute w-full top-full left-0 z-10 -mt-2 overflow-hidden transition-all duration-500 ${
                  showFeatureIcons ? 'max-h-[360px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2'
                }`}
                aria-hidden={!showFeatureIcons}
              >
                <div className={`bg-white border-x border-b border-gray-200 rounded-b-2xl shadow-lg px-4 pb-1 ${showFeatureIcons ? 'pt-8' : 'pt-0'}`}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full px-8">
                    {featureButtons.map((btn, index) => (
                      <button
                        key={btn.label}
                        className="group rounded-xl px-4 py-1 flex flex-col items-center text-center"
                        type="button"
                        onClick={() => handleFeatureClick(btn.path)}
                        data-tour={
                          btn.path === '/image-create' ? 'btn-image' :
                          btn.path === '/video-create' ? 'btn-video' :
                          btn.path === '/productivity' ? 'btn-productivity' :
                          btn.path === '/community' ? 'btn-community' : undefined
                        }
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
                      aria-expanded={showFeatureIcons}
                      aria-label="패널 토글"
                      className="w-10 h-10 relative flex items-center justify-center hover:scale-105 transition-transform duration-200 cursor-pointer"
                      data-tour="feature-toggle"
                    >
                      {/* 펼쳐진 상태: 위쪽 화살표 */}
                      <svg
                        className={`w-5 h-5 text-gray-600 transition-all duration-200 ${showFeatureIcons ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      {/* 접힌 상태: 아래쪽 화살표 */}
                      <svg
                        className={`w-5 h-5 text-gray-600 transition-all duration-200 absolute ${showFeatureIcons ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

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
      
      {/* 온보딩 투어 */}
      <OnboardingTour
        open={isTourOpen}
        onClose={() => {
          setIsTourOpen(false);
          if (typeof window !== 'undefined') {
            localStorage.setItem('moa_onboarding_done_v1', '1');
            localStorage.removeItem('moa_onboarding_force');
          }
        }}
        characterImageSrc="/MOA.ico"
        steps={[
          {
            selector: '[data-tour="search-input"]',
            title: 'AI 검색 시작',
            content: '여기에 원하는 작업을 자연어로 입력해 보세요. 예: "무료 이미지 생성 AI 추천"',
          },
          {
            selector: '[data-tour="hdr-logo"]',
            title: '상단바 - 로고',
            content: 'MOA 로고를 클릭하면 언제든지 홈으로 돌아올 수 있어요.',
          },
          {
            selector: '[data-tour="hdr-home"]',
            title: '상단바 - 홈',
            content: '홈으로 이동합니다. 검색/추천 시작점이에요.',
          },
          {
            selector: '[data-tour="hdr-ai-list"]',
            title: '상단바 - AI 목록',
            content: '카테고리/필터로 다양한 AI 도구를 탐색하세요.',
          },
          {
            selector: '[data-tour="hdr-usage"]',
            title: '상단바 - 사용량',
            content: '이미지/비디오/생산성 도구 사용량과 초기화 일정을 볼 수 있어요.',
          },
          {
            selector: '[data-tour="hdr-plan"]',
            title: '상단바 - 플랜',
            content: '요금제/혜택을 확인하고 업그레이드할 수 있어요.',
          },
          {
            selector: '[data-tour="hdr-community"]',
            title: '상단바 - 커뮤니티',
            content: '팁과 결과물을 공유하고 소통해요.',
          },
          {
            selector: '[data-tour="hdr-contact"]',
            title: '상단바 - 문의',
            content: '문제가 있거나 제안이 있다면 언제든지 문의해주세요.',
          },
          {
            selector: '[data-tour="hdr-profile"]',
            title: '상단바 - 프로필',
            content: '프로필/설정/로그아웃을 사용할 수 있어요.',
          },
          {
            selector: '[data-tour="feature-toggle"]',
            title: '기능 패널',
            content: '이 버튼으로 주요 기능 패널을 열고 닫을 수 있어요.',
          },
          {
            selector: '[data-tour="btn-image"]',
            title: '이미지 생성',
            content: '텍스트로 이미지를 생성할 수 있어요. 사용량 한도는 플랜에 따라 달라요.',
          },
          {
            selector: '[data-tour="btn-video"]',
            title: '비디오 생성',
            content: '문장을 입력하면 동영상을 만들어드립니다.',
          },
          {
            selector: '[data-tour="btn-productivity"]',
            title: '생산성 도구 모음',
            content: '보고서/자소서/코드 리뷰 등 업무 효율을 높이는 도구들을 모았어요.',
          },
          {
            selector: '[data-tour="btn-community"]',
            title: '커뮤니티',
            content: '유저들과 팁을 공유하고 영감을 얻어보세요.',
          },
        ]}
      />
    </>
  );
}