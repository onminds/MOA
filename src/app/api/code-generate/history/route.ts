import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    // 사용자 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
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

    // 사용자별 최신 10개 코드 생성 히스토리 조회
    const result = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`
        SELECT TOP 10
          id,
          request_text,
          generated_code,
          language,
          complexity,
          created_at,
          updated_at
        FROM code_generations 
        WHERE user_id = @userEmail 
        ORDER BY created_at DESC
      `);

    const history = result.recordset.map(item => ({
      id: item.id,
      requestText: item.request_text,
      generatedCode: item.generated_code,
      language: item.language,
      complexity: item.complexity,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    console.log('📋 코드 생성 히스토리 조회:', {
      userId: session.user.email,
      count: history.length
    });

    return NextResponse.json({ 
      success: true, 
      history,
      count: history.length
    });

  } catch (error) {
    console.error('❌ 히스토리 조회 중 오류:', error);
    return NextResponse.json({ 
      error: '히스토리 조회 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
