import { NextRequest, NextResponse } from 'next/server';
import sql from 'mssql';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: '비디오 ID가 필요합니다.' }, { status: 400 });
    }

    const pool = await sql.connect({
      server: process.env.DB_SERVER || '',
      database: process.env.DB_NAME || '',
      user: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
      options: { encrypt: true, trustServerCertificate: true }
    });

    const result = await pool.request()
      .input('id', sql.Int, parseInt(id))
      .query(`SELECT video_data FROM video_generation_history WHERE id = @id`);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: '비디오를 찾을 수 없습니다.' }, { status: 404 });
    }

    const videoData = result.recordset[0].video_data;
    if (!videoData) {
      return NextResponse.json({ error: '비디오 데이터가 없습니다.' }, { status: 404 });
    }

    return new NextResponse(videoData, {
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  } catch (error) {
    console.error('비디오 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}


