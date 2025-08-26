import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

function isValidHttpUrl(maybeUrl: string): boolean {
  try {
    const u = new URL(maybeUrl);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function isImageUrlReachable(url: string): Promise<{ ok: boolean; contentType?: string; size?: number; } > {
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return { ok: false };
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return { ok: false };
    const buf = await res.arrayBuffer();
    const size = buf.byteLength;
    if (size < 500) return { ok: false };
    return { ok: true, contentType: ct, size };
  } catch {
    return { ok: false };
  }
}

function isAllowedIconSource(iconUrl: string, domain?: string): boolean {
  try {
    const u = new URL(iconUrl);
    const host = u.hostname;
    const allowedHosts = new Set([
      'www.google.com',
      'icons.duckduckgo.com',
      'api.faviconkit.com',
      'logo.clearbit.com',
    ]);
    // 원본 서비스 도메인 직접 경로 허용
    if (domain && (host === domain || host === `www.${domain}`)) return true;
    if (allowedHosts.has(host)) return true;
    return false;
  } catch {
    return false;
  }
}

// 간단 In-memory 레이트리밋 (프로세스 재시작 시 초기화)
const rateMap = new Map<string, number>();
function rateLimitKey(pageId: string): string { return `icon:${pageId}`; }
function checkAndTouchRate(pageId: string, windowMs = 60 * 60 * 1000): boolean {
  const key = rateLimitKey(pageId);
  const now = Date.now();
  const last = rateMap.get(key) || 0;
  if (now - last < windowMs) return false;
  rateMap.set(key, now);
  return true;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!process.env.NOTION_API_KEY || !process.env.NOTION_DATABASE_ID) {
      return NextResponse.json({ error: 'Notion not configured' }, { status: 500 });
    }

    const { id: pageId } = await params;
    const body = await request.json().catch(() => ({}));
    const iconUrl: string | undefined = body?.iconUrl;
    const domain: string | undefined = body?.domain;

    if (!iconUrl || !isValidHttpUrl(iconUrl)) {
      return NextResponse.json({ error: 'iconUrl required' }, { status: 400 });
    }

    // 레이트리밋: 동일 페이지는 일정 시간 내 1회만 허용
    if (!checkAndTouchRate(pageId)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    // 간단 레이트리밋(베이직): Cloud/Edge에서 헤더 기반으로 보완 가능. 여기서는 생략.

    // 이미지 검증: 이미지 MIME, 최소 크기 등
    const check = await isImageUrlReachable(iconUrl);
    if (!check.ok) {
      return NextResponse.json({ error: 'iconUrl is not a valid image or not reachable' }, { status: 400 });
    }

    // 허용 출처 검증
    if (!isAllowedIconSource(iconUrl, domain)) {
      return NextResponse.json({ error: 'icon source not allowed' }, { status: 400 });
    }

    // 노션 업데이트: files 속성('아이콘')이 있으면 교체, 없으면 '아이콘 URL' 텍스트/url 속성에 기록
    // 우선 스키마를 모르는 상황에서도 안전하게 pages.update 시도
    const updatePayload: any = {
      page_id: pageId,
      properties: {}
    };

    // files 타입(권장) 우선
    updatePayload.properties['아이콘'] = {
      files: [
        {
          name: 'icon',
          external: { url: iconUrl }
        }
      ]
    };

    let filesOk = false;
    try {
      await notion.pages.update(updatePayload);
      filesOk = true;
    } catch {}

    // URL 속성도 함께 갱신 시도(정합성 유지)
    const urlUpdate: any = { page_id: pageId, properties: {} };
    urlUpdate.properties['아이콘 URL'] = { url: iconUrl };
    try { await notion.pages.update(urlUpdate); } catch {}

    return NextResponse.json({ ok: true, storedIn: filesOk ? 'files+url' : 'url' });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}


