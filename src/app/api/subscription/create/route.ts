import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 생성 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { customerKey, planId, amount, billingCycle = 'monthly' } = await request.json();
    console.log('받은 데이터:', { customerKey, planId, amount, billingCycle });

    const db = await getConnection();
    
    // 빌링키 조회
    const billingKeyResult = await db.request()
      .input('customerKey', customerKey)
      .input('userId', session.user.id)
      .query(`
        SELECT id, billing_key, is_active 
        FROM billing_keys 
        WHERE customer_key = @customerKey AND user_id = @userId
      `);

    if (billingKeyResult.recordset.length === 0) {
      return NextResponse.json({ error: '유효하지 않은 빌링키입니다.' }, { status: 400 });
    }

    const billingKey = billingKeyResult.recordset[0];
    if (!billingKey.is_active) {
      return NextResponse.json({ error: '비활성화된 빌링키입니다.' }, { status: 400 });
    }

    // 기존 활성 구독이 있는지 확인
    const existingSubscriptionResult = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, status 
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active'
      `);

    if (existingSubscriptionResult.recordset.length > 0) {
      return NextResponse.json({ error: '이미 활성 구독이 있습니다.' }, { status: 400 });
    }

    // 다음 결제일 계산
    const nextBillingDate = new Date();
    if (billingCycle === 'monthly') {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    } else if (billingCycle === 'yearly') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    }

    // 구독 생성
    const subscriptionResult = await db.request()
      .input('userId', session.user.id)
      .input('billingKeyId', billingKey.id)
      .input('planType', planId)
      .input('amount', amount)
      .input('billingCycle', billingCycle)
      .input('nextBillingDate', nextBillingDate)
      .query(`
        INSERT INTO subscriptions (user_id, billing_key_id, plan_type, amount, billing_cycle, next_billing_date)
        OUTPUT INSERTED.id
        VALUES (@userId, @billingKeyId, @planType, @amount, @billingCycle, @nextBillingDate)
      `);

    const subscriptionId = subscriptionResult.recordset[0].id;

    console.log('구독 생성 완료:', {
      subscriptionId,
      userId: session.user.id,
      planId,
      amount,
      nextBillingDate
    });

    return NextResponse.json({
      success: true,
      subscriptionId,
      nextBillingDate: nextBillingDate.toISOString()
    });

  } catch (error) {
    console.error('구독 생성 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 