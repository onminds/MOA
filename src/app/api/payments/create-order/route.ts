import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 자동결제(빌링) 주문 생성 API 시작 ===');
    
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

    // Basic 플랜은 자동결제 불가
    if (planId === 'basic') {
      return NextResponse.json({ error: 'Basic 플랜은 자동결제를 지원하지 않습니다.' }, { status: 400 });
    }

    console.log('DB 연결 시도...');
    const db = await getConnection();
    console.log('DB 연결 성공');
    
    // 기존 active 구독이 있는지 확인 (subscriptions 테이블에서 조회)
    const existingSubscription = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, subscription_id, plan_type, status 
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active'
      `);

    if (existingSubscription.recordset.length > 0) {
      const existing = existingSubscription.recordset[0];
      console.log('기존 활성 구독 발견:', existing);
      
      // 기존 구독이 같은 플랜인 경우
      if (existing.plan_type === planId) {
        return NextResponse.json({ 
          error: '이미 동일한 플랜을 구독하고 있습니다. 구독을 해제한 후 다시 시도해주세요.' 
        }, { status: 400 });
      }
      
      // 기존 구독이 다른 플랜인 경우 업그레이드/다운그레이드
      console.log('플랜 변경 요청:', existing.plan_type, '->', planId);
      
      // 기존 구독을 inactive로 변경
      await db.request()
        .input('subscriptionId', existing.subscription_id)
        .input('userId', session.user.id)
        .query(`
          UPDATE subscriptions 
          SET status = 'inactive', 
              auto_renewal = 0,
              updated_at = GETDATE()
          WHERE subscription_id = @subscriptionId AND user_id = @userId
        `);
      
      console.log('기존 구독을 inactive로 변경 완료');
    } else {
      console.log('활성 구독이 없습니다. 새로운 구독을 진행합니다.');
    }

    // 고유한 주문 ID 생성
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substr(2, 9);
    const orderId = `subscription_${timestamp}_${randomStr}`;
    
    // 고유한 customerKey 생성 (사용자별 고유 식별자)
    const customerKey = `customer_${session.user.id}_${timestamp}`;
    
    // 주문명 생성
    const orderName = `MOA ${planName} 플랜 구독`;
    
    // 빌링 주기 설정 (월간)
    const billingCycle = 'monthly';
    
    // 다음 결제일 계산 (1개월 후)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    console.log('생성된 주문 정보:', {
      orderId,
      orderName,
      customerKey,
      billingCycle,
      nextBillingDate,
      planId,
      amount
    });

    // 주문 정보를 payments 테이블에 저장
    try {
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('orderName', orderName)
        .input('customerKey', customerKey)
        .input('planType', planId)
        .input('amount', amount)
        .input('billingCycle', billingCycle)
        .input('nextBillingDate', nextBillingDate)
        .input('status', 'pending')
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, order_name, customer_key,
            plan_type, amount, billing_cycle, next_billing_date, 
            status, created_at
          ) VALUES (
            @userId, @orderId, @orderName, @customerKey,
            @planType, @amount, @billingCycle, @nextBillingDate,
            @status, GETDATE()
          )
        `);

      console.log('주문 정보 저장 완료');

      return NextResponse.json({
        success: true,
        message: '자동결제 주문이 생성되었습니다.',
        orderId: orderId,
        orderName: orderName,
        customerKey: customerKey,
        billingCycle: billingCycle,
        nextBillingDate: nextBillingDate,
        planId: planId,
        amount: amount
      });

    } catch (dbError) {
      console.error('주문 정보 저장 실패:', dbError);
      return NextResponse.json({ 
        error: '주문 정보 저장에 실패했습니다.' 
      }, { status: 500 });
    }

  } catch (error) {
    console.error('자동결제 주문 생성 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 