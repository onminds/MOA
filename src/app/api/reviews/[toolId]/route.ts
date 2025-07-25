import { NextRequest, NextResponse } from 'next/server';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const { toolId } = await params;
    const toolIdNum = parseInt(toolId);
    const toolReviews = reviews.filter(review => review.toolId === toolIdNum);
    
    return NextResponse.json({ reviews: toolReviews });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
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
      { status: 500 }
    );
  }
} 