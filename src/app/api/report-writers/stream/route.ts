import { NextResponse } from "next/server";
import { classifyTopic, makeTitle, makeTLDR, writeSectionHTML } from "@/lib/report-writers/pipeline";
import { buildOutline } from "@/lib/report-writers/templates";
import { TocItem, ReportSection } from "@/lib/report-writers/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { topic, pageCount = 3, seedUrls = [], domain, denyList, compareColumns } = await req.json();
  
  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: "주제가 필요합니다" }), { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const topicType = classifyTopic(topic, domain);
        const toc = buildOutline(topicType, topic);
        
        // 메타데이터 전송
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "meta", data: { toc, sources: [] } })}\n\n`));
        
        // 섹션별 생성 및 수집
        const sections: ReportSection[] = [];
        for (const item of toc) {
          const sec = await writeSectionHTML({
            topic,
            sectionId: item.id,
            sectionTitle: item.title,
            sources: [], // 빈 배열로 고정
            domain,
            denyList,
            compareSpec: compareColumns ? { columns: compareColumns } : undefined,
            topicType, // ✅ topicType 추가
          });
          
          // 섹션 데이터 수집
          sections.push({ id: item.id, title: item.title, html: sec.html, citations: sec.citations });
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "section", data: sec })}\n\n`));
        }
        
        // 완료 신호 - 실제 생성된 섹션 데이터 사용
        const title = await makeTitle(topic, []);
        const summary = await makeTLDR(sections);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", data: { title, summary, model: "gpt-5-mini" } })}\n\n`));
        controller.close();
      } catch (error: any) {
        console.error("스트리밍 에러:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
