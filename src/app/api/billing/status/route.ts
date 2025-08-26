import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('=== 구독 상태 확인 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const db = await getConnection();

    // 1. 현재 활성 구독 정보 조회
    const activeSubscription = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, subscription_id, billing_key, customer_key, plan_type, 
               amount, status, subscription_start_date, next_billing_date, 
               last_billing_date, auto_renewal, created_at, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active'
        ORDER BY created_at DESC
      `);

    // 2. 결제 내역 조회 (최근 10건)
    const paymentHistory = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT TOP 10 id, transaction_id, billing_key, amount, plan_type, 
               status, payment_method, payment_key, receipt_id, 
               error_message, created_at
        FROM payments 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    // 3. 구독 취소 내역 조회
    const cancellationHistory = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, subscription_id, plan_type, canceled_at, 
               cancel_reason, created_at
        FROM subscription_cancellations 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    // 4. 사용자 현재 플랜 정보 조회
    const userInfo = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT id, plan_type, subscription_id, created_at, updated_at
        FROM users 
        WHERE id = @userId
      `);

    const user = userInfo.recordset[0];
    const activeSub = activeSubscription.recordset[0];
    const payments = paymentHistory.recordset;
    const cancellations = cancellationHistory.recordset;

    console.log('구독 상태 조회 완료:', {
      userId: session.user.id,
      hasActiveSubscription: !!activeSub,
      paymentCount: payments.length,
      cancellationCount: cancellations.length
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user?.id,
          planType: user?.plan_type || 'basic',
          subscriptionId: user?.subscription_id,
          createdAt: user?.created_at,
          updatedAt: user?.updated_at
        },
        activeSubscription: activeSub ? {
          id: activeSub.id,
          subscriptionId: activeSub.subscription_id,
          billingKey: activeSub.billing_key,
          customerKey: activeSub.customer_key,
          planType: activeSub.plan_type,
          amount: activeSub.amount,
          status: activeSub.status,
          subscriptionStartDate: activeSub.subscription_start_date,
          nextBillingDate: activeSub.next_billing_date,
          lastBillingDate: activeSub.last_billing_date,
          autoRenewal: activeSub.auto_renewal,
          createdAt: activeSub.created_at,
          updatedAt: activeSub.updated_at
        } : null,
        paymentHistory: payments.map(payment => ({
          id: payment.id,
          transactionId: payment.transaction_id,
          billingKey: payment.billing_key,
          amount: payment.amount,
          planType: payment.plan_type,
          status: payment.status,
          paymentMethod: payment.payment_method,
          paymentKey: payment.payment_key,
          receiptId: payment.receipt_id,
          errorMessage: payment.error_message,
          createdAt: payment.created_at
        })),
        cancellationHistory: cancellations.map(cancellation => ({
          id: cancellation.id,
          subscriptionId: cancellation.subscription_id,
          planType: cancellation.plan_type,
          canceledAt: cancellation.canceled_at,
          cancelReason: cancellation.cancel_reason,
          createdAt: cancellation.created_at
        }))
      }
    });

  } catch (error) {
    console.error('구독 상태 확인 API 오류:', error);
    return NextResponse.json({
      success: false,
      error: '서버 오류가 발생했습니다.'
    }, { status: 500 });
  }
}
