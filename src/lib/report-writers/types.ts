export type TopicType =
  | "market_research"
  | "tech_review"
  | "academic_summary"
  | "product_comparison"
  | "news_brief"
  | "howto_guide"
  | "general_review";

export type ReportSource = {
  id: number;
  title: string;
  url: string;
  publisher?: string;
  date?: string;
  favicon?: string;
};

export type TocItem = { id: string; title: string };

export type ReportSection = {
  id: string;
  title?: string;
  html: string; // sanitized HTML fragment
  citations: number[]; // indexes into sources[] (1-based)
};

export type ReportWriter = {
  id: string;
  title: string;
  summary: string; // TL;DR 3~5 lines
  toc: TocItem[];
  sections: ReportSection[];
  sources: ReportSource[];
  meta: {
    createdAt: string;
    updatedAt?: string;
    model: string;
    sourceCount: number;
  };
};

export type BuildReportInput = {
  topic: string;
  seedUrls?: string[];
  domain?: string;
  denyList?: string[];
  compareColumns?: string[];
};
