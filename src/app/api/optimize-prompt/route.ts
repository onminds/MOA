import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, model, translateOnly } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    // 번역만 수행 옵션 처리
    if (translateOnly) {
      const translation = await openai.responses.create({
        model: 'gpt-5-mini',
        input: `Translate the following text to natural, fluent English.\n- Only translate.\n- Do not add adjectives or enhancements.\n- Preserve entities and technical terms.\n- If it's already English, return as-is.\n\nText:\n${prompt}`,
        reasoning: { effort: 'low' }
      });
      const optimizedPrompt = (translation as any).output_text?.trim();
      if (!optimizedPrompt) {
        throw new Error('번역에 실패했습니다.');
      }
      return NextResponse.json({ optimizedPrompt, originalPrompt: prompt });
    }

    // 모델별 최적화 프롬프트 템플릿
    const modelOptimizations = {
      "DALL-E 3": "high quality, detailed, professional photography, 4k, ultra realistic",
      "Stable Diffusion XL": "high quality, detailed, professional lighting, balanced composition, high resolution",
      "Kandinsky": "vibrant colors, artistic style, abstract art, digital painting",
      "Realistic Vision": "photorealistic, high quality, detailed, professional photography"
    };

    const optimization = modelOptimizations[model as keyof typeof modelOptimizations] || "";

    // gpt-5-mini + Responses API로 최적화 수행 (간결/저지연 설정)
    const instruction = [
      "You are a prompt optimization expert.",
      "Tasks:",
      "1) Translate Korean to English if needed",
      "2) Optimize for the specified AI image model",
      "3) Add model-specific enhancements while preserving intent",
      "\nModel:", String(model || ''),
      "Model-specific optimizations:", String(optimization || ''),
      "\nReturn only the optimized English prompt, nothing else."
    ].join(' ');

    const completion = await openai.responses.create({
      model: 'gpt-5-mini',
      input: `${instruction}\n\nUser prompt:\n${prompt}`,
      reasoning: { effort: 'low' }
    });

    const optimizedPrompt = (completion as any).output_text?.trim();

    if (!optimizedPrompt) {
      throw new Error('프롬프트 최적화에 실패했습니다.');
    }

    return NextResponse.json({ 
      optimizedPrompt,
      originalPrompt: prompt
    });

  } catch (error) {
    console.error('프롬프트 최적화 오류:', error);
    return NextResponse.json({ error: '프롬프트 최적화 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 