export function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    // 프로덕션/프리뷰 도메인 허용 목록 (필요 시 보완)
    const allow = ['moaplus.ai', 'www.moaplus.ai'];
    if (allow.some((d) => host === d || host.endsWith(`.${d}`))) return true;
    // Vercel 프리뷰/프로덕션 도메인 허용
    if (host.endsWith('.vercel.app') || host.endsWith('.vercel.dev')) return true;
    return false;
  } catch { return false; }
}

// 동일 호스트 요청 또는 허용 오리진인지 확인
import type { NextRequest } from 'next/server';
export function isSameHostOrAllowed(req: NextRequest): boolean {
  try {
    const host = (req.nextUrl?.hostname || '').toLowerCase();
    // 동일 호스트 요청은 모두 허용
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const getHost = (v: string | null) => { try { return v ? new URL(v).hostname.toLowerCase() : ''; } catch { return ''; } };
    const originHost = getHost(origin);
    const refererHost = getHost(referer);
    if (originHost === host || refererHost === host) return true;
    // localhost 및 허용 오리진 체크
    if (host === 'localhost' || host.endsWith('.localhost')) return true;
    return isAllowedOrigin(origin) || isAllowedOrigin(referer);
  } catch {
    return false;
  }
}

export function parseBoolean(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['1','true','yes','y','on'].includes(v.toLowerCase());
  return fallback;
}

export function parseNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function safeString(v: unknown, maxLen = 200): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}


