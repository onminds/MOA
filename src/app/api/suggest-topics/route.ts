import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { topic, contentType, type } = await request.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 });
    }

    console.log('주제 추천 시작:', { topic, contentType, type });

    const suggestions = await generateTopicSuggestions(topic.trim(), contentType, type);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('주제 추천 오류:', error);
    return NextResponse.json({ error: '주제 추천 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function generateTopicSuggestions(topic: string, contentType: string, type: string): Promise<string[]> {
  const contentTypeMap = {
    review: '리뷰',
    info: '정보',
    daily: '일상',
  };

  let systemPrompt = '';
  let userPrompt = '';

  if (type === 'blog') {
    systemPrompt = `당신은 블로그 주제 추천 전문가입니다. 사용자가 입력한 주제를 바탕으로 블로그에 적합한 구체적이고 매력적인 주제들을 추천해주세요.

추천 규칙:
1. 입력된 주제와 관련성이 높은 주제들
2. 블로그에 적합한 구체적이고 매력적인 제목
3. 클릭을 유도하는 흥미로운 표현
4. 실제 블로그에서 사용할 수 있는 수준의 품질
5. 각 주제는 20자 이내로 작성
6. 5개의 다양한 주제 추천`;

    userPrompt = `다음 정보를 바탕으로 블로그 주제를 추천해주세요:

입력 주제: ${topic}
콘텐츠 타입: ${contentTypeMap[contentType as keyof typeof contentTypeMap]}

5개의 매력적이고 구체적인 블로그 주제를 추천해주세요. 각 주제는 줄바꿈으로 구분해주세요.`;
  } else {
    systemPrompt = `당신은 레포트 주제 추천 전문가입니다. 사용자가 입력한 주제와 관련된 5개의 구체적이고 흥미로운 레포트 주제를 추천해주세요.

추천 주제는 다음 조건을 만족해야 합니다:
1. 원래 주제와 관련성이 있어야 함
2. 구체적이고 명확해야 함
3. 학술적 가치가 있어야 함
4. 현재 동향과 연관성이 있어야 함
5. 다양한 관점에서 접근 가능해야 함

응답은 정확히 5개의 주제만 포함하고, 각 주제는 번호 없이 한 줄로 작성해주세요.`;

    userPrompt = `다음 주제와 관련된 5개의 레포트 주제를 추천해주세요:

원래 주제: ${topic}

정확히 5개의 추천 주제를 한 줄씩 작성해주세요.`;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content || '';
    
    // 응답을 줄바꿈으로 분리하여 주제 추출
    let suggestions = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+\./)) // 번호 제거
      .slice(0, 5); // 최대 5개만 반환

    // 만약 5개 미만이면 기본 추천 주제 추가
    if (suggestions.length < 5) {
      const defaultSuggestions = type === 'blog' ? [
        `${topic} 완벽 가이드`,
        `${topic} 후기 및 리뷰`,
        `${topic} 추천 및 팁`,
        `${topic} 경험담`,
        `${topic} 상세 분석`
      ] : [
        `${topic}의 현재 동향과 미래 전망`,
        `${topic}이 사회에 미치는 영향과 변화`,
        `${topic}의 윤리적 고려사항과 해결방안`,
        `${topic}의 산업별 활용 사례와 성과`,
        `${topic}의 기술적 발전과 혁신 방향`
      ];
      
      // 기존 추천 주제와 기본 추천 주제를 결합
      suggestions = [...suggestions, ...defaultSuggestions.slice(0, 5 - suggestions.length)];
    }

    return suggestions;
  } catch (error) {
    console.error('OpenAI API 오류:', error);
    
    // 기본 추천 주제들
    if (type === 'blog') {
      return [
        `${topic} 완벽 가이드`,
        `${topic} 후기 및 리뷰`,
        `${topic} 추천 및 팁`,
        `${topic} 경험담`,
        `${topic} 상세 분석`
      ];
    } else {
      return [
        `${topic}의 현재 동향과 미래 전망`,
        `${topic}이 사회에 미치는 영향과 변화`,
        `${topic}의 윤리적 고려사항과 해결방안`,
        `${topic}의 산업별 활용 사례와 성과`,
        `${topic}의 기술적 발전과 혁신 방향`
      ];
    }
  }
} 