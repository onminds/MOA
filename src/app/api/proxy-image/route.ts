import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_BYTES = 512 * 1024; // 512KB
const TIMEOUT_MS = 8000; // 8s 조금 여유

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
  // url 우선, 없으면 src도 허용
  let imageUrl = searchParams.get('url') || searchParams.get('src');

  if (!imageUrl) {
    return NextResponse.json({ error: '이미지 URL이 필요합니다.' }, { status: 400 });
  }

  try {
    // 이중 래핑 해제: 
    // /api/proxy-image?url=/api/proxy-image?src=ENCODED → 내부 src 추출
    try {
      const maybeNested = decodeURIComponent(imageUrl);
      if (maybeNested.startsWith('/api/proxy-image')) {
        const nested = new URL(`http://local${maybeNested}`); // dummy origin for relative
        const inner = nested.searchParams.get('url') || nested.searchParams.get('src');
        if (inner) imageUrl = inner;
      }
    } catch {}

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

    // 3차: 실패(예: 404/403 등) 시 도메인 기반 폴백 체인
    if (!response.ok) {
      const status = response.status;
      const host = u.hostname;
      const tryFetch = async (candidate: string) => {
        try {
          const r = await fetch(candidate, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' }, redirect: 'follow', signal: controller.signal });
          return r.ok ? r : null;
        } catch { return null; }
      };

      // 다중 폴백 순서: favicon.svg → favicon.ico → favicon.png → Google S2 → Clearbit
      let alt = await tryFetch(`${u.protocol}//${host}/favicon.svg`);
      if (!alt) alt = await tryFetch(`${u.protocol}//${host}/favicon.ico`);
      if (!alt) alt = await tryFetch(`${u.protocol}//${host}/favicon.png`);
      if (!alt) alt = await tryFetch(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
      if (!alt) alt = await tryFetch(`https://logo.clearbit.com/${host}`);

      if (alt) response = alt; else {
        if (status === 401 || status === 403) {
          clearTimeout(timer);
          return new NextResponse(null, { status: 302, headers: { Location: imageUrl } });
        }
        throw new Error(`이미지 가져오기 실패: ${status}`);
      }
    }

    let contentTypeHeader = response.headers.get('content-type') || '';
    let contentType = contentTypeHeader.toLowerCase();
    if (!contentType.startsWith('image/')) {
      // 콘텐츠 타입이 잘못 온 경우에도 바이트 스니핑으로 보정 시도
      const clone = response.clone();
      const buf = await clone.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e;
      const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
      const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
      if (isPng) contentType = 'image/png';
      else if (isJpg) contentType = 'image/jpeg';
      else if (isGif) contentType = 'image/gif';
      else if (isWebp) contentType = 'image/webp';
      else {
        clearTimeout(timer);
        return NextResponse.json({ error: '이미지 타입이 아닙니다.' }, { status: 400 });
      }
      // 스니핑 성공 시 아래에서 buf 사용해 반환
      const length = buf.byteLength;
      if (length > MAX_BYTES) {
        return NextResponse.json({ error: '이미지 용량 초과' }, { status: 413 });
      }
      return new NextResponse(buf, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600',
          'Content-Disposition': 'inline',
          'Vary': 'Accept',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
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