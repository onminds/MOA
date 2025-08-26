import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 취소 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { subscriptionId, reason } = await request.json();
    
    console.log('구독 취소 요청 받음:', { subscriptionId, reason });

    const db = await getConnection();

    // 1. 구독 정보 조회
    const subscription = await db.request()
      .input('userId', session.user.id)
      .input('subscriptionId', subscriptionId)
      .query(`
        SELECT id, billing_key, customer_key, plan_type, status, 
               subscription_start_date, next_billing_date
        FROM subscriptions 
        WHERE user_id = @userId AND subscription_id = @subscriptionId
      `);

    if (subscription.recordset.length === 0) {
      return NextResponse.json({ 
        error: '구독 정보를 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    const sub = subscription.recordset[0];
    console.log('구독 정보:', sub);

    // 2. 토스페이먼츠 API 호출하여 구독 취소
    console.log('토스페이먼츠 구독 취소 API 호출 준비');
    
    try {
      // 토스페이먼츠에서는 빌링키를 직접 삭제하는 API가 없으므로
      // 데이터베이스에서 구독 상태만 변경
      console.log('토스페이먼츠 구독 취소 처리 (데이터베이스 상태 변경)');
      
      // 구독 상태를 취소로 변경
      await db.request()
        .input('subscriptionId', subscriptionId)
        .input('canceledAt', new Date())
        .input('reason', reason || '사용자 요청')
        .query(`
          UPDATE subscriptions 
          SET status = 'canceled',
              canceled_at = @canceledAt,
              cancel_reason = @reason,
              auto_renewal = 0,
              updated_at = GETDATE()
          WHERE subscription_id = @subscriptionId
        `);

      console.log('구독 상태 취소로 변경 완료');

      // 사용자 플랜을 Basic으로 변경
      await db.request()
        .input('userId', session.user.id)
        .query(`
          UPDATE users 
          SET plan_type = 'basic', 
              subscription_id = NULL,
              updated_at = GETDATE()
          WHERE id = @userId
        `);

      console.log('사용자 플랜 Basic으로 변경 완료');

      // 구독 취소 내역 기록
      await db.request()
        .input('userId', session.user.id)
        .input('subscriptionId', subscriptionId)
        .input('planType', sub.plan_type)
        .input('canceledAt', new Date())
        .input('reason', reason || '사용자 요청')
        .query(`
          INSERT INTO subscription_cancellations (
            user_id, subscription_id, plan_type, canceled_at, 
            cancel_reason, created_at
          ) VALUES (
            @userId, @subscriptionId, @planType, @canceledAt,
            @reason, GETDATE()
          )
        `);

      console.log('구독 취소 내역 기록 완료');

      return NextResponse.json({
        success: true,
        message: '구독이 성공적으로 취소되었습니다.',
        subscriptionId: subscriptionId,
        canceledAt: new Date(),
        reason: reason || '사용자 요청'
      });

    } catch (tossError) {
      console.error('토스페이먼츠 구독 취소 처리 오류:', tossError);
      
      // 토스페이먼츠 API 오류가 발생해도 로컬 구독은 취소 처리
      try {
        await db.request()
          .input('subscriptionId', subscriptionId)
          .input('canceledAt', new Date())
          .input('reason', reason || '사용자 요청 (토스페이먼츠 오류)')
          .query(`
            UPDATE subscriptions 
            SET status = 'canceled',
                canceled_at = @canceledAt,
                cancel_reason = @reason,
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);

        console.log('토스페이먼츠 오류 발생했지만 로컬 구독 취소 완료');

        return NextResponse.json({
          success: true,
          message: '구독이 취소되었습니다. (토스페이먼츠 연동에 일시적 문제가 있을 수 있습니다.)',
          subscriptionId: subscriptionId,
          canceledAt: new Date(),
          reason: reason || '사용자 요청'
        });

      } catch (localError) {
        console.error('로컬 구독 취소 처리도 실패:', localError);
        throw localError;
      }
    }

  } catch (error) {
    console.error('구독 취소 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
