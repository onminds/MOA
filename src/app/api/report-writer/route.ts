import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const topic = formData.get('topic') as string;
    const pageCount = parseInt(formData.get('pageCount') as string) || 1;
    
    // 파일들 수집
    const files: File[] = [];
    for (let i = 0; i < 3; i++) {
      const file = formData.get(`file_${i}`) as File;
      if (file) {
        files.push(file);
      }
    }
    
    // URL들 수집
    const urls: string[] = [];
    for (let i = 0; i < 2; i++) {
      const url = formData.get(`url_${i}`) as string;
      if (url && url.trim()) {
        urls.push(url.trim());
      }
    }

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: '주제를 입력해주세요.' }, { status: 400 });
    }

    console.log('레포트 작성 시작:', topic);
    console.log('페이지 수:', pageCount);
    console.log('업로드된 파일 수:', files.length);
    console.log('입력된 URL 수:', urls.length);

    // OpenAI를 사용하여 체계적인 레포트 작성
    console.log('레포트 작성 중...');
    const report = await generateReport(topic, pageCount, files, urls);

    return NextResponse.json({ report });
  } catch (error) {
    console.error('레포트 작성 오류:', error);
    return NextResponse.json({ error: '레포트 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

async function generateReport(topic: string, pageCount: number, files: File[], urls: string[]): Promise<string> {
  try {
    // 파일 내용 추출 (간단한 텍스트 파일만 처리)
    let fileContents = '';
    for (const file of files) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        try {
          const text = await file.text();
          fileContents += `\n\n[파일: ${file.name}]\n${text}`;
        } catch (error) {
          console.log(`파일 ${file.name} 읽기 실패:`, error);
        }
      }
    }

    // URL 내용 추출 (간단한 텍스트 기반)
    let urlContents = '';
    for (const url of urls) {
      urlContents += `\n\n[참고 URL: ${url}]`;
    }

    // 페이지 수에 따른 토큰 수 조정
    const maxTokens = Math.min(4000, pageCount * 800); // 페이지당 약 800 토큰

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `당신은 학술적이고 전문적인 레포트 작성 전문가입니다. 주어진 주제에 대해 체계적이고 상세한 레포트를 작성해주세요.

다음 형식과 구조로 작성해주세요:

[주제명]

서론: [주제]의 정의와 중요성
- 주제의 기본 개념과 정의
- 현대 사회에서의 중요성과 영향
- 본 레포트의 탐구 방향과 목표

[주제]의 역사적 발전
- 역사적 배경과 발전 과정
- 주요 이론가와 연구자들의 기여
- 기술적 혁신과 발전 단계

[주제]의 핵심 기술과 방법론
- 주요 기술과 방법론 설명
- 각 기술의 특징과 장단점
- 기술 간의 연관성과 발전 방향

[주제]의 주요 응용 분야
- 다양한 산업 분야에서의 활용
- 구체적인 사례와 성과
- 각 분야별 혁신적 변화

[주제]의 현재와 미래 응용
- 현재 상황과 최신 동향
- 국내외 비교 분석
- 미래 발전 전망과 가능성

[주제]의 윤리적 고려사항
- 주요 윤리적 도전과제
- 사회적 영향과 우려사항
- 해결 방안과 가이드라인

결론: [주제]의 미래 전망
- 전체적인 발전 방향 요약
- 사회경제적 영향과 시사점
- 향후 연구 방향과 제언

레포트 작성 시 다음 사항을 준수해주세요:
1. 학술적이면서도 이해하기 쉽게 작성
2. 객관적이고 중립적인 관점 유지
3. 구체적인 예시와 데이터 포함
4. 논리적 구조와 일관성 유지
5. 지정된 페이지 수에 맞게 적절한 분량으로 작성
6. 각 섹션별로 적절한 소제목 사용
7. 첨부된 보충자료와 URL을 참고하여 내용을 보강
8. 서론과 결론을 명확하게 구분하여 작성
9. 각 섹션이 자연스럽게 연결되도록 구성
10. 마크다운 헤더 표시(##)를 사용하지 말고 일반 텍스트로 섹션 제목을 작성`
        },
        {
          role: "user",
          content: `다음 주제에 대해 위의 형식에 따라 체계적이고 상세한 레포트를 작성해주세요:

주제: ${topic}
페이지 수: ${pageCount}페이지
${fileContents ? `\n보충자료:\n${fileContents}` : ''}
${urlContents ? `\n참고 URL:\n${urlContents}` : ''}

레포트는 학술적이면서도 실용적이고, 현재 동향과 미래 전망을 포함하여 작성해주세요. 
페이지 수에 맞게 적절한 분량으로 작성하고, 서론과 결론을 명확하게 구분하여 작성해주세요.`
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '레포트를 생성할 수 없습니다.';
  } catch (error) {
    console.error('레포트 생성 오류:', error);
    throw new Error('레포트 생성에 실패했습니다.');
  }
} 