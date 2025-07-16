import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    
    // 쿠키 삭제
    response.cookies.delete('google_access_token');
    response.cookies.delete('google_refresh_token');
    
    return response;
  } catch (error) {
    console.error('로그아웃 오류:', error);
    return NextResponse.json(
      { error: '로그아웃에 실패했습니다.' },
      { status: 500 }
    );
  }
} 