'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const customerKey = searchParams.get('customerKey');
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');

  const handleRetry = () => {
    // 플랜 페이지로 이동하여 다시 시도
    router.push('/plan');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  const handleContactSupport = () => {
    // 고객 지원 페이지로 이동
    router.push('/contact');
  };

  // 에러 코드에 따른 사용자 친화적 메시지
  const getErrorMessage = () => {
    if (errorMessage) return errorMessage;
    
    switch (errorCode) {
      case 'PAY_CANCEL':
        return '결제가 취소되었습니다.';
      case 'USER_CANCEL':
        return '사용자가 결제를 취소했습니다.';
      case 'INVALID_CARD':
        return '유효하지 않은 카드 정보입니다.';
      case 'INSUFFICIENT_FUNDS':
        return '카드 잔액이 부족합니다.';
      case 'CARD_EXPIRED':
        return '만료된 카드입니다.';
      case 'INVALID_CARD_NUMBER':
        return '잘못된 카드 번호입니다.';
      default:
        return '결제 처리 중 오류가 발생했습니다.';
    }
  };

  const getErrorDescription = () => {
    switch (errorCode) {
      case 'PAY_CANCEL':
      case 'USER_CANCEL':
        return '결제를 다시 시도하거나 다른 결제 수단을 사용해보세요.';
      case 'INVALID_CARD':
      case 'INVALID_CARD_NUMBER':
        return '카드 정보를 다시 확인하고 입력해주세요.';
      case 'INSUFFICIENT_FUNDS':
        return '카드 잔액을 확인하고 다시 시도해주세요.';
      case 'CARD_EXPIRED':
        return '유효한 카드로 다시 시도해주세요.';
      default:
        return '잠시 후 다시 시도하거나 고객 지원팀에 문의해주세요.';
    }
  };

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">결제 실패</h2>
          <p className="text-gray-600 mb-4">{getErrorMessage()}</p>
          <p className="text-sm text-gray-500 mb-6">{getErrorDescription()}</p>
          
          {orderId && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-gray-600 mb-2">
                <span className="font-medium">주문 ID:</span> {orderId}
              </p>
              {amount && (
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">결제 금액:</span> {parseInt(amount).toLocaleString()}원
                </p>
              )}
              {errorCode && (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">오류 코드:</span> {errorCode}
                </p>
              )}
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              다시 시도하기
            </button>
            <button
              onClick={handleContactSupport}
              className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              고객 지원 문의
            </button>
            <button
              onClick={handleGoHome}
              className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div><p className="text-gray-600">결제 실패 정보를 불러오는 중...</p></div></div></div>}>
      <PaymentFailContent />
    </Suspense>
  );
}
