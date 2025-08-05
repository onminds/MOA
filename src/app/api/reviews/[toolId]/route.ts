import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params;
    const toolIdNum = parseInt(toolId);
    
    // 현재 사용자 ID 가져오기 (Authorization 헤더에서)
    const authHeader = request.headers.get('authorization');
    let currentUserId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const userId = authHeader.substring(7);
      // 빈 문자열이 아닌 경우에만 설정
      if (userId && userId !== '') {
        currentUserId = userId;
      }
    }
    
    const pool = await getConnection();
    const result = await pool.request()
      .input('toolId', toolIdNum)
      .input('currentUserId', currentUserId)
      .query(`
        SELECT 
          r.id,
          r.tool_id as toolId,
          r.user_id as userId,
          u.display_name as userName,
          r.rating,
          r.comment,
          r.helpful_count as helpful,
          r.not_helpful_count as notHelpful,
          FORMAT(r.created_at, 'yyyy-MM-dd') as date,
          COALESCE(v.vote_type, '') as userVote
        FROM ai_reviews r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN review_votes v ON r.id = v.review_id AND v.user_id = @currentUserId
        WHERE r.tool_id = @toolId AND r.is_deleted = 0
        ORDER BY r.created_at DESC
      `);
    
    return NextResponse.json({ reviews: result.recordset });
  } catch (error) {
    console.error('리뷰 조회 오류:', error);
    return NextResponse.json(
      { error: '리뷰 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params;
    const toolIdNum = parseInt(toolId);
    const body = await request.json();
    
    // 필수 필드 검증
    if (!body.rating || !body.comment || !body.userId) {
      return NextResponse.json(
        { error: '별점, 리뷰, 사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 기존 리뷰 확인 (삭제되지 않은 것만)
    const existingReview = await pool.request()
      .input('toolId', toolIdNum)
      .input('userId', body.userId)
      .query(`
        SELECT id FROM ai_reviews 
        WHERE tool_id = @toolId AND user_id = @userId AND is_deleted = 0
      `);
    
    if (existingReview.recordset.length > 0) {
      return NextResponse.json(
        { error: '이미 이 AI 도구에 리뷰를 작성하셨습니다.' },
        { status: 400 }
      );
    }
    
    const result = await pool.request()
      .input('toolId', toolIdNum)
      .input('userId', body.userId)
      .input('rating', body.rating)
      .input('comment', body.comment)
      .query(`
        INSERT INTO ai_reviews (tool_id, user_id, rating, comment)
        OUTPUT 
          INSERTED.id,
          INSERTED.tool_id as toolId,
          INSERTED.user_id as userId,
          INSERTED.rating,
          INSERTED.comment,
          INSERTED.helpful_count as helpful,
          INSERTED.not_helpful_count as notHelpful,
          FORMAT(INSERTED.created_at, 'yyyy-MM-dd') as date
        VALUES (@toolId, @userId, @rating, @comment)
      `);
    
    const newReview = result.recordset[0];
    
    // 사용자 이름 가져오기
    const userResult = await pool.request()
      .input('userId', body.userId)
      .query(`
        SELECT display_name as userName
        FROM users
        WHERE id = @userId
      `);
    
    newReview.userName = userResult.recordset[0]?.userName || '사용자';
    
    return NextResponse.json({ review: newReview });
  } catch (error) {
    console.error('리뷰 작성 오류:', error);
    return NextResponse.json(
      { error: '리뷰 작성에 실패했습니다.' },
      { status: 500 }
    );
  }
} 