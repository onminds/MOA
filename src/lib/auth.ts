import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { getConnection } from "./db";
import { getKoreanTimeNow } from "./utils";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {
    const db = await getConnection();
    const productivityServices = new Set([
      'ai-summary',
      'cover-letter',
      'interview-prep',
      'code-generate',
      'lecture-notes',
      'report-writers',
      'sns-post',
      'presentation-script',
      'code-review',
    ]);
    const unifiedServiceType = productivityServices.has(serviceType) ? 'productivity' : serviceType;
    
    // 사용자의 현재 플랜 정보 조회 (payments 최신 내역 기준)
    const userResult = await db.request()
      .input('userId', userId)
      .query(`
        SELECT TOP 1 plan_type 
        FROM payments 
        WHERE user_id = @userId AND status = 'completed' 
        ORDER BY created_at DESC
      `);
    
    const userPlan = userResult.recordset[0]?.plan_type || 'basic';
    
    // 플랜별 제한값 설정
    let planLimit: number;
    if (unifiedServiceType === 'image-generate') {
      // 이미지: Basic 1 / Standard 80 / Pro 180
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 80 : 180;
    } else if (unifiedServiceType === 'video-generate') {
      // 영상: Basic 1 / Standard 20 / Pro 40
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 20 : 40;
    } else if (unifiedServiceType === 'productivity') {
      // 생산성(통합): Basic 1 / Standard 120 / Pro 250
      planLimit = userPlan === 'basic' ? 1 : userPlan === 'standard' ? 120 : 250;
    } else {
      // 기타 기본값
      planLimit = userPlan === 'basic' ? 10 : userPlan === 'standard' ? 50 : 100;
    }
    
    // 사용량 정보 조회
    const usageResult = await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .query('SELECT * FROM usage WHERE user_id = @userId AND service_type = @serviceType');
    
    let usage = usageResult.recordset[0];

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = planLimit;
      
      // 계정 생성일 기준으로 일주일 후 초기화 시간 설정
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
        .input('serviceType', unifiedServiceType)
        .input('limitCount', defaultLimit)
        .input('nextResetDate', nextResetDate)
        .query(`
          INSERT INTO usage (user_id, service_type, usage_count, limit_count, next_reset_date, created_at, updated_at)
          VALUES (@userId, @serviceType, 0, @limitCount, @nextResetDate, GETDATE(), GETDATE())
        `);
      
      usage = {
        usage_count: 0,
        limit_count: defaultLimit,
        next_reset_date: nextResetDate
      };
    } else {
      // 기존 사용량 정보가 있지만 플랜이 변경된 경우 limit_count 업데이트
      if (usage.limit_count !== planLimit) {
        console.log(`사용자 ${userId}의 ${serviceType} 제한값 업데이트: ${usage.limit_count} -> ${planLimit}`);
        
        await db.request()
          .input('userId', userId)
          .input('serviceType', unifiedServiceType)
          .input('limitCount', planLimit)
          .query(`
            UPDATE usage 
            SET limit_count = @limitCount, updated_at = GETDATE()
            WHERE user_id = @userId AND service_type = @serviceType
          `);
        
        usage.limit_count = planLimit;
      }
    }

    // 주간 리셋 체크 (계정 생성일 기준 일주일마다)
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
    if (nextResetDate && now > new Date(nextResetDate) && usage.usage_count > 0) {
      console.log(`사용자 ${userId}의 ${serviceType} 사용량 초기화: ${usage.usage_count} -> 0`);
      
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
      
      usage.usage_count = 0;
      usage.next_reset_date = nextReset;
    }

    // 사용량 제한 체크 (현재 플랜 기준)
    if (usage.usage_count >= planLimit) {
      return {
        allowed: false,
        remaining: 0,
        limit: planLimit,
        resetDate: usage.next_reset_date,
      };
    }

    return {
      allowed: true,
      remaining: planLimit - usage.usage_count,
      limit: planLimit,
      resetDate: usage.next_reset_date,
    };
  } catch (error) {
    console.error("사용량 체크 오류:", error);
    return {
      allowed: false,
      remaining: 0,
      limit: 0,
      resetDate: new Date(),
    };
  }
}

export async function incrementUsage(userId: string, serviceType: string) {
  try {
    const db = await getConnection();
    const productivityServices = new Set([
      'ai-summary',
      'cover-letter',
      'interview-prep',
      'code-generate',
      'lecture-notes',
      'report-writers',
      'sns-post',
      'presentation-script',
      'code-review',
    ]);
    const unifiedServiceType = productivityServices.has(serviceType) ? 'productivity' : serviceType;
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', unifiedServiceType)
      .query(`
        UPDATE usage 
        SET usage_count = usage_count + 1, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
  } catch (error) {
    console.error("사용량 증가 오류:", error);
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return {
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

  return {
    user: session.user,
  };
} 