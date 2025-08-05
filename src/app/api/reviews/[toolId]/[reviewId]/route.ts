import { NextRequest, NextResponse } from 'next/server';
<<<<<<< HEAD
import { getConnection } from '@/lib/db';
=======

// 임시 리뷰 데이터 (실제로는 데이터베이스에서 관리)
let reviews = [
  {
    id: '1',
    toolId: 1,
    userId: 'user1',
    userName: '김개발',
    rating: 5,
    comment: '정말 유용한 도구입니다. 코딩할 때 많이 도움이 되었어요!',
    date: '2024-01-15',
    helpful: 12,
    notHelpful: 1
  },
  {
    id: '2',
    toolId: 1,
    userId: 'user2',
    userName: '이디자인',
    rating: 4,
    comment: '디자인 작업에 활용하기 좋습니다. 다만 가격이 조금 비싸네요.',
    date: '2024-01-10',
    helpful: 8,
    notHelpful: 2
  },
  {
    id: '3',
    toolId: 1,
    userId: 'user3',
    userName: '박마케팅',
    rating: 5,
    comment: '마케팅 콘텐츠 작성에 최고입니다. 시간을 많이 절약할 수 있어요.',
    date: '2024-01-08',
    helpful: 15,
    notHelpful: 0
  },
  {
    id: '4',
    toolId: 2,
    userId: 'user4',
    userName: '최연구',
    rating: 5,
    comment: 'Claude는 정말 안전하고 유용한 AI입니다. 특히 긴 문서 분석에 최고예요.',
    date: '2024-01-12',
    helpful: 20,
    notHelpful: 1
  },
  {
    id: '5',
    toolId: 2,
    userId: 'user5',
    userName: '정학생',
    rating: 4,
    comment: '학습 자료 작성에 도움이 많이 됩니다. 다만 무료 버전의 제한이 있네요.',
    date: '2024-01-09',
    helpful: 10,
    notHelpful: 2
  }
];
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
<<<<<<< HEAD
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
=======
    const { isHelpful } = body;
    
    const reviewIndex = reviews.findIndex(review => review.id === reviewId);
    
    if (reviewIndex === -1) {
      return NextResponse.json(
        { error: 'Review not found' },
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
        { status: 404 }
      );
    }
    
<<<<<<< HEAD
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
    
    return NextResponse.json({ review: updatedReview });
  } catch (error) {
    console.error('리뷰 평가 오류:', error);
    return NextResponse.json(
      { error: '리뷰 평가에 실패했습니다.' },
=======
    if (isHelpful) {
      reviews[reviewIndex].helpful += 1;
    } else {
      reviews[reviewIndex].notHelpful += 1;
    }
    
    return NextResponse.json({ review: reviews[reviewIndex] });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update review' },
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      { status: 500 }
    );
  }
} 