import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { topic } = await request.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 });
    }

    console.log('추천 주제 생성 시작:', topic);

    const suggestions = await generateSuggestedTopics(topic);

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('추천 주제 생성 오류:', error);
    return NextResponse.json({ error: '추천 주제 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function generateSuggestedTopics(topic: string): Promise<string[]> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 레포트 주제 추천 전문가입니다. 사용자가 입력한 주제와 관련된 5개의 구체적이고 흥미로운 레포트 주제를 추천해주세요.

추천 주제는 다음 조건을 만족해야 합니다:
1. 원래 주제와 관련성이 있어야 함
2. 구체적이고 명확해야 함
3. 학술적 가치가 있어야 함
4. 현재 동향과 연관성이 있어야 함
5. 다양한 관점에서 접근 가능해야 함

응답은 정확히 5개의 주제만 포함하고, 각 주제는 번호 없이 한 줄로 작성해주세요.
예시 형식:
인공지능이 의료 분야에 미치는 영향
머신러닝을 활용한 교육 혁신 방안
자율주행 기술의 사회적 영향과 윤리적 고려사항
빅데이터 분석을 통한 비즈니스 의사결정 최적화
사이버보안에서 AI 기술의 활용과 한계`
        },
        {
          role: "user",
          content: `다음 주제와 관련된 5개의 레포트 주제를 추천해주세요:

원래 주제: ${topic}

정확히 5개의 추천 주제를 한 줄씩 작성해주세요.`
        }
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
      const defaultSuggestions = [
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
    console.error('추천 주제 생성 오류:', error);
    
    // 오류 발생 시 기본 추천 주제 반환
    return [
      `${topic}의 현재 동향과 미래 전망`,
      `${topic}이 사회에 미치는 영향과 변화`,
      `${topic}의 윤리적 고려사항과 해결방안`,
      `${topic}의 산업별 활용 사례와 성과`,
      `${topic}의 기술적 발전과 혁신 방향`
    ];
  }
} 