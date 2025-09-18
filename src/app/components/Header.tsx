"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Settings, User, LogOut, Crown, Star, Zap, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useLanguage } from '@/contexts/LanguageContext';
import { createPortal } from 'react-dom';
import { cachedFetchJson } from '@/lib/client-utils';

interface PlanInfo {
  planType: string;
  planInfo: {
    name: string;
    displayName: string;
    color: string;
    features: string[];
  };
}

interface HeaderProps {
  forceWhiteBackground?: boolean;
}

export default function Header({ forceWhiteBackground = false }: HeaderProps) {
  const router = useRouter();
  const { t, currentBackground } = useLanguage();

  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [planCache, setPlanCache] = useState<Map<string, PlanInfo>>(new Map());
  const [lastPlanFetch, setLastPlanFetch] = useState<number>(0);
  const PLAN_CACHE_DURATION = 5 * 60 * 1000; // 5분 캐시
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 클라이언트 사이드에서만 배경 설정 확인
  const [clientBackground, setClientBackground] = useState('default');
  
  useEffect(() => {
    if (mounted) {
      const savedBackground = localStorage.getItem('selectedBackground');
      if (savedBackground) {
        setClientBackground(savedBackground);
      } else {
        setClientBackground(currentBackground);
      }
    }
  }, [mounted, currentBackground]);

  useEffect(() => {
    if (session?.user?.email) {
      // 세션에서 캐시된 플랜 정보 확인
      const cachedPlan = planCache.get(session.user.email);
      const now = Date.now();
      
      if (cachedPlan && (now - lastPlanFetch) < PLAN_CACHE_DURATION) {
        // 캐시된 정보가 유효하면 사용
        setPlanInfo(cachedPlan);
        setPlanLoading(false);
      } else {
        // 캐시가 없거나 만료되었으면 새로 가져오기
        fetchPlanInfo();
      }
    }
  }, [session, planCache, lastPlanFetch]);

  // 스마트 폴링: 페이지 포커스, 결제 완료, 백그라운드 체크
  useEffect(() => {
    const handleFocus = () => {
      if (session?.user?.email) {
        const now = Date.now();
        // 포커스 시 캐시가 만료되었으면 새로 가져오기
        if ((now - lastPlanFetch) >= PLAN_CACHE_DURATION) {
          fetchPlanInfo();
        }
      }
    };

    const handlePlanUpdated = () => {
      if (session?.user?.email) {
        // 결제 완료 시 즉시 새로고침 (캐시 무시)
        fetchPlanInfo(true);
      }
    };

    // 백그라운드 체크 (5분마다)
    const interval = setInterval(() => {
      if (session?.user?.email) {
        const now = Date.now();
        // 백그라운드에서도 캐시가 만료되었을 때만 체크
        if ((now - lastPlanFetch) >= PLAN_CACHE_DURATION) {
          fetchPlanInfo();
        }
      }
    }, 5 * 60 * 1000); // 5분마다

    window.addEventListener('focus', handleFocus);
    window.addEventListener('planUpdated', handlePlanUpdated);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('planUpdated', handlePlanUpdated);
      clearInterval(interval);
    };
  }, [session, lastPlanFetch]);

  const fetchPlanInfo = async (forceRefresh = false) => {
    const userEmail = session?.user?.email;
    if (!userEmail) return;

    // 강제 새로고침이 아니고 캐시가 유효하면 API 호출하지 않음
    if (!forceRefresh) {
      const cachedPlan = planCache.get(userEmail);
      const now = Date.now();
      if (cachedPlan && (now - lastPlanFetch) < PLAN_CACHE_DURATION) {
        return;
      }
    }

    setPlanLoading(true);
    try {
      const data = await cachedFetchJson('/api/user/plan', `plan-${userEmail}`, {}, 0);
      setPlanInfo(data);
      setPlanCache(prev => new Map(prev).set(userEmail, data));
      setLastPlanFetch(Date.now());
    } catch (error) {
      console.error('플랜 정보 로딩 실패:', error);
    } finally {
      setPlanLoading(false);
    }
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' });
  };

  const getProfileImage = () => {
    if (session?.user?.image) {
      return session.user.image;
    }
    return null;
  };

  const getInitials = () => {
    if (session?.user?.name) {
      return session.user.name.charAt(0).toUpperCase();
    }
    if (session?.user?.email) {
      return session.user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'basic':
        return <Shield className="w-3 h-3" />;
      case 'standard':
        return <Zap className="w-3 h-3" />;
      case 'pro':
        return <Crown className="w-3 h-3" />;
      default:
        return <Shield className="w-3 h-3" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'basic':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'standard':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'pro':
        return 'bg-purple-100 text-purple-700 border-purple-300';
      default:
        return 'bg-blue-100 text-blue-700 border-blue-300';
    }
  };

  // 배경에 따른 드롭다운 스타일 결정
  const isCustomBackground = !forceWhiteBackground;
  const isSpaceBackground = clientBackground === 'space' && !forceWhiteBackground;
  const isNatureBackground = clientBackground === 'nature' && !forceWhiteBackground;
  const isGeometricBackground = clientBackground === 'geometric' && !forceWhiteBackground;
  

  
  const dropdownClasses = isCustomBackground 
    ? 'bg-white/90 backdrop-blur-md border border-white/20 shadow-lg' 
    : 'bg-white border border-gray-200 shadow-lg';

  // 배경에 따른 텍스트 색상 결정
  const textColor = isSpaceBackground ? 'text-white' : 'text-gray-700';
  const hoverColor = isSpaceBackground ? 'hover:text-gray-200' : 'hover:text-gray-900';
  const logoColor = isSpaceBackground ? 'text-white' : 'text-gray-900';

  const handleDropdownToggle = (event: React.MouseEvent) => {
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    
    setDropdownPosition({
      top: rect.bottom + window.scrollY,
      left: rect.right - 192 // w-48 = 192px
    });
    
    setShowDropdown(!showDropdown);
  };

  return (
    <header className={`shadow-lg border-b transition-all duration-300 ${
      isCustomBackground 
        ? 'aero-glass' 
        : 'bg-white border-gray-200'
    }`} style={{
      ...(isCustomBackground && {
        background: 'rgba(255, 255, 255, 0.25) !important',
        backdropFilter: 'blur(8px) !important',
        WebkitBackdropFilter: 'blur(8px) !important',
        border: '1px solid rgba(255, 255, 255, 0.3) !important',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 1px 0 rgba(255, 255, 255, 0.2) !important',
        zIndex: 1000
      })
    }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div
              className="flex items-center cursor-pointer"
              onClick={() => router.push('/')}
              data-tour="hdr-logo"
            >
              <Image
                src="/images/Moa_Logo.png"
                alt="MOA 로고"
                width={32}
                height={32}
                className="w-8 h-8 mr-2"
              />
              <span className={`text-2xl font-bold ${logoColor}`}>
                MOA
              </span>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className={`${textColor} ${hoverColor}`} data-tour="hdr-home">{t('home')}</Link>
            <Link href="/ai-list" className={`${textColor} ${hoverColor}`} data-tour="hdr-ai-list">{t('ai_list') || 'AI 목록'}</Link>
            <Link href="/usage" className={`${textColor} ${hoverColor}`} data-tour="hdr-usage">{t('usage')}</Link>
            <Link href="/plan" className={`${textColor} ${hoverColor}`} data-tour="hdr-plan">{t('plan') || '플랜'}</Link>
            <Link href="/community" className={`${textColor} ${hoverColor}`} data-tour="hdr-community">{t('community')}</Link>
            <Link href="/contact" className={`${textColor} ${hoverColor}`} data-tour="hdr-contact">{t('contact') || '문의하기'}</Link>
          </nav>
          <div className="flex items-center space-x-4">
            {!mounted ? (
              <div className={textColor}>{t('loading')}</div>
            ) : status === "loading" ? (
              <div className={textColor}>{t('loading')}</div>
            ) : session ? (
              <div className="flex items-center space-x-4">
                {/* 관리자 버튼들 */}
                {session.user?.role === 'ADMIN' && (
                  <div className="flex items-center space-x-2">
                    <Link 
                      href="/admin"
                      className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors flex items-center gap-1"
                    >
                      <Settings className="w-3 h-3" />
                      {t('admin') || '관리자'}
                    </Link>
                    <Link 
                      href="/admin/reports"
                      className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      신고 관리
                    </Link>
                  </div>
                )}
                
                {/* 플랜 표시 */}
                {planLoading || !planInfo ? (
                  <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded-full border border-gray-200 bg-gray-100 min-w-[80px] h-[28px]">
                    <div className="w-3 h-3 bg-gray-300 rounded-full animate-pulse"></div>
                    <div className="w-12 h-3 bg-gray-300 rounded animate-pulse"></div>
                  </div>
                ) : (
                  <div
                    className={`hidden sm:flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${getPlanColor(planInfo.planType)} min-w-[80px] h-[28px]`}
                    data-tour="hdr-plan-badge"
                  >
                    {getPlanIcon(planInfo.planType)}
                    <span>{planInfo.planInfo.displayName}</span>
                  </div>
                )}
                
                {/* 프로필 드롭다운 */}
                <div className="relative" data-tour="hdr-profile">
                  <button
                    onClick={handleDropdownToggle}
                    className={`flex items-center space-x-2 p-2 rounded-lg transition-colors border ${
                      isCustomBackground 
                        ? 'border-white/50 hover:border-white/70 bg-white/20 hover:bg-white/30' 
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="relative">
                      {getProfileImage() ? (
                        <Image
                          src={getProfileImage()!}
                          alt="프로필"
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 font-semibold text-sm">
                          {getInitials()}
                        </div>
                      )}
                    </div>
                    <span className={`hidden sm:block text-sm ${textColor}`}>
                      {session.user?.name || session.user?.email}
                    </span>
                    <ChevronDown className={`w-4 h-4 ${isSpaceBackground ? 'text-gray-300' : 'text-gray-500'}`} />
                  </button>

                  {/* Portal을 사용한 드롭다운 메뉴 */}
                  {showDropdown && mounted && createPortal(
                    <div 
                      className={`fixed w-48 rounded-lg py-2 z-[99999] ${dropdownClasses}`}
                      style={{
                        top: dropdownPosition.top,
                        left: dropdownPosition.left
                      }}
                    >
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {session.user?.name || t('user') || '사용자'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.user?.email}
                        </div>
                      </div>
                      
                      <Link
                        href="/settings"
                        className={`flex items-center px-4 py-2 text-sm text-gray-700 transition-colors ${
                          isCustomBackground 
                            ? 'hover:bg-white/50' 
                            : 'hover:bg-gray-100'
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          setShowDropdown(false);
                          setTimeout(() => {
                            router.push('/settings');
                          }, 100);
                        }}
                      >
                        <User className="w-4 h-4 mr-2" />
                        {t('profile_settings')}
                      </Link>
                      
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          handleSignOut();
                        }}
                        className={`flex items-center w-full px-4 py-2 text-sm text-gray-700 transition-colors ${
                          isCustomBackground 
                            ? 'hover:bg-white/50' 
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        {t('logout')}
                      </button>
                    </div>,
                    document.body
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link 
                  href="/auth/signin"
                  className="bg-white text-black px-4 py-2 rounded border border-black hover:bg-gray-50 transition-colors"
                >
                  {t('login')}
                </Link>
                <Link 
                  href="/auth/signup"
                  className="bg-black text-white px-4 py-2 rounded border border-white hover:bg-gray-800 transition-colors"
                >
                  {t('signup')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Portal을 사용한 드롭다운 외부 클릭 시 닫기 */}
      {showDropdown && mounted && createPortal(
        <div 
          className="fixed inset-0 z-[99998]" 
          onClick={() => setShowDropdown(false)}
        />,
        document.body
      )}
    </header>
  );
} 