import type { NextRequest } from 'next/server';

type Bucket = { ts: number[] };
const store: Map<string, Bucket> = new Map();

export function getClientId(req: NextRequest): string {
  const xf = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim();
  const xr = (req.headers.get('x-real-ip') || '').trim();
  const ua = (req.headers.get('user-agent') || '').slice(0, 40);
  return xf || xr || `ua:${ua}` || 'unknown';
}

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let b = store.get(key);
  if (!b) { b = { ts: [] }; store.set(key, b); }
  // drop old
  b.ts = b.ts.filter((t) => now - t < windowMs);
  if (b.ts.length >= limit) return false;
  b.ts.push(now);
  return true;
}

export function withRateLimit(req: NextRequest, scope: string, limit: number, windowMs: number): { ok: boolean; key: string } {
  const id = getClientId(req);
  const key = `${scope}:${id}`;
  const ok = rateLimit(key, limit, windowMs);
  return { ok, key };
}


