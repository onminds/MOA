import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const db = await getConnection();
    const result = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT role 
        FROM users 
        WHERE id = @userId
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    const role = result.recordset[0].role;
    
    return NextResponse.json({ 
      success: true, 
      role: role,
      isAdmin: role === 'ADMIN'
    });
  } catch (err) {
    console.error('사용자 role 조회 오류:', err);
    return NextResponse.json({ error: 'DB 오류', detail: err }, { status: 500 });
  }
}
