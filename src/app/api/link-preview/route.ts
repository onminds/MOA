import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Simple process-local cache (LRU-ish with TTL)
type PreviewData = { title: string; description: string; image: string | null; url: string };
type CacheEntry = { etag: string; expiresAt: number; data: PreviewData };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

function putCache(key: string, entry: CacheEntry) {
  cache.set(key, entry);
  // naive cap
  if (cache.size > 1000) {
    const firstKey = cache.keys().next().value as string | undefined;
    if (firstKey) cache.delete(firstKey);
  }
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  const m = h.match(/^172\.(\d+)\./);
  if (m) {
    const n = Number(m[1]);
    if (n >= 16 && n <= 31) return true;
  }
  return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // URL 디코딩
    const decodedUrl = decodeURIComponent(url);
    
    // URL 유효성 검사
    let validUrl: string;
    try {
      validUrl = new URL(decodedUrl).toString();
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const u = new URL(validUrl);
    const preferScreenshot = (searchParams.get('screenshot') === '1');
    const shotWidthParam = Number(searchParams.get('w') || '0');
    const shotWidth = Number.isFinite(shotWidthParam) && shotWidthParam > 0 ? Math.min(Math.max(shotWidthParam, 400), 2000) : 1200;
    // SSRF guard - block private/localhost
    if (isPrivateHost(u.hostname)) {
      return NextResponse.json({ title: u.hostname.replace(/^www\./,''), description: '', image: null, url: validUrl }, { status: 200 });
    }

    // ETag/Cache keys (host-level)
    const dayKey = new Date().toISOString().slice(0,10);
    const baseKey = `${u.hostname}|${dayKey}|ss:${preferScreenshot ? '1' : '0'}`;
    const etag = 'W/"' + Buffer.from(baseKey).toString('base64').slice(0, 16) + '"';
    const inm = request.headers.get('if-none-match');
    const now = Date.now();
    const cached = cache.get(baseKey);
    if (cached && cached.expiresAt > now) {
      if (inm && inm === cached.etag) {
        return new NextResponse(null, { status: 304, headers: { 'ETag': cached.etag, 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400', 'X-Preview-Stage': 'cache-304' } });
      }
      const resCached = NextResponse.json(cached.data);
      resCached.headers.set('ETag', cached.etag);
      resCached.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');
      resCached.headers.set('X-Preview-Stage', 'cache-hit');
      return resCached;
    }

    // 초경량 파서: 문서 앞부분(최대 100KB)만 읽어 OG 메타 추출
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    let parsed = { title: '', description: '', image: null as string | null };
    try {
      // Optional HEAD to resolve redirects fast
      try {
        const head = await fetch(validUrl, {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36' }
        });
        if (head.url && head.url !== validUrl) {
          // update final URL if redirected
          validUrl = head.url;
        }
      } catch {}

      const res = await fetch(validUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
          'Accept-Language': 'ko,en;q=0.8'
        },
        redirect: 'follow',
        signal: controller.signal
      });
      // content-type 체크(HTML만 파싱)
      const ct = res.headers.get('content-type') || '';
      if (!/text\/html|application\/xhtml\+xml/i.test(ct)) {
        throw new Error('Not HTML');
      }
      const reader = res.body?.getReader();
      let html: string = '';
      if (reader) {
        const decoder = new TextDecoder('utf-8');
        let received = 0;
        const MAX = 100 * 1024;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
          html += decoder.decode(value, { stream: true });
          if (received >= MAX) break;
        }
        // 간단 메타 파싱
        const pick = (re: RegExp) => { const m = html.match(re); return m && m[1] ? m[1].trim() : ''; };
        const ogTitle = pick(/<meta[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const twTitle = pick(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const titleTag = pick(/<title[^>]*>([^<]+)<\/title>/i);
        const ogDesc = pick(/<meta[^>]*(?:property|name)=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const twDesc = pick(/<meta[^>]*name=["']twitter:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const metaDesc = pick(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const ogImg = pick(/<meta[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["'][^>]*>/i);
        const twImg = pick(/<meta[^>]*name=["']twitter:image[^>]*content=["']([^"']+)["'][^>]*>/i);
        const linkIcon = pick(/<link[^>]*rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*href=["']([^"']+)["'][^>]*>/i);
        parsed.title = ogTitle || twTitle || titleTag || '';
        parsed.description = ogDesc || twDesc || metaDesc || '';
        let img = (ogImg || twImg || linkIcon || '') || '';
        if (img) {
          try {
            if (img.startsWith('//')) {
              const u = new URL(validUrl);
              img = `${u.protocol}${img}`;
            } else if (!/^https?:\/\//i.test(img)) {
              img = new URL(img, res.url || validUrl).toString();
            }
          } catch {}
        }
        parsed.image = img || null;
      }
      // Try manifest.json icons if still empty
      if (!parsed.image && typeof html === 'string') {
        try {
          const manifestHrefMatch = /(rel=["']manifest["'][^>]*href=["']([^"']+)["'])|(<link[^>]*href=["']([^"']+)["'][^>]*rel=["']manifest["'])/i.exec(html);
          const href = manifestHrefMatch && (manifestHrefMatch[2] || manifestHrefMatch[4]);
          if (href) {
            let murl = href;
            if (murl.startsWith('//')) { murl = `${u.protocol}${murl}`; }
            if (!/^https?:\/\//i.test(murl)) murl = new URL(murl, res.url || validUrl).toString();
            const mController = new AbortController();
            const mTimer = setTimeout(() => mController.abort(), 1000);
            const mRes = await fetch(murl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: mController.signal });
            clearTimeout(mTimer);
            if (mRes.ok) {
              const mj = await mRes.json().catch(() => null);
              const icons: any[] = (mj && Array.isArray(mj.icons)) ? mj.icons : [];
              let best: { src: string; size: number } | null = null;
              for (const ic of icons) {
                const sizes = String(ic.sizes || '').split(/\s+/).map((s: string) => Number(s.split('x')[0]) || 0);
                const max = Math.max(...sizes, Number(ic.size || 0) || 0);
                if (!best || max > best.size) {
                  best = { src: ic.src, size: max };
                }
              }
              if (best && best.src) {
                let src = best.src as string;
                if (src.startsWith('//')) src = `${u.protocol}${src}`;
                if (!/^https?:\/\//i.test(src)) src = new URL(src, res.url || validUrl).toString();
                parsed.image = src;
              }
            }
          }
        } catch {}
      }
      // Try manifest.json icons if still empty (duplicate guard retained for robustness)
      if (!parsed.image && typeof html === 'string') {
        try {
          const manifestHrefMatch = /(rel=["']manifest["'][^>]*href=["']([^"']+)["'])|(<link[^>]*href=["']([^"']+)["'][^>]*rel=["']manifest["'])/i.exec(html);
          const href = manifestHrefMatch && (manifestHrefMatch[2] || manifestHrefMatch[4]);
          if (href) {
            let murl = href;
            if (murl.startsWith('//')) { murl = `${u.protocol}${murl}`; }
            if (!/^https?:\/\//i.test(murl)) murl = new URL(murl, res.url || validUrl).toString();
            const mController = new AbortController();
            const mTimer = setTimeout(() => mController.abort(), 1000);
            const mRes = await fetch(murl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: mController.signal });
            clearTimeout(mTimer);
            if (mRes.ok) {
              const mj = await mRes.json().catch(() => null);
              const icons: any[] = (mj && Array.isArray(mj.icons)) ? mj.icons : [];
              let best: { src: string; size: number } | null = null;
              for (const ic of icons) {
                const sizes = String(ic.sizes || '').split(/\s+/).map((s: string) => Number(s.split('x')[0]) || 0);
                const max = Math.max(...sizes, Number(ic.size || 0) || 0);
                if (!best || max > best.size) {
                  best = { src: ic.src, size: max };
                }
              }
              if (best && best.src) {
                let src = best.src as string;
                if (src.startsWith('//')) src = `${u.protocol}${src}`;
                if (!/^https?:\/\//i.test(src)) src = new URL(src, res.url || validUrl).toString();
                parsed.image = src;
              }
            }
          }
        } catch {}
      }

      // Try common icon paths if still empty
      if (!parsed.image) {
        const base = new URL(res.url || validUrl);
        const candidates = [
          '/apple-touch-icon.png',
          '/apple-touch-icon-precomposed.png',
          '/favicon-196x196.png', '/favicon-192x192.png', '/favicon-180x180.png', '/favicon-152x152.png', '/favicon-128.png',
          '/favicon-96x96.png', '/favicon-64.png', '/favicon-32x32.png', '/favicon.ico'
        ];
        for (const p of candidates) {
          try {
            const iconUrl = new URL(p, base);
            const iController = new AbortController();
            const iTimer = setTimeout(() => iController.abort(), 800);
            const iRes = await fetch(iconUrl.toString(), { method: 'HEAD', signal: iController.signal });
            clearTimeout(iTimer);
            const ct2 = iRes.headers.get('content-type') || '';
            if (iRes.ok && /^image\//i.test(ct2)) {
              parsed.image = iconUrl.toString();
              break;
            }
          } catch {}
        }
      }
    } catch {
      // 무시하고 폴백 사용
    } finally {
      clearTimeout(timer);
    }

    // 폴백 및 정규화
    const hostTitle = new URL(validUrl).hostname.replace(/^www\./, '');
    // If preferScreenshot, force screenshot thumbnail of the homepage
    if (preferScreenshot) {
      const shot = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(u.origin)}?w=${shotWidth}`;
      parsed.image = shot;
    }

    // Last-resort: s2 favicon (256)
    if (!parsed.image) {
      parsed.image = `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=256`;
    }

    const body = {
      title: parsed.title || hostTitle,
      description: parsed.description || '',
      image: parsed.image || null,
      url: validUrl
    };

    const resFinal = NextResponse.json(body);
    // update cache
    putCache(baseKey, { etag, expiresAt: Date.now() + CACHE_TTL_MS, data: body });
    resFinal.headers.set('ETag', etag);
    resFinal.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');
    resFinal.headers.set('X-Preview-Stage', parsed.image ? 'meta' : 'fallback');
    return resFinal;

  } catch (error) {
    console.error('Link preview error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
