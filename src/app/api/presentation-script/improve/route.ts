import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { fileContent, formData } = await request.json();

    // 입력 검증
    if (!fileContent || !fileContent.trim()) {
      return NextResponse.json(
        { error: '분석할 대본 내용이 없습니다.' },
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
    const validKeyPoints = formData.keyPoints?.filter((point: string) => point.trim() !== '') || [];

    // 프롬프트 생성
    let prompt = `다음은 개선이 필요한 발표 대본입니다. 이 대본을 분석하고 더 효과적이고 매력적인 발표 대본으로 개선해주세요.

**원본 대본:**
${fileContent}

**개선 요청 정보:**`;

    if (formData.topic) {
      prompt += `\n- 주제: ${formData.topic}`;
    }
    
    if (formData.duration) {
      prompt += `\n- 목표 발표 시간: ${formData.duration}분`;
    }
    
    if (formData.audience) {
      prompt += `\n- 대상 청중: ${audienceMap[formData.audience] || formData.audience}`;
    }
    
    if (formData.purpose) {
      prompt += `\n- 발표 목적: ${purposeMap[formData.purpose] || formData.purpose}`;
    }

    if (formData.tone) {
      prompt += `\n- 희망하는 발표 톤/스타일: ${toneMap[formData.tone] || formData.tone}`;
    }

    if (validKeyPoints.length > 0) {
      prompt += `\n- 강조하고 싶은 포인트: ${validKeyPoints.map((point: string, index: number) => `${index + 1}. ${point}`).join('\n  ')}`;
    }

    if (formData.additionalInfo) {
      prompt += `\n- 추가 요청사항: ${formData.additionalInfo}`;
    }

    prompt += `

**개선 요구사항:**
1. 원본의 핵심 내용과 메시지는 유지하면서 전달력을 높여주세요
2. 더 명확하고 논리적인 구조로 재구성해주세요
3. 청중의 관심을 끌 수 있는 시작과 강력한 마무리를 만들어주세요
4. 적절한 강조점과 전환 구문을 추가해주세요
5. 발표 시간에 맞는 적절한 분량으로 조정해주세요
6. 청중과의 상호작용 요소를 포함해주세요
7. 실제 발표할 때 자연스럽게 말할 수 있는 문체로 개선해주세요

**출력 형식:**
[개선된 발표 대본]

📝 **개선된 발표 제목:** [제목]

⏰ **예상 발표 시간:** ${formData.duration || '미지정'}분

---

## 🔍 개선 요약
- **주요 개선사항:** [어떤 부분이 어떻게 개선되었는지 간단히 설명]

---

## 📋 개선된 발표 대본

### 1️⃣ 도입부 (${formData.duration ? `0-${Math.ceil(parseInt(formData.duration) * 0.15)}분` : '시작 부분'})
[개선된 도입부 대본]

### 2️⃣ 본론 (${formData.duration ? `${Math.ceil(parseInt(formData.duration) * 0.15)}-${Math.ceil(parseInt(formData.duration) * 0.85)}분` : '중간 부분'})
[개선된 본론 대본 - 주요 포인트별로 섹션 구분]

### 3️⃣ 결론 (${formData.duration ? `${Math.ceil(parseInt(formData.duration) * 0.85)}-${formData.duration}분` : '마무리 부분'})
[개선된 결론 대본]

---

## 💡 발표 개선 팁
[원본 대본과 비교하여 개선된 발표를 위한 실용적인 팁 3-5개]

---

원본의 장점은 살리면서 약점을 보완하여 더 효과적인 발표가 될 수 있도록 개선해주세요.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 발표 코치이자 스피치 컨설턴트입니다. 기존 발표 대본을 분석하고 개선하는 전문가로서, 내용의 본질은 유지하면서 전달력과 설득력을 높이는 것에 특화되어 있습니다. 청중의 관점에서 더 흥미롭고 이해하기 쉬운 대본으로 개선해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3500,
      temperature: 0.7,
    });

    const script = completion.choices[0]?.message?.content;

    if (!script) {
      throw new Error('발표 대본 개선에 실패했습니다.');
    }

    return NextResponse.json({ script });

  } catch (error) {
    console.error('Error improving presentation script:', error);
    return NextResponse.json(
      { error: '발표 대본 개선 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 