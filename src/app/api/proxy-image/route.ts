import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
    }

    // OpenAI 이미지 URL에서 이미지 가져오기
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      return NextResponse.json({ error: '이미지를 가져올 수 없습니다.' }, { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    
    // 이미지를 클라이언트로 전송
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    return NextResponse.json({ error: '이미지 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 