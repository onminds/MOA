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

    const { prompt, generatedImageUrl, model, size, style, quality, title } = await request.json();
    
    if (!prompt || !generatedImageUrl || !title) {
      return NextResponse.json({ error: '필수 데이터가 누락되었습니다.' }, { status: 400 });
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

    // 현재 사용자의 히스토리 개수 확인
    const checkResult = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .query(`SELECT COUNT(*) as count FROM image_generation_history WHERE user_id = @userEmail`);

    const currentCount = checkResult.recordset[0].count;

    // 10개가 넘으면 가장 오래된 것 삭제
    if (currentCount >= 10) {
      await pool.request()
        .input('userEmail', sql.VarChar, session.user.email)
        .query(`
          DELETE FROM image_generation_history
          WHERE id IN (
            SELECT TOP 1 id FROM image_generation_history 
            WHERE user_id = @userEmail 
            ORDER BY created_at ASC
          )
        `);
    }

    // 새로운 이미지 생성 히스토리 저장
    const result = await pool.request()
      .input('userEmail', sql.VarChar, session.user.email)
      .input('prompt', sql.NVarChar, prompt)
      .input('generatedImageUrl', sql.NVarChar, generatedImageUrl)
      .input('model', sql.NVarChar, model || 'unknown')
      .input('size', sql.NVarChar, size || 'unknown')
      .input('style', sql.NVarChar, style || 'unknown')
      .input('quality', sql.NVarChar, quality || 'standard')
      .input('title', sql.NVarChar, title)
      .query(`
        INSERT INTO image_generation_history 
        (user_id, prompt, generated_image_url, model, size, style, quality, title, created_at, status)
        VALUES (@userEmail, @prompt, @generatedImageUrl, @model, @size, @style, @quality, @title, GETDATE(), 'success');
        SELECT SCOPE_IDENTITY() as id;
      `);

    const savedId = result.recordset[0].id;
    return NextResponse.json({ 
      success: true, 
      id: savedId, 
      message: '이미지가 성공적으로 저장되었습니다.' 
    });

  } catch (error) {
    console.error('❌ 이미지 저장 중 오류:', error);
    return NextResponse.json({ error: '이미지 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
