import { getConnection } from "@/lib/db";
import { getKoreanTimeNow, getKoreanTomorrowMidnightUTC } from "@/lib/utils";
import {
  formatUsageNumber,
  toActualUsage,
  toUnifiedServiceType,
} from "@/lib/usageConstants";

export async function checkImageGenerationUsage(userId: string) {
  const db = await getConnection();

  const userResult = await db
    .request()
    .input("userId", userId)
    .query(`
      SELECT u.id, u.role, s.plan_type
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: "사용자를 찾을 수 없습니다." };
  }

  const user = userResult.recordset[0];

  const usageResult = await db
    .request()
    .input("userId", userId)
    .input("serviceType", "image-generate")
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 1;
  let planType = "basic";

  if (user.plan_type) {
    planType = user.plan_type;

    switch (planType) {
      case "standard":
        maxLimit = 80;
        break;
      case "pro":
        maxLimit = 180;
        break;
      default:
        maxLimit = 1;
    }
  } else if (user.role === "ADMIN") {
    maxLimit = 9999;
    planType = "admin";
  }

  let currentUsage = usageResult.recordset[0]?.usage_count || 0;
  let nextResetDate = usageResult.recordset[0]?.next_reset_date;

  // 결제일 조회 (Standard/Pro 플랜용)
  let paymentDate = null;
  if (planType === 'standard' || planType === 'pro') {
    const paymentResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as payment_date
        FROM payments 
        WHERE user_id = @userId AND status = 'completed' 
        ORDER BY created_at DESC
      `);
    
    // subscriptions 테이블에서도 조회 (어드민으로 변경한 경우)
    const subscriptionResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as subscription_date, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active' 
        ORDER BY updated_at DESC
      `);
    
    // 결제일 우선순위: payments > subscriptions updated_at > subscriptions created_at
    paymentDate = paymentResult.recordset[0]?.payment_date;
    if (!paymentDate && subscriptionResult.recordset[0]) {
      paymentDate = subscriptionResult.recordset[0].updated_at || subscriptionResult.recordset[0].subscription_date;
    }
    
    console.log(`[DEBUG IMAGE] 결제일 조회 결과: paymentDate=${paymentDate}, source=${paymentResult.recordset[0] ? 'payments' : 'subscriptions'}`);
  }

  if (!nextResetDate) {
    // 스탠다드/프로 플랜은 결제일 기준
    if (paymentDate && (planType === 'standard' || planType === 'pro')) {
      const resetDate = new Date(paymentDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
    }
    // 베이직 플랜은 계정 생성일 기준
    else {
      const userCreatedResult = await db
        .request()
        .input("userId", userId)
        .query("SELECT created_at FROM users WHERE id = @userId");

      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setMonth(resetDate.getMonth() + 1);
        nextResetDate = resetDate;
      }
    }

    if (nextResetDate) {
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", "image-generate")
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  // 스탠다드/프로 플랜은 항상 결제일 기준으로 재설정 (즉시 적용)
  if (paymentDate && (planType === 'standard' || planType === 'pro')) {
    console.log(`[DEBUG IMAGE] 결제일 조회 성공: paymentDate=${paymentDate}, planType=${planType}`);
    const expectedResetDate = new Date(paymentDate);
    expectedResetDate.setMonth(expectedResetDate.getMonth() + 1);
    console.log(`[DEBUG IMAGE] 예상 리셋: ${expectedResetDate.toISOString()}, 현재: ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'}`);
    
    // 날짜만 비교 (시:분:초는 무시)
    const needsUpdate = !nextResetDate || 
      new Date(nextResetDate).toDateString() !== expectedResetDate.toDateString();
    
    console.log(`[DEBUG IMAGE] 업데이트 필요? ${needsUpdate}`);
    
    if (needsUpdate) {
      console.log(`[Image Standard/Pro 리셋 날짜 업데이트] ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'} → ${expectedResetDate.toISOString()}`);
      nextResetDate = expectedResetDate;
      
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", "image-generate")
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  const now = new Date(); // UTC
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`[이미지 리셋 실행] userId=${userId}, 이전 사용량=${currentUsage}`);
    
    let nextReset: Date;
    
    // 월간 리셋: 결제일 기준으로 다음 리셋일 계산
    if (paymentDate) {
      // 결제일 기준으로 현재보다 미래인 다음 리셋일 찾기
      const base = new Date(paymentDate);
      while (base <= now) {
        base.setMonth(base.getMonth() + 1);
      }
      nextReset = base;
      console.log(`[이미지 월간 리셋] 결제일 ${new Date(paymentDate).toISOString()} 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    } else {
      // 결제일이 없으면 기존 방식 (이전 리셋일 + 1개월)
      nextReset = new Date(nextResetDate);
      nextReset.setMonth(nextReset.getMonth() + 1);
      console.log(`[이미지 월간 리셋] 이전 리셋일 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", "image-generate")
      .input("nextResetDate", nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
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
    resetDate: nextResetDate || new Date().toISOString(),
  };
}

export async function checkVideoGenerationUsage(userId: string) {
  const db = await getConnection();

  const userResult = await db
    .request()
    .input("userId", userId)
    .query(`
      SELECT u.id, u.role, s.plan_type
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: "사용자를 찾을 수 없습니다." };
  }

  const user = userResult.recordset[0];

  const usageResult = await db
    .request()
    .input("userId", userId)
    .input("serviceType", "video-generate")
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 1;
  let planType = "basic";

  if (user.plan_type) {
    planType = user.plan_type;

    switch (planType) {
      case "standard":
        maxLimit = 20;
        break;
      case "pro":
        maxLimit = 40;
        break;
      default:
        maxLimit = 1;
    }
  } else if (user.role === "ADMIN") {
    maxLimit = 9999;
    planType = "admin";
  }

  let currentUsage = usageResult.recordset[0]?.usage_count || 0;
  let videoNextResetDate = usageResult.recordset[0]?.next_reset_date;

  // 결제일 조회 (Standard/Pro 플랜용)
  let paymentDate = null;
  if (planType === 'standard' || planType === 'pro') {
    const paymentResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as payment_date
        FROM payments 
        WHERE user_id = @userId AND status = 'completed' 
        ORDER BY created_at DESC
      `);
    
    // subscriptions 테이블에서도 조회 (어드민으로 변경한 경우)
    const subscriptionResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as subscription_date, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active' 
        ORDER BY updated_at DESC
      `);
    
    // 결제일 우선순위: payments > subscriptions updated_at > subscriptions created_at
    paymentDate = paymentResult.recordset[0]?.payment_date;
    if (!paymentDate && subscriptionResult.recordset[0]) {
      paymentDate = subscriptionResult.recordset[0].updated_at || subscriptionResult.recordset[0].subscription_date;
    }
    
    console.log(`[DEBUG VIDEO] 결제일 조회 결과: paymentDate=${paymentDate}, source=${paymentResult.recordset[0] ? 'payments' : 'subscriptions'}`);
  }

  if (!videoNextResetDate) {
    // 스탠다드/프로 플랜은 결제일 기준
    if (paymentDate && (planType === 'standard' || planType === 'pro')) {
      const resetDate = new Date(paymentDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      videoNextResetDate = resetDate;
    }
    // 베이직 플랜은 계정 생성일 기준
    else {
      const userCreatedResult = await db
        .request()
        .input("userId", userId)
        .query("SELECT created_at FROM users WHERE id = @userId");

      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setMonth(resetDate.getMonth() + 1);
        videoNextResetDate = resetDate;
      }
    }

    if (videoNextResetDate) {
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", "video-generate")
        .input("nextResetDate", videoNextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  // 스탠다드/프로 플랜은 항상 결제일 기준으로 재설정 (즉시 적용)
  if (paymentDate && (planType === 'standard' || planType === 'pro')) {
    console.log(`[DEBUG VIDEO] 결제일 조회 성공: paymentDate=${paymentDate}, planType=${planType}`);
    const expectedResetDate = new Date(paymentDate);
    expectedResetDate.setMonth(expectedResetDate.getMonth() + 1);
    console.log(`[DEBUG VIDEO] 예상 리셋: ${expectedResetDate.toISOString()}, 현재: ${videoNextResetDate ? new Date(videoNextResetDate).toISOString() : 'null'}`);
    
    // 날짜만 비교 (시:분:초는 무시)
    const needsUpdate = !videoNextResetDate || 
      new Date(videoNextResetDate).toDateString() !== expectedResetDate.toDateString();
    
    console.log(`[DEBUG VIDEO] 업데이트 필요? ${needsUpdate}`);
    
    if (needsUpdate) {
      console.log(`[Video Standard/Pro 리셋 날짜 업데이트] ${videoNextResetDate ? new Date(videoNextResetDate).toISOString() : 'null'} → ${expectedResetDate.toISOString()}`);
      videoNextResetDate = expectedResetDate;
      
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", "video-generate")
        .input("nextResetDate", videoNextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  const now = new Date(); // UTC
  if (videoNextResetDate && now > new Date(videoNextResetDate) && currentUsage > 0) {
    console.log(`[비디오 리셋 실행] userId=${userId}, 이전 사용량=${currentUsage}`);
    
    let nextReset: Date;
    
    // 월간 리셋: 결제일 기준으로 다음 리셋일 계산
    if (paymentDate) {
      // 결제일 기준으로 현재보다 미래인 다음 리셋일 찾기
      const base = new Date(paymentDate);
      while (base <= now) {
        base.setMonth(base.getMonth() + 1);
      }
      nextReset = base;
      console.log(`[비디오 월간 리셋] 결제일 ${new Date(paymentDate).toISOString()} 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    } else {
      // 결제일이 없으면 기존 방식 (이전 리셋일 + 1개월)
      nextReset = new Date(videoNextResetDate);
      nextReset.setMonth(nextReset.getMonth() + 1);
      console.log(`[비디오 월간 리셋] 이전 리셋일 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", "video-generate")
      .input("nextResetDate", nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);

    currentUsage = 0;
    videoNextResetDate = nextReset;
  }

  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: videoNextResetDate || new Date().toISOString(),
  };
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  const db = await getConnection();
  const unifiedServiceType = toUnifiedServiceType(serviceType);
  const usageResult = await db
    .request()
    .input("userId", userId)
    .input("serviceType", unifiedServiceType)
    .query(
      "SELECT usage_count, limit_count, next_reset_date FROM usage WHERE user_id = @userId AND service_type = @serviceType"
    );

  if (usageResult.recordset.length === 0) {
    const defaultLimit = getDefaultLimit(unifiedServiceType === "productivity" ? "productivity" : serviceType);

    const userCreatedResult = await db
      .request()
      .input("userId", userId)
      .query("SELECT created_at FROM users WHERE id = @userId");

    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    let nextResetDate: Date | null = null;

    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", unifiedServiceType)
      .input("limitCount", defaultLimit)
      .input("nextResetDate", nextResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
      `);

    return {
      allowed: true,
      usageCount: 0,
      limitCount: defaultLimit,
      remainingCount: defaultLimit,
      resetDate: nextResetDate,
    };
  }

  const usage = usageResult.recordset[0];
  const now = new Date(); // UTC
  let nextResetDate = usage.next_reset_date;

  // planType 조회
  const planResult = await db
    .request()
    .input("userId", userId)
    .query("SELECT plan_type FROM users WHERE id = @userId");
  const planType = planResult.recordset[0]?.plan_type || "basic";

  // 결제일 조회 (스탠다드/프로 플랜만)
  let paymentDate: Date | null = null;
  if (planType === 'standard' || planType === 'pro') {
    const paymentResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as payment_date 
        FROM payments 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);
    
    const subscriptionResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as subscription_date, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active' 
        ORDER BY updated_at DESC
      `);
    
    paymentDate = paymentResult.recordset[0]?.payment_date;
    if (!paymentDate && subscriptionResult.recordset[0]) {
      paymentDate = subscriptionResult.recordset[0].updated_at || subscriptionResult.recordset[0].subscription_date;
    }
  }

  if (!nextResetDate) {
    const userCreatedResult = await db
      .request()
      .input("userId", userId)
      .query("SELECT created_at FROM users WHERE id = @userId");

    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;

      await db
        .request()
        .input("userId", userId)
        .input("serviceType", unifiedServiceType)
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  if (nextResetDate && now > new Date(nextResetDate) && usage.usage_count > 0) {
    console.log(`[기타 서비스 리셋 실행] userId=${userId}, serviceType=${unifiedServiceType}, 이전 사용량=${usage.usage_count}`);
    
    let nextReset: Date;
    
    // 월간 리셋: 결제일 기준으로 다음 리셋일 계산
    if (paymentDate) {
      // 결제일 기준으로 현재보다 미래인 다음 리셋일 찾기
      const base = new Date(paymentDate);
      while (base <= now) {
        base.setMonth(base.getMonth() + 1);
      }
      nextReset = base;
      console.log(`[기타 서비스 월간 리셋] 결제일 ${new Date(paymentDate).toISOString()} 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    } else {
      // 결제일이 없으면 기존 방식 (이전 리셋일 + 1개월)
      nextReset = new Date(nextResetDate);
      nextReset.setMonth(nextReset.getMonth() + 1);
      console.log(`[기타 서비스 월간 리셋] 이전 리셋일 기준 → 다음 리셋: ${nextReset.toISOString()}`);
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", unifiedServiceType)
      .input("nextResetDate", nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);

    usage.usage_count = 0;
    usage.next_reset_date = nextReset;
  }

  const actualUsageCount = toActualUsage(unifiedServiceType, usage.usage_count);
  const actualLimitCount = usage.limit_count ?? getDefaultLimit(unifiedServiceType === "productivity" ? "productivity" : serviceType);
  const allowed = actualUsageCount < actualLimitCount;
  return {
    allowed,
    usageCount: formatUsageNumber(actualUsageCount),
    limitCount: actualLimitCount,
    remainingCount: formatUsageNumber(Math.max(0, actualLimitCount - actualUsageCount)),
    resetDate: usage.next_reset_date,
  };
}

export async function checkProductivityToolUsage(
  userId: string,
  serviceType: string
) {
  const db = await getConnection();

  const userResult = await db
    .request()
    .input("userId", userId)
    .query(`
      SELECT u.id, u.role, s.plan_type
      FROM users u
      LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: "사용자를 찾을 수 없습니다." };
  }

  const user = userResult.recordset[0];
  const unifiedServiceType = toUnifiedServiceType(serviceType);

  const usageResult = await db
    .request()
    .input("userId", userId)
    .input("serviceType", unifiedServiceType)
    .query(`
      SELECT usage_count, limit_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 1;
  let planType = "basic";

  if (user.plan_type) {
    planType = user.plan_type;

    switch (planType) {
      case "standard":
        maxLimit = 120;
        break;
      case "pro":
        maxLimit = 250;
        break;
      default:
        maxLimit = 1;
    }
  } else if (user.role === "ADMIN") {
    maxLimit = 9999;
    planType = "admin";
  }

  let currentUsageStored = usageResult.recordset[0]?.usage_count || 0;
  let nextResetDate = usageResult.recordset[0]?.next_reset_date;

  // now를 먼저 선언 (아래에서 사용)
  let now = getKoreanTimeNow();

  // 결제일 조회 (Standard/Pro 플랜용)
  let paymentDate = null;
  if (planType === 'standard' || planType === 'pro') {
    const paymentResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as payment_date
        FROM payments 
        WHERE user_id = @userId AND status = 'completed' 
        ORDER BY created_at DESC
      `);
    
    // subscriptions 테이블에서도 조회 (어드민으로 변경한 경우)
    const subscriptionResult = await db
      .request()
      .input("userId", userId)
      .query(`
        SELECT TOP 1 created_at as subscription_date, updated_at
        FROM subscriptions 
        WHERE user_id = @userId AND status = 'active' 
        ORDER BY updated_at DESC
      `);
    
    // 결제일 우선순위: payments > subscriptions updated_at > subscriptions created_at
    paymentDate = paymentResult.recordset[0]?.payment_date;
    if (!paymentDate && subscriptionResult.recordset[0]) {
      paymentDate = subscriptionResult.recordset[0].updated_at || subscriptionResult.recordset[0].subscription_date;
    }
    
    console.log(`[DEBUG PRODUCTIVITY] 결제일 조회 결과: paymentDate=${paymentDate}, source=${paymentResult.recordset[0] ? 'payments' : 'subscriptions'}`);
  }

  if (usageResult.recordset.length === 0) {
    let initialResetDate: Date | null = null;

    // 베이직 플랜의 생산성 도구는 일일 초기화
    if (planType === 'basic') {
      // 한국 시간 기준 내일 자정 (UTC로 저장)
      initialResetDate = getKoreanTomorrowMidnightUTC();
      console.log(`[Productivity 초기 리셋 날짜 설정] ${initialResetDate.toISOString()}`);
    }
    // 스탠다드/프로 플랜은 결제일 기준
    else if (paymentDate && (planType === 'standard' || planType === 'pro')) {
      const resetDate = new Date(paymentDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      initialResetDate = resetDate;
    }
    // 베이직 플랜 (계정 생성일 기준)
    else {
      const userCreatedResult = await db
        .request()
        .input("userId", userId)
        .query("SELECT created_at FROM users WHERE id = @userId");

      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setMonth(resetDate.getMonth() + 1);
        initialResetDate = resetDate;
      }
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", unifiedServiceType)
      .input("limitCount", maxLimit)
      .input("nextResetDate", initialResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
      `);

    currentUsageStored = 0;
    nextResetDate = initialResetDate;
  }

  // 베이직 플랜은 항상 내일 자정(한국 시간)으로 재설정 (즉시 적용)
  if (planType === 'basic') {
    const tomorrow = getKoreanTomorrowMidnightUTC();
    
    // 날짜만 비교 (시:분:초는 무시)
    const needsUpdate = !nextResetDate || 
      new Date(nextResetDate).toDateString() !== tomorrow.toDateString();
    
    if (needsUpdate) {
      console.log(`[Productivity 리셋 날짜 업데이트] ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'} → ${tomorrow.toISOString()}`);
      nextResetDate = tomorrow;
      
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", unifiedServiceType)
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  // 스탠다드/프로 플랜은 항상 결제일 기준으로 재설정 (즉시 적용)
  else if (paymentDate && (planType === 'standard' || planType === 'pro')) {
    console.log(`[DEBUG PRODUCTIVITY] 결제일 조회 성공: paymentDate=${paymentDate}, planType=${planType}`);
    const expectedResetDate = new Date(paymentDate);
    expectedResetDate.setMonth(expectedResetDate.getMonth() + 1);
    console.log(`[DEBUG PRODUCTIVITY] 예상 리셋: ${expectedResetDate.toISOString()}, 현재: ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'}`);
    
    // 날짜만 비교 (시:분:초는 무시)
    const needsUpdate = !nextResetDate || 
      new Date(nextResetDate).toDateString() !== expectedResetDate.toDateString();
    
    console.log(`[DEBUG PRODUCTIVITY] 업데이트 필요? ${needsUpdate}`);
    
    if (needsUpdate) {
      console.log(`[Productivity Standard/Pro 리셋 날짜 업데이트] ${nextResetDate ? new Date(nextResetDate).toISOString() : 'null'} → ${expectedResetDate.toISOString()}`);
      nextResetDate = expectedResetDate;
      
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", unifiedServiceType)
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  // 다른 플랜: next_reset_date가 없으면 설정
  else if (!nextResetDate) {
    // 스탠다드/프로 플랜은 결제일 기준
    if (paymentDate && (planType === 'standard' || planType === 'pro')) {
      const resetDate = new Date(paymentDate);
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
    }
    // 베이직 플랜은 계정 생성일 기준
    else {
      const userCreatedResult = await db
        .request()
        .input("userId", userId)
        .query("SELECT created_at FROM users WHERE id = @userId");

      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setMonth(resetDate.getMonth() + 1);
        nextResetDate = resetDate;
      }
    }

    if (nextResetDate) {
      await db
        .request()
        .input("userId", userId)
        .input("serviceType", unifiedServiceType)
        .input("nextResetDate", nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }

  // 리셋 체크 (now는 이미 위에서 선언됨)
  console.log(`[PRODUCTIVITY 리셋 체크] userId: ${userId}, now: ${now.toISOString()}, nextResetDate: ${nextResetDate}, currentUsage: ${currentUsageStored}`);
  if (nextResetDate && now > new Date(nextResetDate) && currentUsageStored > 0) {
    console.log(`🔄 [PRODUCTIVITY 리셋 실행!] userId: ${userId}, 사용량: ${currentUsageStored} → 0`);
    let nextReset: Date;
    
    // 베이직 플랜은 일일 초기화, 나머지는 월간 초기화
    if (planType === 'basic') {
      // 한국 시간 기준 다음 날 자정 (UTC로 저장)
      nextReset = getKoreanTomorrowMidnightUTC();
      console.log(`[리셋 후 다음 리셋 날짜 설정] ${nextReset.toISOString()}`);
    } else {
      // 월간 리셋: 결제일 기준으로 다음 리셋일 계산
      if (paymentDate) {
        // 결제일 기준으로 현재보다 미래인 다음 리셋일 찾기
        const base = new Date(paymentDate);
        while (base <= now) {
          base.setMonth(base.getMonth() + 1);
        }
        nextReset = base;
        console.log(`[월간 리셋] 결제일 ${new Date(paymentDate).toISOString()} 기준 → 다음 리셋: ${nextReset.toISOString()}`);
      } else {
        // 결제일이 없으면 기존 방식 (이전 리셋일 + 1개월)
        nextReset = new Date(nextResetDate);
        nextReset.setMonth(nextReset.getMonth() + 1);
        console.log(`[월간 리셋] 이전 리셋일 기준 → 다음 리셋: ${nextReset.toISOString()}`);
      }
    }

    await db
      .request()
      .input("userId", userId)
      .input("serviceType", unifiedServiceType)
      .input("nextResetDate", nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);

    currentUsageStored = 0;
    nextResetDate = nextReset;
  }

  const currentUsageActual = toActualUsage(unifiedServiceType, currentUsageStored);
  const remainingCount = Math.max(0, maxLimit - currentUsageActual);
  const allowed = currentUsageActual < maxLimit;

  return {
    allowed,
    usageCount: formatUsageNumber(currentUsageActual),
    limitCount: maxLimit,
    remainingCount: formatUsageNumber(remainingCount),
    planType,
    resetDate: nextResetDate || new Date().toISOString(),
  };
}

export function getDefaultLimit(serviceType: string): number {
  switch (serviceType) {
    case "productivity":
      return 1;
    case "image-generate":
      return 2;
    case "ai-chat":
      return 20;
    case "code-generate":
      return 15;
    case "sns-post":
      return 10;
    default:
      return 10;
  }
}
