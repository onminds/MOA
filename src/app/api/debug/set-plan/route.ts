import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." }, 
        { status: 401 }
      );
    }

    const { planType } = await request.json();

    if (!planType || !['basic', 'standard', 'pro'].includes(planType)) {
      return NextResponse.json(
        { error: "올바른 플랜 타입을 선택해주세요. (basic, standard, pro)" }, 
        { status: 400 }
      );
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." }, 
        { status: 404 }
      );
    }

    if (planType === 'basic') {
      // 기본 플랜으로 변경 (결제 내역 삭제)
      await prisma.payment.deleteMany({
        where: { userId: currentUser.id }
      });
      
      return NextResponse.json({
        message: "기본 플랜으로 변경되었습니다. (이미지 생성 2회)",
        planType: 'basic',
        imageLimit: 2
      });
    } else {
      // Standard 또는 Pro 플랜 결제 내역 추가
      const amount = planType === 'standard' ? 9900 : 19900;
      const creditsAdded = planType === 'standard' ? 120 : 300;

      // 기존 결제 내역 삭제 후 새로 추가
      await prisma.payment.deleteMany({
        where: { userId: currentUser.id }
      });

      await prisma.payment.create({
        data: {
          userId: currentUser.id,
          planType: planType,
          amount: amount,
          creditsAdded: creditsAdded,
          paymentMethod: "test",
          status: "completed",
          transactionId: `test_${Date.now()}`
        }
      });

      return NextResponse.json({
        message: `${planType.toUpperCase()} 플랜으로 변경되었습니다.`,
        planType: planType,
        imageLimit: creditsAdded
      });
    }

  } catch (error) {
    console.error("플랜 설정 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
} 