"use client";
import { useSearchParams } from 'next/navigation';
import { XCircle, Home, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function SubscriptionFail() {
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('code');
  const errorMessage = searchParams.get('message');

  const getErrorMessage = () => {
    if (errorMessage) return errorMessage;
    
    switch (errorCode) {
      case 'PAY_PROCESS_CANCELED':
        return '결제가 취소되었습니다.';
      case 'PAY_PROCESS_ABORTED':
        return '결제가 중단되었습니다.';
      case 'INVALID_CARD':
        return '유효하지 않은 카드입니다.';
      case 'INSUFFICIENT_BALANCE':
        return '잔액이 부족합니다.';
      default:
        return '구독 설정 중 오류가 발생했습니다.';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
          구독 설정 실패
        </h2>
        <p className="text-center text-gray-600 mb-6">
          {getErrorMessage()}
        </p>
        <div className="space-y-3">
          <Link
            href="/plan"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center block"
          >
            <RefreshCw className="w-5 h-5 inline mr-2" />
            다시 시도
          </Link>
          <Link
            href="/"
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center block"
          >
            <Home className="w-5 h-5 inline mr-2" />
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
} 