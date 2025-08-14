"use client";
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function SubscriptionSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleSubscriptionSuccess = async () => {
      try {
        const customerKey = searchParams.get('customerKey');
        const authKey = searchParams.get('authKey');

        if (!customerKey || !authKey) {
          setError('구독 정보가 올바르지 않습니다.');
          setLoading(false);
          return;
        }

        console.log('구독 성공 처리:', { customerKey, authKey });

        // 1. 빌링키 발급
        const billingKeyResponse = await fetch('/api/subscription/issue-billing-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authKey,
            customerKey
          })
        });

        if (!billingKeyResponse.ok) {
          const errorData = await billingKeyResponse.json();
          setError(errorData.error || '빌링키 발급에 실패했습니다.');
          setLoading(false);
          return;
        }

        const billingKeyData = await billingKeyResponse.json();
        console.log('빌링키 발급 성공:', billingKeyData);

        // 2. 구독 생성 (기본값으로 monthly, standard 플랜)
        const subscriptionResponse = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerKey,
            planId: 'standard', // 기본값
            amount: 15900, // 기본값
            billingCycle: 'monthly'
          })
        });

        if (!subscriptionResponse.ok) {
          const errorData = await subscriptionResponse.json();
          setError(errorData.error || '구독 생성에 실패했습니다.');
          setLoading(false);
          return;
        }

        const subscriptionData = await subscriptionResponse.json();
        console.log('구독 생성 성공:', subscriptionData);

        // 3. 첫 결제 실행
        const firstPaymentResponse = await fetch('/api/subscription/process-billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: subscriptionData.subscriptionId
          })
        });

        if (firstPaymentResponse.ok) {
          setSuccess(true);
          // 구독 성공 후 Header 플랜 정보 새로고침을 위해 이벤트 발생
          window.dispatchEvent(new CustomEvent('planUpdated'));
        } else {
          const errorData = await firstPaymentResponse.json();
          // 첫 결제 실패는 구독 생성 자체는 성공이므로 경고만 표시
          setSuccess(true);
          console.warn('첫 결제 실패:', errorData);
        }
      } catch (error) {
        console.error('구독 성공 처리 오류:', error);
        setError('구독 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    handleSubscriptionSuccess();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-6">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
            구독 처리 중...
          </h2>
          <p className="text-center text-gray-600">
            잠시만 기다려주세요.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-2xl">✕</span>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
            구독 실패
          </h2>
          <p className="text-center text-gray-600 mb-6">
            {error}
          </p>
          <div className="flex gap-3">
            <Link
              href="/plan"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center"
            >
              다시 시도
            </Link>
            <Link
              href="/"
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center"
            >
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
          구독 성공!
        </h2>
        <p className="text-center text-gray-600 mb-6">
          정기 결제가 설정되었습니다.<br />
          매월 자동으로 결제됩니다.
        </p>
        <div className="space-y-3">
          <Link
            href="/"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center block"
          >
            <Home className="w-5 h-5 inline mr-2" />
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionSuccess() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SubscriptionSuccessContent />
    </Suspense>
  );
} 