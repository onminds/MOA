import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://moa.tools";
  const now = new Date().toISOString();

  const routes = [
    "", // 홈
    "/ai-list",
    "/ai-chat", 
    "/image-create",
    "/video-create",
    "/ppt-create",
    "/code-generate",
    "/code-review",
    "/contact",
    "/community",
    "/plan",
    "/settings",
    "/productivity",
    "/productivity/ai-summary",
    "/productivity/code-generate",
    "/productivity/code-review",
    "/productivity/cover-letter",
    "/productivity/interview-prep",
    "/productivity/lecture-notes",
    "/productivity/presentation-script",
    "/productivity/report-writers",
    "/payments/success",
    "/usage",
    "/admin",
    "/test",
    "/test-pdf",
  ];

  const staticEntries: MetadataRoute.Sitemap = routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: path === "" ? 1 : 0.7,
  }));

  // 동적: AI 서비스 상세 페이지 포함
  const dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const res = await fetch(`${base}/api/ai-services?thin=1&limit=1000`, { next: { revalidate: 3600 } });
    const data = await res.json();
    const services: Array<{ id: string; url: string; name: string; }>= data.services || [];
    services.forEach((svc) => {
      const toDomain = (u: string) => {
        try { const urlObj = new URL(u.startsWith('http')?u:`https://${u}`); return urlObj.hostname.replace(/^www\./,''); } catch { return svc.id; }
      };
      const pathId = svc.url ? toDomain(svc.url) : svc.id;
      dynamicEntries.push({
        url: `${base}/ai-tool/${pathId}`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      });
    });
  } catch {}

  return [...staticEntries, ...dynamicEntries];
}