import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
    }

    console.log('프록시 이미지 요청:', imageUrl);

    // OpenAI 이미지 URL에서 이미지 가져오기
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      console.error('이미지 가져오기 실패:', response.status, response.statusText);
      return NextResponse.json({ error: '이미지를 가져올 수 없습니다.' }, { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    
    // Content-Type 헤더 결정
    let contentType = 'image/png';
    if (imageUrl.includes('.jpg') || imageUrl.includes('.jpeg')) {
      contentType = 'image/jpeg';
    } else if (imageUrl.includes('.webp')) {
      contentType = 'image/webp';
    }
    
    // 이미지를 클라이언트로 전송
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐시
      },
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    return NextResponse.json({ error: '이미지 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 