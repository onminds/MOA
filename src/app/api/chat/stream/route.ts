import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { detectToolSearchIntent, analyzeUserIntent, detectWebsiteBuildIntent, detectWebsiteAssistIntent, detectBeginnerFriendlyIntent, detectWorkflowAutomationIntent } from '@/lib/intent-analyzer';
import { searchAITools, type AITool } from '@/lib/notion-client';
import { systemRecommendationPrompt, buildRecommendationUserPrompt, systemGeneralPrompt, systemDbReasoningPrompt, buildDbReasoningUserPrompt } from '@/lib/prompt-templates';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { prompt, model = 'gpt-3.5-turbo', template = false, kbMode } = await req.json();
  // 툴 검색/특정 의도는 스트리밍 대신 비스트리밍 경로로 우회 (프론트에서 재시도)
  if (!template && (detectToolSearchIntent(prompt) || detectWebsiteBuildIntent(prompt) || detectWebsiteAssistIntent(prompt) || detectBeginnerFriendlyIntent(prompt) || detectWorkflowAutomationIntent(prompt))) {
    return new Response('', { status: 409 });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let alreadyClosed = false;
      try {
        const sanitizeDelta = (t: string) => t
          .replace(/```[\s\S]*?```/g, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/_(.*?)_/g, '$1')
          .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');

        let messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
        if (kbMode === 'db' && detectToolSearchIntent(prompt)) {
          const intent = analyzeUserIntent(prompt);
          let tools = await searchAITools({
            category: intent.category || undefined,
            price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
            features: intent.features.length > 0 ? intent.features : undefined,
            searchQuery: intent.category || intent.features.join(' ') || undefined
          });
          const targetCount = Math.min(Math.max(intent.count ?? 5, 1), 10);
          const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
          tools = shuffle(tools);
          // 부족하면 범위를 넓혀 targetCount까지 보강
          if (tools.length < targetCount) {
            const broader = shuffle(await searchAITools({ searchQuery: intent.category || (intent.features.join(' ') || undefined) }));
            const ids = new Set(tools.map(t => t.id));
            for (const t of broader) {
              if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; }
            }
          }
          if (tools.length < targetCount) {
            const all = shuffle(await searchAITools({}));
            const ids = new Set(tools.map(t => t.id));
            for (const t of all) {
              if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; }
            }
          }
          tools = tools.slice(0, targetCount);
          messages = [
            { role: 'system', content: systemDbReasoningPrompt() },
            { role: 'user', content: buildDbReasoningUserPrompt(prompt, tools as unknown as AITool[]) }
          ];
        } else if (template && detectToolSearchIntent(prompt)) {
          const intent = analyzeUserIntent(prompt);
          let tools = await searchAITools({
            category: intent.category || undefined,
            price: intent.pricePreference !== 'any' ? intent.pricePreference : undefined,
            features: intent.features.length > 0 ? intent.features : undefined,
            searchQuery: intent.category || intent.features.join(' ') || undefined
          });
          const targetCount = Math.min(Math.max(intent.count ?? 5, 1), 10);
          const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5);
          tools = shuffle(tools);
          // 부족 시 보강하여 최소 targetCount 확보
          if (tools.length < targetCount) {
            const broader = shuffle(await searchAITools({ searchQuery: intent.category || (intent.features.join(' ') || undefined) }));
            const ids = new Set(tools.map(t => t.id));
            for (const t of broader) {
              if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; }
            }
          }
          if (tools.length < targetCount) {
            const all = shuffle(await searchAITools({}));
            const ids = new Set(tools.map(t => t.id));
            for (const t of all) {
              if (!ids.has(t.id)) { tools.push(t); ids.add(t.id); if (tools.length >= targetCount) break; }
            }
          }
          tools = tools.slice(0, targetCount);
          messages = [
            { role: 'system', content: systemRecommendationPrompt(targetCount) },
            { role: 'user', content: buildRecommendationUserPrompt(prompt, tools as unknown as AITool[], targetCount) }
          ];
        } else {
          messages = [
            { role: 'system', content: systemGeneralPrompt('향상된 AI') },
            { role: 'user', content: prompt }
          ];
        }

        const chat = await openai.chat.completions.create({
          model: model as any,
          stream: true,
          messages
        });
        for await (const part of chat) {
          const delta = part.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(sanitizeDelta(delta)));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode('\n[stream-error]'));
      } finally {
        if (!alreadyClosed) controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}


