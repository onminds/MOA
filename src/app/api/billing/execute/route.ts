import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

// 단건 실행: 특정 billingKey에 대해 즉시 자동결제 실행
export async function POST(request: NextRequest) {
  try {
    console.log('=== 자동결제 실행 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { billingKey, amount, orderId, orderName, customerKey, planType } = await request.json();
    
    console.log('자동결제 실행 요청 받음:', { billingKey, amount, orderId, orderName });

    // 결제/플랜 반영에 필요한 구독 정보 선조회
    const db = await getConnection();
    const subInfo = await db.request()
      .input('userId', session.user.id)
      .input('billingKey', billingKey)
      .query(`
        SELECT TOP 1 subscription_id, plan_type, customer_key
        FROM subscriptions
        WHERE user_id = @userId AND billing_key = @billingKey AND status = 'active'
        ORDER BY created_at DESC
      `);
    const subscriptionId: string | null = subInfo.recordset[0]?.subscription_id || null;
    const planTypeFromDb: string | null = subInfo.recordset[0]?.plan_type || null;
    const effectivePlanType: string = planType || planTypeFromDb || 'standard';
    const customerKeyFromDb: string | null = subInfo.recordset[0]?.customer_key || null;
    const effectiveCustomerKey: string | undefined = (customerKey || customerKeyFromDb) || undefined;

    // Idempotency: 동일 orderId로 이미 처리된 결제가 있으면 바로 성공 반환
    const existing = await db.request()
      .input('orderId', orderId)
      .query(`
        SELECT TOP 1 status FROM payments WHERE transaction_id = @orderId
      `);
    if (existing.recordset.length > 0) {
      const st = existing.recordset[0].status;
      console.log('중복 결제 요청 탐지 - 기존 상태:', st);
      return NextResponse.json({
        success: st === 'completed',
        message: st === 'completed' ? '이미 처리된 주문입니다.' : `이미 존재하는 주문 상태: ${st}`
      });
    }

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
        // v2: 등록 시 사용한 customerKey를 항상 포함
        ...(effectiveCustomerKey ? { customerKey: effectiveCustomerKey } : {}),
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
      
      // DB 커넥션은 상단에서 이미 확보됨

      // 결제 내역에 성공 기록 (plan_type/ subscription_id 포함)
      await db.request()
        .input('userId', session.user.id)
        .input('orderId', orderId)
        .input('billingKey', billingKey)
        .input('amount', amount)
        .input('planType', effectivePlanType)
        .input('subscriptionId', subscriptionId || null)
        .input('status', 'completed')
        .input('paymentMethod', 'card')
        .input('paymentKey', result.paymentKey)
        .input('transactionId', (result.lastTransactionKey || result.transactionId || null))
        .query(`
          INSERT INTO payments (
            user_id, transaction_id, billing_key, amount,
            plan_type, status, payment_method, payment_key, receipt_id,
            subscription_id, created_at
          ) VALUES (
            @userId, @orderId, @billingKey, @amount,
            @planType, @status, @paymentMethod, @paymentKey, @transactionId,
            ${subscriptionId ? '@subscriptionId' : 'NULL'}, GETDATE()
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

      // 사용자 테이블은 구독/플랜 컬럼이 없을 수 있으므로 업데이트 생략 (플랜 판정은 payments/subscriptions 기준)

      return NextResponse.json({
        success: true,
        message: '자동결제가 성공적으로 실행되었습니다.',
        paymentKey: result.paymentKey,
        transactionId: (result.lastTransactionKey || result.transactionId || null),
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

// 스케줄러(관리자/크론)에서 호출: next_billing_date가 지났고 auto_renewal인 구독들을 일괄 실행
export async function PUT(request: NextRequest) {
  try {
    console.log('=== 자동결제 일괄 실행(스케줄러) 시작 ===');

    const db = await getConnection();

    // 1) 결제 대상 구독 조회
    const due = await db.request().query(`
      SELECT TOP 50 user_id, subscription_id, billing_key, amount, plan_type, customer_key
      FROM subscriptions
      WHERE status = 'active'
        AND auto_renewal = 1
        AND next_billing_date <= GETDATE()
      ORDER BY next_billing_date ASC
    `);

    const targets = due.recordset || [];
    console.log('스케줄러 대상 건수:', targets.length);

    const results: Array<{ subscriptionId: string; ok: boolean; message: string }> = [];

    // 2) 각 대상에 대해 자동결제 실행
    for (const t of targets) {
      try {
        // 이달에 이미 결제 성공 기록이 있으면 스킵 (중복 방지)
        const alreadyPaid = await db.request()
          .input('subscriptionId', t.subscription_id)
          .query(`
            SELECT TOP 1 id FROM payments
            WHERE subscription_id = @subscriptionId AND status = 'completed'
              AND created_at >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          `);
        if (alreadyPaid.recordset.length > 0) {
          results.push({ subscriptionId: t.subscription_id, ok: true, message: '이미 결제됨(이달)' });
          continue;
        }
        const orderId = `renew_${t.subscription_id}_${Date.now()}`;
        const response = await fetch(`https://api.tosspayments.com/v1/billing/${t.billing_key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: t.amount,
            orderId,
            orderName: '정기결제 자동 갱신',
            // v2: 등록 시 사용한 customerKey 포함
            ...(t.customer_key ? { customerKey: t.customer_key } : {})
          })
        });

        const result = await response.json();

        if (response.ok && result.status === 'DONE') {
          // 결제 내역 저장
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('billingKey', t.billing_key)
            .input('amount', t.amount)
            .input('planType', t.plan_type)
            .input('orderId', orderId)
            .input('status', 'completed')
            .query(`
              INSERT INTO payments (
                subscription_id, billing_key, amount, plan_type, transaction_id,
                status, payment_method, created_at
              ) VALUES (
                @subscriptionId, @billingKey, @amount, @planType, @orderId,
                @status, 'card', GETDATE()
              )
            `);

          // 다음 결제일 갱신
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('nextBillingDate', nextBillingDate)
            .query(`
              UPDATE subscriptions
              SET next_billing_date = @nextBillingDate, updated_at = GETDATE()
              WHERE subscription_id = @subscriptionId
            `);

          results.push({ subscriptionId: t.subscription_id, ok: true, message: '갱신 성공' });
        } else {
          // 실패 기록
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('billingKey', t.billing_key)
            .input('orderId', orderId)
            .input('status', 'failed')
            .input('errorMessage', result.message || '갱신 실패')
            .query(`
              INSERT INTO payments (
                subscription_id, billing_key, transaction_id,
                status, payment_method, error_message, created_at
              ) VALUES (
                @subscriptionId, @billingKey, @orderId,
                @status, 'card', @errorMessage, GETDATE()
              )
            `);

          results.push({ subscriptionId: t.subscription_id, ok: false, message: result.message || '갱신 실패' });
        }
      } catch (e) {
        console.error('스케줄러 개별 실행 오류:', e);
        results.push({ subscriptionId: t.subscription_id, ok: false, message: '예외 발생' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('자동결제 일괄 실행(스케줄러) 오류:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}

// Vercel Scheduled Cron은 기본적으로 GET을 호출합니다.
// 보안: Vercel이 추가하는 헤더(x-vercel-cron) 또는 Authorization Bearer 시크릿을 허용합니다.
export async function GET(request: NextRequest) {
  try {
    const cronHeader = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('authorization');
    const bearer = `Bearer ${process.env.CRON_SECRET || ''}`;
    if (!cronHeader && (!process.env.CRON_SECRET || authHeader !== bearer)) {
      return NextResponse.json({ error: 'Unauthorized cron call' }, { status: 401 });
    }

    console.log('=== 자동결제 일괄 실행(스케줄러/GET) 시작 ===');
    const db = await getConnection();

    const due = await db.request().query(`
      SELECT TOP 50 user_id, subscription_id, billing_key, amount, plan_type
      FROM subscriptions
      WHERE status = 'active'
        AND auto_renewal = 1
        AND next_billing_date <= GETDATE()
      ORDER BY next_billing_date ASC
    `);

    const targets = due.recordset || [];
    console.log('스케줄러 대상 건수:', targets.length);

    const results: Array<{ subscriptionId: string; ok: boolean; message: string }> = [];

    for (const t of targets) {
      try {
        const alreadyPaid = await db.request()
          .input('subscriptionId', t.subscription_id)
          .query(`
            SELECT TOP 1 id FROM payments
            WHERE subscription_id = @subscriptionId AND status = 'completed'
              AND created_at >= DATEADD(MONTH, DATEDIFF(MONTH, 0, GETDATE()), 0)
          `);
        if (alreadyPaid.recordset.length > 0) {
          results.push({ subscriptionId: t.subscription_id, ok: true, message: '이미 결제됨(이달)' });
          continue;
        }

        const orderId = `renew_${t.subscription_id}_${Date.now()}`;
        const response = await fetch(`https://api.tosspayments.com/v1/billing/${t.billing_key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            amount: t.amount, 
            orderId, 
            orderName: '정기결제 자동 갱신',
            ...(t.customer_key ? { customerKey: t.customer_key } : {})
          })
        });

        const result = await response.json();

        if (response.ok && result.status === 'DONE') {
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('billingKey', t.billing_key)
            .input('amount', t.amount)
            .input('planType', t.plan_type)
            .input('orderId', orderId)
            .input('status', 'completed')
            .query(`
              INSERT INTO payments (
                subscription_id, billing_key, amount, plan_type, transaction_id,
                status, payment_method, created_at
              ) VALUES (
                @subscriptionId, @billingKey, @amount, @planType, @orderId,
                @status, 'card', GETDATE()
              )
            `);

          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('nextBillingDate', nextBillingDate)
            .query(`
              UPDATE subscriptions
              SET next_billing_date = @nextBillingDate, updated_at = GETDATE()
              WHERE subscription_id = @subscriptionId
            `);

          results.push({ subscriptionId: t.subscription_id, ok: true, message: '갱신 성공' });
        } else {
          await db.request()
            .input('subscriptionId', t.subscription_id)
            .input('billingKey', t.billing_key)
            .input('orderId', orderId)
            .input('status', 'failed')
            .input('errorMessage', result.message || '갱신 실패')
            .query(`
              INSERT INTO payments (
                subscription_id, billing_key, transaction_id,
                status, payment_method, error_message, created_at
              ) VALUES (
                @subscriptionId, @billingKey, @orderId,
                @status, 'card', @errorMessage, GETDATE()
              )
            `);
          results.push({ subscriptionId: t.subscription_id, ok: false, message: result.message || '갱신 실패' });
        }
      } catch (e) {
        console.error('스케줄러 개별 실행 오류:', e);
        results.push({ subscriptionId: t.subscription_id, ok: false, message: '예외 발생' });
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('자동결제 일괄 실행(스케줄러/GET) 오류:', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
