import { getTimeSplit } from './timeUtils';
import { summarizeText } from './summarizeText';

interface PromptParams {
  title: string;
  audience: string;
  purpose: string;
  duration: number;
  keyPoints: string[];
  referenceText: string;
  structureLines?: string[];
  tone?: string;
}

export function buildPrompt({
  title,
  audience,
  purpose,
  duration,
  keyPoints,
  referenceText,
  structureLines,
  tone
}: PromptParams): string {
  const timeSplit = getTimeSplit(duration);
  
  // 동적 문구 매개변수화
  const emphasisOnBody = `본론은 전체 ${duration}분 중 가장 많은 시간을 차지하므로`;
  const conceptDetail = `각 개념당 최소 2-3문장으로 상세히 설명`;
  const bodyTimeDetail = timeSplit.body;
  const introTimeDetail = timeSplit.intro;
  const conclusionTimeDetail = timeSplit.conclusion;

  // 참조 텍스트 최적화 (200자로 제한)
  const optimizedReferenceText = referenceText.length > 200 
    ? referenceText.substring(0, 200) + '...'
    : referenceText;

  // ① PDF를 주 소스로 쓰라는 강력한 안내문
  const primarySourceNotice = referenceText
    ? `❗ **첨부된 PDF 내용을 최우선 정보로 사용**하고, 제목("${title}")은 보조용으로만 참고해 주세요.\n`
    : '';

  // ② 기존 referenceSection은 그대로 두되, 상단에 배치
  const referenceSection = referenceText
    ? `${primarySourceNotice}아래는 PDF 요약입니다:\n${optimizedReferenceText}\n`
    : '';

  // ③ 나머지 템플릿 구성
  const toneLine = tone ? `발표 톤: ${tone}` : '';
  const structureSection = structureLines?.length
    ? `📚 문서 구조:\n${structureLines.join('\n')}\n`
    : '';

  return `
❗ **첨부자료의 모든 텍스트, 제목, 숫자, 정의, 용어를 정확히 인용**하여 작성해주세요.

### 도입부 (${introTimeDetail})
[2~3문장 작성]
1. 청중의 관심을 끌 질문 또는 사례  
2. 발표 주제와 목적 소개  
3. 오늘 얻을 수 있는 기대 효과 제시

*예시:*  
> "여러분, [참고자료 제목]을 통해 오늘 '${title}'의 핵심을 살펴보겠습니다."

### 본론 (${bodyTimeDetail})
[다음 가이드에 맞춰 **매 개념당 최소 3~4문장**, **연속 흐름**으로 작성]

1. **핵심 개념 정확한 인용**  
   - 참고자료의 정의·단계·분류·특징·숫자를 **오탈자 없이** 정확히 인용  
   - 각 개념의 배경과 중요성 설명
   - 예시: 실제 사례 또는 데이터 활용  
   - 개념 간의 연결성과 상호작용 설명

2. **강조 키워드 심화 분석**  
   ${keyPoints.length > 0 
     ? keyPoints.map(p => `- "${p}": 정의, 특징, 실제 적용 사례, 장단점 등을 상세히 설명`).join('\n   ') 
     : '- 없음'}  

3. **실무 적용 및 사례 연구**  
   - 각 개념의 실제 비즈니스 환경에서의 적용 방법
   - 성공 사례와 실패 사례 비교 분석
   - 산업별, 규모별 적용 차이점 설명

4. **심화 정보 및 트렌드**  
   - 응용·장단점·실제 적용 방법 등 심화 정보 포함  
   - 최신 트렌드와 기술 발전 방향
   - 미래 전망과 발전 가능성

5. **분량 조절 및 상세도**  
   - 전체 ${duration}분 중 가장 많은 시간을 차지하므로, 매우 상세하고 풍부하게 설명  
   - 각 섹션당 최소 2-3개 문단으로 구성
   - 구체적인 데이터, 통계, 사례를 충분히 포함

### 결론 (${conclusionTimeDetail})
[2~3문장 작성]
1. 오늘 다룬 핵심 요약  
2. 강조 메시지("핵심은 … 입니다")  
3. 향후 전망 또는 제언  
4. 감사 인사

발표 대상은 ${audience}이고, 발표 시간은 ${duration}분, 발표 목적은 ${purpose}야.

${referenceSection}

${structureSection}

**작성 시 유의사항**  
- 참고자료에 등장하는 전문 용어·숫자·단계 등 **정확히** 반영  
- 소주제 분할 없이 **자연스럽고 연속적인** 본문 흐름 유지  
- 각 섹션 사이에 **한 줄 공백** 삽입(가독성 확보)  
- 발표자가 읽는 것처럼 **대화형·자연스러운** 문체 사용  
- **모든 인용**(정의·숫자·표현)은 참고자료 원문과 **100% 일치**  
${toneLine}

---

위 가이드라인을 **정확하게** 따르는 고품질 발표 대본을 작성해주세요.
`.trim();
} 