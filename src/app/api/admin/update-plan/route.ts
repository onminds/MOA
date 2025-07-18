import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 체크
    if (session.user?.email !== 'admin@moa.com') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { userId, planType } = await request.json();

    if (!userId || !planType) {
      return NextResponse.json({ error: '사용자 ID와 플랜 타입이 필요합니다' }, { status: 400 });
    }

    // 유효한 플랜 타입 체크
    if (!['basic', 'standard', 'pro'].includes(planType)) {
      return NextResponse.json({ error: '유효하지 않은 플랜 타입입니다' }, { status: 400 });
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { payments: true },
    });

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // Payment 레코드가 있으면 업데이트, 없으면 생성
    const existingPayment = user.payments.find((p: any) => p.status === 'completed');
    
    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: { planType: planType },
      });
    } else {
      await prisma.payment.create({
        data: {
          userId: userId,
          planType: planType,
          amount: 0, // 관리자가 부여하는 경우 무료
          creditsAdded: 0,
          paymentMethod: 'admin',
          status: 'completed',
        },
      });
    }

    // 플랜별 제한 설정 (이미지와 영상만)
    const planLimits = {
      basic: { image: 2, video: 1 },
      standard: { image: 120, video: 20 },
      pro: { image: 300, video: 45 }
    };
    
    const limits = planLimits[planType as keyof typeof planLimits];

    // 이미지 생성 제한 업데이트
    await prisma.usage.upsert({
      where: {
        userId_serviceType: {
          userId: userId,
          serviceType: 'image-generate',
        },
      },
      update: {
        limitCount: limits.image,
      },
      create: {
        userId: userId,
        serviceType: 'image-generate',
        usageCount: 0,
        limitCount: limits.image,
        resetDate: new Date(),
      },
    });

    // 영상 생성 제한 업데이트
    await prisma.usage.upsert({
      where: {
        userId_serviceType: {
          userId: userId,
          serviceType: 'video-generate',
        },
      },
      update: {
        limitCount: limits.video,
      },
      create: {
        userId: userId,
        serviceType: 'video-generate',
        usageCount: 0,
        limitCount: limits.video,
        resetDate: new Date(),
      },
    });

    return NextResponse.json({ 
      message: '플랜이 성공적으로 업데이트되었습니다',
      planType: planType 
    });
  } catch (error) {
    console.error('플랜 업데이트 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
} 