import { NextResponse } from 'next/server';
import { getConnectionPool } from '@/lib/db-pool';

// 신고 사유 목록 조회
export async function GET() {
  try {
    const pool = await getConnectionPool();
    const result = await pool.request()
      .query(`
        SELECT 
          id,
          reason_code,
          reason_name,
          description,
          is_active
        FROM report_reasons 
        WHERE is_active = 1
        ORDER BY id
      `);

    return NextResponse.json({ reasons: result.recordset });

  } catch (error) {
    console.error('신고 사유 조회 오류:', error);
    return NextResponse.json({ error: '신고 사유 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
