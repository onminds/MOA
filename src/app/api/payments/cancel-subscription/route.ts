import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 구독 취소 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { subscriptionId, reason } = await request.json();
    
    console.log('구독 취소 요청 받음:', { subscriptionId, reason });

    if (!subscriptionId) {
      return NextResponse.json({ error: '구독 ID가 필요합니다.' }, { status: 400 });
    }

    const db = await getConnection();

    // 1. 구독 정보 확인
    const subscriptionResult = await db.request()
      .input('subscriptionId', subscriptionId)
      .input('userId', session.user.id)
      .query(`
        SELECT id, subscription_id, plan_type, subscription_status, user_id
        FROM payments 
        WHERE subscription_id = @subscriptionId AND user_id = @userId
      `);

    if (subscriptionResult.recordset.length === 0) {
      return NextResponse.json({ error: '구독을 찾을 수 없거나 접근 권한이 없습니다.' }, { status: 404 });
    }

    const subscription = subscriptionResult.recordset[0];
    console.log('구독 정보:', subscription);

    if (subscription.subscription_status !== 'active') {
      return NextResponse.json({ error: '이미 취소되었거나 비활성화된 구독입니다.' }, { status: 400 });
    }

    // 2. 토스페이먼츠 API 호출하여 구독 취소
    console.log('토스페이먼츠 구독 취소 API 호출 준비');
    
    try {
      const response = await fetch(`https://api.tosspayments.com/v1/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reason: reason || '사용자 요청'
        })
      });

      console.log('토스페이먼츠 구독 취소 API 응답:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText
      });

      let result;
      try {
        const responseText = await response.text();
        result = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.log('토스페이먼츠 응답 파싱 실패, 빈 객체 사용:', parseError);
        result = {};
      }

      if (response.ok) {
        // 3. DB 상태 업데이트
        await db.request()
          .input('subscriptionId', subscriptionId)
          .input('canceledAt', new Date())
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = @canceledAt,
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);

        // 4. 사용자 플랜을 Basic으로 초기화 (payments 테이블에 새 레코드 추가)
        await db.request()
          .input('userId', session.user.id)
          .input('planType', 'basic')
          .input('amount', 0)
          .input('status', 'completed')
          .query(`
            INSERT INTO payments (
              user_id, plan_type, amount, status, created_at, updated_at
            )
            VALUES (
              @userId, @planType, @amount, @status, GETDATE(), GETDATE()
            )
          `);

        // 5. 기존 활성 구독이 있다면 모두 취소 처리
        await db.request()
          .input('userId', session.user.id)
          .input('canceledAt', new Date())
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = @canceledAt,
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE user_id = @userId 
              AND subscription_status = 'active'
          `);

        console.log('구독 취소 및 플랜 초기화 완료:', {
          subscriptionId,
          reason: reason || '사용자 요청',
          canceledAt: new Date().toISOString(),
          userPlanReset: 'basic'
        });

        return NextResponse.json({
          success: true,
          message: '구독이 성공적으로 취소되었습니다.',
          subscriptionId: subscriptionId,
          canceledAt: new Date().toISOString()
        });

      } else {
        // 토스페이먼츠 API 호출 실패
        console.error('토스페이먼츠 구독 취소 실패:', result);
        
        // API 호출 실패 시에도 DB에서 취소 처리 (수동 취소)
        await db.request()
          .input('subscriptionId', subscriptionId)
          .input('canceledAt', new Date())
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = @canceledAt,
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);

        // 사용자 플랜을 Basic으로 초기화 (payments 테이블에 새 레코드 추가)
        await db.request()
          .input('userId', session.user.id)
          .input('planType', 'basic')
          .input('amount', 0)
          .input('status', 'completed')
          .query(`
            INSERT INTO payments (
              user_id, plan_type, amount, status, created_at, updated_at
            )
            VALUES (
              @userId, @planType, @amount, @status, GETDATE(), GETDATE()
            )
          `);

        // 기존 활성 구독이 있다면 모두 취소 처리
        await db.request()
          .input('userId', session.user.id)
          .input('canceledAt', new Date())
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = @canceledAt,
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE user_id = @userId 
              AND subscription_status = 'active'
          `);

        return NextResponse.json({
          success: true,
          message: '구독이 취소되었습니다. (토스페이먼츠에서 구독을 찾을 수 없어 DB에서만 취소 처리)',
          subscriptionId: subscriptionId,
          note: '토스페이먼츠 API 호출에 실패했지만 구독은 취소 처리되었습니다.',
          planReset: 'basic'
        });

      }

    } catch (apiError) {
      console.error('토스페이먼츠 API 호출 오류:', apiError);
      
      // API 호출 실패 시에도 DB에서 취소 처리 (수동 취소)
      await db.request()
        .input('subscriptionId', subscriptionId)
        .input('canceledAt', new Date())
        .query(`
          UPDATE payments 
          SET subscription_status = 'canceled',
              canceled_at = @canceledAt,
              auto_renewal = 0,
              updated_at = GETDATE()
          WHERE subscription_id = @subscriptionId
        `);

      // 사용자 플랜을 Basic으로 초기화 (payments 테이블에 새 레코드 추가)
      await db.request()
        .input('userId', session.user.id)
        .input('planType', 'basic')
        .input('amount', 0)
        .input('status', 'completed')
        .query(`
          INSERT INTO payments (
            user_id, plan_type, amount, status, created_at, updated_at
          )
          VALUES (
            @userId, @planType, @amount, @status, GETDATE(), GETDATE()
          )
        `);

      // 기존 활성 구독이 있다면 모두 취소 처리
      await db.request()
        .input('userId', session.user.id)
        .input('canceledAt', new Date())
        .query(`
          UPDATE payments 
          SET subscription_status = 'canceled',
              canceled_at = @canceledAt,
              auto_renewal = 0,
              updated_at = GETDATE()
          WHERE user_id = @userId 
            AND subscription_status = 'active'
        `);

      return NextResponse.json({
        success: true,
        message: '구독이 취소되었습니다. (수동 처리)',
        subscriptionId: subscriptionId,
        note: '토스페이먼츠 API 호출에 실패했지만 구독은 취소 처리되었습니다.',
        planReset: 'basic'
      });

    }

  } catch (error) {
    console.error('구독 취소 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 구독 정보 조회 API (GET)
export async function GET(request: NextRequest) {
  try {
    console.log('=== 구독 정보 조회 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const db = await getConnection();

    // 사용자의 활성 구독 조회 (실제 DB 컬럼에 맞게 수정)
    const subscriptionResult = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT 
          subscription_id,
          plan_type,
          subscription_status,
          subscription_start_date,
          next_billing_date,
          auto_renewal,
          canceled_at,
          amount
        FROM payments 
        WHERE user_id = @userId 
          AND subscription_id IS NOT NULL
        ORDER BY created_at DESC
      `);

    const subscriptions = subscriptionResult.recordset.map(sub => ({
      subscriptionId: sub.subscription_id,
      planType: sub.plan_type,
      status: sub.subscription_status,
      startDate: sub.subscription_start_date,
      nextBillingDate: sub.next_billing_date,
      autoRenewal: sub.auto_renewal,
      canceledAt: sub.canceled_at,
      amount: sub.amount
    }));

    return NextResponse.json({
      success: true,
      subscriptions: subscriptions,
      activeSubscription: subscriptions.find(sub => sub.status === 'active') || null
    });

  } catch (error) {
    console.error('구독 정보 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
