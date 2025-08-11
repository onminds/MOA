import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import sql from 'mssql';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const pool = await sql.connect({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER!,
      database: process.env.DB_NAME,
      options: { encrypt: false, trustServerCertificate: true },
    });

    const result = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`SELECT TOP 10 id, code_content, review_result, created_at, updated_at FROM code_reviews WHERE user_id = @userEmail ORDER BY created_at DESC`);

    const history = result.recordset.map(item => {
      const reviewData = JSON.parse(item.review_result);
      return {
        id: item.id,
        codeContent: item.code_content,
        detectedLanguage: reviewData.detectedLanguage,
        overallScore: reviewData.overallScore,
        summary: reviewData.summary,
        scores: reviewData.scores,
        issues: reviewData.issues,
        improvements: reviewData.improvements,
        positives: reviewData.positives,
        refactoredCode: reviewData.refactoredCode,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      };
    });

    console.log('📋 코드 리뷰 히스토리 조회:', { 
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
    return NextResponse.json({ error: '히스토리 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
