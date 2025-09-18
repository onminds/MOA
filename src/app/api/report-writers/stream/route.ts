import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { checkUsageLimit, incrementUsage } from "@/lib/auth";
import { classifyTopic, makeTitle, makeTLDR, writeSectionHTML } from "@/lib/report-writers/pipeline";
import { buildOutline } from "@/lib/report-writers/templates";
import { TocItem, ReportSection } from "@/lib/report-writers/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // 인증 체크
  const authResult = await requireAuth();
  if ('error' in authResult) {
    return new Response(JSON.stringify({ error: authResult.error }), { status: authResult.status });
  }
  const { user } = authResult;

  const { topic, pageCount = 3, seedUrls = [], domain, denyList, compareColumns, attachmentsText } = await req.json();

  if (!topic?.trim()) {
    return new Response(JSON.stringify({ error: "주제가 필요합니다" }), { status: 400 });
  }

  // 사용량 체크
  const usageCheck = await checkUsageLimit(user.id, 'report-writers');
  if (!usageCheck.allowed) {
    return new Response(JSON.stringify({ 
      error: '레포트 작성 사용량 한도에 도달했습니다.',
      currentUsage: usageCheck.limit - usageCheck.remaining,
      maxLimit: usageCheck.limit,
      resetDate: usageCheck.resetDate
    }), { status: 429 });
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
        let usageSent = false;
        for (let idx = 0; idx < toc.length; idx++) {
          const item = toc[idx];
          const sec = await writeSectionHTML({
            topic,
            sectionId: item.id,
            sectionTitle: item.title,
            sources: [], // 빈 배열로 고정
            domain,
            denyList,
            compareSpec: compareColumns ? { columns: compareColumns } : undefined,
            topicType, // ✅ topicType 추가
            attachmentsText,
          });

          // 섹션 데이터 수집
          sections.push({ id: item.id, title: item.title, html: sec.html, citations: sec.citations });

          // 마지막 섹션 직후 사용량 선증가 및 사용량 이벤트 전송
          if (idx === toc.length - 1) {
            try {
              await incrementUsage(user.id, 'report-writers');
              const updated = await checkUsageLimit(user.id, 'report-writers');
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "usage", data: { current: updated.limit - updated.remaining, limit: updated.limit, remaining: updated.remaining } })}\n\n`));
              usageSent = true;
            } catch (e) {
              console.error('사용량 증가/조회 실패:', e);
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "section", data: sec })}\n\n`));
        }
        
        // 루프가 돌지 않았거나(목차가 비었을 때 등) usage 이벤트가 전송되지 않은 경우 보장 처리
        if (!usageSent) {
          try {
            await incrementUsage(user.id, 'report-writers');
            const updated = await checkUsageLimit(user.id, 'report-writers');
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "usage", data: { current: updated.limit - updated.remaining, limit: updated.limit, remaining: updated.remaining } })}\n\n`));
          } catch (e) {
            console.error('사용량 증가/조회 실패(보장 처리):', e);
          }
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
