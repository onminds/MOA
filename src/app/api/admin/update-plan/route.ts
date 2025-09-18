import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 관리자 권한 체크
    if (authResult.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { userId, planType } = await request.json();

    if (!userId || !planType) {
      return NextResponse.json({ error: '사용자 ID와 플랜 타입이 필요합니다' }, { status: 400 });
    }

    // 유효한 플랜 타입 체크
    if (!['basic', 'standard', 'pro'].includes(planType)) {
      return NextResponse.json({ error: '유효하지 않은 플랜 타입입니다' }, { status: 400 });
    }

    const db = await getConnection();

    // 사용자 존재 확인
    const userResult = await db.request()
      .input('user_id', userId)
      .query('SELECT id FROM users WHERE id = @user_id');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 플랜별 한도 설정
    const limits = {
      basic: { image: 2, video: 1 },
      standard: { image: 120, video: 20 },
      pro: { image: 300, video: 45 }
    };

    const planLimits = limits[planType as keyof typeof limits];

    // 기존 결제 내역 확인
    const existingPaymentResult = await db.request()
      .input('userId', userId)
      .query(`
        SELECT TOP 1 id, plan_type, subscription_status 
        FROM payments 
        WHERE user_id = @userId 
          AND status = 'completed'
        ORDER BY created_at DESC
      `);

    if (existingPaymentResult.recordset.length > 0) {
      const existingPayment = existingPaymentResult.recordset[0];
      
      // 활성 구독이 있는 경우 취소 처리
      if (existingPayment.subscription_status === 'active') {
        await db.request()
          .input('paymentId', existingPayment.id)
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = GETDATE(),
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE id = @paymentId
          `);
      }
    }

    // 새로운 결제 내역 생성 (관리자 수동 플랜 변경)
    const amount = planType === 'basic' ? 0 : (planType === 'standard' ? 15900 : 29000);
    
    await db.request()
      .input('userId', userId)
      .input('planType', planType)
      .input('amount', amount)
      .input('status', 'completed')
      .input('paymentMethod', 'admin_manual')
      .query(`
        INSERT INTO payments (
          user_id, plan_type, amount, status, payment_method, created_at, updated_at
        )
        VALUES (
          @userId, @planType, @amount, @status, @paymentMethod, GETDATE(), GETDATE()
        )
      `);

    // 사용량 한도 업데이트
    await db.request()
      .input('userId', userId)
      .input('imageLimit', planLimits.image)
      .input('videoLimit', planLimits.video)
      .query(`
        MERGE usage AS target
        USING (SELECT @userId as user_id, 'image' as service_type) AS source
        ON target.user_id = source.user_id AND target.service_type = source.service_type
        WHEN MATCHED THEN
          UPDATE SET limit_count = @imageLimit, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, service_type, usage_count, limit_count, reset_date, created_at, updated_at)
          VALUES (@userId, 'image', 0, @imageLimit, DATEADD(MONTH, 1, GETDATE()), GETDATE(), GETDATE());
      `);

    await db.request()
      .input('userId', userId)
      .input('videoLimit', planLimits.video)
      .query(`
        MERGE usage AS target
        USING (SELECT @userId as user_id, 'video' as service_type) AS source
        ON target.user_id = source.user_id AND target.service_type = source.service_type
        WHEN MATCHED THEN
          UPDATE SET limit_count = @videoLimit, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, service_type, usage_count, limit_count, reset_date, created_at, updated_at)
          VALUES (@userId, 'video', 0, @videoLimit, DATEADD(MONTH, 1, GETDATE()), GETDATE(), GETDATE());
      `);

    console.log('관리자 플랜 변경 완료:', { userId, planType, amount });

    return NextResponse.json({
      success: true,
      message: '플랜이 성공적으로 변경되었습니다.',
      planType: planType,
      amount: amount
    });

  } catch (error) {
    console.error('관리자 플랜 변경 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 