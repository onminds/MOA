import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 결제 처리 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { subscriptionId } = await request.json();
    console.log('받은 데이터:', { subscriptionId });

    const db = await getConnection();
    
    // 구독 정보 조회
    const subscriptionResult = await db.request()
      .input('subscriptionId', subscriptionId)
      .input('userId', session.user.id)
      .query(`
        SELECT s.id, s.plan_type, s.amount, s.billing_cycle, s.next_billing_date,
               bk.billing_key, bk.customer_key
        FROM subscriptions s
        JOIN billing_keys bk ON s.billing_key_id = bk.id
        WHERE s.id = @subscriptionId AND s.user_id = @userId AND s.status = 'active'
      `);

    if (subscriptionResult.recordset.length === 0) {
      return NextResponse.json({ error: '유효하지 않은 구독입니다.' }, { status: 400 });
    }

    const subscription = subscriptionResult.recordset[0];
    
    // 주문 ID 생성
    const orderId = `sub_${Date.now()}_${subscriptionId}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 토스페이먼츠 빌링 결제 API 호출
    const response = await fetch(`https://api.tosspayments.com/v1/billing/${subscription.billing_key}`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customerKey: subscription.customer_key,
        amount: subscription.amount,
        orderId: orderId,
        orderName: `${subscription.plan_type} 구독 결제`,
        customerEmail: session.user.email || 'user@example.com',
        customerName: session.user.name || '사용자',
        taxFreeAmount: 0
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 빌링 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.status === 'DONE') {
      // 결제 성공
      const paymentKey = result.paymentKey;
      
      // 구독 결제 내역 저장
      await db.request()
        .input('subscriptionId', subscriptionId)
        .input('billingKeyId', subscription.billing_key_id)
        .input('orderId', orderId)
        .input('paymentKey', paymentKey)
        .input('amount', subscription.amount)
        .input('status', 'completed')
        .input('billingDate', new Date())
        .query(`
          INSERT INTO subscription_payments (subscription_id, billing_key_id, order_id, payment_key, amount, status, billing_date)
          VALUES (@subscriptionId, @billingKeyId, @orderId, @paymentKey, @amount, @status, @billingDate)
        `);

      // 다음 결제일 업데이트
      const nextBillingDate = new Date(subscription.next_billing_date);
      if (subscription.billing_cycle === 'monthly') {
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
      } else if (subscription.billing_cycle === 'yearly') {
        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
      }

      await db.request()
        .input('subscriptionId', subscriptionId)
        .input('nextBillingDate', nextBillingDate)
        .query(`
          UPDATE subscriptions 
          SET next_billing_date = @nextBillingDate, updated_at = GETDATE()
          WHERE id = @subscriptionId
        `);

      console.log('구독 결제 완료:', {
        subscriptionId,
        orderId,
        paymentKey,
        amount: subscription.amount,
        nextBillingDate
      });

      return NextResponse.json({
        success: true,
        orderId,
        paymentKey,
        amount: subscription.amount,
        nextBillingDate: nextBillingDate.toISOString()
      });
    } else {
      // 결제 실패
      console.log('구독 결제 실패:', {
        responseStatus: response.status,
        result: result
      });

      // 실패 내역 저장
      await db.request()
        .input('subscriptionId', subscriptionId)
        .input('billingKeyId', subscription.billing_key_id)
        .input('orderId', orderId)
        .input('amount', subscription.amount)
        .input('status', 'failed')
        .input('billingDate', new Date())
        .query(`
          INSERT INTO subscription_payments (subscription_id, billing_key_id, order_id, amount, status, billing_date)
          VALUES (@subscriptionId, @billingKeyId, @orderId, @amount, @status, @billingDate)
        `);

      return NextResponse.json({
        success: false,
        message: '구독 결제에 실패했습니다.',
        error: result.message || '알 수 없는 오류'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('구독 결제 처리 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 