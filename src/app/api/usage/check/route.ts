import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConnection } from "@/lib/db";

// 이미지 생성 전용 사용량 체크
async function checkImageGenerationUsage(userId: string) {
  const db = await getConnection();
  
  // 사용자 정보와 최근 결제 내역 조회
  const userResult = await db.request()
    .input('userId', userId)
    .query(`
      SELECT u.id, u.role, p.plan_type
      FROM users u
      LEFT JOIN (
        SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM payments 
        WHERE status = 'completed'
      ) p ON u.id = p.user_id AND p.rn = 1
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const user = userResult.recordset[0];
  
  // 사용량 조회 (next_reset_date 포함)
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', 'image-generate')
    .query(`
      SELECT usage_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 2; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.plan_type) {
    planType = user.plan_type;
    
    switch (planType) {
      case 'standard':
        maxLimit = 120;
        break;
      case 'pro':
        maxLimit = 300;
        break;
      default:
        maxLimit = 2;
    }
  }
  // 관리자이면서 결제 내역이 없으면 무제한
  else if (user.role === 'ADMIN') {
    maxLimit = 9999;
    planType = 'admin';
  }

  let currentUsage = usageResult.recordset[0]?.usage_count || 0;
  let nextResetDate = usageResult.recordset[0]?.next_reset_date;
  
  // next_reset_date가 없으면 계정 생성일 기준으로 일주일 후로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      // 계정 생성일 + 7일로 설정
      const resetDate = new Date(userCreatedAt);
      resetDate.setDate(resetDate.getDate() + 7);
      nextResetDate = resetDate;
      
      // DB에 next_reset_date 저장
      await db.request()
        .input('userId', userId)
        .input('serviceType', 'image-generate')
        .input('nextResetDate', nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  
  const now = new Date();
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 이미지 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 일주일 후로 설정
    const nextReset = new Date(nextResetDate);
    nextReset.setDate(nextReset.getDate() + 7);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', 'image-generate')
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate 
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    currentUsage = 0;
    nextResetDate = nextReset;
  }

  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: nextResetDate ? new Date(nextResetDate).toISOString() : new Date().toISOString()
  };
}

// 영상 생성 전용 사용량 체크
async function checkVideoGenerationUsage(userId: string) {
  const db = await getConnection();
  
  // 사용자 정보와 최근 결제 내역 조회
  const userResult = await db.request()
    .input('userId', userId)
    .query(`
      SELECT u.id, u.role, p.plan_type
      FROM users u
      LEFT JOIN (
        SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM payments 
        WHERE status = 'completed'
      ) p ON u.id = p.user_id AND p.rn = 1
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const user = userResult.recordset[0];
  
  // 사용량 조회 (next_reset_date 포함)
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', 'video-generate')
    .query(`
      SELECT usage_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 1; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.plan_type) {
    planType = user.plan_type;
    
    switch (planType) {
      case 'standard':
        maxLimit = 20;
        break;
      case 'pro':
        maxLimit = 45;
        break;
      default:
        maxLimit = 1;
    }
  }
  // 관리자이면서 결제 내역이 없으면 무제한
  else if (user.role === 'ADMIN') {
    maxLimit = 9999;
    planType = 'admin';
  }

  let currentUsage = usageResult.recordset[0]?.usage_count || 0;
  let nextResetDate = usageResult.recordset[0]?.next_reset_date;
  
  // next_reset_date가 없으면 계정 생성일 기준으로 일주일 후로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      // 계정 생성일 + 7일로 설정
      const resetDate = new Date(userCreatedAt);
      resetDate.setDate(resetDate.getDate() + 7);
      nextResetDate = resetDate;
      
      // DB에 next_reset_date 저장
      await db.request()
        .input('userId', userId)
        .input('serviceType', 'video-generate')
        .input('nextResetDate', nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  
  const now = new Date();
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 영상 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 일주일 후로 설정
    const nextReset = new Date(nextResetDate);
    nextReset.setDate(nextReset.getDate() + 7);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', 'video-generate')
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate 
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    currentUsage = 0;
    nextResetDate = nextReset;
  }

  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: nextResetDate ? new Date(nextResetDate).toISOString() : new Date().toISOString()
  };
}

// 기존 사용량 체크 (다른 서비스용)
async function checkUsageLimit(userId: string, serviceType: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const db = await getConnection();
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', serviceType)
    .query('SELECT usage_count, limit_count, reset_date FROM usage WHERE user_id = @userId AND service_type = @serviceType');

  if (usageResult.recordset.length === 0) {
    return {
      allowed: true,
      usageCount: 0,
      limitCount: getDefaultLimit(serviceType),
      remainingCount: getDefaultLimit(serviceType),
      resetDate: today
    };
  }

  const usage = usageResult.recordset[0];
  const usageDate = new Date(usage.reset_date);
  usageDate.setHours(0, 0, 0, 0);
  
  if (today.getTime() !== usageDate.getTime()) {
    return {
      allowed: true,
      usageCount: 0,
      limitCount: usage.limit_count,
      remainingCount: usage.limitCount,
      resetDate: today
    };
  }

  const allowed = usage.usage_count < usage.limit_count;
  return {
    allowed,
    usageCount: usage.usageCount,
    limitCount: usage.limitCount,
    remainingCount: Math.max(0, usage.limitCount - usage.usageCount),
    resetDate: usage.resetDate
  };
}

function getDefaultLimit(serviceType: string): number {
  switch (serviceType) {
    case 'image-generate':
      return 2;
    case 'ai-chat':
      return 20;
    case 'code-generate':
      return 15;
    case 'sns-post':
      return 10;
    default:
      return 10;
  }
}

export async function GET(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');

    if (!serviceType) {
      return NextResponse.json({ error: '서비스 타입이 필요합니다.' }, { status: 400 });
    }

    // AI 요약, SNS 포스트, 코드 생성은 무제한으로 처리
    if (serviceType === 'ai-summary' || serviceType === 'sns-post' || serviceType === 'code-generate') {
      return NextResponse.json({
        allowed: true,
        usageCount: 0,
        limitCount: 9999,
        remainingCount: 9999,
        planType: 'unlimited',
        resetDate: new Date().toISOString()
      });
    }

    // 이미지 생성은 특별한 로직 사용
    let usageInfo;
    if (serviceType === 'image-generate') {
      usageInfo = await checkImageGenerationUsage(user.id);
    } else if (serviceType === 'video-generate') {
      usageInfo = await checkVideoGenerationUsage(user.id);
    } else {
      usageInfo = await checkUsageLimit(user.id, serviceType);
    }

    return NextResponse.json(usageInfo);
  } catch (error) {
    console.error('사용량 확인 오류:', error);
    return NextResponse.json({ error: '사용량 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 