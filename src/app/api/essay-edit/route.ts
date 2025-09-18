import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/rate-limiter';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  try {
    // Rate limit (essay edit는 aiChat과 동일한 강도 적용)
    const rateLimited = createRateLimitMiddleware(rateLimitConfigs.aiChat)(request);
    if (rateLimited) return rateLimited as any;

    const { content, instruction, model = 'gpt-5-mini', reasoningEffort = 'minimal', verbosity = 'low' } = await request.json();

    if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
      return NextResponse.json({ error: 'instruction가 필요합니다.' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content가 필요합니다.' }, { status: 400 });
    }

    // 입력 길이 제한 (Server-side)
    const MAX_CONTENT_LEN = 20000; // 20k chars
    const MAX_INSTRUCTION_LEN = 1000; // 1k chars
    if (content.length > MAX_CONTENT_LEN) {
      return NextResponse.json({ error: `content 길이 초과(${MAX_CONTENT_LEN})` }, { status: 413 });
    }
    if (instruction.length > MAX_INSTRUCTION_LEN) {
      return NextResponse.json({ error: `instruction 길이 초과(${MAX_INSTRUCTION_LEN})` }, { status: 413 });
    }

    // 모델 화이트리스트
    const allowedModels = new Set(['gpt-5', 'gpt-5-mini', 'gpt-5-nano']);
    const resolvedModel = allowedModels.has(model) ? model : 'gpt-5-mini';

    const systemLines = [
      '[시스템]',
      '당신은 한국어 글을 자연스럽고 설득력 있게 다듬는 전문 에디터입니다.',
      '규칙:',
      '- 의미는 유지하고 간결성/가독성/논리 전개를 개선합니다.',
      '- 맞춤법, 문장부호, 어색한 표현을 다듬습니다.',
      "- 출력은 수정된 텍스트만 반환합니다. 설명/리스트/마크다운/따옴표/코드펜스 금지.",
    ];
    const system = systemLines.join('\n');
    const prompt = `${system}\n\n[지시] ${instruction}\n\n[편집 대상]\n${content}`;

    const response = await openai.responses.create({
      model: resolvedModel,
      input: prompt,
    });

    // output_text가 있으면 사용, 없으면 폴백 파싱
    let revised = (response as any).output_text as string | undefined;
    if (!revised) {
      try {
        const outputs: any[] = (response as any).output || [];
        const firstText = outputs
          .flatMap((o: any) => o.content || [])
          .find((c: any) => c.type === 'output_text' || c.type === 'text');
        revised = (firstText?.text || '').trim();
      } catch {
        revised = '';
      }
    }
    revised = (revised || '').trim();
    return NextResponse.json({ revised });
  } catch (error) {
    console.error('essay-edit error', error);
    return NextResponse.json({ error: '편집 중 오류가 발생했습니다.' }, { status: 500 });
  }
}


