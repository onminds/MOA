import { getServerSession } from "next-auth/next";
import { PrismaClient } from "@prisma/client";
import { authOptions } from "@/lib/authOptions";

const prisma = new PrismaClient();

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {
    // 사용량 정보 조회
    let usage = await prisma.usage.findUnique({
      where: {
        userId_serviceType: {
          userId,
          serviceType,
        },
      },
    });

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = serviceType === "image-generate" ? 1 : 10; // 이미지 생성은 1회, 나머지는 10회
      usage = await prisma.usage.create({
        data: {
          userId,
          serviceType,
          usageCount: 0,
          limitCount: defaultLimit,
        },
      });
    }

    // 일일 리셋 체크 (매일 자정에 리셋)
    const now = new Date();
    const resetDate = new Date(usage.resetDate);
    const isNewDay = now.getDate() !== resetDate.getDate() || 
                     now.getMonth() !== resetDate.getMonth() || 
                     now.getFullYear() !== resetDate.getFullYear();

    if (isNewDay) {
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
      };
    }

    return {
      allowed: true,
      remaining: usage.limitCount - usage.usageCount,
      limit: usage.limitCount,
      resetDate: usage.resetDate,
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
  } catch (error) {
    console.error("사용량 증가 오류:", error);
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    return {
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

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
  };
} 