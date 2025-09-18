"use client";
import React from 'react';

type LogoProps = {
  url?: string;
  domain?: string;
  icon?: string; // 노션 등에서 받은 확정 아이콘 URL
  alt: string;
  size?: number; // px
  className?: string;
};

function extractDomain(input?: string): string | null {
  if (!input) return null;
  
  // URL에서 도메인 추출
  let cleanInput = input.trim();
  
  // https://, http://, // 등 제거
  cleanInput = cleanInput.replace(/^(https?:)?\/\//i, '');
  
  // 남은 슬래시 이후 경로 제거
  cleanInput = cleanInput.split('/')[0];
  
  // 포트 번호 제거
  cleanInput = cleanInput.split(':')[0];
  
  // www. 제거
  cleanInput = cleanInput.replace(/^www\./i, '');
  
  // 빈 문자열이나 잘못된 도메인 체크
  if (!cleanInput || cleanInput.includes(' ')) {
    return null;
  }
  
  return cleanInput;
}

function dicebear(domain: string, size: number): string {
  return `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(domain)}&size=${size}`;
}

function buildSrcSet(src: string, size: number): string | undefined {
  try {
    if (src.includes('api.faviconkit.com')) {
      // .../SIZE 형태이므로 2x로 교체한 URL 생성
      const parts = src.split('/');
      const last = parts.pop() || String(size);
      const base = parts.join('/');
      const oneX = `${base}/${size}`;
      const twoX = `${base}/${size * 2}`;
      return `${oneX} 1x, ${twoX} 2x`;
    }
    if (src.includes('api.dicebear.com')) {
      const url = new URL(src);
      url.searchParams.set('size', String(size));
      const oneX = url.toString();
      url.searchParams.set('size', String(size * 2));
      const twoX = url.toString();
      return `${oneX} 1x, ${twoX} 2x`;
    }
  } catch {
    // ignore
  }
  // 기타 소스는 자체 해상도가 충분하므로 동일 URL 사용
  return undefined;
}

export default function Logo({ url, domain: domainProp, icon, alt, size = 40, className }: LogoProps) {
  const domain = React.useMemo(() => extractDomain(domainProp || url || ''), [domainProp, url]);
  const [finalSrc, setFinalSrc] = React.useState<string | null>(icon || null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (icon) {
      // CORS/핫링크 차단 회피를 위해 서버 프록시를 통해 로드
      const proxied = `/api/proxy-image?url=${encodeURIComponent(icon)}`;
      setFinalSrc(proxied);
    } else {
      setFinalSrc(null); // 아이덴티콘 사용 중지: 노션 아이콘 없으면 표시만 비움
    }
  }, [icon, domain, alt, size]);

  // 실패했거나 아직 로드 중일 때 즉시 아이덴티콘 표시
  if (!finalSrc || failed) {
    return (
      <div
        aria-label={alt}
        style={{ width: size, height: size, borderRadius: 8, background: '#f3f4f6' }}
        className={className}
      />
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      style={{ objectFit: 'contain', borderRadius: 8, background: '#fff' }}
      className={className}
      onError={() => { setFailed(true); }}
    />
  );
}
