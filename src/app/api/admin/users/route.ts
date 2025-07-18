import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 체크
    if (session.user?.email !== 'admin@moa.com') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 모든 사용자 조회 (Payment 정보와 Usage 정보 포함)
    const users = await prisma.user.findMany({
      include: {
        usage: true,
        payments: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: {
            payments: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 사용자 데이터 포맷팅
    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      usage: user.usage.map((usage: any) => ({
        id: usage.id,
        serviceType: usage.serviceType,
        usageCount: usage.usageCount,
        limitCount: usage.limitCount,
        resetDate: usage.resetDate.toISOString()
      })),
      createdAt: user.createdAt.toISOString(),
      _count: user._count
    }));

    return NextResponse.json({ users: formattedUsers });
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    // 관리자 권한 체크
    if (session.user?.email !== 'admin@moa.com') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      return NextResponse.json({ error: '사용자 ID와 역할이 필요합니다' }, { status: 400 });
    }

    // 유효한 역할 체크
    if (!['USER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다' }, { status: 400 });
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 역할 업데이트
    await prisma.user.update({
      where: { id: userId },
      data: { role: role }
    });

    return NextResponse.json({ 
      message: '사용자 역할이 성공적으로 업데이트되었습니다',
      userId: userId,
      role: role
    });
  } catch (error) {
    console.error('사용자 역할 업데이트 실패:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
} 