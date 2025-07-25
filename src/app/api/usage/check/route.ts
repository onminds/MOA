import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 이미지 생성 전용 사용량 체크
async function checkImageGenerationUsage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payments: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!user) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const usage = await prisma.usage.findUnique({
    where: {
      userId_serviceType: {
        userId,
        serviceType: 'image-generate'
      }
    }
  });

  let maxLimit = 2; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.payments.length > 0) {
    const latestPayment = user.payments[0];
    planType = latestPayment.planType;
    
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

  const currentUsage = usage?.usageCount || 0;
  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: new Date().toISOString() // 이미지는 총 제한이므로 리셋 없음
  };
}

// 영상 생성 전용 사용량 체크
async function checkVideoGenerationUsage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payments: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!user) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const usage = await prisma.usage.findUnique({
    where: {
      userId_serviceType: {
        userId,
        serviceType: 'video-generate'
      }
    }
  });

  let maxLimit = 1; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.payments.length > 0) {
    const latestPayment = user.payments[0];
    planType = latestPayment.planType;
    
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

  const currentUsage = usage?.usageCount || 0;
  const remainingCount = Math.max(0, maxLimit - currentUsage);
  const allowed = currentUsage < maxLimit;

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount,
    planType,
    resetDate: new Date().toISOString() // 영상은 총 제한이므로 리셋 없음
  };
}

// 기존 사용량 체크 (다른 서비스용)
async function checkUsageLimit(userId: string, serviceType: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const usage = await prisma.usage.findUnique({
    where: {
      userId_serviceType: {
        userId,
        serviceType
      }
    }
  });

  if (!usage) {
    return {
      allowed: true,
      usageCount: 0,
      limitCount: getDefaultLimit(serviceType),
      remainingCount: getDefaultLimit(serviceType),
      resetDate: today
    };
  }

  const usageDate = new Date(usage.resetDate);
  usageDate.setHours(0, 0, 0, 0);
  
  if (today.getTime() !== usageDate.getTime()) {
    return {
      allowed: true,
      usageCount: 0,
      limitCount: usage.limitCount,
      remainingCount: usage.limitCount,
      resetDate: today
    };
  }

  const allowed = usage.usageCount < usage.limitCount;
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