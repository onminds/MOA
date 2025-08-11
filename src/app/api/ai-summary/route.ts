import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';
import { extractYouTubeContent } from '@/lib/youtube-extractor';
import { extractDocumentContent, extractWebsiteContent } from '@/lib/content-extractor';
import { generateSummary } from '@/lib/text-processor';
import { getSummaryCostInfo } from '@/lib/summary-cost-calculator';
import { summarizeWithPuppeteer } from '@/lib/puppeteer-summarizer';

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    const formData = await request.formData();
    const type = formData.get('type') as string;

    let content = '';

    switch (type) {
      case 'youtube':
        const youtubeUrl = formData.get('youtubeUrl') as string;
        content = await extractYouTubeContent(youtubeUrl);
        break;
      
      case 'document':
        const document = formData.get('document') as File;
        content = await extractDocumentContent(document);
        break;
      
      case 'website':
        const websiteUrl = formData.get('websiteUrl') as string;
        content = await extractWebsiteContent(websiteUrl);
        break;
      
      case 'text':
        content = formData.get('textContent') as string;
        break;
      
      default:
        return NextResponse.json({ error: '지원하지 않는 타입입니다.' }, { status: 400 });
    }

    if (!content) {
      return NextResponse.json({ error: '내용을 추출할 수 없습니다.' }, { status: 400 });
    }

    // 비용 계산 (GPT-3.5-turbo 사용)
    const costInfo = getSummaryCostInfo(content, 'gpt-3.5-turbo', 2000);
    console.log('💰 요약 비용 정보:', {
      cost: costInfo.cost.toFixed(2) + '원',
      isExpensive: costInfo.isExpensive,
      inputTokens: costInfo.inputTokens,
      estimatedOutputTokens: costInfo.estimatedOutputTokens,
      contentLength: content.length
    });

    // 요약은 무조건 OpenAI 사용
    console.log('🤖 OpenAI 사용:', costInfo.cost.toFixed(2) + '원');
    const summary = await generateSummary(content, type);

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
    console.error('요약 생성 오류:', error);
    return NextResponse.json({ error: '요약 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 