import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {
    const db = await getConnection();
    
    // 사용량 정보 조회
    const usageResult = await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
      .query('SELECT * FROM usage WHERE user_id = @userId AND service_type = @serviceType');
    
    let usage = usageResult.recordset[0];

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = serviceType === "image-generate" ? 1 : 10; // 이미지 생성은 1회, 나머지는 10회
      
      // 계정 생성일 기준으로 일주일 후 초기화 시간 설정
      const userCreatedResult = await db.request()
        .input('userId', userId)
        .query('SELECT created_at FROM users WHERE id = @userId');
      
      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      let nextResetDate = null;
      
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setDate(resetDate.getDate() + 7);
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
      
      usage = {
        usage_count: 0,
        limit_count: defaultLimit,
        next_reset_date: nextResetDate
      };
    }

    // 주간 리셋 체크 (계정 생성일 기준 일주일마다)
    const now = new Date();
    let nextResetDate = usage.next_reset_date;
    
    // next_reset_date가 없으면 계정 생성일 기준으로 설정
    if (!nextResetDate) {
      const userCreatedResult = await db.request()
        .input('userId', userId)
        .query('SELECT created_at FROM users WHERE id = @userId');
      
      const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
      if (userCreatedAt) {
        const resetDate = new Date(userCreatedAt);
        resetDate.setDate(resetDate.getDate() + 7);
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
      
      // 다음 초기화 시간을 일주일 후로 설정
      const nextReset = new Date(nextResetDate);
      nextReset.setDate(nextReset.getDate() + 7);
      
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

    // 사용량 제한 체크
    if (usage.usage_count >= usage.limit_count) {
      return {
        allowed: false,
        remaining: 0,
        limit: usage.limit_count,
        resetDate: usage.next_reset_date,
      };
    }

    return {
      allowed: true,
      remaining: usage.limit_count - usage.usage_count,
      limit: usage.limit_count,
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
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
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