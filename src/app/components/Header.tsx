"use client";
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { useState } from 'react';

export default function Header() {
  const router = useRouter();
  const [, setSidebarOpen] = useState(false);
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
            <button className="text-gray-700 hover:text-gray-900">로그인</button>
            <button className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800">
              회원가입
            </button>
          </div>
        </div>
      </div>
    </header>
  );
} 