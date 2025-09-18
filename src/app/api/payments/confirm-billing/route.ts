import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 자동결제(빌링) 확인 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { billingKey, orderId, amount, planId, customerKey } = await request.json();
    
    console.log('자동결제 확인 요청 받음:', { billingKey, orderId, amount, planId, customerKey });

    // 1. 토스페이먼츠 API 호출하여 빌링키 검증
    console.log('토스페이먼츠 빌링키 검증 API 호출 준비:', {
      secretKey: process.env.TOSS_SECRET_KEY ? '설정됨' : '설정되지 않음',
      secretKeyLength: process.env.TOSS_SECRET_KEY?.length || 0
    });
    
    // 빌링키로 결제 승인 요청
    const response = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: orderId,
        orderName: `MOA ${planId} 플랜 구독`,
        customerKey: customerKey,
        customerName: session.user.name || '사용자',
        customerEmail: session.user.email || 'user@example.com'
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 빌링 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.status === 'DONE') {
      // 자동결제 성공
      console.log('토스페이먼츠 자동결제 성공:', {
        billingKey,
        orderId,
        amount,
        planId,
        result: result
      });
      
      const db = await getConnection();

      // 구독 ID 생성
      const subscriptionId = result.subscriptionId || `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 다음 결제일 계산 (1개월 후)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      // 자동결제 정보를 subscriptions 테이블에 저장
      await db.request()
        .input('userId', session.user.id)
        .input('billingKey', billingKey)
        .input('customerKey', customerKey)
        .input('subscriptionId', subscriptionId)
        .input('planType', planId)
        .input('amount', amount)
        .input('status', 'active')
        .input('nextBillingDate', nextBillingDate)
        .input('autoRenewal', 1)
        .input('subscriptionStartDate', new Date())
        .query(`
          INSERT INTO subscriptions (
            user_id, billing_key, customer_key, subscription_id, 
            plan_type, amount, status, next_billing_date, 
            auto_renewal, subscription_start_date, created_at
          ) VALUES (
            @userId, @billingKey, @customerKey, @subscriptionId,
            @planType, @amount, @status, @nextBillingDate,
            @autoRenewal, @subscriptionStartDate, GETDATE()
          )
        `);

      console.log('자동결제 구독 정보 저장 완료:', {
        userId: session.user.id,
        billingKey,
        subscriptionId,
        planType: planId
      });

      // 결제 내역에도 기록 (payments 테이블)
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('billingKey', billingKey)
        .input('amount', amount)
        .input('planType', planId)
        .input('status', 'completed')
        .input('paymentMethod', 'card')
        .input('subscriptionId', subscriptionId)
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, billing_key, amount, 
            plan_type, status, payment_method, subscription_id, 
            created_at
          ) VALUES (
            @userId, @orderId, @billingKey, @amount,
            @planType, @status, @paymentMethod, @subscriptionId,
            GETDATE()
          )
        `);

      console.log('결제 내역 저장 완료');

      // 사용자 테이블 업데이트는 생략 (플랜 판정은 payments/subscriptions 기준)

      return NextResponse.json({
        success: true,
        message: '자동결제가 성공적으로 등록되었습니다.',
        subscriptionId: subscriptionId,
        nextBillingDate: nextBillingDate,
        billingKey: billingKey
      });

    } else {
      // 자동결제 실패
      console.error('토스페이먼츠 자동결제 실패:', result);
      
      const db = await getConnection();
      
      // 실패한 결제 내역 기록
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('billingKey', billingKey)
        .input('amount', amount)
        .input('planType', planId)
        .input('status', 'failed')
        .input('paymentMethod', 'card')
        .input('errorMessage', result.message || '자동결제 실패')
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, billing_key, amount, 
            plan_type, status, payment_method, error_message, 
            created_at
          ) VALUES (
            @userId, @orderId, @billingKey, @amount,
            @planType, @status, @paymentMethod, @errorMessage,
            GETDATE()
          )
        `);

      return NextResponse.json({
        success: false,
        error: result.message || '자동결제에 실패했습니다.',
        code: result.code
      }, { status: 400 });
    }

  } catch (error) {
    console.error('자동결제 확인 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
