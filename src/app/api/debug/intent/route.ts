import { NextRequest, NextResponse } from 'next/server';
import { analyzeUserIntent, detectToolSearchIntent, computeAmbiguity } from '@/lib/intent-analyzer';
import { buildChipsForKey } from '@/lib/chips';

export async function POST(req: NextRequest) {
  try {
    const { message } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    const toolSearch = detectToolSearchIntent(message);
    const intent = analyzeUserIntent(message);
    const ambiguity = computeAmbiguity(message);
    const chips = buildChipsForKey('tool_search', { intent });
    return NextResponse.json({ toolSearch, intent, ambiguity, chips });
  } catch (e) {
    return NextResponse.json({ error: 'failed', details: String(e) }, { status: 500 });
  }
}



