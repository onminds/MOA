import { NextRequest, NextResponse } from 'next/server';
import dns from 'dns/promises';
import net from 'net';
export const runtime = 'nodejs';

const MAX_BYTES = 512 * 1024; // 512KB
const TIMEOUT_MS = 5000; // 5s

function isPrivateIp(ip: string): boolean {
  try {
    if (!ip) return true;
    if (ip === '0.0.0.0') return true;
    if (ip === '127.0.0.1') return true;
    if (ip === '::1') return true;
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(n => parseInt(n, 10));
      const [a, b] = parts;
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      return false;
    }
    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower.startsWith('fe80') || lower.startsWith('fd') || lower.startsWith('fc')) return true;
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
  }

  try {
    const u = new URL(imageUrl);
    if (!/^https?:$/i.test(u.protocol)) {
      return NextResponse.json({ error: '지원되지 않는 프로토콜' }, { status: 400 });
    }
    const hostname = u.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1'].includes(hostname)) {
      return NextResponse.json({ error: '금지된 호스트' }, { status: 403 });
    }
    try {
      const lookups = await dns.lookup(hostname, { all: true, verbatim: true });
      if (lookups.some(a => isPrivateIp(a.address))) {
        return NextResponse.json({ error: '사설 네트워크 접근 금지' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: '호스트 확인 실패' }, { status: 400 });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    // 1차 시도: 일반 브라우저 헤더 + 원본 호스트 Referer
    let response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': `${u.protocol}//${u.host}/`
      },
      redirect: 'follow',
      signal: controller.signal
    });

    // 2차 시도: Referer 제거
    if (!response.ok) {
      response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'
        },
        redirect: 'follow',
        signal: controller.signal
      });
    }

    // 3차: 여전히 401/403이면 원본 이미지로 리다이렉트 시켜 브라우저가 직접 가져오게 함
    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        clearTimeout(timer);
        return new NextResponse(null, { status: 302, headers: { Location: imageUrl } });
      }
      throw new Error(`이미지 가져오기 실패: ${status}`);
    }

    const contentTypeHeader = response.headers.get('content-type') || '';
    const contentType = contentTypeHeader.toLowerCase();
    if (!contentType.startsWith('image/')) {
      clearTimeout(timer);
      return NextResponse.json({ error: '이미지 타입이 아닙니다.' }, { status: 400 });
    }
    const lenHeader = response.headers.get('content-length');
    if (lenHeader) {
      const length = parseInt(lenHeader, 10);
      if (Number.isFinite(length) && length > MAX_BYTES) {
        clearTimeout(timer);
        return NextResponse.json({ error: '이미지 용량 초과' }, { status: 413 });
      }
    }
    const imageBuffer = await response.arrayBuffer();
    clearTimeout(timer);
    if (imageBuffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: '이미지 용량 초과' }, { status: 413 });
    }

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': 'inline',
        'Vary': 'Accept',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('이미지 프록시 오류:', error);
    // 최종 폴백: 원본으로 리다이렉트(브라우저가 직접 접근 시 성공할 수 있음)
    if (imageUrl) {
      return new NextResponse(null, { status: 302, headers: { Location: imageUrl } });
    }
    return NextResponse.json({ error: '이미지를 가져올 수 없습니다.' }, { status: 500 });
  }
} 