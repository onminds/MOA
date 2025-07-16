"use client";
import { useState } from 'react';
import { LogIn } from 'lucide-react';

export default function GoogleLogin() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // 구글 로그인 로직 (실제 구현 시 OAuth2 플로우)
      console.log('Google login clicked');
      // 임시로 로그인 상태 변경
      setTimeout(() => {
        setIsLoggedIn(true);
        setIsLoading(false);
      }, 1000);
    } catch (error) {
      console.error('Login error:', error);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
  };

  if (isLoggedIn) {
    return (
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold"
      >
        <LogIn className="w-5 h-5" />
        로그아웃
      </button>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-2 bg-black text-white py-3 rounded-lg hover:bg-gray-800 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <LogIn className="w-5 h-5" />
      )}
      {isLoading ? '로그인 중...' : '로그인'}
    </button>
  );
} 