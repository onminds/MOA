import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { invalidateAiServicesCache } from '@/lib/ai-services';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { isHelpful, userId } = body;
    
    if (typeof isHelpful !== 'boolean' || !userId) {
      return NextResponse.json(
        { error: 'isHelpful 값과 userId가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 리뷰 존재 여부 확인
    const checkResult = await pool.request()
      .input('reviewId', reviewId)
      .query(`
        SELECT id FROM ai_reviews 
        WHERE id = @reviewId AND is_deleted = 0
      `);
    
    if (checkResult.recordset.length === 0) {
      return NextResponse.json(
        { error: '리뷰를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const voteType = isHelpful ? 'helpful' : 'not_helpful';
    
    // 기존 투표 확인
    const existingVote = await pool.request()
      .input('reviewId', reviewId)
      .input('userId', userId)
      .query(`
        SELECT vote_type FROM review_votes 
        WHERE review_id = @reviewId AND user_id = @userId
      `);
    
    if (existingVote.recordset.length > 0) {
      const currentVote = existingVote.recordset[0].vote_type;
      
      if (currentVote === voteType) {
        // 같은 투표 취소
        await pool.request()
          .input('reviewId', reviewId)
          .input('userId', userId)
          .query(`
            DELETE FROM review_votes 
            WHERE review_id = @reviewId AND user_id = @userId
          `);
        
        // 카운트 감소
        const updateField = isHelpful ? 'helpful_count' : 'not_helpful_count';
        await pool.request()
          .input('reviewId', reviewId)
          .query(`
            UPDATE ai_reviews 
            SET ${updateField} = ${updateField} - 1
            WHERE id = @reviewId
          `);
      } else {
        // 다른 투표로 변경
        await pool.request()
          .input('reviewId', reviewId)
          .input('userId', userId)
          .input('voteType', voteType)
          .query(`
            UPDATE review_votes 
            SET vote_type = @voteType
            WHERE review_id = @reviewId AND user_id = @userId
          `);
        
        // 카운트 조정 (기존 투표 감소, 새 투표 증가)
        const oldField = currentVote === 'helpful' ? 'helpful_count' : 'not_helpful_count';
        const newField = isHelpful ? 'helpful_count' : 'not_helpful_count';
        
        await pool.request()
          .input('reviewId', reviewId)
          .query(`
            UPDATE ai_reviews 
            SET ${oldField} = ${oldField} - 1,
                ${newField} = ${newField} + 1
            WHERE id = @reviewId
          `);
      }
    } else {
      // 새로운 투표 추가
      await pool.request()
        .input('reviewId', reviewId)
        .input('userId', userId)
        .input('voteType', voteType)
        .query(`
          INSERT INTO review_votes (review_id, user_id, vote_type)
          VALUES (@reviewId, @userId, @voteType)
        `);
      
      // 카운트 증가
      const updateField = isHelpful ? 'helpful_count' : 'not_helpful_count';
      await pool.request()
        .input('reviewId', reviewId)
        .query(`
          UPDATE ai_reviews 
          SET ${updateField} = ${updateField} + 1
          WHERE id = @reviewId
        `);
    }
    
    // 업데이트된 리뷰 정보 반환
    const result = await pool.request()
      .input('reviewId', reviewId)
      .input('currentUserId', userId)
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
        WHERE r.id = @reviewId
      `);
    
    const updatedReview = result.recordset[0];
    
    // 투표 변경 반영을 위해 목록 캐시 무효화
    try { invalidateAiServicesCache(); } catch {}
    return NextResponse.json({ review: updatedReview });
  } catch (error) {
    console.error('리뷰 평가 오류:', error);
    return NextResponse.json(
      { error: '리뷰 평가에 실패했습니다.' },
      { status: 500 }
    );
  }
} 