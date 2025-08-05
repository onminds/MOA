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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params;
    const toolIdNum = parseInt(toolId);
<<<<<<< HEAD
    
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
=======
    const toolReviews = reviews.filter(review => review.toolId === toolIdNum);
    
    return NextResponse.json({ reviews: toolReviews });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
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
    
<<<<<<< HEAD
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
=======
    const newReview = {
      id: Date.now().toString(),
      toolId: toolIdNum,
      userId: body.userId || 'anonymous',
      userName: body.userName || '사용자',
      rating: body.rating,
      comment: body.comment,
      date: new Date().toISOString().split('T')[0],
      helpful: 0,
      notHelpful: 0
    };
    
    reviews.push(newReview);
    
    return NextResponse.json({ review: newReview });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create review' },
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      { status: 500 }
    );
  }
} 