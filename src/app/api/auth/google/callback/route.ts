import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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

      const { searchParams } = new URL(request.url);
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        return NextResponse.redirect(new URL('/auth/error?error=' + error, request.url));
      }

      if (!code) {
        return NextResponse.redirect(new URL('/auth/error?error=no_code', request.url));
      }

      // 액세스 토큰과 리프레시 토큰 받기
      const { tokens } = await oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        return NextResponse.redirect(new URL('/auth/error?error=no_access_token', request.url));
      }

      // 사용자 정보 가져오기
      oauth2Client.setCredentials(tokens);
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      await oauth2.userinfo.get();

      // 성공 시 리다이렉트 (토큰은 쿠키나 세션에 저장)
      const response = NextResponse.redirect(new URL('/productivity/email-assistant', request.url));
      
      // 토큰을 쿠키에 저장 (보안을 위해 httpOnly 사용)
      response.cookies.set('google_access_token', tokens.access_token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 3600 // 1시간
      });

      if (tokens.refresh_token) {
        response.cookies.set('google_refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV !== 'development',
          sameSite: 'lax',
          maxAge: 30 * 24 * 60 * 60 // 30일
        });
      }

      return response;
    } else {
      // 프로덕션 환경이나 환경 변수가 없을 때는 mock 응답
      const response = NextResponse.redirect(new URL('/productivity/email-assistant', request.url));
      
      // Mock 토큰 설정
      response.cookies.set('google_access_token', 'mock_access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        maxAge: 3600 // 1시간
      });

      return response;
    }

  } catch (error) {
    console.error('Google OAuth 콜백 오류:', error);
    return NextResponse.redirect(new URL('/auth/error?error=callback_failed', request.url));
  }
} 