import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
<<<<<<< HEAD
import { getConnection } from "@/lib/db";
=======
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

<<<<<<< HEAD
    // 관리자 권한 체크 - role 기반으로 변경
    if (session.user?.role !== 'ADMIN') {
=======
    // 관리자 권한 체크
    if (session.user?.email !== 'admin@moa.com') {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      return NextResponse.json({ error: '관리자 권한이 필요합니다' }, { status: 403 });
    }

    // 모든 사용자 조회 (Payment 정보와 Usage 정보 포함)
<<<<<<< HEAD
    const db = await getConnection();
    const usersResult = await db.request().query(`
      SELECT 
        u.id,
        u.display_name as name,
        u.email,
        u.role,
        u.created_at as createdAt,
        p.plan_type,
        (SELECT COUNT(*) FROM payments WHERE user_id = u.id) as paymentCount
      FROM users u
      LEFT JOIN (
        SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM payments 
        WHERE status = 'completed'
      ) p ON u.id = p.user_id AND p.rn = 1
      WHERE u.is_active = 1
      ORDER BY u.created_at DESC
    `);

    // 각 사용자의 사용량 정보 조회
    const formattedUsers = await Promise.all(usersResult.recordset.map(async (user: any) => {
      const usageResult = await db.request()
        .input('userId', user.id)
        .query(`
          SELECT 
            service_type as serviceType,
            usage_count as usageCount,
            limit_count as limitCount,
            reset_date as resetDate
          FROM usage 
          WHERE user_id = @userId
        `);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        planType: user.plan_type || 'basic',
        usage: usageResult.recordset.map((usage: any, index: number) => ({
          id: `${user.id}-${usage.serviceType}-${index}`,
          serviceType: usage.serviceType,
          usageCount: usage.usageCount,
          limitCount: usage.limitCount,
          resetDate: usage.resetDate.toISOString()
        })),
        createdAt: user.createdAt.toISOString(),
        _count: { payments: user.paymentCount }
      };
=======
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
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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

<<<<<<< HEAD
    // 관리자 권한 체크 - role 기반으로 변경
    if (session.user?.role !== 'ADMIN') {
=======
    // 관리자 권한 체크
    if (session.user?.email !== 'admin@moa.com') {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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
<<<<<<< HEAD
    const db = await getConnection();
    const userResult = await db.request()
      .input('userId', userId)
      .query('SELECT id FROM users WHERE id = @userId AND is_active = 1');

    if (userResult.recordset.length === 0) {
=======
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 역할 업데이트
<<<<<<< HEAD
    await db.request()
      .input('userId', userId)
      .input('role', role)
      .query('UPDATE users SET role = @role, updated_at = GETDATE() WHERE id = @userId');
=======
    await prisma.user.update({
      where: { id: userId },
      data: { role: role }
    });
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

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