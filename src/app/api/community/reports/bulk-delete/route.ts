import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnectionPool } from '@/lib/db-pool';

// 그룹별 신고 삭제 (같은 대상에 대한 모든 신고를 한번에 삭제)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId');
    const reason = searchParams.get('reason');

    // 필수 파라미터 검증
    if (!targetType || !targetId) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // reason이 'all'이면 해당 대상의 모든 신고를 대상으로 함
    const isAllReasons = reason === 'all';
    
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
      .input('targetId', parseInt(targetId));
    
    if (!isAllReasons) {
      checkRequest.input('reason', reason);
    }
    
    const checkResult = await checkRequest.query(checkQuery);

    if (parseInt(checkResult.recordset[0].count) === 0) {
      return NextResponse.json({ error: '해당 신고 그룹을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 삭제 전 개수 확인
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM reports 
      WHERE target_type = @targetType 
        AND target_id = @targetId 
    `;
    
    if (!isAllReasons) {
      countQuery += ` AND reason = @reason`;
    }
    
    const countRequest = pool.request()
      .input('targetType', targetType)
      .input('targetId', parseInt(targetId));
    
    if (!isAllReasons) {
      countRequest.input('reason', reason);
    }
    
    const countResult = await countRequest.query(countQuery);

    const deletedCount = parseInt(countResult.recordset[0].count);

    // 그룹의 모든 신고를 한번에 삭제
    let deleteQuery = `
      DELETE FROM reports 
      WHERE target_type = @targetType 
        AND target_id = @targetId 
    `;
    
    if (!isAllReasons) {
      deleteQuery += ` AND reason = @reason`;
    }
    
    const deleteRequest = pool.request()
      .input('targetType', targetType)
      .input('targetId', parseInt(targetId));
    
    if (!isAllReasons) {
      deleteRequest.input('reason', reason);
    }
    
    await deleteRequest.query(deleteQuery);

    return NextResponse.json({ 
      success: true, 
      message: `${deletedCount}개의 신고가 성공적으로 삭제되었습니다.`,
      deletedCount
    });

  } catch (error) {
    console.error('그룹별 신고 삭제 오류:', error);
    return NextResponse.json({ error: '신고 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
