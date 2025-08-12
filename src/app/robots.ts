import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = "https://moa.tools";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
} 