import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import crypto from 'crypto';

// 웹훅 서명 검증 함수
function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.TOSS_SECRET_KEY) {
    console.error('웹훅 서명 또는 시크릿 키가 없습니다.');
    return false;
  }

  try {
    const signingSecret = process.env.TOSS_WEBHOOK_SECRET || process.env.TOSS_SECRET_KEY;
    const expectedSignature = crypto
      .createHmac('sha256', signingSecret)
      .update(body)
      .digest('base64');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    console.log('웹훅 서명 검증 결과:', {
      expected: expectedSignature,
      received: signature,
      isValid: isValid
    });

    return isValid;
  } catch (error) {
    console.error('웹훅 서명 검증 중 오류:', error);
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
      case 'BILLING_DELETED':
        await handleBillingDeleted(db, data);
        break;
      case 'PAYMENT_STATUS_CHANGED':
        await handlePaymentStatusChanged(db, data);
        break;
        
      case 'BILLING_STATUS_CHANGED':
        await handleBillingStatusChanged(db, data);
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
  
  const { paymentKey, orderId, status, totalAmount } = data;
  
  try {
    if (status === 'DONE') {
      // 결제 성공
      await db.request()
        .input('paymentKey', paymentKey)
        .input('orderId', orderId)
        .input('status', 'completed')
        .input('amount', totalAmount)
        .query(`
          UPDATE payments 
          SET status = @status, 
              amount = @amount,
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);
      
      console.log('결제 상태 업데이트 완료: 성공');
    } else if (status === 'CANCELED') {
      // 결제 취소
      await db.request()
        .input('paymentKey', paymentKey)
        .input('orderId', orderId)
        .input('status', 'canceled')
        .query(`
          UPDATE payments 
          SET status = @status, 
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);
      
      console.log('결제 상태 업데이트 완료: 취소');
    }
  } catch (error) {
    console.error('결제 상태 변경 처리 오류:', error);
  }
}

// 빌링 상태 변경 처리
async function handleBillingStatusChanged(db: any, data: any) {
  console.log('빌링 상태 변경 처리:', data);
  
  const { billingKey, status, orderId } = data;
  
  try {
    if (status === 'DONE') {
      // 빌링 성공
      await db.request()
        .input('billingKey', billingKey)
        .input('orderId', orderId)
        .input('status', 'completed')
        .query(`
          UPDATE payments 
          SET status = @status, 
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);
      
      console.log('빌링 상태 업데이트 완료: 성공');
    } else if (status === 'FAILED') {
      // 빌링 실패
      await db.request()
        .input('billingKey', billingKey)
        .input('orderId', orderId)
        .input('status', 'failed')
        .query(`
          UPDATE payments 
          SET status = @status, 
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);
      
      console.log('빌링 상태 업데이트 완료: 실패');
    }
  } catch (error) {
    console.error('빌링 상태 변경 처리 오류:', error);
  }
}

// 구독 갱신 처리
async function handleSubscriptionRenewed(db: any, data: any) {
  console.log('구독 갱신 처리:', data);
  
  const { subscriptionId, billingKey, amount, orderId } = data;
  
  try {
    // 새로운 결제 내역 생성
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('billingKey', billingKey)
      .input('amount', amount)
      .input('orderId', orderId)
      .input('status', 'completed')
      .query(`
        INSERT INTO payments (
          subscription_id, billing_key, amount, transaction_id, 
          status, payment_method, created_at
        ) VALUES (
          @subscriptionId, @billingKey, @amount, @orderId,
          @status, 'card', GETDATE()
        )
      `);
    
    // 구독 정보 업데이트 (다음 결제일 갱신)
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('nextBillingDate', nextBillingDate)
      .input('lastBillingDate', new Date())
      .query(`
        UPDATE subscriptions 
        SET next_billing_date = @nextBillingDate,
            last_billing_date = @lastBillingDate,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);
    
    console.log('구독 갱신 처리 완료');
  } catch (error) {
    console.error('구독 갱신 처리 오류:', error);
  }
}

// 구독 취소 처리
async function handleSubscriptionCanceled(db: any, data: any) {
  console.log('구독 취소 처리:', data);
  
  const { subscriptionId, reason } = data;
  
  try {
    // 구독 상태를 취소로 변경
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('canceledAt', new Date())
      .input('reason', reason || '토스페이먼츠 웹훅')
      .query(`
        UPDATE subscriptions 
        SET status = 'canceled',
            canceled_at = @canceledAt,
            cancel_reason = @reason,
            auto_renewal = 0,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);
    
    // 사용자 플랜을 Basic으로 변경
    await db.request()
      .input('subscriptionId', subscriptionId)
      .query(`
        UPDATE users 
        SET plan_type = 'basic', 
            subscription_id = NULL,
            updated_at = GETDATE()
        WHERE subscription_id = @subscriptionId
      `);
    
    console.log('구독 취소 처리 완료');
  } catch (error) {
    console.error('구독 취소 처리 오류:', error);
  }
}

// 구독 실패 처리
async function handleSubscriptionFailed(db: any, data: any) {
  console.log('구독 실패 처리:', data);
  
  const { subscriptionId, reason, billingKey, orderId } = data;
  
  try {
    // 결제 내역에 실패 기록
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('billingKey', billingKey)
      .input('orderId', orderId)
      .input('status', 'failed')
      .input('errorMessage', reason || '구독 실패')
      .query(`
        INSERT INTO payments (
          subscription_id, billing_key, transaction_id, 
          status, payment_method, error_message, created_at
        ) VALUES (
          @subscriptionId, @billingKey, @orderId,
          @status, 'card', @errorMessage, GETDATE()
        )
      `);
    
    console.log('구독 실패 처리 완료');
  } catch (error) {
    console.error('구독 실패 처리 오류:', error);
  }
}

// 구독 결제 실패 처리
async function handleSubscriptionPaymentFailed(db: any, data: any) {
  console.log('구독 결제 실패 처리:', data);
  
  const { subscriptionId, reason, billingKey, orderId, amount } = data;
  
  try {
    // 결제 내역에 실패 기록
    await db.request()
      .input('subscriptionId', subscriptionId)
      .input('billingKey', billingKey)
      .input('orderId', orderId)
      .input('amount', amount)
      .input('status', 'failed')
      .input('errorMessage', reason || '구독 결제 실패')
      .query(`
        INSERT INTO payments (
          subscription_id, billing_key, transaction_id, amount,
          status, payment_method, error_message, created_at
        ) VALUES (
          @subscriptionId, @billingKey, @orderId, @amount,
          @status, 'card', @errorMessage, GETDATE()
        )
      `);
    
    console.log('구독 결제 실패 처리 완료');
  } catch (error) {
    console.error('구독 결제 실패 처리 오류:', error);
  }
}

// 빌링 삭제 처리 (구매자 탈퇴/빌링키 삭제)
async function handleBillingDeleted(db: any, data: any) {
  console.log('빌링 삭제 처리:', data);

  const { billingKey } = data;

  try {
    // 해당 빌링키를 가진 구독을 취소 상태로 전환
    await db.request()
      .input('billingKey', billingKey)
      .query(`
        UPDATE subscriptions 
        SET status = 'canceled',
            auto_renewal = 0,
            canceled_at = GETDATE(),
            updated_at = GETDATE()
        WHERE billing_key = @billingKey
      `);

    // 해당 빌링키를 가진 사용자 플랜을 Basic으로 복귀
    await db.request()
      .input('billingKey', billingKey)
      .query(`
        UPDATE users 
        SET plan_type = 'basic',
            subscription_id = NULL,
            updated_at = GETDATE()
        WHERE subscription_id IN (
          SELECT TOP 1 subscription_id FROM subscriptions WHERE billing_key = @billingKey
        )
      `);

    console.log('빌링 삭제 처리 완료');
  } catch (error) {
    console.error('빌링 삭제 처리 오류:', error);
  }
}
