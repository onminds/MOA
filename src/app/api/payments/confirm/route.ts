import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 정기결제 확인 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { paymentKey, orderId, amount, planId } = await request.json();
    
    console.log('정기결제 확인 요청 받음:', { paymentKey, orderId, amount, planId });

    // 정기결제 주문인지 확인
    const isSubscription = orderId.startsWith('subscription_');
    console.log('정기결제 여부:', isSubscription);

    // 1. 토스페이먼츠 API 호출하여 결제 검증
    console.log('토스페이먼츠 API 호출 준비:', {
      secretKey: process.env.TOSS_SECRET_KEY ? '설정됨' : '설정되지 않음',
      secretKeyLength: process.env.TOSS_SECRET_KEY?.length || 0
    });
    
    const response = await fetch(`https://api.tosspayments.com/v1/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey: paymentKey,
        orderId: orderId,
        amount: amount
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.status === 'DONE') {
      // 결제 성공
      console.log('토스페이먼츠 결제 성공:', {
        paymentKey,
        orderId,
        amount,
        planId,
        result: result
      });
      
      const db = await getConnection();

      if (isSubscription) {
        // 정기결제인 경우 구독 정보 저장
        console.log('정기결제 구독 정보 저장 중...');
        
        // 구독 ID 생성 (토스페이먼츠에서 제공하거나 자체 생성)
        const subscriptionId = result.subscriptionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 다음 결제일 계산 (1개월 후)
        const nextBillingDate = new Date();
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

        // 정기결제 정보 업데이트
        await db.request()
          .input('transactionId', orderId)
          .input('paymentKey', paymentKey)
          .input('status', 'completed')
          .input('paymentMethod', result.method || 'card')
          .input('planType', planId)
          .input('subscriptionId', subscriptionId)
          .input('subscriptionStatus', 'active')
          .input('nextBillingDate', nextBillingDate)
          .input('autoRenewal', 1)
          .input('subscriptionStartDate', new Date())
          .query(`
            UPDATE payments 
            SET receipt_id = @paymentKey, 
                status = @status, 
                payment_method = @paymentMethod, 
                plan_type = @planType,
                subscription_id = @subscriptionId,
                subscription_status = @subscriptionStatus,
                next_billing_date = @nextBillingDate,
                auto_renewal = @autoRenewal,
                subscription_start_date = @subscriptionStartDate,
                updated_at = GETDATE()
            WHERE transaction_id = @transactionId
          `);

        console.log('정기결제 구독 정보 저장 완료:', {
          orderId,
          planId,
          subscriptionId,
          status: 'active',
          nextBillingDate: nextBillingDate.toISOString()
        });

        return NextResponse.json({
          success: true,
          message: '정기결제가 완료되었습니다.',
          planType: planId,
          subscriptionId: subscriptionId,
          nextBillingDate: nextBillingDate.toISOString(),
          billingCycle: 'monthly'
        });

      } else {
        // 일반 결제인 경우 기존 로직 유지
        console.log('일반 결제 처리 중...');
        
        await db.request()
          .input('transactionId', orderId)
          .input('paymentKey', paymentKey)
          .input('status', 'completed')
          .input('paymentMethod', result.method || 'card')
          .input('planType', planId)
          .query(`
            UPDATE payments 
            SET receipt_id = @paymentKey, 
                status = @status, 
                payment_method = @paymentMethod, 
                plan_type = @planType,
                updated_at = GETDATE()
            WHERE transaction_id = @transactionId
          `);

        console.log('일반 결제 정보 업데이트 완료:', {
          orderId,
          planId,
          status: 'completed'
        });

        return NextResponse.json({
          success: true,
          message: '결제가 완료되었습니다.',
          planType: planId
        });
      }

    } else {
      // 결제 실패
      console.log('토스페이먼츠 결제 실패:', {
        responseStatus: response.status,
        result: result
      });
      
      const db = await getConnection();
      
      if (isSubscription) {
        // 정기결제 실패 시 구독 상태도 업데이트
        await db.request()
          .input('transactionId', orderId)
          .input('status', 'failed')
          .input('subscriptionStatus', 'failed')
          .query(`
            UPDATE payments 
            SET status = @status, 
                subscription_status = @subscriptionStatus, 
                updated_at = GETDATE()
            WHERE transaction_id = @transactionId
          `);
      } else {
        // 일반 결제 실패
        await db.request()
          .input('transactionId', orderId)
          .input('status', 'failed')
          .query(`
            UPDATE payments 
            SET status = @status, updated_at = GETDATE()
            WHERE transaction_id = @transactionId
          `);
      }

      return NextResponse.json({
        success: false,
        message: '결제에 실패했습니다.',
        error: result.message || '알 수 없는 오류'
      });
    }

  } catch (error) {
    console.error('정기결제 확인 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 