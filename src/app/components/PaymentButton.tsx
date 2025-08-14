"use client";
import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useSession } from 'next-auth/react';

interface PaymentButtonProps {
  planId: string;
  planName: string;
  amount: number;
  currentPlan?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function PaymentButton({ planId, planName, amount, currentPlan, onSuccess, onError }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  // Basic Plan이거나 현재 플랜인 경우 버튼을 숨김
  if (planId === 'basic' || planId === currentPlan) {
    return null;
  }

  const handlePayment = async () => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    // Basic 플랜은 정기결제 불가
    if (planId === 'basic') {
      alert('Basic 플랜은 정기결제를 지원하지 않습니다.');
      return;
    }

    setLoading(true);
    console.log('토스페이먼츠 정기결제 시작...');
    
    try {
      // 1. 정기결제 주문 생성 API 호출
      console.log('정기결제 주문 생성 API 호출:', { planId, planName, amount });
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          planName,
          amount
        })
      });

      console.log('API 응답 상태:', orderResponse.status);
      
      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        console.error('API 오류 응답:', errorData);
        throw new Error(errorData.error || '주문 생성에 실패했습니다.');
      }

      const responseData = await orderResponse.json();
      console.log('API 응답 데이터:', responseData);
      const { orderId, orderName, billingCycle, nextBillingDate } = responseData;

      // 2. 토스페이먼츠 정기결제 요청
      console.log('토스페이먼츠 정기결제 요청 시작...');
      
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      
      const response = await tossPayments.requestPayment('카드', {
        amount: amount,
        orderId: orderId,
        orderName: orderName,
        customerName: session.user.name || '사용자',
        customerEmail: session.user.email || 'user@example.com'
      }).catch((error) => {
        // 토스페이먼츠 취소 오류 처리
        if (error && typeof error === 'object') {
          const errorObj = error as any;
          const errorMessage = errorObj.message?.toLowerCase() || '';
          const errorCode = errorObj.code || '';
          
          // 취소 관련 에러들
          if (errorMessage.includes('취소되었습니다') ||
              errorMessage.includes('사용자가 결제를 취소') ||
              errorMessage.includes('payment cancelled') ||
              errorMessage.includes('payment canceled') ||
              errorMessage.includes('user cancelled') ||
              errorMessage.includes('user canceled') ||
              errorCode === 'PAY_CANCEL' ||
              errorCode === 'USER_CANCEL' ||
              errorCode === 'PAYMENT_CANCELED') {
            console.log('사용자가 정기결제를 취소했습니다.');
            return null; // 취소는 정상적인 행동이므로 null 반환
          }
        }
        throw error; // 다른 오류는 다시 던지기
      });

      console.log('토스페이먼츠 정기결제 응답:', response);

      // 사용자가 취소한 경우 처리
      if (!response) {
        console.log('정기결제가 취소되었습니다.');
        return;
      }

      // 3. 정기결제 성공 시 서버에 확인 요청
      if (response && typeof response === 'object' && 'paymentKey' in response && 'orderId' in response) {
        const confirmResponse = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey: (response as any).paymentKey,
            orderId: (response as any).orderId,
            amount: amount,
            planId: planId
          })
        });

        if (confirmResponse.ok) {
          const confirmData = await confirmResponse.json();
          console.log('정기결제 성공!', confirmData);
          
          // 구독 정보 표시
          if (confirmData.subscriptionId) {
            alert(`정기결제가 완료되었습니다!\n\n구독 ID: ${confirmData.subscriptionId}\n다음 결제일: ${new Date(confirmData.nextBillingDate).toLocaleDateString()}`);
          } else {
            alert('정기결제가 완료되었습니다!');
          }
          
          onSuccess?.();
        } else {
          const errorData = await confirmResponse.json();
          console.error('정기결제 확인 실패:', errorData);
          throw new Error(errorData.error || '정기결제 확인에 실패했습니다.');
        }
      }

    } catch (error) {
      console.error('정기결제 처리 오류:', error);
      
      // 사용자가 의도적으로 취소한 경우는 에러로 처리하지 않음
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('cancel') || 
            errorMessage.includes('close') || 
            errorMessage.includes('dismiss') ||
            errorMessage.includes('user cancelled') ||
            errorMessage.includes('user closed') ||
            errorMessage.includes('취소되었습니다') ||
            errorMessage.includes('사용자가 결제를 취소') ||
            errorMessage.includes('payment cancelled') ||
            errorMessage.includes('payment canceled')) {
          console.log('사용자가 정기결제를 취소했습니다.');
          return;
        }
      }
      
      // 토스페이먼츠 취소 오류 처리
      if (error && typeof error === 'object' && 'message' in error) {
        const errorObj = error as any;
        const errorMessage = errorObj.message?.toLowerCase() || '';
        if (errorMessage.includes('취소되었습니다') ||
            errorMessage.includes('사용자가 결제를 취소') ||
            errorMessage.includes('payment cancelled') ||
            errorMessage.includes('payment canceled') ||
            errorMessage.includes('user cancelled') ||
            errorMessage.includes('user canceled')) {
          console.log('사용자가 정기결제를 취소했습니다.');
          return;
        }
      }
      
      // 토스페이먼츠 SDK 에러 처리
      if (error && typeof error === 'object' && 'code' in error) {
        const errorObj = error as any;
        // 토스페이먼츠 취소 관련 에러 코드들
        if (errorObj.code === 'PAY_CANCEL' || 
            errorObj.code === 'USER_CANCEL' ||
            errorObj.code === 'PAYMENT_CANCELED') {
          console.log('사용자가 정기결제를 취소했습니다.');
          return;
        }
      }
      
      // 기타 실제 오류만 사용자에게 표시
      onError?.(error instanceof Error ? error.message : '정기결제 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
      {loading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          처리 중...
        </div>
      ) : (
        '정기결제 시작'
      )}
    </button>
  );
} 