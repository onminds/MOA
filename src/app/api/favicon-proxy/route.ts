import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const path = searchParams.get('path') || '/favicon.ico';

    if (!domain) {
      return NextResponse.json({ error: 'Domain parameter is required' }, { status: 400 });
    }

    // 도메인 유효성 검사
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
      return NextResponse.json({ error: 'Invalid domain format' }, { status: 400 });
    }

    // favicon URL 구성
    const faviconUrl = `https://${domain}${path}`;

    // favicon 가져오기
    const response = await fetch(faviconUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      // 404는 정상적인 상황이므로 에러로 처리하지 않음
      if (response.status === 404) {
        return NextResponse.json({ 
          error: 'Favicon not found',
          status: 404 
        }, { status: 404 });
      }
      throw new Error(`Failed to fetch favicon: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || 'image/x-icon';
    const buffer = await response.arrayBuffer();

    // CORS 헤더 설정
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Cache-Control', 'public, max-age=86400'); // 24시간 캐시

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Favicon proxy error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch favicon',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
