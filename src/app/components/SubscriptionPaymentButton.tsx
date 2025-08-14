"use client";
import { useState } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { useSession } from 'next-auth/react';

interface SubscriptionPaymentButtonProps {
  planId: string;
  planName: string;
  amount: number;
  billingCycle?: 'monthly' | 'yearly';
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function SubscriptionPaymentButton({ 
  planId, 
  planName, 
  amount, 
  billingCycle = 'monthly',
  onSuccess, 
  onError 
}: SubscriptionPaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  const handleSubscriptionPayment = async () => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);
    console.log('구독 결제 시작...');
    
    try {
      // 1. 카드 등록 API 호출
      console.log('카드 등록 API 호출:', { planId, planName, amount });
      const registerResponse = await fetch('/api/subscription/register-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          planName,
          amount
        })
      });

      if (!registerResponse.ok) {
        const errorText = await registerResponse.text();
        console.error('카드 등록 API 오류:', errorText);
        throw new Error('카드 등록에 실패했습니다.');
      }

      const registerData = await registerResponse.json();
      console.log('카드 등록 응답:', registerData);
      
      const { customerKey, successUrl, failUrl } = registerData;

      // 2. 토스페이먼츠 빌링 인증 요청
      console.log('토스페이먼츠 빌링 인증 요청 시작...');
      
      const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
      
      const response = await tossPayments.requestBillingAuth('카드', {
        customerKey: customerKey,
        successUrl: successUrl,
        failUrl: failUrl,
      }).catch((error) => {
        if (error && typeof error === 'object') {
          const errorObj = error as any;
          if (errorObj.message && errorObj.message.includes('취소되었습니다')) {
            console.log('사용자가 카드 등록을 취소했습니다.');
            return null;
          }
        }
        throw error;
      });

      console.log('토스페이먼츠 빌링 인증 응답:', response);

      if (!response) {
        console.log('카드 등록이 취소되었습니다.');
        return;
      }

      // 3. 빌링키 발급
      if (response && typeof response === 'object' && 'authKey' in response) {
        console.log('빌링키 발급 요청...');
        const billingKeyResponse = await fetch('/api/subscription/issue-billing-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            authKey: (response as any).authKey,
            customerKey: customerKey
          })
        });

        if (!billingKeyResponse.ok) {
          const errorText = await billingKeyResponse.text();
          console.error('빌링키 발급 실패:', errorText);
          throw new Error('빌링키 발급에 실패했습니다.');
        }

        const billingKeyData = await billingKeyResponse.json();
        console.log('빌링키 발급 성공:', billingKeyData);

        // 4. 구독 생성
        console.log('구독 생성 요청...');
        const subscriptionResponse = await fetch('/api/subscription/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerKey: customerKey,
            planId: planId,
            amount: amount,
            billingCycle: billingCycle
          })
        });

        if (!subscriptionResponse.ok) {
          const errorText = await subscriptionResponse.text();
          console.error('구독 생성 실패:', errorText);
          throw new Error('구독 생성에 실패했습니다.');
        }

        const subscriptionData = await subscriptionResponse.json();
        console.log('구독 생성 성공:', subscriptionData);

        // 5. 첫 결제 실행 (선택사항)
        console.log('첫 결제 실행...');
        const firstPaymentResponse = await fetch('/api/subscription/process-billing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscriptionId: subscriptionData.subscriptionId
          })
        });

        if (firstPaymentResponse.ok) {
          console.log('첫 결제 성공!');
          onSuccess?.();
        } else {
          const errorText = await firstPaymentResponse.text();
          console.error('첫 결제 실패:', errorText);
          // 첫 결제 실패는 구독 생성 자체는 성공이므로 경고만 표시
          alert('구독은 생성되었지만 첫 결제에 실패했습니다. 다음 결제일에 재시도됩니다.');
          onSuccess?.();
        }
      }

    } catch (error) {
      console.error('구독 결제 오류:', error);
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSubscriptionPayment}
      disabled={loading}
      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
    >
      {loading ? '처리 중...' : `${billingCycle === 'monthly' ? '월' : '년'} 구독 시작`}
    </button>
  );
} 