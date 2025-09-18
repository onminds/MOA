import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 자동 플랜 전환 API 시작 ===');
    
    const db = await getConnection();

    // 1. 다음 결제일이 도래한 취소된 구독 조회
    const expiredSubscriptions = await db.request()
      .query(`
        SELECT 
          sc.user_id,
          sc.subscription_id,
          sc.next_billing_date,
          s.plan_type
        FROM subscription_cancellations sc
        INNER JOIN subscriptions s ON sc.subscription_id = s.subscription_id
        WHERE sc.auto_plan_change = 1
          AND sc.next_billing_date <= GETDATE()
          AND sc.plan_changed = 0
      `);

    console.log('자동 플랜 전환 대상 구독 수:', expiredSubscriptions.recordset.length);

    const results = [];

    for (const subscription of expiredSubscriptions.recordset) {
      try {
        // 2. Basic Plan 결제 기록 생성 (무료)
        await db.request()
          .input('userId', subscription.user_id)
          .input('planType', 'basic')
          .input('amount', 0)
          .input('status', 'completed')
          .input('subscriptionId', subscription.subscription_id)
          .query(`
            INSERT INTO payments (
              user_id, plan_type, amount, status, subscription_id,
              created_at, updated_at
            ) VALUES (
              @userId, @planType, @amount, @status, @subscriptionId,
              GETDATE(), GETDATE()
            )
          `);

        // 3. 자동 플랜 전환 완료 표시
        await db.request()
          .input('subscriptionId', subscription.subscription_id)
          .query(`
            UPDATE subscription_cancellations 
            SET plan_changed = 1,
                plan_changed_at = GETDATE(),
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);

        results.push({
          subscriptionId: subscription.subscription_id,
          userId: subscription.user_id,
          planType: subscription.plan_type,
          status: 'success',
          message: 'Basic Plan으로 자동 전환 완료'
        });

        console.log('자동 플랜 전환 완료:', {
          subscriptionId: subscription.subscription_id,
          userId: subscription.user_id,
          fromPlan: subscription.plan_type,
          toPlan: 'basic'
        });

      } catch (error) {
        console.error('개별 구독 플랜 전환 실패:', {
          subscriptionId: subscription.subscription_id,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        });

        results.push({
          subscriptionId: subscription.subscription_id,
          userId: subscription.user_id,
          planType: subscription.plan_type,
          status: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: '자동 플랜 전환 처리 완료',
      processedCount: expiredSubscriptions.recordset.length,
      results: results
    });

  } catch (error) {
    console.error('자동 플랜 전환 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}

// 수동으로 특정 구독의 플랜 전환을 처리하는 API
export async function PUT(request: NextRequest) {
  try {
    const { subscriptionId } = await request.json();
    
    if (!subscriptionId) {
      return NextResponse.json({ error: '구독 ID가 필요합니다.' }, { status: 400 });
    }

    const db = await getConnection();

    // 1. 구독 정보 조회
    const subscriptionResult = await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        SELECT user_id, plan_type, next_billing_date
        FROM subscriptions 
        WHERE subscription_id = @subscriptionId
      `);

    if (subscriptionResult.recordset.length === 0) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.recordset[0];

    // 2. Basic Plan 결제 기록 생성
    await db.request()
      .input('userId', subscription.user_id)
      .input('planType', 'basic')
      .input('amount', 0)
      .input('status', 'completed')
      .input('subscriptionId', subscriptionId)
      .query(`
        INSERT INTO payments (
          user_id, plan_type, amount, status, subscription_id,
          created_at, updated_at
        ) VALUES (
          @userId, @planType, @amount, @status, @subscriptionId,
          GETDATE(), GETDATE()
        )
      `);

    // 3. 구독 상태 완전 정리 (subscriptions 테이블)
    await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        UPDATE subscriptions 
        SET status = 'cancelled',
            auto_renewal = 0,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);

    // 4. 구독 취소 스케줄 완료 처리
    await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        UPDATE subscription_cancellations 
        SET plan_changed = 1,
            plan_changed_at = GETDATE(),
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);

    // 5. 기존 결제 내역 정리 (해당 구독 관련 결제들을 cancelled로 변경)
    await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        UPDATE payments 
        SET status = 'cancelled',
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId 
          AND status != 'completed'
      `);

    return NextResponse.json({
      success: true,
      message: '수동 플랜 전환 완료',
      subscriptionId: subscriptionId,
      fromPlan: subscription.plan_type,
      toPlan: 'basic'
    });

  } catch (error) {
    console.error('수동 플랜 전환 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
