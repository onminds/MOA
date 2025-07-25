import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    // 모델별 최적화 프롬프트 템플릿
    const modelOptimizations = {
      "DALL-E 3": "high quality, detailed, professional photography, 4k, ultra realistic",
      "Stable Diffusion XL": "high quality, detailed, professional lighting, balanced composition, high resolution",
      "Kandinsky": "vibrant colors, artistic style, abstract art, digital painting",
      "Realistic Vision": "photorealistic, high quality, detailed, professional photography"
    };

    const optimization = modelOptimizations[model as keyof typeof modelOptimizations] || "";

    // 모든 모델에 대해 최적화 수행
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a prompt optimization expert. Your task is to:
1. Translate Korean text to English if the input contains Korean
2. Optimize the prompt for the specified AI image generation model
3. Add model-specific enhancements while keeping the original intent

Model: ${model}
Model-specific optimizations: ${optimization}

Return only the optimized English prompt, nothing else.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7
    });

    const optimizedPrompt = completion.choices[0]?.message?.content?.trim();

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