import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import sql from 'mssql';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 사용자 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const videoId = parseInt(params.id);
    if (isNaN(videoId)) {
      return NextResponse.json({ error: '유효하지 않은 영상 ID입니다.' }, { status: 400 });
    }

    console.log('🗑️ 영상 히스토리 삭제 요청 - ID:', videoId);

    const pool = await getConnection();

    // 사용자의 숫자 ID 조회
    const userResult = await pool.request()
      .input('email', sql.NVarChar, session.user.email)
      .query('SELECT id FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userId = userResult.recordset[0].id;

    // 영상이 해당 사용자의 것인지 확인하고 삭제
    const deleteResult = await pool.request()
      .input('videoId', sql.Int, videoId)
      .input('userId', sql.BigInt, userId)
      .query(`
        DELETE FROM video_generation_history 
        WHERE id = @videoId AND user_id = @userId;
        SELECT @@ROWCOUNT as deletedCount;
      `);

    const deletedCount = deleteResult.recordset[0]?.deletedCount || 0;

    if (deletedCount === 0) {
      return NextResponse.json({ error: '영상을 찾을 수 없거나 삭제 권한이 없습니다.' }, { status: 404 });
    }

    console.log('✅ 영상 히스토리 삭제 완료 - ID:', videoId);

    return NextResponse.json({
      success: true,
      message: '영상이 삭제되었습니다.'
    });

  } catch (error) {
    console.error('❌ 영상 히스토리 삭제 오류:', error);
    return NextResponse.json({ 
      error: '영상 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
