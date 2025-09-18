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

    // 개발자 도구에서 프롬프트 노출 방지를 위한 처리
    const response = {
      // 프롬프트를 Base64로 인코딩하여 개발자 도구에서 쉽게 읽을 수 없도록 함
      data: Buffer.from(optimizedPrompt).toString('base64'),
      // originalPrompt는 보안상 반환하지 않음 (클라이언트에서 이미 가지고 있음)
    };

    // 프로덕션 환경에서는 추가 보안 처리
    if (process.env.NODE_ENV === 'production') {
      // 응답 헤더에 캐시 방지 설정
      const headers = new Headers();
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('Expires', '0');
      
      return NextResponse.json(response, { headers });
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('프롬프트 최적화 오류:', error);
    return NextResponse.json({ error: '프롬프트 최적화 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 