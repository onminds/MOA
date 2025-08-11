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

    // 결제 내역 생성 (수동 플랜 변경)
    await db.request()
      .input('user_id', userId)
      .input('plan_type', planType)
      .input('amount', 0) // 수동 변경이므로 0원
      .input('payment_method', 'manual')
      .input('status', 'completed')
      .query(`
        INSERT INTO payments (user_id, plan_type, amount, payment_method, status, created_at, updated_at)
        VALUES (@user_id, @plan_type, @amount, @payment_method, @status, GETDATE(), GETDATE())
      `);

    // 사용량 한도 업데이트
    await db.request()
      .input('user_id', userId)
      .input('service_type', 'image-generate')
      .input('limit_count', planLimits.image)
      .query(`
        MERGE usage AS target
        USING (SELECT @user_id as user_id, @service_type as service_type) AS source
        ON target.user_id = source.user_id AND target.service_type = source.service_type
        WHEN MATCHED THEN
          UPDATE SET limit_count = @limit_count, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, service_type, usage_count, limit_count, reset_date, created_at, updated_at)
          VALUES (@user_id, @service_type, 0, @limit_count, GETDATE(), GETDATE(), GETDATE());
      `);

    await db.request()
      .input('user_id', userId)
      .input('service_type', 'video-generate')
      .input('limit_count', planLimits.video)
      .query(`
        MERGE usage AS target
        USING (SELECT @user_id as user_id, @service_type as service_type) AS source
        ON target.user_id = source.user_id AND target.service_type = source.service_type
        WHEN MATCHED THEN
          UPDATE SET limit_count = @limit_count, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, service_type, usage_count, limit_count, reset_date, created_at, updated_at)
          VALUES (@user_id, @service_type, 0, @limit_count, GETDATE(), GETDATE(), GETDATE());
      `);

    return NextResponse.json({ 
      message: `사용자 플랜이 ${planType}으로 업데이트되었습니다`,
      planType,
      limits: planLimits
    });
  } catch (error) {
    console.error('플랜 업데이트 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
} 