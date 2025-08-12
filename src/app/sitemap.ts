import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://moa.tools";
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
    "/productivity/blog-writer",
    "/productivity/code-generate",
    "/productivity/code-review",
    "/productivity/cover-letter",
    "/productivity/email-assistant",
    "/productivity/interview-prep",
    "/productivity/lecture-notes",
    "/productivity/presentation-script",
    "/productivity/report-writer",
    "/productivity/slide-generator",
    "/productivity/sns-post",
    "/payments/success",
    "/usage",
    "/admin",
    "/test",
    "/test-pdf",
  ];

  return routes.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
} 