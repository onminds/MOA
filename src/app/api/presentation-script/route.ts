import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { topic, duration, audience, purpose, keyPoints, tone, additionalInfo } = await request.json();

    // 입력 검증
    if (!topic || !audience || !purpose) {
      return NextResponse.json(
        { error: '발표 주제, 대상 청중, 발표 목적은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    // 청중에 따른 설명
    const audienceMap: { [key: string]: string } = {
      'colleagues': '동료/팀원',
      'executives': '경영진/상급자',
      'clients': '고객/클라이언트', 
      'students': '학생/수강생',
      'general': '일반 대중',
      'professionals': '전문가/업계 관계자',
      'investors': '투자자/파트너'
    };

    // 목적에 따른 설명
    const purposeMap: { [key: string]: string } = {
      'inform': '정보 전달',
      'persuade': '설득/제안',
      'educate': '교육/지식 공유',
      'sell': '판매/마케팅',
      'report': '보고/업데이트',
      'inspire': '동기 부여/영감',
      'entertain': '오락/흥미'
    };

    // 톤에 따른 설명
    const toneMap: { [key: string]: string } = {
      'formal': '공식적이고 전문적인',
      'friendly': '친근하고 캐주얼한',
      'enthusiastic': '열정적이고 역동적인',
      'calm': '차분하고 신중한',
      'confident': '자신감 있는',
      'conversational': '대화형이고 상호작용하는'
    };

    // 유효한 주요 포인트만 필터링
    const validKeyPoints = keyPoints.filter((point: string) => point.trim() !== '');

    // 프롬프트 생성
    let prompt = `다음 조건에 맞는 발표 대본을 작성해주세요:

**발표 정보:**
- 주제: ${topic}
- 발표 시간: ${duration}분
- 대상 청중: ${audienceMap[audience] || audience}
- 발표 목적: ${purposeMap[purpose] || purpose}`;

    if (tone) {
      prompt += `\n- 발표 톤/스타일: ${toneMap[tone] || tone}`;
    }

    if (validKeyPoints.length > 0) {
      prompt += `\n- 주요 포인트: ${validKeyPoints.map((point: string, index: number) => `${index + 1}. ${point}`).join('\n  ')}`;
    }

    if (additionalInfo) {
      prompt += `\n- 추가 정보: ${additionalInfo}`;
    }

    prompt += `

**대본 작성 요구사항:**
1. ${duration}분 발표에 적합한 분량으로 작성
2. 명확한 구조 (도입-본론-결론)
3. 시간별 섹션 구분 표시
4. 청중과의 상호작용 포인트 포함
5. 발표자가 실제로 말할 수 있는 자연스러운 문체
6. 적절한 강조점과 전환 구문 포함
7. 마지막에 발표 팁 제공

**출력 형식:**
[발표 대본]

📝 **발표 제목:** [제목]

⏰ **예상 발표 시간:** ${duration}분

---

## 🎯 발표 개요
- **목적:** [발표 목적]
- **핵심 메시지:** [핵심 메시지 요약]

---

## 📋 발표 대본

### 1️⃣ 도입부 (0-${Math.ceil(parseInt(duration) * 0.15)}분)
[도입부 대본]

### 2️⃣ 본론 (${Math.ceil(parseInt(duration) * 0.15)}-${Math.ceil(parseInt(duration) * 0.85)}분)
[본론 대본 - 주요 포인트별로 섹션 구분]

### 3️⃣ 결론 (${Math.ceil(parseInt(duration) * 0.85)}-${duration}분)
[결론 대본]

---

## 💡 발표 팁
[발표자를 위한 실용적인 팁 3-5개]

---

대본을 자연스럽고 실용적으로 작성해주세요. 청중에게 맞는 언어와 예시를 사용하고, 발표자가 실제로 말하기 쉬운 형태로 구성해주세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 발표 코치이자 스피치 라이터입니다. 다양한 상황과 청중에 맞는 효과적인 발표 대본을 작성하는 전문가입니다. 실용적이고 자연스러우며 청중의 관심을 끌 수 있는 대본을 작성해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.7,
    });

    const script = completion.choices[0]?.message?.content;

    if (!script) {
      throw new Error('발표 대본 생성에 실패했습니다.');
    }

    return NextResponse.json({ script });

  } catch (error) {
    console.error('Error generating presentation script:', error);
    return NextResponse.json(
      { error: '발표 대본 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 