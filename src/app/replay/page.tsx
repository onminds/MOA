"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Replay() {
  const router = useRouter();

  useEffect(() => {
    try {
      localStorage.removeItem('moa_onboarding_done_v1');
      localStorage.setItem('moa_onboarding_force', '1');
    } catch {}
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">튜토리얼을 다시 실행합니다...</p>
        <a href="/" className="text-blue-600 underline">홈으로 이동</a>
      </div>
    </div>
  );
}


