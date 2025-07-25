import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get('google_access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ 
        isAuthenticated: false,
        user: null 
      });
    }

    // 개발 환경에서만 실제 Google API 사용
    if (process.env.NODE_ENV === 'development' && accessToken !== 'mock_access_token') {
      const { google } = await import('googleapis');
      
      // 토큰 유효성 검사 및 사용자 정보 가져오기
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: accessToken });
      
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return NextResponse.json({
        isAuthenticated: true,
        user: {
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture
        }
      });
    } else {
      // 프로덕션 환경이나 mock 토큰일 때는 mock 응답
      return NextResponse.json({
        isAuthenticated: true,
        user: {
          email: 'mock@example.com',
          name: 'Mock User',
          picture: 'https://via.placeholder.com/150'
        }
      });
    }
  } catch (error) {
    console.error('인증 상태 확인 오류:', error);
    return NextResponse.json({ 
      isAuthenticated: false,
      user: null 
    });
  }
} 