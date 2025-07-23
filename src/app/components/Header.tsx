"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, ChevronDown, Settings, User, LogOut, Code } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';

export default function Header() {
  const router = useRouter();
  const [, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

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

  return (
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
            <span
              className="text-2xl font-bold text-gray-900 cursor-pointer"
              onClick={() => router.push('/')}
            >
              MOA
            </span>
          </div>
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-700 hover:text-gray-900">홈</Link>
            <Link href="#" className="text-gray-700 hover:text-gray-900">AI 목록</Link>
            <Link href="#" className="text-gray-700 hover:text-gray-900">추천</Link>
            <Link href="/community" className="text-gray-700 hover:text-gray-900">커뮤니티</Link>
            <Link href="/code-review/project" className="text-gray-700 hover:text-gray-900 flex items-center">
              <Code className="w-4 h-4 mr-1" />
              코드리뷰
            </Link>
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