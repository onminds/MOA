import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getConnection } from "@/lib/db";
import { getKoreanTimeNow } from "@/lib/utils";

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
  
  // 사용량 조회
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', 'image-generate')
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
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
        maxLimit = 80;
        break;
      case 'pro':
        maxLimit = 180;
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
  
  // next_reset_date가 없으면 계정 생성일 기준으로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
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
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  const now = getKoreanTimeNow(); // 한국 시간 기준
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 이미지 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 정확히 한 달 후로 설정 (한국 시간 기준)
    const nextReset = new Date(nextResetDate);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', 'image-generate')
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    // currentUsage를 0으로 업데이트
    currentUsage = 0;
  }
  
  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: nextResetDate || new Date().toISOString()
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
  
  // 사용량 조회
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', 'video-generate')
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
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
        maxLimit = 40;
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
  
  // next_reset_date가 없으면 계정 생성일 기준으로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
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
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  const now = getKoreanTimeNow(); // 한국 시간 기준
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 영상 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 정확히 한 달 후로 설정 (한국 시간 기준)
    const nextReset = new Date(nextResetDate);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', 'video-generate')
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    // currentUsage를 0으로 업데이트
    currentUsage = 0;
  }
  
  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: nextResetDate || new Date().toISOString()
  };
}

// 기존 사용량 체크 (다른 서비스용)
async function checkUsageLimit(userId: string, serviceType: string) {
  const db = await getConnection();
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', serviceType)
    .query('SELECT usage_count, limit_count, next_reset_date FROM usage WHERE user_id = @userId AND service_type = @serviceType');

  if (usageResult.recordset.length === 0) {
    // 사용량 정보가 없으면 생성
    const defaultLimit = getDefaultLimit(serviceType);
    
    // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    let nextResetDate = null;
    
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
    }
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
      .input('limitCount', defaultLimit)
      .input('nextResetDate', nextResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
      `);
    
    return {
      allowed: true,
      usageCount: 0,
      limitCount: defaultLimit,
      remainingCount: defaultLimit,
      resetDate: nextResetDate
    };
  }

  const usage = usageResult.recordset[0];
  const now = getKoreanTimeNow(); // 한국 시간 기준
  let nextResetDate = usage.next_reset_date;
  
  // next_reset_date가 없으면 계정 생성일 기준으로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
      
      // DB에 next_reset_date 저장
      await db.request()
        .input('userId', userId)
        .input('serviceType', serviceType)
        .input('nextResetDate', nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  if (nextResetDate && now > new Date(nextResetDate) && usage.usage_count > 0) {
    console.log(`사용자 ${userId}의 ${serviceType} 사용량 초기화: ${usage.usage_count} -> 0`);
    
    // 다음 초기화 시간을 정확히 한 달 후로 설정 (한국 시간 기준)
    const nextReset = new Date(nextResetDate);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    usage.usage_count = 0;
    usage.next_reset_date = nextReset;
  }

  const allowed = usage.usage_count < usage.limit_count;
  return {
    allowed,
    usageCount: usage.usage_count,
    limitCount: usage.limit_count,
    remainingCount: Math.max(0, usage.limit_count - usage.usage_count),
    resetDate: usage.next_reset_date
  };
}

// 생산성 도구 사용량 체크
async function checkProductivityToolUsage(userId: string, serviceType: string) {
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
  
  // 통합 버킷(service_type = 'productivity') 사용
  const unifiedServiceType = 'productivity';

  // 사용량 조회
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', unifiedServiceType)
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  // 플랜별 통합 한도: Basic 1 / Standard 120 / Pro 250
  let maxLimit = 1; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.plan_type) {
    planType = user.plan_type;
    
    switch (planType) {
      case 'standard':
        maxLimit = 120;
        break;
      case 'pro':
        maxLimit = 250;
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
  
  // 사용량 정보가 없으면 새로 생성
  if (usageResult.recordset.length === 0) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    let initialResetDate = null;
    
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
      initialResetDate = resetDate;
    }
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .input('limitCount', maxLimit)
      .input('nextResetDate', initialResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
      `);
    
    currentUsage = 0;
    nextResetDate = initialResetDate;
  }
  
  // next_reset_date가 없으면 계정 생성일 기준으로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userId)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
      
      // DB에 next_reset_date 저장
      await db.request()
        .input('userId', userId)
        .input('serviceType', unifiedServiceType)
        .input('nextResetDate', nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  const now = getKoreanTimeNow(); // 한국 시간 기준
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 ${serviceType} 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 정확히 한 달 후로 설정 (한국 시간 기준)
    const nextReset = new Date(nextResetDate);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    // currentUsage를 0으로 업데이트
    currentUsage = 0;
  }
  
  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: nextResetDate || new Date().toISOString()
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

    // 생산성 도구들은 플랜별 제한 적용
    let usageInfo;
    if (serviceType === 'productivity' || serviceType === 'ai-summary' || serviceType === 'cover-letter' || serviceType === 'interview-prep' || 
        serviceType === 'code-generate' || serviceType === 'lecture-notes' || serviceType === 'report-writers' || 
        serviceType === 'sns-post' || serviceType === 'presentation-script' || serviceType === 'code-review') {
      usageInfo = await checkProductivityToolUsage(user.id, serviceType);
    } else if (serviceType === 'image-generate') {
      // 이미지 생성은 특별한 로직 사용
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