import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function POST(request: NextRequest) {
  try {
    // 사용자 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { requestText, generatedCode, language, complexity } = await request.json();

    if (!requestText || !generatedCode) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
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

    // 사용자별 최신 10개 확인
    const checkResult = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`
        SELECT COUNT(*) as count 
        FROM code_generations 
        WHERE user_id = @userEmail
      `);

    const currentCount = checkResult.recordset[0].count;

    // 10개 초과 시 가장 오래된 것 삭제
    if (currentCount >= 10) {
      await pool.request()
        .input('userEmail', sql.VarChar, session.user.email)
        .query(`
          DELETE FROM code_generations 
          WHERE id IN (
            SELECT TOP 1 id 
            FROM code_generations 
            WHERE user_id = @userEmail 
            ORDER BY created_at ASC
          )
        `);
    }

    // 새 코드 생성 결과 저장
    const result = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .input('requestText', sql.NVarChar, requestText)
      .input('generatedCode', sql.NVarChar, generatedCode)
      .input('language', sql.VarChar, language || 'unknown')
      .input('complexity', sql.VarChar, complexity || 'unknown')
      .query(`
        INSERT INTO code_generations (user_id, request_text, generated_code, language, complexity)
        VALUES (@userEmail, @requestText, @generatedCode, @language, @complexity);
        
        SELECT SCOPE_IDENTITY() as id;
      `);

    const savedId = result.recordset[0].id;

    console.log('✅ 코드 생성 결과 저장 완료:', {
      userId: session.user.email,
      requestText: requestText.substring(0, 100) + '...',
      language,
      complexity,
      savedId
    });

    return NextResponse.json({ 
      success: true, 
      id: savedId,
      message: '코드가 성공적으로 저장되었습니다.' 
    });

  } catch (error) {
    console.error('❌ 코드 저장 중 오류:', error);
    return NextResponse.json({ 
      error: '코드 저장 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
