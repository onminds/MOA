import { getServerSession } from "next-auth/next";
<<<<<<< HEAD
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";
=======
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {
<<<<<<< HEAD
    const db = await getConnection();
    
    // 사용량 정보 조회
    const usageResult = await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
      .query('SELECT * FROM usage WHERE user_id = @userId AND service_type = @serviceType');
    
    let usage = usageResult.recordset[0];
=======
    // 사용량 정보 조회
    let usage = await prisma.usage.findUnique({
      where: {
        userId_serviceType: {
          userId,
          serviceType,
        },
      },
    });
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = serviceType === "image-generate" ? 1 : 10; // 이미지 생성은 1회, 나머지는 10회
<<<<<<< HEAD
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
=======
      usage = await prisma.usage.create({
        data: {
          userId,
          serviceType,
          usageCount: 0,
          limitCount: defaultLimit,
        },
      });
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    }

    // 일일 리셋 체크 (매일 자정에 리셋)
    const now = new Date();
<<<<<<< HEAD
    const resetDate = new Date(usage.reset_date);
=======
    const resetDate = new Date(usage.resetDate);
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    const isNewDay = now.getDate() !== resetDate.getDate() || 
                     now.getMonth() !== resetDate.getMonth() || 
                     now.getFullYear() !== resetDate.getFullYear();

    if (isNewDay) {
<<<<<<< HEAD
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
=======
      usage = await prisma.usage.update({
        where: { id: usage.id },
        data: {
          usageCount: 0,
          resetDate: now,
        },
      });
    }

    // 사용량 제한 체크
    if (usage.usageCount >= usage.limitCount) {
      return {
        allowed: false,
        remaining: 0,
        limit: usage.limitCount,
        resetDate: usage.resetDate,
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      };
    }

    return {
      allowed: true,
<<<<<<< HEAD
      remaining: usage.limit_count - usage.usage_count,
      limit: usage.limit_count,
      resetDate: usage.reset_date,
=======
      remaining: usage.limitCount - usage.usageCount,
      limit: usage.limitCount,
      resetDate: usage.resetDate,
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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
<<<<<<< HEAD
    const db = await getConnection();
    
    await db.request()
      .input('userId', userId)
      .input('serviceType', serviceType)
      .query(`
        UPDATE usage 
        SET usage_count = usage_count + 1, updated_at = GETDATE()
        WHERE user_id = @userId AND service_type = @serviceType
      `);
=======
    await prisma.usage.update({
      where: {
        userId_serviceType: {
          userId,
          serviceType,
        },
      },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  } catch (error) {
    console.error("사용량 증가 오류:", error);
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
<<<<<<< HEAD
  if (!session?.user?.id) {
=======
  if (!session?.user) {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    return {
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

<<<<<<< HEAD
  return {
    user: session.user,
=======
  // 사용자 ID 확인 (여러 방법으로 시도)
  const userId = session.user.id || session.user.email;
  
  if (!userId) {
    return {
      error: "사용자 정보를 찾을 수 없습니다.",
      status: 401,
    };
  }

  return {
    user: {
      id: userId,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      image: session.user.image,
    },
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  };
} 