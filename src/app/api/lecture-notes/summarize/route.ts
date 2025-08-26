import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getSummaryCostInfo } from '@/lib/summary-cost-calculator';
import { summarizeWithPuppeteer } from '@/lib/puppeteer-summarizer';

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

    // 비용 계산 (gpt-5-mini 기준)
    const costInfo = getSummaryCostInfo(transcript, 'gpt-5-mini', 2000);
    console.log('💰 강의 노트 요약 비용 정보:', {
      cost: costInfo.cost.toFixed(2) + '원',
      isExpensive: costInfo.isExpensive,
      inputTokens: costInfo.inputTokens,
      estimatedOutputTokens: costInfo.estimatedOutputTokens,
      contentLength: transcript.length
    });

    // 요약은 비용 제한 없이 OpenAI 사용
    console.log('🤖 OpenAI 사용:', costInfo.cost.toFixed(2) + '원');

    let summary: string;
    
    // OpenAI를 사용한 요약 생성 (Responses API + gpt-5-mini)
    try {
      const completion = await openai.responses.create({
        model: 'gpt-5-mini',
        input: `다음 강의 내용을 ${summaryType} 형식으로 한국어로 명확하게 요약해주세요. 핵심 개념, 중요한 포인트, 결론을 포함하고 불필요한 중복은 제거하세요.\n\n원문:\n${transcript}`,
        reasoning: { effort: 'low' }
      });

      summary = completion.output_text || '요약을 생성할 수 없습니다.';
    } catch (error) {
      console.error('OpenAI 요약 생성 오류:', error);
      summary = '요약을 생성할 수 없습니다.';
    }

    return NextResponse.json({ 
      summary,
      costInfo: {
        cost: costInfo.cost,
        isExpensive: costInfo.isExpensive,
        method: 'openai',
        inputTokens: costInfo.inputTokens,
        estimatedOutputTokens: costInfo.estimatedOutputTokens
      }
    });

  } catch (error) {
    console.error('강의 요약 생성 오류:', error);
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 