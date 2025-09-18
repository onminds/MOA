import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import { executeTransaction } from '@/lib/db-pool';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 상태 롤백 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { orderId } = await request.json();
    
    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 누락되었습니다.' }, { status: 400 });
    }

    const db = await getConnection();

    // 1. pending 상태의 주문 정보 조회
    const pendingOrderResult = await db.request()
      .input('orderId', orderId)
      .input('userId', session.user.id)
      .query(`
        SELECT * FROM payments 
        WHERE transaction_id = @orderId AND user_id = @userId AND status = 'pending'
      `);

    if (pendingOrderResult.recordset.length === 0) {
      console.log('pending 상태의 주문을 찾을 수 없음');
      return NextResponse.json({ error: '롤백할 주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const pendingOrder = pendingOrderResult.recordset[0];
    console.log('pending 주문 정보:', pendingOrder);

    // 2. 해당 사용자의 가장 최근 active 구독을 inactive로 변경한 기록 찾기
    const inactiveSubscriptionResult = await db.request()
      .input('userId', session.user.id)
      .input('planType', pendingOrder.plan_type)
      .query(`
        SELECT TOP 1 * FROM subscriptions 
        WHERE user_id = @userId 
          AND plan_type != @planType 
          AND status = 'inactive'
          AND updated_at >= DATEADD(MINUTE, -10, GETDATE()) -- 최근 10분 내에 변경된 것만
        ORDER BY updated_at DESC
      `);

    if (inactiveSubscriptionResult.recordset.length === 0) {
      console.log('롤백할 구독 정보를 찾을 수 없음');
      // pending 주문만 삭제
      await db.request()
        .input('orderId', orderId)
        .query(`
          DELETE FROM payments 
          WHERE transaction_id = @orderId
        `);
      
      console.log('pending 주문만 삭제 완료');
      
      return NextResponse.json({
        success: true,
        message: 'pending 주문이 삭제되었습니다.',
        rollbackType: 'order_only'
      });
    }

    const inactiveSubscription = inactiveSubscriptionResult.recordset[0];
    console.log('롤백할 구독 정보:', inactiveSubscription);

    // 3. 트랜잭션으로 롤백 처리
    try {
      await executeTransaction(async (transaction) => {
        // 3-1. 구독 상태를 다시 active로 복구
        await transaction.request()
          .input('subscriptionId', inactiveSubscription.subscription_id)
          .query(`
            UPDATE subscriptions 
            SET status = 'active', 
                auto_renewal = 1,
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);

        // 3-2. pending 주문 삭제
        await transaction.request()
          .input('orderId', orderId)
          .query(`
            DELETE FROM payments 
            WHERE transaction_id = @orderId
          `);
      });
      
      console.log('구독 상태 롤백 완료:', {
        subscriptionId: inactiveSubscription.subscription_id,
        planType: inactiveSubscription.plan_type,
        status: 'active'
      });

      return NextResponse.json({
        success: true,
        message: '구독 상태가 성공적으로 복구되었습니다.',
        rollbackType: 'full',
        subscriptionId: inactiveSubscription.subscription_id,
        planType: inactiveSubscription.plan_type
      });

    } catch (transactionError) {
      console.error('트랜잭션 실행 오류:', transactionError);
      throw transactionError;
    }

  } catch (error) {
    console.error('구독 상태 롤백 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
