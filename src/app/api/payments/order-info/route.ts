import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('=== 주문 정보 조회 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    
    if (!orderId) {
      return NextResponse.json({ error: '주문 ID가 필요합니다.' }, { status: 400 });
    }

    console.log('주문 정보 조회 요청:', { orderId, userId: session.user.id });

    const db = await getConnection();

    // 주문 정보 조회
    const orderResult = await db.request()
      .input('orderId', orderId)
      .input('userId', session.user.id)
      .query(`
        SELECT id, transaction_id, order_name, customer_key, plan_type, 
               amount, billing_cycle, next_billing_date, status, created_at
        FROM payments 
        WHERE transaction_id = @orderId AND user_id = @userId
      `);

    if (orderResult.recordset.length === 0) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const order = orderResult.recordset[0];
    console.log('주문 정보 조회 완료:', order);

    return NextResponse.json({
      success: true,
      orderId: order.transaction_id,
      orderName: order.order_name,
      customerKey: order.customer_key,
      planId: order.plan_type,
      amount: order.amount,
      billingCycle: order.billing_cycle,
      nextBillingDate: order.next_billing_date,
      status: order.status,
      createdAt: order.created_at
    });

  } catch (error) {
    console.error('주문 정보 조회 API 오류:', error);
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
