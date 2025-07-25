import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 토큰 제한 설정
const MAX_TOKENS_PER_REQUEST = 8000;
const MAX_CODE_LENGTH = 10000; // 코드 길이 제한 (10000자)

export async function POST(request: NextRequest) {
  try {
    const { code, language, context } = await request.json();

    if (!code) {
      return NextResponse.json({ error: '코드가 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('코드리뷰 API 호출됨');
    console.log('언어:', language);
    console.log('코드 길이:', code.length);

    // 코드가 너무 긴 경우 처리
    let processedCode = code;
    let isTruncated = false;
    
    if (code.length > MAX_CODE_LENGTH) {
      processedCode = code.substring(0, MAX_CODE_LENGTH) + '\n\n... (코드가 너무 길어 일부만 분석됩니다)';
      isTruncated = true;
    }

    const prompt = `
다음 ${language || '코드'}를 분석하여 코드리뷰를 제공해주세요:

코드:
\`\`\`${language || ''}
${processedCode}
\`\`\`

${context ? `컨텍스트: ${context}` : ''}
${isTruncated ? '\n⚠️ 주의: 코드가 너무 길어 일부만 분석됩니다.' : ''}

다음 항목들을 포함하여 상세한 코드리뷰를 제공해주세요:

1. **코드 품질 평가**
   - 가독성
   - 유지보수성
   - 성능

2. **개선 사항**
   - 버그 가능성
   - 보안 취약점
   - 최적화 기회

3. **모범 사례 준수**
   - 코딩 컨벤션
   - 디자인 패턴
   - 아키텍처

4. **구체적인 개선 제안**
   - 리팩토링 제안
   - 코드 예시

한국어로 답변해주세요.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자입니다. 코드를 분석하고 개선점을 제시하는 코드리뷰 전문가입니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3,
    });

    const review = completion.choices[0]?.message?.content;

    if (!review) {
      return NextResponse.json({ error: '코드리뷰 생성에 실패했습니다.' }, { status: 500 });
    }

    console.log('코드리뷰 생성 완료');

    return NextResponse.json({
      success: true,
      review: review,
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
      isTruncated: isTruncated,
      originalLength: code.length,
      processedLength: processedCode.length
    });

  } catch (error) {
    console.error('코드리뷰 처리 중 오류:', error);
    
    // 토큰 제한 오류인 경우 특별한 메시지 반환
    if (error instanceof Error && error.message.includes('429')) {
      return NextResponse.json(
        { 
          error: '토큰 제한에 도달했습니다. 코드를 더 작은 부분으로 나누어 분석해주세요.',
          details: '코드가 너무 길어 분석할 수 없습니다. 파일을 더 작은 단위로 나누거나, 중요한 부분만 선택하여 분석해주세요.'
        },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: '코드리뷰 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 