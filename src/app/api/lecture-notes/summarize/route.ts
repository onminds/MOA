import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { transcript, summaryType = 'final' } = await request.json();

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: '변환된 텍스트가 필요합니다.' }, { status: 400 });
    }

    console.log('요약 생성 시작:', summaryType, transcript.length, '문자');

    let prompt = '';
    let maxTokens = 500;

    if (summaryType === 'realtime') {
      // 실시간 요약 (간단하고 빠르게)
      prompt = `다음 강의/대화 내용을 간단히 요약해주세요. 주요 키워드와 핵심 내용만 포함하여 3-4문장으로 요약해주세요:

${transcript}

요약:`;
      maxTokens = 200;
    } else {
      // 최종 요약 (상세하고 체계적으로)
      prompt = `다음은 강의나 대화를 녹음한 내용을 텍스트로 변환한 것입니다. 이 내용을 체계적으로 요약해주세요.

요약 형식:
1. 주요 주제
2. 핵심 내용 (중요한 포인트들을 순서대로)
3. 결론/요점 정리

내용:
${transcript}

요약:`;
      maxTokens = 800;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "당신은 강의와 대화 내용을 명확하고 체계적으로 요약하는 전문가입니다. 한국어로 자연스럽고 이해하기 쉽게 요약해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.3, // 일관성 있는 요약을 위해 낮은 값 사용
    });

    const summary = completion.choices[0].message.content;

    console.log('요약 생성 완료:', summary?.length, '문자');

    return NextResponse.json({
      success: true,
      summary: summary || '요약을 생성할 수 없습니다.',
      summaryType,
      originalLength: transcript.length,
      summaryLength: summary?.length || 0
    });

  } catch (error) {
    console.error('요약 생성 오류:', error);
    
    // OpenAI API 에러 처리
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    if (error instanceof Error && error.message.includes('context_length_exceeded')) {
      return NextResponse.json({ 
        error: '텍스트가 너무 깁니다. 더 짧은 내용으로 다시 시도해주세요.' 
      }, { status: 400 });
    }

    return NextResponse.json({ 
      error: '요약 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 