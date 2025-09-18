import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit';
import { isSameHostOrAllowed, safeString } from '@/lib/validation';
import { searchAITools, type AITool } from '@/lib/notion-client';
import { systemDetailPrompt } from '@/lib/prompt-templates';
import { generateDetailedToolPrompt } from '@/lib/intent-analyzer';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const rl = withRateLimit(req, 'tool_detail', 60, 60_000);
    if (!rl.ok) return NextResponse.json({ code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60' } });
    if (!isSameHostOrAllowed(req)) {
      return NextResponse.json({ code: 'FORBIDDEN' }, { status: 403 });
    }
    const { slug: rawSlug } = await params;
    const slug = safeString(decodeURIComponent(rawSlug || ''), 120).toLowerCase().trim();
    if (!slug) return NextResponse.json({ code: 'BAD_REQUEST' }, { status: 400 });
    let pool = await searchAITools({});
    const pick = pool.find(t => String(t.id || '').toLowerCase() === slug
      || String(t.domain || '').toLowerCase().includes(slug)
      || String(t.name || '').toLowerCase().replace(/\s+/g,'').includes(slug.replace(/\s+/g,''))
    ) as AITool | undefined;
    if (!pick) return NextResponse.json({ code: 'NOT_FOUND' }, { status: 404 });

    const sys = systemDetailPrompt();
    const user = generateDetailedToolPrompt(pick);
    const completion = await openai.chat.completions.create({
      model: 'gpt-5' as any,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user }
      ],
      max_completion_tokens: 700
    });
    const text = completion.choices[0].message.content || '';
    return NextResponse.json({ tool: pick, detail: text }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch (err) {
    console.error('[tools/detail] error', err);
    return NextResponse.json({ code: 'INTERNAL_ERROR' }, { status: 500, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}




