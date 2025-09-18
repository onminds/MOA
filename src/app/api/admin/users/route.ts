import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 체크 - role 기반으로 변경
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 모든 사용자 조회 (Payment 정보와 Usage 정보 포함)
    const db = await getConnection();
    const usersResult = await db.request().query(`
      SELECT 
        u.id,
        u.display_name as name,
        u.email,
        u.role,
        u.created_at as createdAt,
        p.plan_type,
        (SELECT COUNT(*) FROM payments WHERE user_id = u.id) as paymentCount
      FROM users u
      LEFT JOIN (
        SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM payments 
        WHERE status = 'completed'
      ) p ON u.id = p.user_id AND p.rn = 1
      WHERE u.is_active = 1
      ORDER BY u.created_at DESC
    `);

    // 각 사용자의 사용량 정보 조회 (현재 플랜 기준으로 계산)
    const formattedUsers = await Promise.all(usersResult.recordset.map(async (user: any) => {
      const usageResult = await db.request()
        .input('userId', user.id)
        .query(`
          SELECT 
            service_type as serviceType,
            usage_count as usageCount,
            limit_count as limitCount,
            reset_date as resetDate
          FROM usage 
          WHERE user_id = @userId
        `);

      // 현재 플랜 기준으로 사용량 한도 계산
      const planType = user.plan_type || 'basic';
      const getLimitForService = (serviceType: string, planType: string) => {
        // 관리자(별도 처리)는 호출부에서 우선 무제한 처리
        if (serviceType === 'productivity') {
          // 생산성 통합 버킷
          switch (planType) {
            case 'standard': return 120;
            case 'pro': return 250;
            default: return 1;
          }
        }
        switch (serviceType) {
          case 'image-generate':
          case 'image':
            switch (planType) {
              case 'standard': return 80;
              case 'pro': return 180;
              default: return 1;
            }
          case 'video-generate':
          case 'video':
            switch (planType) {
              case 'standard': return 20;
              case 'pro': return 40;
              default: return 1;
            }
          default:
            // 기타 기본값은 0 처리 (표시 제외 대상)
            return 0;
        }
      };

      // 관리자는 무제한
      const isAdmin = user.role === 'ADMIN';
      const rawUsages = usageResult.recordset;

      // 생산성 통합: 기존 개별 항목 + 'productivity' 레코드를 하나로 병합
      const productivityKeys = new Set([
        'productivity',
        'ai-summary','report-writers','cover-letter','lecture-notes',
        'interview-prep','code-review','presentation-script','code-generate','sns-post'
      ]);

      const imageRow = rawUsages.find((u: any) => u.serviceType === 'image' || u.serviceType === 'image-generate');
      const videoRow = rawUsages.find((u: any) => u.serviceType === 'video' || u.serviceType === 'video-generate');
      const prodUnified = rawUsages.find((u: any) => u.serviceType === 'productivity');
      const prodOthers = rawUsages.filter((u: any) => productivityKeys.has(u.serviceType) && u.serviceType !== 'productivity');

      const imageOut = imageRow ? {
        id: `${user.id}-image`,
        serviceType: 'image',
        usageCount: imageRow.usageCount,
        limitCount: isAdmin ? 9999 : getLimitForService('image', planType),
        resetDate: imageRow.resetDate ? imageRow.resetDate.toISOString?.() || imageRow.resetDate : new Date().toISOString()
      } : {
        id: `${user.id}-image`, serviceType: 'image', usageCount: 0, limitCount: isAdmin ? 9999 : getLimitForService('image', planType), resetDate: new Date().toISOString()
      };

      const videoOut = videoRow ? {
        id: `${user.id}-video`,
        serviceType: 'video',
        usageCount: videoRow.usageCount,
        limitCount: isAdmin ? 9999 : getLimitForService('video', planType),
        resetDate: videoRow.resetDate ? videoRow.resetDate.toISOString?.() || videoRow.resetDate : new Date().toISOString()
      } : {
        id: `${user.id}-video`, serviceType: 'video', usageCount: 0, limitCount: isAdmin ? 9999 : getLimitForService('video', planType), resetDate: new Date().toISOString()
      };

      let prodUsageCount = 0;
      if (prodUnified) {
        prodUsageCount = prodUnified.usageCount || 0;
      } else if (prodOthers.length > 0) {
        prodUsageCount = prodOthers.reduce((sum: number, u: any) => sum + (u.usageCount || 0), 0);
      }
      const productivityOut = {
        id: `${user.id}-productivity`,
        serviceType: 'productivity',
        usageCount: prodUsageCount,
        limitCount: isAdmin ? 9999 : getLimitForService('productivity', planType),
        resetDate: new Date().toISOString()
      };

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        planType: planType,
        usage: [imageOut, videoOut, productivityOut],
        createdAt: user.createdAt.toISOString(),
        _count: { payments: user.paymentCount }
      };
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 체크 - role 기반으로 변경
    if (session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: '사용자 ID와 역할이 필요합니다' }, { status: 400 });
    }

    // 유효한 역할 체크
    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다' }, { status: 400 });
    }

    // 사용자 존재 확인
    const db = await getConnection();
    const userResult = await db.request()
      .input('userId', userId)
      .query('SELECT id FROM users WHERE id = @userId AND is_active = 1');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 역할 업데이트
    await db.request()
      .input('userId', userId)
      .input('role', role)
      .query('UPDATE users SET role = @role, updated_at = GETDATE() WHERE id = @userId');

    return NextResponse.json({ 
      message: '사용자 역할이 성공적으로 업데이트되었습니다',
      userId: userId,
      role: role
    });
  } catch (error) {
    console.error('사용자 역할 업데이트 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
} 