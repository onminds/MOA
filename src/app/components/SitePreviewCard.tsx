"use client";
import React from 'react';
import { cachedFetchJson } from '@/lib/client-utils';
import Logo from '../../components/Logo';
import Image from 'next/image';

type Props = {
  url: string;
  title: string;
  altTitle?: string;
};

export default function SitePreviewCard({ url, title, altTitle }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [meta, setMeta] = React.useState<{ title?: string; description?: string; image?: string | null; url?: string } | null>(null);
  const [showLive, setShowLive] = React.useState(false);
  const [showImage, setShowImage] = React.useState(true);

  const absoluteUrl = React.useMemo(() => {
    try {
      const hasProtocol = /^https?:\/\//i.test(url);
      const u = new URL(hasProtocol ? url : `https://${url}`);
      return u.toString();
    } catch {
      return url;
    }
  }, [url]);

  const previewUrl = React.useMemo(() => {
    try {
      const u = new URL(absoluteUrl);
      return u.origin; // 브랜드 단위 프리뷰는 루트만 사용
    } catch {
      return absoluteUrl;
    }
  }, [absoluteUrl]);

  const hostLabel = React.useMemo(() => {
    try {
      const u = new URL(absoluteUrl);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return altTitle || title;
    }
  }, [absoluteUrl, title, altTitle]);

  React.useEffect(() => {
    let io: IntersectionObserver | null = null;
    const key = `preview:v2:${previewUrl}`;
    const node = document.getElementById(key);
    const run = async () => {
      try {
        // sessionStorage 캐시 우선
        const cached = sessionStorage.getItem(key);
        if (cached) {
          setMeta(JSON.parse(cached));
          setLoading(false);
          return;
        }
        setLoading(true);
        setShowImage(true);
        const data = await cachedFetchJson(`/api/link-preview?url=${encodeURIComponent(previewUrl)}`, key, undefined, 60 * 60 * 1000);
        setMeta(data);
        sessionStorage.setItem(key, JSON.stringify(data));
      } catch {
        setMeta(null);
      } finally {
        setLoading(false);
      }
    };
    if (node && 'IntersectionObserver' in window) {
      io = new IntersectionObserver((entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          run();
          io && io.disconnect();
        }
      }, { rootMargin: '200px' });
      io.observe(node);
    } else {
      run();
    }
    return () => { io && io.disconnect(); };
  }, [absoluteUrl]);

  return (
    <a id={`preview:v2:${previewUrl}`} href={absoluteUrl} target="_blank" rel="noopener noreferrer nofollow" className="block group" aria-label={`${hostLabel} 사이트 열기(새 창)`}>
      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
        <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
          {loading ? (
            <div className="w-full h-full animate-pulse">
              <div className="w-full h-full bg-gray-200" />
            </div>
          ) : (meta?.image && showImage) ? (
            <Image
              src={`/api/proxy-image?url=${encodeURIComponent(meta.image)}`}
              alt={meta?.title || altTitle || title}
              className="absolute inset-0 object-cover"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={() => setShowImage(false)}
            />
          ) : null}
          <div className="flex items-center justify-center w-full h-full">
            <Logo url={url} alt={meta?.title || altTitle || title} size={72} />
          </div>
          <div className="absolute bottom-2 right-2">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); setShowLive(true); }}
              className="px-2 py-1 text-xs bg-black/60 text-white rounded hover:bg-black/75"
              aria-label="라이브 미리보기 열기"
            >
              라이브 미리보기
            </button>
          </div>
        </div>
        <div className="p-4 flex items-center gap-3">
          <Logo url={url} alt={altTitle || title} size={24} />
          <div className="text-gray-900 font-medium truncate" title={meta?.title || hostLabel}>{hostLabel}</div>
        </div>
      </div>
      {showLive && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center" onClick={() => setShowLive(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-medium truncate">{meta?.title || title}</div>
              <button onClick={() => setShowLive(false)} className="text-gray-500 hover:text-gray-700" aria-label="라이브 미리보기 닫기">닫기</button>
            </div>
            <iframe
              src={absoluteUrl}
              title={meta?.title || title}
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        </div>
      )}
    </a>
  );
}

// 외부 미리보기 이미지는 제거하고 Logo만 사용
