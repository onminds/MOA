import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { receiptId, orderId } = await request.json();

    // 1. Bootpay API 호출하여 결제 검증
    const response = await fetch('https://api.bootpay.co.kr/v2/request/receipt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BOOTPAY_PRIVATE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        receipt_id: receiptId
      })
    });

    const result = await response.json();

    if (result.status === 200 && result.data.status === 1) {
      // 결제 성공
      const db = await getConnection();

      // 2. DB 업데이트
      await db.request()
        .input('transactionId', orderId)
        .input('receiptId', receiptId)
        .input('status', 'completed')
        .input('paymentMethod', result.data.payment_method || 'card')
        .query(`
          UPDATE payments 
          SET receipt_id = @receiptId, status = @status, payment_method = @paymentMethod, updated_at = GETDATE()
          WHERE transaction_id = @transactionId
        `);

      // 3. 사용자 플랜 업데이트 (payments 테이블의 최신 플랜으로)
      await db.request()
        .input('userId', session.user.id)
        .input('planType', result.data.order_name.toLowerCase().includes('standard') ? 'standard' : 
                         result.data.order_name.toLowerCase().includes('pro') ? 'pro' : 'basic')
        .query(`
          UPDATE users 
          SET plan_type = @planType, updated_at = GETDATE()
          WHERE id = @userId
        `);

      return NextResponse.json({
        success: true,
        message: '결제가 완료되었습니다.',
        planType: result.data.order_name
      });
    } else {
      // 결제 실패
      const db = await getConnection();
      await db.request()
        .input('transactionId', orderId)
        .input('status', 'failed')
        .query(`
          UPDATE payments 
          SET status = @status, updated_at = GETDATE()
          WHERE transaction_id = @transactionId
        `);

      return NextResponse.json({
        success: false,
        message: '결제에 실패했습니다.',
        error: result.message
      });
    }

  } catch (error) {
    console.error('결제 확인 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 