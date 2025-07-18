"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

export default function Header() {
  const router = useRouter();
  const [, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: session, status } = useSession();

  useEffect(() => {
    setMounted(true);
  }, []);

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
            <Link href="#" className="text-gray-700 hover:text-gray-900">커뮤니티</Link>
          </nav>
          <div className="flex items-center space-x-4">
            {!mounted ? (
              <div className="text-gray-700">로딩...</div>
            ) : status === "loading" ? (
              <div className="text-gray-700">로딩...</div>
            ) : session ? (
              <>
                {session.user?.email === 'admin@moa.com' && (
                  <Link 
                    href="/admin"
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                  >
                    관리자
                  </Link>
                )}
                <span className="text-gray-700">
                  안녕하세요, {session.user?.name || session.user?.email}님!
                </span>
                <button 
                  onClick={() => signOut()}
                  className="text-gray-700 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/auth/signin"
                  className="bg-white text-black px-4 py-2 rounded border border-black hover:bg-gray-50"
                >
                  로그인
                </Link>
                <Link 
                  href="/auth/signup"
                  className="bg-black text-white px-4 py-2 rounded border border-white hover:bg-gray-800"
                >
                  회원가입
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 