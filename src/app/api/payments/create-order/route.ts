import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 주문 생성 API 시작 ===');
    
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

    console.log('DB 연결 시도...');
    const db = await getConnection();
    console.log('DB 연결 성공');
    
    // 주문 ID 생성 (고유값 + planId 포함)
    const orderId = `order_${Date.now()}_${planId}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('생성된 주문 ID:', orderId);

    // 주문 정보 DB 저장
    console.log('DB 저장 시도...');
    await db.request()
      .input('transactionId', orderId)
      .input('userId', session.user.id)
      .input('planType', planId)
      .input('amount', amount)
      .input('status', 'pending')
      .query(`
        INSERT INTO payments (transaction_id, user_id, plan_type, amount, status, created_at, updated_at)
        VALUES (@transactionId, @userId, @planType, @amount, @status, GETDATE(), GETDATE())
      `);
    console.log('DB 저장 성공');

    return NextResponse.json({
      orderId,
      orderName: plan.name,
      amount
    });

  } catch (error) {
    console.error('주문 생성 오류:', error);
    console.error('오류 상세:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 