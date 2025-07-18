import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 사용자 사용량 업데이트
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다." }, 
        { status: 401 }
      );
    }

    // 현재 사용자가 관리자인지 확인
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." }, 
        { status: 403 }
      );
    }

    const { userId, action, serviceType, customLimit } = await request.json();

    if (!userId || !action) {
      return NextResponse.json(
        { error: "사용자 ID와 액션을 입력해주세요." }, 
        { status: 400 }
      );
    }

    switch (action) {
      case "reset": {
        // 특정 서비스 또는 모든 서비스 사용량 리셋
        const whereClause = serviceType 
          ? { userId, serviceType } 
          : { userId };

        await prisma.usage.updateMany({
          where: whereClause,
          data: {
            usageCount: 0,
            resetDate: new Date()
          }
        });

        return NextResponse.json({ 
          message: serviceType 
            ? `${serviceType} 사용량이 리셋되었습니다.`
            : "모든 사용량이 리셋되었습니다." 
        });
      }

      case "unlimited": {
        // 특정 서비스를 무제한으로 설정 (limitCount를 9999로 설정)
        if (!serviceType) {
          return NextResponse.json(
            { error: "서비스 타입을 지정해주세요." }, 
            { status: 400 }
          );
        }

        await prisma.usage.upsert({
          where: {
            userId_serviceType: {
              userId,
              serviceType
            }
          },
          update: {
            limitCount: 9999,
            usageCount: 0,
            resetDate: new Date()
          },
          create: {
            userId,
            serviceType,
            limitCount: 9999,
            usageCount: 0,
            resetDate: new Date()
          }
        });

        return NextResponse.json({ 
          message: `${serviceType} 서비스가 무제한으로 설정되었습니다.` 
        });
      }

      case "setLimit": {
        // 커스텀 제한 설정
        if (!serviceType || !customLimit || customLimit < 0) {
          return NextResponse.json(
            { error: "서비스 타입과 유효한 제한 수치를 입력해주세요." }, 
            { status: 400 }
          );
        }

        await prisma.usage.upsert({
          where: {
            userId_serviceType: {
              userId,
              serviceType
            }
          },
          update: {
            limitCount: customLimit,
            usageCount: 0,
            resetDate: new Date()
          },
          create: {
            userId,
            serviceType,
            limitCount: customLimit,
            usageCount: 0,
            resetDate: new Date()
          }
        });

        return NextResponse.json({ 
          message: `${serviceType} 서비스 제한이 ${customLimit}회로 설정되었습니다.` 
        });
      }

      default:
        return NextResponse.json(
          { error: "올바른 액션을 선택해주세요." }, 
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("사용량 관리 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
} 