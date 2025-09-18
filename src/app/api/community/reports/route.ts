import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnectionPool } from '@/lib/db-pool';

// 신고 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { targetType, targetId, reason, description } = await request.json();

    // 필수 필드 검증
    if (!targetType || !targetId || !reason) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // targetType 검증
    if (!['post', 'comment'].includes(targetType)) {
      return NextResponse.json({ error: '잘못된 신고 대상 타입입니다.' }, { status: 400 });
    }

    // 대상 존재 여부 확인
    const pool = await getConnectionPool();
    let targetExists = false;
    if (targetType === 'post') {
      const postResult = await pool.request()
        .input('targetId', targetId)
        .query('SELECT id FROM posts WHERE id = @targetId AND is_deleted = 0');
      targetExists = postResult.recordset.length > 0;
    } else if (targetType === 'comment') {
      const commentResult = await pool.request()
        .input('targetId', targetId)
        .query('SELECT id FROM comments WHERE id = @targetId AND is_deleted = 0');
      targetExists = commentResult.recordset.length > 0;
    }

    if (!targetExists) {
      return NextResponse.json({ error: '신고 대상이 존재하지 않습니다.' }, { status: 404 });
    }

    // 중복 신고 확인 (같은 사용자가 같은 대상을 신고한 경우)
    const duplicateResult = await pool.request()
      .input('reporterId', session.user.id)
      .input('targetType', targetType)
      .input('targetId', targetId)
      .query(`
        SELECT id FROM reports 
        WHERE reporter_id = @reporterId 
          AND target_type = @targetType 
          AND target_id = @targetId
          AND status IN ('pending', 'reviewed')
      `);

    if (duplicateResult.recordset.length > 0) {
      return NextResponse.json({ error: '이미 신고한 대상입니다.' }, { status: 409 });
    }

    // 신고 생성
    const result = await pool.request()
      .input('reporterId', session.user.id)
      .input('targetType', targetType)
      .input('targetId', targetId)
      .input('reason', reason)
      .input('description', description || null)
      .query(`
        INSERT INTO reports (reporter_id, target_type, target_id, reason, description, status)
        OUTPUT INSERTED.id
        VALUES (@reporterId, @targetType, @targetId, @reason, @description, 'pending')
      `);

    return NextResponse.json({ 
      success: true, 
      reportId: result.recordset[0].id,
      message: '신고가 성공적으로 접수되었습니다.' 
    });

  } catch (error) {
    console.error('신고 생성 오류:', error);
    return NextResponse.json({ error: '신고 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 신고 목록 조회 (관리자용)
export async function GET(request: NextRequest) {
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
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // 신고 그룹별 목록 조회 (같은 대상에 대한 신고들을 그룹화)
    let query = `
      SELECT 
        r.target_type,
        r.target_id,
        MIN(r.created_at) AS first_reported_at,
        MAX(r.created_at) AS last_reported_at,
        COUNT(*) AS report_count,
        STRING_AGG(CONCAT(u.display_name, ' (', u.email, ')'), '; ') AS reporters,
        STRING_AGG(DISTINCT r.reason, ', ') AS reasons,
        STRING_AGG(DISTINCT r.status, ', ') AS statuses
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
    `;

    const conditions: string[] = [];

    if (status) {
      conditions.push(`r.status = @status`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` 
      GROUP BY r.target_type, r.target_id
      ORDER BY last_reported_at DESC
    `;
    
    // SQL Server에서 안전한 페이지네이션 (모든 버전 호환)
    const finalQuery = `
      SELECT 
        r.target_type,
        r.target_id,
        MIN(r.created_at) AS first_reported_at,
        MAX(r.created_at) AS last_reported_at,
        COUNT(*) AS report_count
      FROM reports r
      JOIN users u ON r.reporter_id = u.id
      ${status ? 'WHERE r.status = @status' : ''}
      GROUP BY r.target_type, r.target_id
      ORDER BY MAX(r.created_at) DESC
    `;

    const dbRequest = pool.request()
      .input('limit', limit)
      .input('offset', offset);
    
    if (status) {
      dbRequest.input('status', status);
    }

    const result = await dbRequest.query(finalQuery);

    // 전체 데이터에서 페이지네이션 처리
    const allReports = result.recordset;
    const total = allReports.length;
    const startIndex = offset;
    const endIndex = startIndex + limit;
    const paginatedReports = allReports.slice(startIndex, endIndex);

    // 각 신고 그룹에 대한 상세 정보 조회
    const detailedReports = await Promise.all(
      paginatedReports.map(async (report) => {
        // 신고자 정보 조회 (상세 내용 포함)
        const reportersResult = await pool.request()
          .input('targetType', report.target_type)
          .input('targetId', report.target_id)
          .query(`
            SELECT DISTINCT u.display_name, u.email, r.reason, r.description, r.created_at
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            WHERE r.target_type = @targetType AND r.target_id = @targetId
            ORDER BY r.created_at ASC
          `);
        
        const reporters = reportersResult.recordset
          .map(r => {
            let reporterInfo = `${r.display_name} (${r.email})`;
            if (r.description) {
              reporterInfo += ` - ${r.description}`;
            }
            return reporterInfo;
          })
          .join('; ');

        // 신고 사유 조회
        const reasonsResult = await pool.request()
          .input('targetType', report.target_type)
          .input('targetId', report.target_id)
          .query(`
            SELECT DISTINCT reason
            FROM reports
            WHERE target_type = @targetType AND target_id = @targetId
          `);
        
        const reasons = reasonsResult.recordset
          .map(r => r.reason)
          .join(', ');

        // 신고 상태 조회
        const statusesResult = await pool.request()
          .input('targetType', report.target_type)
          .input('targetId', report.target_id)
          .query(`
            SELECT DISTINCT status
            FROM reports
            WHERE target_type = @targetType AND target_id = @targetId
          `);
        
        const statuses = statusesResult.recordset
          .map(r => r.status)
          .join(', ');

        return {
          ...report,
          reporters,
          reasons,
          statuses
        };
      })
    );

    return NextResponse.json({
      reports: detailedReports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('신고 목록 조회 오류:', error);
    return NextResponse.json({ error: '신고 목록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
