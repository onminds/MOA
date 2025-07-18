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

    // 관리자 권한 확인
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! }
    });

    if (!currentUser || currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { error: "관리자 권한이 필요합니다." }, 
        { status: 403 }
      );
    }

    // planType 컬럼 추가 마이그레이션 실행
    try {
      await prisma.$executeRaw`
        ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "planType" TEXT NOT NULL DEFAULT 'basic';
      `;

      return NextResponse.json({
        message: "데이터베이스 마이그레이션이 완료되었습니다.",
        migration: "planType 컬럼 추가됨"
      });
    } catch (dbError: any) {
      // 이미 컬럼이 존재하는 경우
      if (dbError.message.includes('already exists') || dbError.message.includes('duplicate column')) {
        return NextResponse.json({
          message: "마이그레이션이 이미 완료되어 있습니다.",
          migration: "planType 컬럼이 이미 존재함"
        });
      }
      
      throw dbError;
    }

  } catch (error) {
    console.error("마이그레이션 오류:", error);
    return NextResponse.json(
      { error: "마이그레이션 중 오류가 발생했습니다: " + (error as Error).message }, 
      { status: 500 }
    );
  }
} 