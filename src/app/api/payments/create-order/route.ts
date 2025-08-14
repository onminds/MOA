import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 정기결제 주문 생성 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { planId, planName, amount } = await request.json();
    console.log('받은 데이터:', { planId, planName, amount });

    // 플랜 정보 검증
    const planInfo = {
      basic: { name: 'Basic Plan', amount: 0 },
      standard: { name: 'Standard Plan', amount: 15900 },
      pro: { name: 'Pro Plan', amount: 29000 }
    };

    const plan = planInfo[planId as keyof typeof planInfo];
    if (!plan || plan.amount !== amount) {
      return NextResponse.json({ error: '잘못된 플랜 정보입니다.' }, { status: 400 });
    }

    // Basic 플랜은 정기결제 불가
    if (planId === 'basic') {
      return NextResponse.json({ error: 'Basic 플랜은 정기결제를 지원하지 않습니다.' }, { status: 400 });
    }

    console.log('DB 연결 시도...');
    const db = await getConnection();
    console.log('DB 연결 성공');
    
    // 기존 active 구독이 있는지 확인
    const existingSubscription = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, subscription_id, plan_type, subscription_status 
        FROM payments 
        WHERE user_id = @userId AND subscription_status = 'active'
      `);

    if (existingSubscription.recordset.length > 0) {
      console.log('기존 구독 발견:', existingSubscription.recordset[0]);
      
      // 기존 활성 구독을 모두 취소 처리
      await db.request()
        .input('userId', session.user.id)
        .input('canceledAt', new Date())
        .query(`
          UPDATE payments 
          SET subscription_status = 'canceled',
              canceled_at = @canceledAt,
              auto_renewal = 0,
              updated_at = GETDATE()
          WHERE user_id = @userId 
            AND subscription_status = 'active'
        `);
      
      console.log('기존 활성 구독 취소 완료');
    }
    
    // 정기결제용 주문 ID 생성 (subscription_ 접두사 사용)
    const orderId = `subscription_${Date.now()}_${planId}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('생성된 정기결제 주문 ID:', orderId);

    // 다음 결제일 계산 (1개월 후)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    // 정기결제 주문 정보 DB 저장
    console.log('정기결제 주문 DB 저장 시도...');
    await db.request()
      .input('transactionId', orderId)
      .input('userId', session.user.id)
      .input('planType', planId)
      .input('amount', amount)
      .input('status', 'pending')
      .input('subscriptionStatus', 'pending')
      .input('billingCycle', 'monthly')
      .input('nextBillingDate', nextBillingDate)
      .input('autoRenewal', 1)
      .input('subscriptionStartDate', new Date())
      .query(`
        INSERT INTO payments (
          transaction_id, user_id, plan_type, amount, status, 
          subscription_status, billing_cycle, next_billing_date, 
          auto_renewal, subscription_start_date, created_at, updated_at
        )
        VALUES (
          @transactionId, @userId, @planType, @amount, @status,
          @subscriptionStatus, @billingCycle, @nextBillingDate,
          @autoRenewal, @subscriptionStartDate, GETDATE(), GETDATE()
        )
      `);
    console.log('정기결제 주문 DB 저장 성공');

    return NextResponse.json({
      orderId,
      orderName: `${plan.name} (정기결제)`,
      amount,
      billingCycle: 'monthly',
      nextBillingDate: nextBillingDate.toISOString()
    });

  } catch (error) {
    console.error('정기결제 주문 생성 오류:', error);
    console.error('오류 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 