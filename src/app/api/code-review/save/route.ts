import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { codeContent, reviewResult } = await request.json();

    if (!codeContent || !reviewResult) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
    }

    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER!,
      database: process.env.DB_NAME,
      options: { encrypt: false, trustServerCertificate: true },
    });

    // 현재 히스토리 개수 확인 (최대 10개 유지)
    const checkResult = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`SELECT COUNT(*) as count FROM code_reviews WHERE user_id = @userEmail`);

    const currentCount = checkResult.recordset[0].count;

    if (currentCount >= 10) {
      // 가장 오래된 항목 삭제 (FIFO)
      await pool.request()
        .input('userEmail', sql.VarChar, session.user.email)
        .query(`DELETE FROM code_reviews WHERE id IN (SELECT TOP 1 id FROM code_reviews WHERE user_id = @userEmail ORDER BY created_at ASC)`);
    }

    // 새로운 리뷰 결과 저장
    const result = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .input('codeContent', sql.NVarChar, codeContent)
      .input('reviewResult', sql.NVarChar, JSON.stringify(reviewResult))
      .query(`INSERT INTO code_reviews (user_id, code_content, review_result) VALUES (@userEmail, @codeContent, @reviewResult); SELECT SCOPE_IDENTITY() as id;`);

    const savedId = result.recordset[0].id;

    console.log('✅ 코드 리뷰 결과 저장 완료:', { 
      userId: session.user.email, 
      codeLength: codeContent.length,
      detectedLanguage: reviewResult.detectedLanguage,
      overallScore: reviewResult.overallScore,
      savedId 
    });

    return NextResponse.json({ 
      success: true, 
      id: savedId, 
      message: '코드 리뷰가 성공적으로 저장되었습니다.' 
    });

  } catch (error) {
    console.error('❌ 코드 리뷰 저장 중 오류:', error);
    return NextResponse.json({ error: '코드 리뷰 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
