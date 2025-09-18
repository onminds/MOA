import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 해제 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { subscriptionId } = await request.json();
    
    if (!subscriptionId) {
      return NextResponse.json({ error: '구독 ID가 누락되었습니다.' }, { status: 400 });
    }

    const db = await getConnection();

    // 1. 구독 정보 조회
    const subscriptionResult = await db.request()
      .input('subscriptionId', subscriptionId)
      .input('userId', session.user.id)
      .query(`
        SELECT * FROM subscriptions 
        WHERE subscription_id = @subscriptionId AND user_id = @userId
      `);

    if (subscriptionResult.recordset.length === 0) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.recordset[0];
    console.log('구독 정보 조회:', subscription);

    // 2. 구독 상태를 inactive로 변경
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('userId', session.user.id)
      .query(`
        UPDATE subscriptions 
        SET status = 'inactive', 
            auto_renewal = 0,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId AND user_id = @userId
      `);

    // 3. users 테이블은 plan_type 컬럼이 없으므로 payments 테이블만 업데이트
    console.log('사용자 플랜 정보는 payments 테이블에서 관리됩니다.');

    // 4. payments 테이블에서 해당 구독 관련 결제 상태 업데이트
    await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        UPDATE payments 
        SET status = 'cancelled',
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);

    // 5. 다음 결제일에 Basic Plan으로 자동 전환하기 위한 스케줄 정보 저장
    const nextBillingDate = subscription.next_billing_date;
    if (nextBillingDate) {
      await db.request()
        .input('userId', session.user.id)
        .input('subscriptionId', subscriptionId)
        .input('planType', subscription.plan_type)
        .input('nextBillingDate', nextBillingDate)
        .query(`
          INSERT INTO subscription_cancellations (
            user_id, subscription_id, plan_type, canceled_at, 
            next_billing_date, auto_plan_change, created_at
          ) VALUES (
            @userId, @subscriptionId, @planType, GETDATE(),
            @nextBillingDate, 1, GETDATE()
          )
        `);
      
      console.log('다음 결제일 자동 Basic Plan 전환 스케줄 등록:', {
        planType: subscription.plan_type,
        nextBillingDate: nextBillingDate.toISOString()
      });
    }

    console.log('구독 해제 완료:', {
      subscriptionId,
      userId: session.user.id,
      status: 'inactive'
    });

    return NextResponse.json({
      success: true,
      message: '구독이 성공적으로 해제되었습니다.',
      subscriptionId: subscriptionId
    });

  } catch (error) {
    console.error('구독 해제 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 구독 정보 조회 API (GET)
export async function GET(request: NextRequest) {
  try {
    console.log('=== 구독 정보 조회 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const db = await getConnection();

    // 사용자의 활성 구독 조회 (subscriptions 테이블에서 조회)
    const subscriptionResult = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT 
          subscription_id,
          plan_type,
          status,
          subscription_start_date,
          next_billing_date,
          auto_renewal,
          created_at,
          amount
        FROM subscriptions 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    // 구독 취소 정보도 함께 조회
    const cancellationResult = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT 
          subscription_id,
          plan_type,
          canceled_at,
          next_billing_date,
          auto_plan_change,
          plan_changed
        FROM subscription_cancellations 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    const subscriptions = subscriptionResult.recordset.map(sub => {
      // 해당 구독의 취소 정보 찾기
      const cancellation = cancellationResult.recordset.find(c => c.subscription_id === sub.subscription_id);
      
      return {
        subscriptionId: sub.subscription_id,
        planType: sub.plan_type,
        status: sub.status,
        startDate: sub.subscription_start_date,
        nextBillingDate: sub.next_billing_date,
        autoRenewal: sub.auto_renewal,
        canceledAt: cancellation?.canceled_at || null,
        amount: sub.amount,
        // 취소 관련 추가 정보
        isCancelled: !!cancellation,
        planChangeDate: cancellation?.next_billing_date || null,
        autoPlanChange: cancellation?.auto_plan_change || false,
        planChanged: cancellation?.plan_changed || false
      };
    });

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions,
      activeSubscription: subscriptions.find(sub => sub.status === 'active') || null,
      // 취소된 구독 중 가장 최근 것
      cancelledSubscription: subscriptions.find(sub => sub.isCancelled) || null
    });

  } catch (error) {
    console.error('구독 정보 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
