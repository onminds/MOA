import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 개발 환경에서만 Google OAuth 사용
    if (process.env.NODE_ENV === 'development' && 
        process.env.GOOGLE_CLIENT_ID && 
        process.env.GOOGLE_CLIENT_SECRET) {
      
      const { google } = await import('googleapis');
      
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      // Gmail과 Calendar API 스코프
      const SCOPES = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ];

      // Google OAuth URL 생성
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });

      return NextResponse.json({ authUrl });
    } else {
      // 프로덕션 환경이나 환경 변수가 없을 때는 mock 응답
      return NextResponse.json({ 
        authUrl: 'https://mock-google-oauth-url.com',
        message: 'Mock OAuth URL (실제 인증을 위해서는 환경 변수를 설정해주세요)'
      });
    }
  } catch (error) {
    console.error('Google OAuth URL 생성 오류:', error);
    return NextResponse.json(
      { error: '인증 URL 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
} 