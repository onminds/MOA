import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string; reviewId: string }> }
) {
  try {
    const { reviewId } = await params;
    const body = await request.json();
    const { userId, userRole } = body;
    
    console.log('리뷰 삭제 요청:', { reviewId, userId, userRole, userIdType: typeof userId });
    
    if (!userId) {
      return NextResponse.json(
        { error: '사용자 ID가 필요합니다.' },
        { status: 400 }
      );
    }
    
    const pool = await getConnection();
    
    // 리뷰 존재 여부 및 작성자 확인
    const reviewResult = await pool.request()
      .input('reviewId', reviewId)
      .query(`
        SELECT user_id, is_deleted 
        FROM ai_reviews 
        WHERE id = @reviewId
      `);
    
    if (reviewResult.recordset.length === 0) {
      return NextResponse.json(
        { error: '리뷰를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    
    const review = reviewResult.recordset[0];
    
    console.log('리뷰 정보:', { 
      review_user_id: review.user_id, 
      review_user_id_type: typeof review.user_id,
      is_deleted: review.is_deleted 
    });
    
    if (review.is_deleted) {
      return NextResponse.json(
        { error: '이미 삭제된 리뷰입니다.' },
        { status: 400 }
      );
    }
    
    // 권한 확인: 관리자가 아니면 자신의 리뷰만 삭제 가능
    // 사용자 ID를 문자열로 통일하여 비교
    const userIdStr = userId.toString();
    const reviewUserIdStr = review.user_id.toString();
    
    console.log('권한 확인:', {
      userRole,
      review_user_id: review.user_id,
      reviewUserIdStr,
      userIdStr,
      isAdmin: userRole === 'ADMIN',
      isOwner: reviewUserIdStr === userIdStr,
      comparison: reviewUserIdStr === userIdStr
    });
    
    if (userRole !== 'ADMIN' && reviewUserIdStr !== userIdStr) {
      console.log('권한 없음: 자신의 리뷰가 아님');
      return NextResponse.json(
        { error: '자신의 리뷰만 삭제할 수 있습니다.' },
        { status: 403 }
      );
    }
    
    // 리뷰 삭제 (소프트 삭제)
    await pool.request()
      .input('reviewId', reviewId)
      .query(`
        UPDATE ai_reviews 
        SET is_deleted = 1, updated_at = GETDATE()
        WHERE id = @reviewId
      `);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('리뷰 삭제 오류:', error);
    return NextResponse.json(
      { error: '리뷰 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
} 