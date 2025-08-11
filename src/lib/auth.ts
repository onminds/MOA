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
      await db.request()
        .input('userId', userId)
        .input('serviceType', serviceType)
        .input('limitCount', defaultLimit)
        .query(`
          INSERT INTO usage (user_id, service_type, usage_count, limit_count, created_at, updated_at)
          VALUES (@userId, @serviceType, 0, @limitCount, GETDATE(), GETDATE())
        `);
      
      usage = {
        usage_count: 0,
        limit_count: defaultLimit,
        reset_date: new Date()
      };
    }

    // 일일 리셋 체크 (매일 자정에 리셋)
    const now = new Date();
    const resetDate = new Date(usage.reset_date);
    const isNewDay = now.getDate() !== resetDate.getDate() || 
                     now.getMonth() !== resetDate.getMonth() || 
                     now.getFullYear() !== resetDate.getFullYear();

    if (isNewDay) {
      await db.request()
        .input('userId', userId)
        .input('serviceType', serviceType)
        .query(`
          UPDATE usage 
          SET usage_count = 0, reset_date = GETDATE(), updated_at = GETDATE()
          WHERE user_id = @userId AND service_type = @serviceType
        `);
      
      usage.usage_count = 0;
      usage.reset_date = now;
    }

    // 사용량 제한 체크
    if (usage.usage_count >= usage.limit_count) {
      return {
        allowed: false,
        remaining: 0,
        limit: usage.limit_count,
        resetDate: usage.reset_date,
      };
    }

    return {
      allowed: true,
      remaining: usage.limit_count - usage.usage_count,
      limit: usage.limit_count,
      resetDate: usage.reset_date,
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