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

    const { request: userRequest, code, language, complexity } = await request.json();

    if (!userRequest || !code) {
      return NextResponse.json(
        { success: false, error: '요청사항과 코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    // AI를 통해 상세 정보 재생성
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: `당신은 코드 분석 전문가입니다. 주어진 코드에 대해 다음 정보를 생성해주세요:

1. **코드 설명**: 코드가 무엇을 하는지 200-300자로 설명
2. **사용 방법**: 코드를 어떻게 사용하는지 150-250자로 설명  
3. **개선 제안**: 코드를 개선할 수 있는 방법 3가지를 제안
4. **관련 개념**: 이 코드와 관련된 프로그래밍 개념 4-5개를 태그 형태로 제시

응답은 반드시 다음 JSON 형태로만 제공하세요:
{
  "explanation": "코드 설명",
  "usage": "사용 방법",
  "improvements": ["개선제안1", "개선제안2", "개선제안3"],
  "relatedConcepts": ["개념1", "개념2", "개념3", "개념4"]
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`
        },
        {
          role: "user",
          content: `코드 분석 요청:

**요청사항**: ${userRequest}
**프로그래밍 언어**: ${language}
**복잡도**: ${complexity}
**코드**:
\`\`\`${language}
${code}
\`\`\`

위 코드에 대한 상세 정보를 생성해주세요.`
        }
      ],
      max_completion_tokens: 1000,
      temperature: 0.3,
    });

    const response = completion.choices[0].message.content;
    
    if (!response) {
      throw new Error('AI 응답이 없습니다.');
    }

    try {
      const result = JSON.parse(response);
      return NextResponse.json({
        success: true,
        ...result
      });
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw new Error('AI 응답 파싱에 실패했습니다.');
    }

  } catch (error) {
    console.error('상세 정보 재생성 오류:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({ 
          success: false,
          error: 'OpenAI API 할당량이 부족합니다.' 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      success: false,
      error: '상세 정보 재생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
