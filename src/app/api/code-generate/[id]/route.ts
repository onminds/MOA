import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 사용자 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const resolvedParams = await params;
    const id = parseInt(resolvedParams.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '잘못된 ID입니다.' }, { status: 400 });
    }

    // DB 연결
    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER!,
      database: process.env.DB_NAME,
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });

    // 해당 항목이 현재 사용자의 것인지 확인 후 삭제
    const result = await pool.request()
      .input('id', sql.Int, id)
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`
        DELETE FROM code_generations 
        WHERE id = @id AND user_id = @userEmail
      `);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ 
        error: '삭제할 항목을 찾을 수 없거나 권한이 없습니다.' 
      }, { status: 404 });
    }

    console.log('🗑️ 코드 생성 결과 삭제 완료:', {
      userId: session.user.email,
      deletedId: id
    });

    return NextResponse.json({ 
      success: true, 
      message: '코드가 성공적으로 삭제되었습니다.' 
    });

  } catch (error) {
    console.error('❌ 코드 삭제 중 오류:', error);
    return NextResponse.json({ 
      error: '코드 삭제 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
