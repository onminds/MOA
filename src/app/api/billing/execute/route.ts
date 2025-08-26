import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 자동결제 실행 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { billingKey, amount, orderId, orderName } = await request.json();
    
    console.log('자동결제 실행 요청 받음:', { billingKey, amount, orderId, orderName });

    // 1. 토스페이먼츠 API 호출하여 자동결제 실행
    console.log('토스페이먼츠 자동결제 실행 API 호출 준비:', {
      secretKey: process.env.TOSS_SECRET_KEY ? '설정됨' : '설정되지 않음',
      secretKeyLength: process.env.TOSS_SECRET_KEY?.length || 0
    });
    
    // 빌링키로 자동결제 실행
    const response = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        orderId: orderId,
        orderName: orderName,
        customerName: session.user.name || '사용자',
        customerEmail: session.user.email || 'user@example.com'
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 자동결제 실행 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.status === 'DONE') {
      // 자동결제 성공
      console.log('토스페이먼츠 자동결제 실행 성공:', {
        billingKey,
        orderId,
        amount,
        result: result
      });
      
      const db = await getConnection();

      // 결제 내역에 성공 기록
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('billingKey', billingKey)
        .input('amount', amount)
        .input('status', 'completed')
        .input('paymentMethod', 'card')
        .input('paymentKey', result.paymentKey)
        .input('transactionId', result.transactionId)
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, billing_key, amount, 
            status, payment_method, payment_key, receipt_id, 
            created_at
          ) VALUES (
            @userId, @orderId, @billingKey, @amount,
            @status, @paymentMethod, @paymentKey, @transactionId,
            GETDATE()
          )
        `);

      console.log('결제 내역 저장 완료');

      // 구독 정보 업데이트 (다음 결제일 갱신)
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      await db.request()
        .input('billingKey', billingKey)
        .input('nextBillingDate', nextBillingDate)
        .input('lastBillingDate', new Date())
        .query(`
          UPDATE subscriptions 
          SET next_billing_date = @nextBillingDate,
              last_billing_date = @lastBillingDate,
              updated_at = GETDATE()
          WHERE billing_key = @billingKey
        `);

      console.log('구독 정보 업데이트 완료');

      return NextResponse.json({
        success: true,
        message: '자동결제가 성공적으로 실행되었습니다.',
        paymentKey: result.paymentKey,
        transactionId: result.transactionId,
        nextBillingDate: nextBillingDate,
        amount: amount
      });

    } else {
      // 자동결제 실패
      console.error('토스페이먼츠 자동결제 실행 실패:', result);
      
      const db = await getConnection();
      
      // 실패한 결제 내역 기록
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('billingKey', billingKey)
        .input('amount', amount)
        .input('status', 'failed')
        .input('paymentMethod', 'card')
        .input('errorMessage', result.message || '자동결제 실행 실패')
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, billing_key, amount, 
            status, payment_method, error_message, 
            created_at
          ) VALUES (
            @userId, @orderId, @billingKey, @amount,
            @status, @paymentMethod, @errorMessage,
            GETDATE()
          )
        `);

      return NextResponse.json({
        success: false,
        error: result.message || '자동결제 실행에 실패했습니다.',
        code: result.code
      }, { status: 400 });
    }

  } catch (error) {
    console.error('자동결제 실행 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
