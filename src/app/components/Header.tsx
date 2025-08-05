"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Settings, User, LogOut, Crown, Star, Zap } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

interface PlanInfo {
  planType: string;
  planInfo: {
    name: string;
    displayName: string;
    color: string;
    features: string[];
  };
}

export default function Header() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (session?.user?.email) {
      fetchPlanInfo();
    }
  }, [session]);

  const fetchPlanInfo = async () => {
    setPlanLoading(true);
    try {
      const response = await fetch('/api/user/plan');
      if (response.ok) {
        const data = await response.json();
        setPlanInfo(data);
      }
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
        return <Zap className="w-3 h-3" />;
      case 'standard':
        return <Star className="w-3 h-3" />;
      case 'pro':
        return <Crown className="w-3 h-3" />;
      default:
        return <Zap className="w-3 h-3" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'basic':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'standard':
        return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'pro':
        return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div
              className="flex items-center cursor-pointer"
              onClick={() => router.push('/')}
            >
              <Image
                src="/images/Moa_Logo.png"
                alt="MOA 로고"
                width={32}
                height={32}
                className="w-8 h-8 mr-2"
              />
              <span className="text-2xl font-bold text-gray-900">
                MOA
              </span>
            </div>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-gray-900">홈</Link>
            <Link href="/ai-list" className="text-gray-700 hover:text-gray-900">AI 목록</Link>
            <Link href="/usage" className="text-gray-700 hover:text-gray-900">사용량 확인</Link>
            <Link href="/plan" className="text-gray-700 hover:text-gray-900">플랜</Link>
            <Link href="/community" className="text-gray-700 hover:text-gray-900">커뮤니티</Link>
            <Link href="#" className="text-gray-700 hover:text-gray-900">문의하기</Link>
          </nav>
          <div className="flex items-center space-x-4">
            {!mounted ? (
              <div className="text-gray-700">로딩...</div>
            ) : status === "loading" ? (
              <div className="text-gray-700">로딩...</div>
            ) : session ? (
              <div className="flex items-center space-x-4">
                {session.user?.email === 'admin@moa.com' && (
                  <Link 
                    href="/admin"
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                  >
                    관리자
                  </Link>
                )}
                
                {/* 플랜 표시 */}
                {planInfo && (
                  <div className={`hidden sm:flex items-center space-x-1 px-2 py-1 rounded-full border text-xs font-medium ${getPlanColor(planInfo.planType)}`}>
                    {getPlanIcon(planInfo.planType)}
                    <span>{planInfo.planInfo.displayName}</span>
                  </div>
                )}
                
                {/* 프로필 드롭다운 */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
                    <span className="hidden sm:block text-sm text-gray-700">
                      {session.user?.name || session.user?.email}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>

                  {/* 드롭다운 메뉴 */}
                  {showDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-medium text-gray-900">
                          {session.user?.name || '사용자'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {session.user?.email}
                        </div>
                        {planInfo && (
                          <div className="mt-2 flex items-center space-x-1">
                            {getPlanIcon(planInfo.planType)}
                            <span className="text-xs font-medium text-gray-700">
                              {planInfo.planInfo.displayName} 플랜
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <User className="w-4 h-4 mr-2" />
                        프로필 설정
                      </Link>
                      
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        설정
                      </Link>
                      
                      <button
                        onClick={() => {
                          setShowDropdown(false);
                          handleSignOut();
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        로그아웃
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <Link 
                  href="/auth/signin"
                  className="bg-white text-black px-4 py-2 rounded border border-black hover:bg-gray-50 transition-colors"
                >
                  로그인
                </Link>
                <Link 
                  href="/auth/signup"
                  className="bg-black text-white px-4 py-2 rounded border border-white hover:bg-gray-800 transition-colors"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* 드롭다운 외부 클릭 시 닫기 */}
      {showDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowDropdown(false)}
        />
      )}
    </header>
  );
} 