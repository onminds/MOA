import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnectionPool } from '@/lib/db-pool';

// 그룹별 신고 상태 변경 (같은 대상에 대한 모든 신고를 한번에 변경)
export async function PATCH(request: NextRequest) {
  try {
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

    const { targetType, targetId, reason, status, adminNotes } = await request.json();

    // 필수 필드 검증
    if (!targetType || !targetId || !status) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 상태값 검증
    const validStatuses = ['pending', 'reviewed', 'resolved', 'dismissed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: '잘못된 상태값입니다.' }, { status: 400 });
    }

    // reason이 null이거나 'all'이면 해당 대상의 모든 신고를 대상으로 함
    const isAllReasons = !reason || reason === 'all';
    
    // 해당 그룹의 신고들이 존재하는지 확인
    let checkQuery = `
      SELECT COUNT(*) as count
      FROM reports
      WHERE target_type = @targetType
        AND target_id = @targetId
    `;
    
    if (!isAllReasons) {
      checkQuery += ` AND reason = @reason`;
    }
    
    const checkRequest = pool.request()
      .input('targetType', targetType)
      .input('targetId', targetId);
    
    if (!isAllReasons) {
      checkRequest.input('reason', reason);
    }
    
    const checkResult = await checkRequest.query(checkQuery);

    if (parseInt(checkResult.recordset[0].count) === 0) {
      return NextResponse.json({ error: '해당 신고 그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 그룹의 모든 신고 상태를 한번에 변경 (OUTPUT 절 제거)
    let updateQuery = `
      UPDATE reports
      SET status = @status,
          admin_notes = @adminNotes,
          updated_at = GETDATE()
      WHERE target_type = @targetType
        AND target_id = @targetId
    `;
    
    if (!isAllReasons) {
      updateQuery += ` AND reason = @reason`;
    }
    
    const updateRequest = pool.request()
      .input('targetType', targetType)
      .input('targetId', targetId)
      .input('status', status)
      .input('adminNotes', adminNotes || null);
    
    if (!isAllReasons) {
      updateRequest.input('reason', reason);
    }
    
    // UPDATE 실행
    await updateRequest.query(updateQuery);

    // 업데이트된 행 수를 별도로 조회
    let countQuery = `
      SELECT COUNT(*) as updated_count
      FROM reports
      WHERE target_type = @targetType
        AND target_id = @targetId
        AND status = @status
    `;
    
    if (!isAllReasons) {
      countQuery += ` AND reason = @reason`;
    }
    
    const countRequest = pool.request()
      .input('targetType', targetType)
      .input('targetId', targetId)
      .input('status', status);
    
    if (!isAllReasons) {
      countRequest.input('reason', reason);
    }
    
    const countResult = await countRequest.query(countQuery);
    const updatedCount = parseInt(countResult.recordset[0].updated_count);

    return NextResponse.json({ 
      success: true, 
      message: `${updatedCount}개의 신고 상태가 성공적으로 변경되었습니다.`,
      updatedCount
    });

  } catch (error) {
    console.error('그룹별 신고 상태 변경 오류:', error);
    return NextResponse.json({ error: '신고 상태 변경 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
