import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 타입 정의 추가
interface PPTSlide {
  id: number;
  title: string;
  content: string[];
  notes?: string;
  chapterId?: number;
  layout?: 'title' | 'content' | 'image' | 'split' | 'chart';
  imageSuggestion?: string;
}

interface PPTChapter {
  id: number;
  title: string;
  description: string;
  slideCount: number;
  color: string;
}

interface PPTDraftResult {
  title: string;
  subtitle: string;
  outline: string[];
  chapters: PPTChapter[];
  slides: PPTSlide[];
  designSuggestions: string[];
  presentationTips: string[];
  estimatedDuration: string;
}

interface PPTDraftRequest {
  topic: string;
  presentationType: 'business' | 'academic' | 'educational' | 'sales' | 'project';
  targetAudience?: string;
  duration: number;
  keyPoints?: string;
  objectives?: string;
  emphasisPoints?: string;
  referenceText?: string;
}

// JSON 응답 검증 함수
function validatePPTDraftResult(data: any): PPTDraftResult {
  const requiredFields = ['title', 'subtitle', 'outline', 'chapters', 'slides'];
  const missingFields = requiredFields.filter(field => !data[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`필수 필드 누락: ${missingFields.join(', ')}`);
  }

  // 슬라이드 검증
  if (!Array.isArray(data.slides)) {
    throw new Error('slides는 배열이어야 합니다.');
  }

  // 슬라이드 수 검증 (최소 5개 이상)
  if (data.slides.length < 5) {
    throw new Error(`슬라이드가 5개 이상 포함되어야 합니다. 현재: ${data.slides.length}개`);
  }

  // 챕터 검증
  if (!Array.isArray(data.chapters)) {
    throw new Error('chapters는 배열이어야 합니다.');
  }

  // 슬라이드 데이터 정제 (imageSuggestion 필드 허용)
  const cleanedSlides = data.slides.map((slide: any) => ({
    id: slide.id || Date.now() + Math.random(),
    title: slide.title || '제목 없음',
    content: Array.isArray(slide.content) ? slide.content : [],
    notes: slide.notes || '',
    chapterId: slide.chapterId || 1,
    layout: slide.layout || 'content',
    // imageSuggestion 필드는 선택사항이므로 제거하지 않음
  }));

  // 기본값 설정
  return {
    title: data.title || '제목 없음',
    subtitle: data.subtitle || '',
    outline: Array.isArray(data.outline) ? data.outline : [],
    chapters: Array.isArray(data.chapters) ? data.chapters : [],
    slides: cleanedSlides,
    designSuggestions: Array.isArray(data.designSuggestions) ? data.designSuggestions : [],
    presentationTips: Array.isArray(data.presentationTips) ? data.presentationTips : [],
    estimatedDuration: data.estimatedDuration || '10분'
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      topic,
      presentationType,
      targetAudience,
      duration,
      keyPoints,
      objectives,
      referenceText
    }: PPTDraftRequest = await request.json();

    if (!topic) {
      return NextResponse.json(
        { success: false, error: '발표 주제를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('PPT 초안 생성 시작:', { 
      topic, 
      presentationType, 
      duration,
      referenceTextLength: referenceText?.length || 0
    });

    const { result, summarizationInfo } = await generatePPTDraft({
      topic,
      presentationType,
      targetAudience,
      duration,
      keyPoints,
      objectives,
      referenceText
    });

    return NextResponse.json({
      success: true,
      result,
      summarizationInfo
    });

  } catch (error) {
    console.error('PPT 초안 생성 오류:', error);
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        success: false,
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: false,
      error: 'PPT 초안 생성 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 텍스트 요약 함수
async function summarizeText(text: string, maxLength: number = 1000): Promise<string> {
  try {
    // 텍스트가 이미 짧으면 요약하지 않음
    if (text.length <= maxLength) {
      return text;
    }

    console.log('텍스트 요약 시작:', {
      originalLength: text.length,
      targetLength: maxLength
    });

    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, maxLength }),
    });

    if (!response.ok) {
      console.warn('요약 API 실패, 원본 텍스트 사용');
      return text.substring(0, maxLength);
    }

    const data = await response.json();
    
    if (data.success) {
      console.log('텍스트 요약 완료:', {
        originalLength: data.originalLength,
        summarizedLength: data.summarizedLength,
        reduction: Math.round((1 - data.summarizedLength / data.originalLength) * 100) + '%'
      });
      return data.summarizedText;
    } else {
      console.warn('요약 실패, 원본 텍스트 사용');
      return text.substring(0, maxLength);
    }
  } catch (error) {
    console.error('텍스트 요약 중 오류:', error);
    return text.substring(0, maxLength);
  }
}

async function generatePPTDraft({
  topic,
  presentationType,
  targetAudience,
  duration,
  keyPoints,
  objectives,
  emphasisPoints,
  referenceText
}: PPTDraftRequest): Promise<{
  result: PPTDraftResult;
  summarizationInfo: {
    wasSummarized: boolean;
    originalLength: number;
    summarizedLength: number;
    reduction: number;
  };
}> {
  
  const presentationTypeDescriptions = {
    business: '비즈니스 프레젠테이션 - 전문적이고 간결하며 데이터 중심',
    academic: '학술 발표 - 논리적이고 체계적이며 근거 중심',
    educational: '교육용 자료 - 이해하기 쉽고 단계적이며 실습 중심',
    sales: '영업/마케팅 - 설득력 있고 매력적이며 고객 중심',
    project: '프로젝트 발표 - 구체적이고 일정 중심이며 결과 지향'
  };

  // 발표 시간에 따른 슬라이드 수 계산 (명확한 기준 적용)
  const slideCountByDuration = {
    5: { min: 3, max: 4, description: '간단한 브리핑' },
    10: { min: 5, max: 7, description: '표준 발표' },
    15: { min: 8, max: 10, description: '상세한 설명' },
    20: { min: 10, max: 12, description: '종합적 발표' },
    30: { min: 15, max: 18, description: '완전한 프레젠테이션' },
    45: { min: 20, max: 25, description: '심화 발표' },
    60: { min: 25, max: 30, description: '장시간 발표' }
  };

  const slideConfig = slideCountByDuration[duration as keyof typeof slideCountByDuration] || 
    { min: 5, max: 7, description: '표준 발표' };

  // 참고 자료 처리
  let processedReferenceText = '';
  if (referenceText && referenceText.trim()) {
    console.log('참고 자료 요약 처리 시작...');
    processedReferenceText = await summarizeText(referenceText.trim(), 800);
    console.log('참고 자료 처리 완료:', {
      originalLength: referenceText.length,
      processedLength: processedReferenceText.length
    });
  }

  const systemPrompt = `당신은 전문적인 프레젠테이션 기획자입니다. '${presentationTypeDescriptions[presentationType]}' 스타일의 PPT 초안을 작성해주세요.

📌 발표 조건:
- 발표 주제: ${topic}
- 발표 시간: ${duration}분 (5~7장 슬라이드 적정)
${targetAudience ? `- 대상: ${targetAudience}` : ''}
${keyPoints ? `- 핵심 내용: ${keyPoints}` : ''}
${objectives ? `- 발표 목표: ${objectives}` : ''}
${emphasisPoints ? `- 강조 요소: ${emphasisPoints}` : ''}
${processedReferenceText ? `- 참고자료 요약: ${processedReferenceText}` : ''}

📋 슬라이드 구성 흐름:
1. 제목 슬라이드
2. 목차
3. 서론 (배경 및 문제 제기)
4. 본론 (사례, 비교, 전략)
5. 결론 (요약 및 제안)
6. Q&A

📎 각 슬라이드 필수 구성:
- **슬라이드 제목**: 명확하고 간결한 제목
- **bullet point 4~5개**: 실제 수치, 기업명, 효과 등 포함 (예: "A사: **매출 20% 증가**")
- **발표 노트**: 청중 상호작용 + 다음 슬라이드 연결 포함, 2~3문장 (예: "다음은 실제 사례입니다.")
- **imageSuggestion**: 구체적 시각 요소를 제안 (예: "좌측: AI 도입 전/후 매출 비교 막대그래프")

${emphasisPoints ? `⭐ 강조 요소 반영: ${emphasisPoints}에 따라 해당 내용을 더 상세하고 비중 있게 다루세요.` : ''}

🧾 디자인 가이드라인:
- 배경: 연한 회색(#F3F4F6) 또는 흰색(#FFFFFF)
- 텍스트: 제목(#1F2937), 본문(#374151), 강조(#3B82F6, #F59E0B)
- 글자 크기: 제목 28~32pt, 본문 16~20pt
- 줄 간격: 1.3~1.4, 좌측 정렬

🧠 Q&A 슬라이드에는 예상 질문을 2~3개 bullet point로 포함하세요. (예: "초기 도입 비용은 얼마인가요?")

⚠️ 반드시 아래 JSON 형식으로만 응답하세요. JSON 외 문장은 절대 포함하지 마세요.
절대로 코드 블록을 포함하지 마세요.
JSON 외 다른 문장이 포함되면 무조건 실패합니다.
모든 응답은 중괄호로 시작하고 끝나야 합니다.

{
  "title": "발표 제목",
  "subtitle": "부제목", 
  "outline": ["목차1", "목차2", "목차3"],
  "chapters": [
    {"id": 1, "title": "서론", "description": "주제 소개 및 배경", "slideCount": 2, "color": "#3B82F6"},
    {"id": 2, "title": "본론", "description": "핵심 내용 및 분석", "slideCount": 3, "color": "#10B981"},
    {"id": 3, "title": "결론", "description": "요약 및 제안", "slideCount": 1, "color": "#F59E0B"},
    {"id": 4, "title": "Q&A", "description": "질문 및 답변", "slideCount": 1, "color": "#8B5CF6"}
  ],
  "slides": [
    {"id": 1, "title": "AI 도입이 중소기업에 미치는 영향", "content": ["글로벌 AI 시장 규모", "중소기업 도입 현황", "시장 성장률 25%", "도입 기업 증가 추이"], "notes": "AI 시장은 빠르게 확장되고 있으며, 중소기업들의 관심도 높아지고 있습니다.", "chapterId": 1, "layout": "title", "imageSuggestion": "AI 시장 성장률 트렌드 라인 그래프"},
    {"id": 2, "title": "시장 동향 분석", "content": ["글로벌 AI 시장 규모", "국내 중소기업 현황", "도입 장벽 분석", "정부 지원 정책"], "notes": "시장 동향을 파악하고 중소기업이 직면한 현실을 살펴보겠습니다.", "chapterId": 1, "layout": "content", "imageSuggestion": "글로벌 vs 국내 AI 시장 비교 막대그래프"},
    {"id": 3, "title": "성공 사례 분석", "content": ["A사: 매출 20% 증가", "B사: 비용 15% 절감", "C사: 고객 만족도 향상", "D사: 업무 효율성 개선"], "notes": "실제 도입 사례를 통해 구체적인 효과를 확인해보겠습니다.", "chapterId": 2, "layout": "content", "imageSuggestion": "좌측: 성공 사례 비교 표, 우측: 효과 지표 차트"},
    {"id": 4, "title": "실패 요인 분석", "content": ["기술 적합성 부족", "직원 저항", "비용 과다", "기대치 불일치"], "notes": "실패 사례도 함께 분석하여 주의사항을 파악하겠습니다.", "chapterId": 2, "layout": "content", "imageSuggestion": "실패 요인별 비율 파이 차트"},
    {"id": 5, "title": "전략적 제안", "content": ["단계별 도입 계획", "예상 투자 비용", "기대 효과 분석", "리스크 관리 방안"], "notes": "구체적이고 실행 가능한 전략을 제시하겠습니다.", "chapterId": 3, "layout": "content", "imageSuggestion": "AI 도입 로드맵 타임라인 차트"},
    {"id": 6, "title": "Q&A", "content": ["도입 비용은 얼마나 드나요?", "기존 인력과의 충돌은 어떻게 조정하나요?", "실패 위험을 줄이는 방법은 무엇인가요?"], "notes": "질문을 받아드리겠습니다.", "chapterId": 4, "layout": "content", "imageSuggestion": "Q&A 아이콘과 질문 풍선 이미지"}
  ],
  "designSuggestions": ["제안1", "제안2"],
  "presentationTips": ["팁1", "팁2"],
  "estimatedDuration": "${duration}분"
}

중요: 반드시 5개 이상의 슬라이드를 생성하세요. 1개나 2개가 아닌, 최소 5개 슬라이드입니다. 각 슬라이드의 bullet은 4~5개, imageSuggestion 필드는 반드시 포함하세요.

JSON만 응답하세요.`;

  const userPrompt = `
발표 주제: ${topic}
발표 유형: ${presentationTypeDescriptions[presentationType]}
발표 시간: ${duration}분
${targetAudience ? `대상: ${targetAudience}` : ''}
${keyPoints ? `핵심내용: ${keyPoints}` : ''}
${objectives ? `목표: ${objectives}` : ''}
${emphasisPoints ? `강조요소: ${emphasisPoints}` : ''}
${processedReferenceText ? `참고자료: ${processedReferenceText}` : ''}

위 내용을 기반으로 슬라이드 1장당 약 1~2분 분량의 발표 내용을 구성해주세요.
${emphasisPoints ? `특히 ${emphasisPoints}에 따라 해당 내용을 더 상세하고 비중 있게 다루세요.` : ''}

각 슬라이드는 다음 정보를 포함해야 합니다:
- 슬라이드 제목
- 핵심 bullet point 4~5개
- 발표 노트 (2~3문장, 청중을 고려한 말투로)
- imageSuggestion (구체적 시각 요소 제안)

내용은 구체적이고 실무적으로 구성하되, 발표 흐름에 따라 점진적으로 전개되도록 해주세요.
절대로 코드 블록을 포함하지 마세요. JSON 외 다른 문장은 포함하지 마세요.
모든 응답은 중괄호로 시작하고 끝나야 합니다.
`;

  console.log('GPT API 호출 시작...');
  console.log('프롬프트 길이:', userPrompt.length);
  
  // 타임아웃 설정 (90초로 연장)
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('OpenAI API 호출 시간이 초과되었습니다.')), 90000);
  });

  const completionPromise = openai.chat.completions.create({
    model: "gpt-4o",
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
    max_tokens: 3500,
    temperature: 0.5,
  });

  // 타임아웃과 API 호출을 경쟁시킴
  const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

  const response = completion.choices[0].message.content;
  
  if (!response) {
    throw new Error('PPT 초안 응답이 없습니다.');
  }

  console.log('GPT 응답 받음, JSON 파싱 시작...');
  console.log('GPT 원본 응답:', response);

  // GPT가 응답에 코드블록 ```json ... ``` 을 포함했을 경우 제거 (강화된 버전)
  const cleaned = response
    .replace(/```json\s*|```/g, '')
    .trim();

  console.log('정제된 응답:', cleaned);

  try {
    const parsedData = JSON.parse(cleaned);
    console.log('JSON 파싱 성공. 슬라이드 수:', parsedData.slides?.length || 0);
    
    const validatedResult = validatePPTDraftResult(parsedData);
    console.log('검증 완료. 최종 슬라이드 수:', validatedResult.slides.length);
    
    return {
      result: validatedResult,
      summarizationInfo: {
        wasSummarized: !!(referenceText && referenceText.length > 800),
        originalLength: referenceText?.length || 0,
        summarizedLength: processedReferenceText?.length || 0,
        reduction: referenceText && processedReferenceText ? 
          Math.round((1 - processedReferenceText.length / referenceText.length) * 100) : 0
      }
    };
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    console.error('정제된 응답:', cleaned);
    console.warn('⚠️ fallback 사용됨. 원인:', parseError instanceof Error ? parseError.message : String(parseError));
    
    // 파싱 실패 시 기본 응답 반환
    return {
      result: getDefaultPPTDraft(topic, presentationType, duration),
      summarizationInfo: {
        wasSummarized: false,
        originalLength: 0,
        summarizedLength: 0,
        reduction: 0
      }
    };
  }
}

// 기본 PPT 초안 (API 실패 시 백업용)
function getDefaultPPTDraft(topic: string, presentationType: string, duration: number): PPTDraftResult {
  return {
    title: topic,
    subtitle: "AI가 생성한 프레젠테이션 초안",
    outline: [
      "AI 시장 동향",
      "중소기업의 현실",
      "성공 사례 분석",
      "실패 사례 분석",
      "요인 분석",
      "전략 요약",
      "기대 효과",
      "Q&A"
    ],
    chapters: [
      {
        id: 1,
        title: "서론",
        description: "주제 소개 및 배경",
        slideCount: 2,
        color: "#3B82F6"
      },
      {
        id: 2,
        title: "본론",
        description: "핵심 내용 및 분석",
        slideCount: 3,
        color: "#10B981"
      },
      {
        id: 3,
        title: "결론",
        description: "요약 및 제안",
        slideCount: 2,
        color: "#F59E0B"
      },
      {
        id: 4,
        title: "Q&A",
        description: "질문 및 답변",
        slideCount: 1,
        color: "#8B5CF6"
      }
    ],
    slides: [
      {
        id: 1,
        title: "제목 슬라이드",
        content: [topic, "발표자: [이름]", "날짜: [날짜]"],
        notes: "청중에게 인사하고 발표 주제를 소개합니다. 발표의 목적과 기대효과를 간단히 언급합니다.",
        chapterId: 1,
        layout: "title"
      },
      {
        id: 2,
        title: "목차",
        content: ["발표 개요", "주요 내용", "결론", "Q&A"],
        notes: "발표의 전체 구성을 설명합니다. 각 섹션별로 다룰 내용을 간단히 소개합니다.",
        chapterId: 1,
        layout: "content"
      },
      {
        id: 3,
        title: "AI 시장 동향",
        content: ["**글로벌 AI 시장 규모**: 2023년 1,500억 달러", "**중소기업 AI 도입률**: 2022년 15% → 2023년 28%", "**AI 도입 성공률**: 평균 65% (대기업 대비 10%p 높음)", "**예상 시장 성장률**: 연평균 25% 증가 전망"],
        notes: "AI 시장의 전반적인 동향을 먼저 살펴보겠습니다. 이러한 시장 흐름은 중소기업에게 어떤 의미일까요? 지금부터 AI 도입의 실제 사례를 보겠습니다. 다음 슬라이드에서는 중소기업들이 직면한 현실을 구체적으로 분석해보겠습니다.",
        chapterId: 1,
        layout: "content"
      },
      {
        id: 4,
        title: "중소기업의 현실",
        content: ["**중소기업 매출 성장률**: 평균 3%로 정체", "**AI 도입 중소기업**: 평균 15% 매출 증가", "**기존 방식의 한계**: 경쟁력 확보 어려움", "**AI 도입 필요성**: 생존과 성장의 필수 요소"],
        notes: "현재 중소기업들이 직면한 현실을 구체적으로 분석해보겠습니다. 여러분도 느끼고 계시겠지만, 전통적인 방식으로는 더 이상 경쟁력을 확보하기 어려운 상황입니다. 하지만 AI를 도입한 중소기업들은 평균 15%의 매출 증가를 경험하고 있어, AI가 이제 선택이 아닌 필수가 되었음을 확인할 수 있습니다. 다음 슬라이드에서는 성공 사례를 구체적으로 살펴보겠습니다.",
        chapterId: 1,
        layout: "content"
      },
      {
        id: 5,
        title: "성공 사례 분석",
        content: ["**A사**: AI 고객 분석으로 이탈률 15% 감소", "**B사**: AI 예측 재고관리로 비용 20% 절감", "**C사**: 추천 시스템으로 구매전환율 1.5배 상승", "**D사**: AI 자동화로 연간 인건비 5천만원 절감"],
        notes: "이제 구체적인 성공 사례를 통해 AI 도입의 실제 효과를 확인해보겠습니다. 각 사례는 실제 중소기업의 성과이며, 여러분의 회사에도 적용 가능한 방법들입니다. 특히 A사의 고객 분석 사례는 많은 중소기업이 공감할 수 있는 부분입니다. 다음 슬라이드에서는 실패 사례도 함께 분석해보겠습니다.",
        chapterId: 2,
        layout: "content"
      },
      {
        id: 6,
        title: "실패 사례 분석",
        content: ["**E사**: 도입 초기비용 과다로 ROI 미달", "**F사**: 기술 적합도 미검토로 활용도 저하", "**G사**: 내부 데이터 부족으로 예측 정확도 낮음", "**H사**: 인력 교육 부족으로 시스템 활용 못함"],
        notes: "성공 사례만큼 실패 사례도 중요한 교훈을 제공합니다. E사의 경우 초기 투자 비용이 너무 높아서 ROI를 달성하지 못했고, F사는 기술의 적합성을 제대로 검토하지 않아 활용도가 떨어졌습니다. 이러한 실패 요인들을 분석하여 다음 슬라이드에서 성공 요인을 도출해보겠습니다.",
        chapterId: 2,
        layout: "content"
      },
      {
        id: 7,
        title: "요인 분석",
        content: ["**성공 요인**: 내부 데이터 기반 예측 모델", "**실패 요인**: 기술 적합도 미검토", "**공통점**: 단계적 도입과 교육의 중요성", "**차이점**: 데이터 품질과 활용 전략"],
        notes: "성공과 실패 사례를 비교 분석한 결과, 핵심은 내부 데이터의 품질과 기술의 적합성입니다. 또한 단계적 도입과 체계적인 교육이 공통적으로 중요한 요소임을 확인할 수 있습니다. 다음 슬라이드에서는 이러한 분석을 바탕으로 전략을 요약해보겠습니다.",
        chapterId: 2,
        layout: "content"
      },
      {
        id: 8,
        title: "전략 요약",
        content: ["**AI는 선택이 아닌 필수**", "**실행 가능한 전략 수립 필요**", "**단계적 도입으로 리스크 최소화**", "**데이터 품질과 교육이 핵심**"],
        notes: "지금까지 살펴본 사례들을 통해 AI 도입이 중소기업에게 필수임을 확인했습니다. 하지만 막연한 두려움보다는 구체적인 실행 계획이 필요합니다. 여러분의 회사에도 적용 가능한 단계적 도입 전략을 제시하겠습니다. 다음 슬라이드에서는 기대 효과를 구체적으로 살펴보겠습니다.",
        chapterId: 3,
        layout: "content"
      },
      {
        id: 9,
        title: "기대 효과",
        content: ["**매출 증가**: 평균 15% 성장 기대", "**비용 절감**: 운영비용 20% 감소", "**효율성 향상**: 업무 시간 30% 단축", "**경쟁력 강화**: 시장 점유율 확대"],
        notes: "AI 도입을 통해 기대할 수 있는 효과들을 구체적으로 제시했습니다. 이러한 효과는 단순한 수치가 아니라 실제 중소기업들의 경험을 바탕으로 한 것입니다. 여러분의 회사에도 적용 가능한 구체적인 전략을 수립하시기 바랍니다. 질문이 있으시면 언제든 말씀해 주세요.",
        chapterId: 3,
        layout: "content"
      },
      {
        id: 10,
        title: "Q&A",
        content: ["AI 도입 초기 비용은 얼마나 드나요?", "기존 인력과의 충돌은 어떻게 조정하나요?", "성과 측정은 어떤 지표로 하나요?"],
        notes: "이제 질문 시간입니다. AI 도입에 대해 궁금한 점이 있으시면 언제든 말씀해 주세요. 특히 초기 비용이나 인력 관리에 대한 질문이 많으실 것 같습니다.",
        chapterId: 4,
        layout: "content"
      }
    ],
    designSuggestions: [
      "제목 슬라이드: 연한 회색 배경에 파란색 제목, 중앙 정렬",
      "목차 슬라이드: 번호가 있는 bullet list, 줄 간격 1.4배 적용",
      "본문 슬라이드: 좌측 텍스트 + 우측 이미지/차트 레이아웃",
      "결론 슬라이드: 강조 색상 배경에 핵심 메시지 Bold 처리",
      "Q&A 슬라이드: 마이크 아이콘과 말풍선 이미지 추가"
    ],
    presentationTips: [
      "모든 bullet에 실제 수치와 회사명을 포함하여 신뢰성 확보",
      "각 슬라이드마다 1-2분 분량으로 발표 시간 관리",
      "Q&A 시간에는 예상 질문에 대한 구체적 답변 준비",
      "시각 자료(차트, 그래프)를 활용한 설명 강화",
      "청중과의 상호작용을 고려한 발표 노트 활용"
    ],
    estimatedDuration: `${duration}분`
  };
} 