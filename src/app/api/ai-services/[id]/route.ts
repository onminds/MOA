import { NextRequest, NextResponse } from 'next/server';
import { findServiceByIdOrDomain, getAllServicesCached } from '@/lib/ai-services';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // rate limit (detail API)
    const rl = checkRateLimit(request);
    if (rl.limited) {
      const res = new NextResponse('Too Many Requests', { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfterSec));
      return res;
    }

    const { services, etag, fromCache } = await getAllServicesCached(false);
    const { id } = await params;

    // If-None-Match handling
    const inm = request.headers.get('if-none-match');
    if (inm && inm === etag) {
      const notModified = new NextResponse(null, { status: 304 });
      notModified.headers.set('ETag', etag);
      notModified.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
      return notModified;
    }

    // id validation (domain or internal id)
    const IdSchema = z.string().min(1).max(128).regex(/^[a-z0-9._-]+$/i);
    const parsed = IdSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const found = findServiceByIdOrDomain(services as any[], id);
    if (!found) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const res = NextResponse.json({ service: found });
    res.headers.set('ETag', etag);
    res.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=300');
    res.headers.set('Vary', 'Accept-Encoding');
    res.headers.set('X-Result-Source', fromCache ? 'cache' : 'live');
    return res;
  } catch (error) {
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 });
  }
}

// simple in-memory rate limiter for detail API
const RL_CAP = 30;
const RL_MS = 60 * 1000;
const rlStore: Map<string, { tokens: number; ts: number }> = new Map();
function checkRateLimit(request: NextRequest): { limited: boolean; retryAfterSec: number } {
  const xf = request.headers.get('x-forwarded-for');
  const ip = xf ? xf.split(',')[0].trim() : 'unknown';
  const now = Date.now();
  const e = rlStore.get(ip) || { tokens: RL_CAP, ts: now };
  if (now - e.ts >= RL_MS) { e.tokens = RL_CAP; e.ts = now; }
  if (e.tokens <= 0) {
    rlStore.set(ip, e);
    const retry = Math.ceil((e.ts + RL_MS - now) / 1000);
    return { limited: true, retryAfterSec: Math.max(1, retry) };
  }
  e.tokens -= 1;
  rlStore.set(ip, e);
  return { limited: false, retryAfterSec: 0 };
}


