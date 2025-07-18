"use client";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // 컴포넌트가 마운트되기 전까지는 로딩 표시
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white">로딩 중...</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: string) => {
    try {
      await signIn(provider, { callbackUrl: "/" });
    } catch (error) {
      setError("소셜 로그인 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-800 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      {/* 배경 장식 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-white/10 to-gray-300/20 rounded-full mix-blend-overlay filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-gray-400/20 to-white/10 rounded-full mix-blend-overlay filter blur-xl opacity-30 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-gray-500/10 to-white/5 rounded-full mix-blend-overlay filter blur-2xl opacity-20 animate-pulse delay-500"></div>
      </div>

      <div className="relative max-w-md w-full space-y-8">
        {/* 로고 및 헤더 */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-black to-gray-800 border-2 border-white/20 rounded-xl flex items-center justify-center shadow-2xl backdrop-blur-sm">
              <span className="text-white text-2xl font-bold tracking-wider">MOA</span>
            </div>
          </Link>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            MOA에 오신 것을 환영합니다
          </h2>
          <p className="mt-3 text-center text-sm text-gray-300">
            AI 기반 통합 검색 플랫폼에 로그인하세요
          </p>
        </div>

        {/* 메인 로그인 카드 */}
        <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-200/20">
          {/* 소셜 로그인 버튼들 */}
          <div className="space-y-4 mb-8">
            <button
              onClick={() => handleSocialLogin("google")}
              className="group w-full flex justify-center items-center px-4 py-3 border-2 border-gray-300 rounded-xl shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="group-hover:text-gray-900 transition-colors">Google로 계속하기</span>
            </button>

            <button
              onClick={() => handleSocialLogin("kakao")}
              className="group w-full flex justify-center items-center px-4 py-3 border-2 border-yellow-300 rounded-xl shadow-sm bg-yellow-300 text-sm font-medium text-gray-800 hover:bg-yellow-400 hover:border-yellow-400 hover:shadow-md transition-all duration-200 ease-in-out transform hover:-translate-y-0.5"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#000" d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
              </svg>
              <span className="group-hover:text-gray-900 transition-colors">카카오로 계속하기</span>
            </button>
          </div>

          {/* 구분선 */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">또는 이메일로 로그인</span>
            </div>
          </div>

          {/* 이메일 로그인 폼 */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  이메일 주소
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:z-10 sm:text-sm bg-white transition-all duration-200"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:z-10 sm:text-sm bg-white transition-all duration-200"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    로그인 중...
                  </>
                ) : (
                  <>
                    <span>로그인</span>
                    <svg className="ml-2 -mr-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 회원가입 링크 */}
        <div className="text-center">
          <p className="text-sm text-gray-300">
            아직 계정이 없으신가요?{" "}
            <Link
              href="/auth/signup"
              className="font-semibold text-white hover:text-gray-300 transition-colors duration-200 underline underline-offset-4"
            >
              무료로 회원가입하기
            </Link>
          </p>
        </div>

        {/* 하단 정보 */}
        <div className="text-center text-xs text-gray-400 space-y-2">
          <p>로그인하면 MOA의 서비스 약관 및 개인정보 처리방침에 동의하게 됩니다.</p>
          <div className="flex justify-center space-x-4">
            <Link href="/" className="hover:text-gray-200 transition-colors">홈으로</Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-200 transition-colors">고객지원</Link>
            <span>•</span>
            <Link href="#" className="hover:text-gray-200 transition-colors">개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </div>
  );
} 