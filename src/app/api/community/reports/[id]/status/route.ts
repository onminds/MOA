import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnectionPool } from '@/lib/db-pool';

// 신고 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // 관리자 권한 확인
    const pool = await getConnectionPool();
    const userResult = await pool.request()
      .input('userId', session.user.id)
      .query('SELECT role FROM users WHERE id = @userId');
    
    if (!userResult.recordset.length || userResult.recordset[0].role !== 'ADMIN') {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const reportId = parseInt(id);
    if (isNaN(reportId)) {
      return NextResponse.json({ error: '잘못된 신고 ID입니다.' }, { status: 400 });
    }

    const { status, adminNotes } = await request.json();

    // 상태값 검증
    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 });
    }

    // 신고 존재 여부 확인
    const reportResult = await pool.request()
      .input('reportId', reportId)
      .query('SELECT id FROM reports WHERE id = @reportId');

    if (reportResult.recordset.length === 0) {
      return NextResponse.json({ error: '신고를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 상태 업데이트
    const updateResult = await pool.request()
      .input('reportId', reportId)
      .input('status', status)
      .input('adminNotes', adminNotes || null)
      .query(`
        UPDATE reports 
        SET status = @status, 
            admin_notes = @adminNotes,
            updated_at = GETDATE()
        OUTPUT INSERTED.id, INSERTED.status
        WHERE id = @reportId
      `);

    return NextResponse.json({ 
      success: true, 
      message: '신고 상태가 성공적으로 변경되었습니다.',
      report: updateResult.recordset[0]
    });

  } catch (error) {
    console.error('신고 상태 변경 오류:', error);
    return NextResponse.json({ error: '신고 상태 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
