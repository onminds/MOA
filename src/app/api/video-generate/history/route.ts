import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    // 사용자 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    console.log('👤 세션 사용자 이메일:', session.user.email);

    const pool = await getConnection();
    console.log('🔌 DB 연결 성공');

    // 사용자의 숫자 ID 조회
    const userResult = await pool.request()
      .input('email', sql.NVarChar, session.user.email)
      .query('SELECT id FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userId = userResult.recordset[0].id;
    console.log('📊 사용자 ID:', userId);

    // 모든 영상 생성 히스토리 조회
    const historyResult = await pool.request()
      .input('userId', sql.BigInt, userId)
      .query(`
        SELECT 
          id,
          prompt,
          generated_video_url,
          model,
          size,
          duration,
          resolution,
          style,
          quality,
          title,
          created_at,
          status
        FROM video_generation_history 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    console.log('📊 전체 히스토리 개수:', historyResult.recordset.length);
    console.log('🔍 쿼리 결과 레코드 수:', historyResult.recordset.length);

    // 결과 변환
    const history = historyResult.recordset.map(item => ({
      id: item.id,
      prompt: item.prompt,
      generatedVideoUrl: item.generated_video_url,
      model: item.model,
      size: item.size,
      duration: item.duration,
      resolution: item.resolution,
      style: item.style,
      quality: item.quality,
      title: item.title,
      createdAt: item.created_at,
      status: item.status
    }));

    console.log('✅ 변환된 히스토리:', history);

    return NextResponse.json({
      success: true,
      history: history,
      count: history.length
    });

  } catch (error) {
    console.error('❌ 영상 히스토리 조회 오류:', error);
    return NextResponse.json({ 
      error: '영상 히스토리를 불러올 수 없습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
