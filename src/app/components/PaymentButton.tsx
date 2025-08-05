"use client";
import { useState } from 'react';
import Bootpay from '@bootpay/client-js';
import { useSession } from 'next-auth/react';

interface PaymentButtonProps {
  planId: string;
  planName: string;
  amount: number;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export default function PaymentButton({ planId, planName, amount, onSuccess, onError }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { data: session } = useSession();

  const handlePayment = async () => {
    if (!session?.user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    setLoading(true);
    console.log('API 호출 시작...');
    
    try {
      // 1. 주문 생성 API 호출
      console.log('주문 생성 API 호출:', { planId, planName, amount });
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
        const errorText = await orderResponse.text();
        console.error('API 오류 응답:', errorText);
        throw new Error('주문 생성에 실패했습니다.');
      }

      const responseData = await orderResponse.json();
      console.log('API 응답 데이터:', responseData);
      const { orderId, orderName } = responseData;

      // 2. Bootpay 결제 요청
      console.log('Bootpay 결제 요청 시작...');
      
      try {
        console.log('Bootpay 결제 요청 데이터:', {
          application_id: process.env.NEXT_PUBLIC_BOOTPAY_APPLICATION_ID,
          price: amount,
          order_name: orderName,
          order_id: orderId
        });
        
        const response = await Bootpay.requestPayment({
          application_id: process.env.NEXT_PUBLIC_BOOTPAY_APPLICATION_ID!,
          price: amount,
          order_name: orderName,
          order_id: orderId,
          method: 'card',
          tax_free: 0,
          user: {
            id: session.user.id,
            username: session.user.name || '사용자',
            email: session.user.email || 'user@example.com',
            phone: '010-0000-0000'
          },
          items: [
            {
              id: planId,
              name: planName,
              qty: 1,
              unique: planId,
              price: amount
            }
          ],
          extra: {
            open_type: 'iframe',
            card_quota: '0,2,3'
          }
        });
        
        console.log('Bootpay 응답:', response);
        
        if (response.event === 'done') {
          // 결제 성공 시 서버에 확인 요청
          const confirmResponse = await fetch('/api/payments/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              receiptId: response.receipt_id,
              orderId: orderId
            })
          });

          if (confirmResponse.ok) {
            console.log('결제 성공!');
            onSuccess?.();
          } else {
            const errorText = await confirmResponse.text();
            console.error('결제 확인 실패:', errorText);
            throw new Error('결제 확인에 실패했습니다.');
          }
        } else if (response.event === 'cancel') {
          console.log('결제 취소됨');
          // 취소는 정상적인 사용자 행동이므로 에러로 처리하지 않음
          return;
        } else if (response.event === 'error') {
          console.error('결제 오류:', response);
          throw new Error('결제 중 오류가 발생했습니다.');
        } else if (response.event === 'close') {
          console.log('결제 창 닫힘');
          // 사용자가 결제 창을 닫은 경우는 정상적인 행동이므로 에러로 처리하지 않음
          return;
        } else if (response.event === 'cancel') {
          console.log('결제 취소됨');
          // 취소는 정상적인 사용자 행동이므로 에러로 처리하지 않음
          return;
        } else {
          // 기타 이벤트는 무시
          console.log('기타 Bootpay 이벤트:', response.event);
          return;
        }

      } catch (bootpayError) {
        // 객체 형태의 에러인 경우 먼저 확인
        if (bootpayError && typeof bootpayError === 'object') {
          const errorObj = bootpayError as any;
          
          // 빈 객체이거나 취소/닫기 이벤트인 경우
          if (Object.keys(errorObj).length === 0 || 
              errorObj.event === 'cancel' || 
              errorObj.event === 'close' ||
              errorObj.event === 'dismiss') {
            console.log('사용자가 결제를 취소하거나 창을 닫았습니다.');
            return;
          }
          
          // 다른 에러 객체인 경우에만 로그 출력
          console.error('Bootpay 오류:', errorObj);
          throw new Error('결제 시스템 오류가 발생했습니다.');
        }
        
        // Error 인스턴스인 경우
        if (bootpayError instanceof Error) {
          const errorMessage = bootpayError.message.toLowerCase();
          if (errorMessage.includes('cancel') || 
              errorMessage.includes('close') || 
              errorMessage.includes('dismiss') ||
              errorMessage.includes('user cancelled') ||
              errorMessage.includes('user closed')) {
            // 취소나 창 닫기는 것은 정상적인 행동
            console.log('사용자가 결제를 취소하거나 창을 닫았습니다.');
            return;
          }
          console.error('Bootpay 오류:', bootpayError);
          throw new Error(`결제 시스템 오류: ${bootpayError.message}`);
        }
        
        // 기타 경우
        console.error('Bootpay 오류:', bootpayError);
        throw new Error('결제 시스템 오류가 발생했습니다.');
      }

    } catch (error) {
      console.error('결제 처리 오류:', error);
      
      // 사용자가 의도적으로 취소한 경우는 에러로 처리하지 않음
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        if (errorMessage.includes('cancel') || 
            errorMessage.includes('close') || 
            errorMessage.includes('dismiss') ||
            errorMessage.includes('user cancelled') ||
            errorMessage.includes('user closed')) {
          console.log('사용자가 결제를 취소했습니다.');
          return;
        }
      }
      
      onError?.(error instanceof Error ? error.message : '결제 중 오류가 발생했습니다.');
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
        '플랜 업그레이드'
      )}
    </button>
  );
} 