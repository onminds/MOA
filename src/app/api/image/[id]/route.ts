import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: imageId } = await params;

    if (!imageId) {
      return NextResponse.json({ error: '이미지 ID가 필요합니다.' }, { status: 400 });
    }

    // DB 연결
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

    // 이미지 데이터 조회
    const result = await pool.request()
      .input('imageId', sql.Int, parseInt(imageId))
      .query(`
        SELECT image_data, content_type 
        FROM image_generation_history 
        WHERE id = @imageId
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다.' }, { status: 404 });
    }

    const imageData = result.recordset[0].image_data;
    const contentType = result.recordset[0].content_type || 'image/png';

    // 이미지 데이터를 응답으로 반환
    return new NextResponse(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 24시간 캐시
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (error) {
    console.error('이미지 조회 오류:', error);
    return NextResponse.json({ 
      error: '이미지를 가져올 수 없습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
