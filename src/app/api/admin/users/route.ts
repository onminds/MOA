import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 사용자 목록 조회
export async function GET() {
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

    // 모든 사용자 정보와 사용량 조회
    const users = await prisma.user.findMany({
      include: {
        usage: true,
        _count: {
          select: {
            payments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("사용자 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
}

// 사용자 역할 변경
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

    const { userId, role } = await request.json();

    if (!userId || !role || !["USER", "ADMIN"].includes(role)) {
      return NextResponse.json(
        { error: "올바른 사용자 ID와 역할을 입력해주세요." }, 
        { status: 400 }
      );
    }

    // 사용자 역할 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      include: {
        usage: true
      }
    });

    return NextResponse.json({ 
      message: "사용자 역할이 업데이트되었습니다.",
      user: updatedUser 
    });
  } catch (error) {
    console.error("사용자 역할 변경 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
} 