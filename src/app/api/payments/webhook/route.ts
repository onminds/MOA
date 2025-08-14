import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import crypto from 'crypto';

// 웹훅 서명 검증 함수
function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.TOSS_WEBHOOK_SECRET) {
    console.log('웹훅 서명 또는 시크릿 키가 없습니다.');
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.TOSS_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );

    console.log('웹훅 서명 검증:', { isValid, expectedSignature, receivedSignature: signature });
    return isValid;
  } catch (error) {
    console.error('웹훅 서명 검증 오류:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== 토스페이먼츠 웹훅 수신 ===');
    
    const body = await request.text();
    const signature = request.headers.get('toss-signature');
    
    console.log('웹훅 요청 정보:', {
      method: request.method,
      url: request.url,
      signature: signature ? '있음' : '없음',
      bodyLength: body.length
    });

    // 웹훅 서명 검증
    if (!verifyWebhookSignature(body, signature)) {
      console.error('웹훅 서명 검증 실패');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const webhookData = JSON.parse(body);
    console.log('웹훅 데이터:', webhookData);

    const { eventType, data } = webhookData;
    
    console.log('웹훅 이벤트 타입:', eventType);

    const db = await getConnection();

    switch (eventType) {
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(db, data);
        break;
        
      case 'SUBSCRIPTION_RENEWED':
        await handleSubscriptionRenewed(db, data);
        break;
        
      case 'SUBSCRIPTION_CANCELED':
        await handleSubscriptionCanceled(db, data);
        break;
        
      case 'SUBSCRIPTION_FAILED':
        await handleSubscriptionFailed(db, data);
        break;
        
      case 'SUBSCRIPTION_PAYMENT_FAILED':
        await handleSubscriptionPaymentFailed(db, data);
        break;
        
      default:
        console.log('처리되지 않은 웹훅 이벤트:', eventType);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('웹훅 처리 오류:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

// 결제 상태 변경 처리
async function handlePaymentStatusChanged(db: any, data: any) {
  console.log('결제 상태 변경 처리:', data);
  
  const { orderId, status, paymentKey } = data;
  
  try {
    await db.request()
      .input('orderId', orderId)
      .input('status', status)
      .input('paymentKey', paymentKey)
      .query(`
        UPDATE payments 
        SET status = @status, 
            receipt_id = @paymentKey,
            updated_at = GETDATE()
        WHERE transaction_id = @orderId
      `);
    
    console.log('결제 상태 업데이트 완료:', { orderId, status });
  } catch (error) {
    console.error('결제 상태 업데이트 오류:', error);
  }
}

// 구독 갱신 처리
async function handleSubscriptionRenewed(db: any, data: any) {
  console.log('구독 갱신 처리:', data);
  
  const { subscriptionId, orderId, amount, nextBillingDate } = data;
  
  try {
    // 새로운 결제 레코드 생성
    await db.request()
      .input('transactionId', orderId)
      .input('subscriptionId', subscriptionId)
      .input('amount', amount)
      .input('status', 'completed')
      .input('subscriptionStatus', 'active')
      .input('nextBillingDate', nextBillingDate)
      .input('autoRenewal', 1)
      .query(`
        INSERT INTO payments (
          transaction_id, subscription_id, amount, status,
          subscription_status, next_billing_date, auto_renewal,
          created_at, updated_at
        )
        VALUES (
          @transactionId, @subscriptionId, @amount, @status,
          @subscriptionStatus, @nextBillingDate, @autoRenewal,
          GETDATE(), GETDATE()
        )
      `);
    
    console.log('구독 갱신 완료:', { subscriptionId, orderId, nextBillingDate });
  } catch (error) {
    console.error('구독 갱신 처리 오류:', error);
  }
}

// 구독 취소 처리
async function handleSubscriptionCanceled(db: any, data: any) {
  console.log('구독 취소 처리:', data);
  
  const { subscriptionId, canceledAt } = data;
  
  try {
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('canceledAt', canceledAt)
      .input('subscriptionStatus', 'canceled')
      .query(`
        UPDATE payments 
        SET subscription_status = @subscriptionStatus,
            canceled_at = @canceledAt,
            auto_renewal = 0,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);
    
    console.log('구독 취소 완료:', { subscriptionId, canceledAt });
  } catch (error) {
    console.error('구독 취소 처리 오류:', error);
  }
}

// 구독 실패 처리
async function handleSubscriptionFailed(db: any, data: any) {
  console.log('구독 실패 처리:', data);
  
  const { subscriptionId, failedAt, reason } = data;
  
  try {
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('failedAt', failedAt)
      .input('subscriptionStatus', 'failed')
      .query(`
        UPDATE payments 
        SET subscription_status = @subscriptionStatus,
            canceled_at = @failedAt,
            auto_renewal = 0,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);
    
    console.log('구독 실패 처리 완료:', { subscriptionId, failedAt, reason });
  } catch (error) {
    console.error('구독 실패 처리 오류:', error);
  }
}

// 구독 결제 실패 처리
async function handleSubscriptionPaymentFailed(db: any, data: any) {
  console.log('구독 결제 실패 처리:', data);
  
  const { subscriptionId, orderId, failedAt, reason } = data;
  
  try {
    // 결제 실패 레코드 생성
    await db.request()
      .input('transactionId', orderId)
      .input('subscriptionId', subscriptionId)
      .input('status', 'failed')
      .input('subscriptionStatus', 'payment_failed')
      .input('failedAt', failedAt)
      .query(`
        INSERT INTO payments (
          transaction_id, subscription_id, status,
          subscription_status, canceled_at,
          created_at, updated_at
        )
        VALUES (
          @transactionId, @subscriptionId, @status,
          @subscriptionStatus, @failedAt,
          GETDATE(), GETDATE()
        )
      `);
    
    console.log('구독 결제 실패 처리 완료:', { subscriptionId, orderId, failedAt, reason });
  } catch (error) {
    console.error('구독 결제 실패 처리 오류:', error);
  }
}
