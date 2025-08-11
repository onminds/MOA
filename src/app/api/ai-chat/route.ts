import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';
import { createRateLimitMiddleware, rateLimitConfigs } from '@/lib/rate-limiter';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate Limiting 미들웨어 생성
const rateLimitMiddleware = createRateLimitMiddleware(rateLimitConfigs.aiChat);

export async function POST(request: NextRequest) {
  try {
    // Rate Limiting 체크
    const rateLimitResponse = rateLimitMiddleware(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // 사용자 인증 확인
    const authResult = await requireAuth();
    if (!authResult.user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const user = authResult.user;

    const body = await request.json();
    const { message, model = 'gpt-3.5-turbo' } = body;

    if (!message) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 });
    }

    // 사용량 제한 확인
    const db = await getConnection();
    const usageResult = await db.request()
      .input('userId', user.id)
      .input('serviceType', 'ai-chat')
      .query('SELECT usage_count FROM usage WHERE user_id = @userId AND service_type = @serviceType');

    const currentUsage = usageResult.recordset[0]?.usage_count || 0;
    const maxLimit = 50; // 기본 제한

    if (currentUsage >= maxLimit) {
      return NextResponse.json({ 
        error: 'AI 채팅 사용량 한도에 도달했습니다.' 
      }, { status: 429 });
    }

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: '당신은 도움이 되는 AI 어시스턴트입니다. 사용자의 질문에 정확하고 유용한 답변을 제공하세요.'
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '응답을 생성할 수 없습니다.';

    // 사용량 업데이트
    await db.request()
      .input('userId', user.id)
      .input('serviceType', 'ai-chat')
      .input('usageCount', currentUsage + 1)
      .query(`
        IF EXISTS (SELECT 1 FROM usage WHERE user_id = @userId AND service_type = @serviceType)
          UPDATE usage SET usage_count = @usageCount WHERE user_id = @userId AND service_type = @serviceType
        ELSE
          INSERT INTO usage (user_id, service_type, usage_count, created_at, updated_at)
          VALUES (@userId, @serviceType, @usageCount, GETDATE(), GETDATE())
      `);

    return NextResponse.json({ 
      success: true, 
      response,
      usage: currentUsage + 1,
      limit: maxLimit
    });

  } catch (error) {
    console.error('AI 채팅 오류:', error);
    return NextResponse.json({ 
      error: 'AI 채팅 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 