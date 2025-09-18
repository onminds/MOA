import { NextRequest, NextResponse } from 'next/server';

type AnalyticsEvent = {
  type: 'tool_impression' | 'tool_click' | 'tool_open';
  toolId?: string;
  toolName?: string;
  traceId?: string;
  meta?: Record<string, any>;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const events: AnalyticsEvent[] = Array.isArray(body) ? body : [body];
    const now = Date.now();

    // Fail-open: 서버 로깅 또는 외부 MCP 분석 툴로 전송하는 훅 자리
    for (const ev of events) {
      // 최소 유효성 체크
      if (!ev?.type) continue;
      // TODO: 여기서 MCP Analytics 호출 연결 가능
      console.log('[analytics]', now, ev.type, ev.toolId, ev.toolName, ev.traceId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}


