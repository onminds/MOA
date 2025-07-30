import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      return NextResponse.json({ error: '이미지 파일이 필요합니다.' }, { status: 400 });
    }

    // 파일 크기 검증 (4MB)
    if (imageFile.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: '이미지 크기는 4MB 이하여야 합니다.' }, { status: 400 });
    }

    // 파일 타입 검증
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json({ error: '유효한 이미지 파일이 아닙니다.' }, { status: 400 });
    }

    // 이미지를 base64로 변환
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // OpenAI Vision API를 사용하여 이미지 분석
    const completion = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "system",
          content: `당신은 이미지 분석 전문가입니다. 업로드된 이미지를 분석하여 AI 이미지 생성을 위한 프롬프트를 생성해주세요.

다음 규칙을 따라주세요:
1. 이미지의 주요 요소들을 식별하세요 (객체, 배경, 색상, 스타일 등)
2. 이미지의 분위기와 감정을 파악하세요
3. 이미지의 아트 스타일을 분석하세요 (사실적, 만화, 추상 등)
4. 한국어로 자연스러운 프롬프트를 생성하세요
5. 구체적이고 상세한 설명을 포함하세요
6. 이미지의 구도, 조명, 색상 팔레트, 질감 등을 포함하세요
7. 다른 이미지와 결합될 수 있도록 모듈화된 설명을 제공하세요

응답은 프롬프트만 반환하고, 다른 설명은 포함하지 마세요.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 이미지를 분석하여 AI 이미지 생성을 위한 프롬프트를 생성해주세요. 다른 이미지와 결합될 수 있도록 모듈화된 형태로 작성해주세요."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageFile.type};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 400,
      temperature: 0.7
    });

    const prompt = completion.choices[0]?.message?.content?.trim();

    if (!prompt) {
      return NextResponse.json({ error: '이미지 분석에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ 
      prompt,
      originalImage: imageFile.name
    });

  } catch (error) {
    console.error('이미지 분석 오류:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({ error: 'OpenAI API 할당량이 부족합니다.' }, { status: 500 });
      }
      if (error.message.includes('content_policy_violation')) {
        return NextResponse.json({ error: '이미지가 정책에 위반됩니다.' }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: '이미지 분석 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 