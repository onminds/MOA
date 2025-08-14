import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ 세션 없음');
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    console.log('👤 세션 사용자 이메일:', session.user.email);

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

    console.log('🔌 DB 연결 성공');

    // session.user.email이 이메일인지 확인하고 ID 조회
    let userId: number;
    
    if (session.user.email && session.user.email.includes('@')) {
      console.log('📧 이메일로 사용자 ID 조회 중:', session.user.email);
      const userResult = await pool.request()
        .input('userEmail', sql.VarChar, session.user.email)
        .query(`SELECT id FROM users WHERE email = @userEmail`);
      
      if (userResult.recordset.length === 0) {
        console.log('❌ 사용자를 찾을 수 없습니다:', session.user.email);
        return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
      }
      
      userId = userResult.recordset[0].id;
      console.log('👤 이메일로 조회된 사용자 ID:', userId);
    } else {
      console.log('❌ 유효한 이메일이 아닙니다:', session.user.email);
      return NextResponse.json({ error: '유효한 사용자 이메일이 아닙니다.' }, { status: 400 });
    }

    // First, check total history count for the user
    const countResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`SELECT COUNT(*) as total FROM image_generation_history WHERE user_id = @userId`);
    console.log('📊 전체 히스토리 개수:', countResult.recordset[0].total);

    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 10
          id, prompt, generated_image_url, image_data, content_type, model, size, style, quality, title, created_at, status
        FROM image_generation_history
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);

    console.log('🔍 쿼리 결과 레코드 수:', result.recordset.length);
    console.log('🔍 쿼리 결과:', result.recordset);

    const history = result.recordset.map(item => {
      // DALL-E 3 이미지의 경우 내부 URL 생성, 다른 모델은 기존 URL 사용
      let imageUrl = item.generated_image_url;
      
      if (item.model === 'DALL-E 3' && item.image_data) {
        // DALL-E 3이고 이미지 데이터가 있으면 내부 URL 사용
        imageUrl = `/api/image/${item.id}`;
      }
      
      return {
        id: item.id,
        prompt: item.prompt,
        generatedImageUrl: imageUrl,
        model: item.model,
        size: item.size,
        style: item.style,
        quality: item.quality,
        title: item.title,
        createdAt: item.created_at,
        status: item.status
      };
    });

    console.log('✅ 변환된 히스토리:', history);

    return NextResponse.json({
      success: true,
      history,
      count: history.length
    });

  } catch (error) {
    console.error('❌ 이미지 히스토리 조회 중 오류:', error);
    return NextResponse.json({ error: '이미지 히스토리 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
