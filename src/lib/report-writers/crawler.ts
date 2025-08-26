import { ReportSource } from "./types";

const CRAWLER_ENDPOINT = process.env.CRAWLER_ENDPOINT || "/api/crawl"; // <- wire to your own

export type CrawlResult = {
  marketData?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
  newsData?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
  statisticsData?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
  otherData?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
};

export async function fetchCrawlBundle(topic: string): Promise<CrawlResult | null> {
  try {
    const res = await fetch(CRAWLER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error("crawler error");
    return (await res.json()) as CrawlResult;
  } catch (e) {
    console.warn("[crawler] fallback to seed URLs only:", (e as any)?.message);
    return null;
  }
}

export function adaptCrawlToSources(bundle: CrawlResult | null, seedUrls: string[] = []): ReportSource[] {
  const collected: ReportSource[] = [];
  let id = 1;
  const push = (title: string, url?: string, publisher?: string, date?: string) => {
    if (!title) return;
    collected.push({ id: id++, title, url: url || "#", publisher, date });
  };
  const ingest = (arr?: Array<{ title: string; url?: string; publisher?: string; date?: string }>) => {
    arr?.forEach((x) => push(x.title, x.url, x.publisher, x.date));
  };
  if (bundle) {
    ingest(bundle.marketData);
    ingest(bundle.newsData);
    ingest(bundle.statisticsData);
    ingest(bundle.otherData);
  }
  // seed URLs come last to keep numbering predictable
  for (const u of seedUrls) push(u, u, new URL(u).hostname.replace(/^www\./, ""));
  // de-dupe by (title,url)
  const key = (s: ReportSource) => `${s.title}@@${s.url}`;
  const seen = new Set<string>();
  return collected.filter((s) => (seen.has(key(s)) ? false : (seen.add(key(s)), true)));
}

