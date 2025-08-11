import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '잘못된 ID입니다.' }, { status: 400 });
    }

    const pool = await sql.connect({
      server: process.env.DB_SERVER || '',
      database: process.env.DB_NAME || '',
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      options: {
        encrypt: true,
        trustServerCertificate: true,
      },
    });

    // session.user.email이 이메일인지 확인하고 ID 조회
    let userId: number;
    
    if (session.user.email && session.user.email.includes('@')) {
      const userResult = await pool.request()
        .input('userEmail', sql.VarChar, session.user.email)
        .query(`SELECT id FROM users WHERE email = @userEmail`);
      
      if (userResult.recordset.length === 0) {
        return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
      }
      
      userId = userResult.recordset[0].id;
    } else {
      return NextResponse.json({ error: '유효한 사용자 이메일이 아닙니다.' }, { status: 400 });
    }

    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('userId', sql.Int, userId)
      .query(`
        DELETE FROM image_generation_history
        WHERE id = @id AND user_id = @userId
      `);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: '삭제할 항목을 찾을 수 없거나 권한이 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '이미지가 성공적으로 삭제되었습니다.' });

  } catch (error) {
    console.error('❌ 이미지 삭제 중 오류:', error);
    return NextResponse.json({ error: '이미지 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
