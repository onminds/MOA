import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CodeReviewRequest {
  code: string;
  reviewType: 'general' | 'security' | 'performance' | 'style' | 'bug';
  description?: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      code,
      reviewType,
      description
    }: CodeReviewRequest = await request.json();

    if (!code) {
      return NextResponse.json(
        { success: false, error: '코드를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('코드 리뷰 시작:', { reviewType, codeLength: code.length });

    const result = await performCodeReview({
      code,
      reviewType,
      description
    });

    return NextResponse.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('코드 리뷰 오류:', error);
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false,
      error: '코드 리뷰 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

async function performCodeReview({
  code,
  reviewType,
  description
}: CodeReviewRequest) {
  
  // 언어 자동 감지
  function detectLanguage(code: string): string {
    // 간단한 패턴 매칭으로 언어 감지
    if (code.includes('def ') || code.includes('import ') && code.includes('print(')) return 'Python';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) return 'JavaScript';
    if (code.includes('public class ') || code.includes('System.out.println')) return 'Java';
    if (code.includes('#include') || code.includes('cout <<')) return 'C++';
    if (code.includes('using System') || code.includes('Console.WriteLine')) return 'C#';
    if (code.includes('package main') || code.includes('func main()')) return 'Go';
    if (code.includes('fn main()') || code.includes('println!')) return 'Rust';
    if (code.includes('<?php') || code.includes('echo ')) return 'PHP';
    if (code.includes('def ') && code.includes('end')) return 'Ruby';
    if (code.includes('func ') && code.includes('var ')) return 'Swift';
    if (code.includes('fun ') && code.includes('val ')) return 'Kotlin';
    if (code.includes('interface ') || code.includes(': ') && code.includes('{')) return 'TypeScript';
    
    return 'Unknown';
  }
  
  const detectedLanguage = detectLanguage(code);
  
  const reviewTypeDescriptions = {
    general: '코드 품질, 성능, 보안, 가독성, 유지보수성 등을 종합적으로 검토',
    security: '보안 취약점, 인증/인가 문제, 데이터 검증, SQL 인젝션 등 보안 관련 이슈',
    performance: '알고리즘 효율성, 메모리 사용량, 실행 속도, 최적화 가능성',
    style: '코딩 컨벤션, 가독성, 일관성, 네이밍, 주석',
    bug: '잠재적 버그, 논리 오류, 예외 처리, 엣지 케이스'
  };

  const systemPrompt = `당신은 숙련된 소프트웨어 개발자이자 코드 리뷰 전문가입니다. 주어진 코드를 분석하여 언어를 자동으로 감지하고 ${reviewTypeDescriptions[reviewType]}에 중점을 두어 상세한 리뷰를 제공해주세요.

리뷰 기준:
1. 가독성 (변수명, 함수명, 구조의 명확성)
2. 유지보수성 (코드 구조, 모듈화, 확장성)
3. 성능 (알고리즘 효율성, 최적화)
4. 보안 (취약점, 데이터 검증)
5. 모범 사례 (언어별 컨벤션, 디자인 패턴)

응답 형식은 반드시 다음 JSON 형태로만 제공하세요:
{
  "detectedLanguage": "감지된언어",
  "overallScore": 전체점수(1-100),
  "scores": {
    "readability": 가독성점수(1-100),
    "maintainability": 유지보수성점수(1-100),
    "performance": 성능점수(1-100),
    "security": 보안점수(1-100),
    "bestPractices": 모범사례점수(1-100)
  },
  "issues": [
    {
      "level": "error|warning|info",
      "type": "이슈타입",
      "message": "이슈설명",
      "line": 라인번호(선택사항),
      "suggestion": "개선제안"
    }
  ],
  "improvements": ["개선사항1", "개선사항2", "개선사항3"],
  "positives": ["잘된점1", "잘된점2", "잘된점3"],
  "refactoredCode": "개선된코드(선택사항)",
  "annotatedCode": "원본코드에 라인별 주석을 추가한 코드",
  "summary": "전체요약(200-300자)"
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  const userPrompt = `
예상 언어: ${detectedLanguage}
리뷰 유형: ${reviewType}
${description ? `코드 설명: ${description}` : ''}

검토할 코드:
\`\`\`
${code}
\`\`\`

위 코드의 언어를 정확히 감지하고 ${reviewTypeDescriptions[reviewType]} 관점에서 분석하여 상세한 리뷰를 제공해주세요.

특히 "annotatedCode"에는 원본 코드의 각 줄 옆에 다음과 같은 주석을 추가해주세요:
- // ⚠️ [문제점]: 구체적인 문제 설명
- // 💡 [개선]: 개선 방향 제안  
- // ✅ [좋음]: 잘 작성된 부분 칭찬
- // 🔒 [보안]: 보안 관련 이슈
- // ⚡ [성능]: 성능 개선 가능한 부분

각 줄마다 해당하는 주석을 달아서 라인별로 구체적인 피드백을 제공해주세요.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    max_tokens: 3000,
    temperature: 0.3, // 일관성 있는 분석을 위해 낮은 값 사용
  });

  const response = completion.choices[0].message.content;
  
  if (!response) {
    throw new Error('코드 리뷰 응답이 없습니다.');
  }

  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    
    // 파싱 실패 시 기본 응답 반환
    return getDefaultReview(detectedLanguage, reviewType);
  }
}

// 기본 리뷰 (API 실패 시 백업용)
function getDefaultReview(detectedLanguage: string, reviewType: string) {
  const codeLength = 100; // 예시 값
  
  let overallScore = 70;
  if (codeLength < 20) overallScore = 60;
  if (codeLength > 200) overallScore = 75;
  
  return {
    detectedLanguage,
    overallScore,
    scores: {
      readability: overallScore,
      maintainability: overallScore - 5,
      performance: overallScore + 5,
      security: overallScore - 10,
      bestPractices: overallScore
    },
    issues: [
      {
        level: 'warning',
        type: '일반적 검토',
        message: 'AI 분석에 일시적인 문제가 발생했습니다.',
        suggestion: '코드를 다시 제출하거나 더 구체적인 설명을 추가해보세요.'
      }
    ],
    improvements: [
      '더 구체적인 변수명 사용을 고려해보세요',
      '에러 처리 로직을 추가해보세요',
      '코드 주석을 추가하여 가독성을 높여보세요'
    ],
    positives: [
      '기본적인 코드 구조가 잘 되어 있습니다',
      `${detectedLanguage} 문법을 올바르게 사용하고 있습니다`
    ],
    annotatedCode: '// 💡 AI 분석이 일시적으로 실패했습니다.\n// 코드를 다시 제출해주세요.',
    summary: `${detectedLanguage} 코드에 대한 ${reviewType} 리뷰입니다. 전반적으로 양호한 코드이지만 몇 가지 개선점이 있습니다. 더 정확한 분석을 위해 코드를 다시 제출해주세요.`
  };
} 