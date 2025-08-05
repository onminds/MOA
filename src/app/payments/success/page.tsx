"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Crown } from 'lucide-react';

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const receiptId = searchParams.get('receipt_id');
    const orderId = searchParams.get('order_id');

    if (!receiptId || !orderId) {
      setSuccess(false);
      setLoading(false);
      return;
    }

    // 결제 성공으로 간주 (Bootpay는 결제 완료 후 이 페이지로 리다이렉트)
    setSuccess(true);
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">결제를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        {success ? (
          <>
            <div className="mb-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">결제 완료!</h1>
              <p className="text-gray-600">플랜이 성공적으로 업그레이드되었습니다.</p>
            </div>
            <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Crown className="w-6 h-6 text-yellow-500" />
                <span className="text-lg font-semibold">새로운 플랜</span>
              </div>
              <p className="text-gray-600">이제 더 많은 기능을 이용하실 수 있습니다!</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </>
        ) : (
          <>
            <div className="mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-red-500">✕</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">결제 실패</h1>
              <p className="text-gray-600">결제 처리 중 문제가 발생했습니다.</p>
            </div>
            <button
              onClick={() => router.push('/plan')}
              className="w-full bg-gray-900 text-white py-3 px-6 rounded-xl font-semibold hover:bg-gray-800 transition-colors"
            >
              플랜 페이지로 돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
} 