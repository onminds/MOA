import { NextRequest, NextResponse } from 'next/server';

// 개발용 Mock 사용자 데이터
const mockUser = {
  email: 'test@example.com',
  name: '테스트 사용자',
  picture: 'https://via.placeholder.com/150'
};

export async function GET(request: NextRequest) {
  try {
    // 개발 환경에서만 Mock 데이터 반환
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json({
        isAuthenticated: true,
        user: mockUser
      });
    } else {
      return NextResponse.json({
        isAuthenticated: false,
        user: null
      });
    }
  } catch (error) {
    console.error('Mock 인증 오류:', error);
    return NextResponse.json({
      isAuthenticated: false,
      user: null
    });
  }
} 