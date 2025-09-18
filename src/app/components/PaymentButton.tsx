"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

// 토스페이먼츠 SDK 타입 정의
declare global {
  interface Window {
    TossPayments: any;
  }
}

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
  const [tossPayments, setTossPayments] = useState<any>(null);
  const { data: session } = useSession();

  // 토스페이먼츠 SDK 로드
  useEffect(() => {
    const loadTossPayments = async () => {
      try {
        // CDN에서 토스페이먼츠 SDK 로드 (v2/standard)
        if (!window.TossPayments) {
          const script = document.createElement('script');
          script.src = 'https://js.tosspayments.com/v2/standard';
          script.onload = () => {
            if (window.TossPayments) {
              const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
              if (clientKey) {
                setTossPayments(window.TossPayments(clientKey));
              }
            }
          };
          document.head.appendChild(script);
        } else {
          const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
          if (clientKey) {
            setTossPayments(window.TossPayments(clientKey));
          }
        }
      } catch (error) {
        console.error('토스페이먼츠 SDK 로드 실패:', error);
      }
    };

    loadTossPayments();
  }, []);

  // Basic Plan이거나 현재 플랜인 경우 버튼을 숨김
  if (planId === 'basic' || planId === currentPlan) {
    return null;
  }

  const handlePayment = async () => {
    // HMR로 인한 세션 초기화 방지
    if (!session?.user?.id) {
      console.log('세션이 없습니다. HMR로 인한 초기화일 수 있습니다. 3초 대기...');
      
      // 세션 복구 시도
      for (let i = 0; i < 6; i++) { // 3초 동안 500ms 간격으로 체크
        await new Promise(resolve => setTimeout(resolve, 500));
        if (session?.user?.id) {
          console.log('세션이 복구되었습니다.');
          break;
        }
      }
      
      if (!session?.user?.id) {
        alert('로그인이 필요합니다.');
        return;
      }
    }

    if (!tossPayments) {
      alert('토스페이먼츠 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // Basic 플랜은 정기결제 불가
    if (planId === 'basic') {
      alert('Basic 플랜은 정기결제를 지원하지 않습니다.');
      return;
    }

    setLoading(true);
    console.log('토스페이먼츠 자동결제(빌링) 시작...');
    
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
      const { orderId, orderName, customerKey } = responseData;

      // 2. v2 표준: payment 인스턴스 생성 후 requestBillingAuth 호출
      console.log('토스페이먼츠 v2 자동결제 인증창 호출...');
      try {
        const payment = tossPayments.payment({ customerKey });
        await payment.requestBillingAuth({
          method: 'CARD',
          successUrl: `${window.location.origin}/payments/success?orderId=${orderId}&amount=${amount}&customerKey=${customerKey}`,
          failUrl: `${window.location.origin}/payments/fail?orderId=${orderId}&amount=${amount}&customerKey=${customerKey}`,
          customerName: session.user.name || '사용자',
          customerEmail: session.user.email || 'user@example.com'
        });
        // v2는 리다이렉트 방식이며 여기서는 보통 반환값이 없습니다.
      } catch (billingError) {
        console.log('결제창 처리 중:', billingError);
        
        // 토스페이먼츠 API 에러인지 사용자 취소인지 구분
        const errorMessage = billingError instanceof Error ? billingError.message : String(billingError);
        
        if (errorMessage.includes('잘못된 요청입니다') || errorMessage.includes('Bad Request')) {
          // API 에러인 경우 - 롤백하지 않고 에러 표시
          console.error('토스페이먼츠 API 에러:', errorMessage);
          if (onError) {
            onError('결제 시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          }
          return;
        }
        
        // 사용자 취소나 기타 에러인 경우 롤백
        try {
          console.log('결제창 닫힘 감지, 구독 상태 롤백 시도...');
          const rollbackResponse = await fetch('/api/payments/rollback-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
          });
          
          if (rollbackResponse.ok) {
            const rollbackData = await rollbackResponse.json();
            console.log('구독 상태 롤백 성공:', rollbackData);
          } else {
            console.error('구독 상태 롤백 실패:', rollbackResponse.status);
          }
        } catch (rollbackError) {
          console.error('롤백 API 호출 오류:', rollbackError);
        }
        
        return; // 에러 없이 정상 종료
      }

    } catch (error) {
      console.error('자동결제 처리 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      
      if (onError) {
        onError(errorMessage);
      } else {
        alert(`결제 처리 중 오류가 발생했습니다: ${errorMessage}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading || !tossPayments}
      className={`w-full py-3 px-6 rounded-lg font-medium transition-colors ${
        loading || !tossPayments
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {!tossPayments ? 'SDK 로딩 중...' : loading ? '처리 중...' : `${planName} 구독하기`}
    </button>
  );
} 