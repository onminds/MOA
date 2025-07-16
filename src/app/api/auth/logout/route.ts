import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // 쿠키 삭제
  response.cookies.delete('google_access_token');
  response.cookies.delete('google_refresh_token');
  
  return response;
} 