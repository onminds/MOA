"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
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
    setSuccess("");

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      setLoading(false);
      return;
    }

    // 비밀번호 길이 확인
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          name,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "회원가입 중 오류가 발생했습니다.");
      } else {
        setSuccess("회원가입이 완료되었습니다! 잠시 후 로그인 페이지로 이동합니다.");
        setTimeout(() => {
          router.push("/auth/signin");
        }, 2000);
      }
    } catch {
      setError("회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
            MOA 계정 만들기
          </h2>
          <p className="mt-3 text-center text-sm text-gray-300">
            AI 기반 통합 검색 플랫폼을 무료로 이용해보세요
          </p>
        </div>

        {/* 메인 회원가입 카드 */}
        <div className="bg-white/95 backdrop-blur-xl shadow-2xl rounded-2xl p-8 border border-gray-200/20">
          {/* 회원가입 폼 */}
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-5">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  이름 (선택사항)
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:z-10 sm:text-sm bg-white transition-all duration-200"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  이메일 주소 *
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
                  비밀번호 *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:z-10 sm:text-sm bg-white transition-all duration-200"
                  placeholder="최소 6자 이상"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">
                  비밀번호 확인 *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-black focus:z-10 sm:text-sm bg-white transition-all duration-200"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>
            </div>

            {/* 약관 동의 */}
            <div className="bg-gray-100 rounded-xl p-4 text-xs text-gray-600">
              <p className="leading-relaxed">
                회원가입을 진행하면 MOA의{" "}
                <Link href="#" className="text-black hover:text-gray-700 font-medium underline">서비스 약관</Link>
                {" "}및{" "}
                <Link href="#" className="text-black hover:text-gray-700 font-medium underline">개인정보 처리방침</Link>
                에 동의하는 것으로 간주됩니다.
              </p>
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

            {success && (
              <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800 font-medium">{success}</p>
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
                    계정 생성 중...
                  </>
                ) : (
                  <>
                    <span>무료 계정 만들기</span>
                    <svg className="ml-2 -mr-1 w-4 h-4 transition-transform group-hover:translate-x-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 로그인 링크 */}
        <div className="text-center">
          <p className="text-sm text-gray-300">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/auth/signin"
              className="font-semibold text-white hover:text-gray-300 transition-colors duration-200 underline underline-offset-4"
            >
              로그인하기
            </Link>
          </p>
        </div>

        {/* 하단 정보 */}
        <div className="text-center text-xs text-gray-400 space-y-2">
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