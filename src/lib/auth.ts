import { getServerSession } from "next-auth/next";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  return session?.user;
}

export async function checkUsageLimit(userId: string, serviceType: string) {
  try {

    // 사용량 정보가 없으면 생성
    if (!usage) {
      const defaultLimit = serviceType === "image-generate" ? 1 : 10; // 이미지 생성은 1회, 나머지는 10회

    }

    // 일일 리셋 체크 (매일 자정에 리셋)
    const now = new Date();

    const isNewDay = now.getDate() !== resetDate.getDate() || 
                     now.getMonth() !== resetDate.getMonth() || 
                     now.getFullYear() !== resetDate.getFullYear();

    if (isNewDay) {

      };
    }

    return {
      allowed: true,

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

  } catch (error) {
    console.error("사용량 증가 오류:", error);
  }
}

export async function requireAuth() {
  const session = await getServerSession(authOptions);

    return {
      error: "로그인이 필요합니다.",
      status: 401,
    };
  }

  };
} 