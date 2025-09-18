import OpenAI from "openai";
import { TopicType, ReportSource, ReportSection, ReportWriter, BuildReportInput } from "./types";
import { buildOutline, lengthRules } from "./templates";
import { originFrom } from "./utils";
import { validateDraft } from "./validator";

const OPENAI_MODEL = "gpt-5-mini"; // GPT-5-mini 사용
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export function classifyTopic(topic: string, domain?: string): TopicType {
  const t = topic.toLowerCase();
  
  // 도메인 우선 라우팅
  if (domain) {
    const d = domain.toLowerCase();
    if (/학술|academic|연구|실험|미생물|세균|배지|培地|culture medium/.test(d)) return "academic_summary";
    if (/기술|tech|개발|프로그래밍|소프트웨어/.test(d)) return "tech_review";
    if (/시장|market|경제|비즈니스|매출/.test(d)) return "market_research";
    if (/비교|comparison|제품|product/.test(d)) return "product_comparison";
    if (/뉴스|news|이슈|속보/.test(d)) return "news_brief";
    if (/가이드|guide|튜토리얼|tutorial/.test(d)) return "howto_guide";
  }
  
  // 키워드 기반 라우팅 (도메인이 없거나 매칭되지 않을 때)
  if (/시장|market|매출|점유율|growth|tam|sam|som/.test(t)) return "market_research";
  if (/기술|tech|spec|architecture|benchmark|성능|인공지능|ai|머신러닝|딥러닝|machine learning|deep learning|artificial intelligence|자연어처리|nlp|컴퓨터비전|computer vision|로봇|robot/.test(t)) return "tech_review";
  if (/논문|학술|paper|method|결과|실험|배지|세균|미생물|분석|검사|배양|실험실|연구|데이터|통계|培地|culture medium/.test(t)) return "academic_summary";
  if (/비교|vs|대안|which|best/.test(t)) return "product_comparison";
  if (/브리핑|이슈|속보|news|사건|사태|발표/.test(t)) return "news_brief";
  if (/가이드|방법|how to|튜토리얼|설치|세팅/.test(t)) return "howto_guide";
  return "general_review";
}

export async function fetchUrlMeta(url: string) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 ReportWriterBot" }, cache: "no-store" });
    const html = await res.text();
    const title = /<title[^>]*>([^<]+)<\/title>/i.exec(html)?.[1]?.trim() || url;
    const publisher = new URL(url).hostname.replace(/^www\./, "");
    const favicon = `${originFrom(url)}/favicon.ico`;
    return { title, publisher, favicon };
  } catch {
    return { title: url, publisher: new URL(url).hostname.replace(/^www\./, "") };
  }
}

export async function planSources(topic: string, seedUrls: string[] = []): Promise<ReportSource[]> {
  // MVP: use provided URLs as sources. You can replace with your crawler/search planner.
  const metas = await Promise.all(seedUrls.map(fetchUrlMeta));
  return metas.map((m, i) => ({ id: i + 1, title: m.title, url: seedUrls[i], publisher: m.publisher, favicon: m.favicon }));
}

// 섹션별 세세한 프롬프트 반환 함수
function getSectionPrompt(topicType: string, sectionId: string, topic: string): string {
  switch (topicType) {
    case 'market_research':
      switch (sectionId) {
        case 'overview':
          return `"${topic} 시장의 정의, 범위, 전체 규모와 주요 특징을 설명하라. (시장 정의 / 범위 / 특징) 실제 공개된 데이터만 사용하고 가상의 추정치나 사례는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'metrics':
          return `"최근 3~5년간 시장 규모, 성장률(CAGR), 주요 지표, 향후 예측을 설명하라. 실제 공개된 데이터만 사용하고 가상의 추정치나 사례는 금지하라. 데이터가 여러 개 제시될 경우 표나 선/막대 차트를 활용할 수 있다. 시계열 데이터가 있으면 <div class="line-chart">를 사용할 수 있다."`;
        case 'players':
          return `"주요 기업 3~5곳의 시장점유율·전략을 비교하라. 실제 기업명(쿠팡, 네이버, 삼성 등)을 사용하고 가상의 A사, B사는 금지하라. 내용을 정리할 필요가 있으면 <li> 태그를 사용하여 불릿 포인트로 작성할 수 있다. 수치 비교가 있을 경우 표나 막대 차트로 요약할 수 있다. <div class="bar-chart">를 사용할 수 있다."`;
        case 'cases':
          return `"최근 성공/실패 사례 2개를 제시하고, 실제 기업명과 검증 가능한 수치만 포함하라. 가상의 사례나 추정치는 금지하라. 사례 간 비교가 필요할 경우 표로 정리할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'risks':
          return `"시장 리스크와 규제 요인을 정리하라. (리스크 항목별로 구분) 실제 사례와 검증 가능한 정보만 사용하고 가상의 추정치는 금지하라. 구분이 많을 경우 간단한 표나 매트릭스로 표현할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'conclusion':
          return `"앞선 분석을 종합해 향후 전망과 시사점을 요약 박스로 제시하라. (기회 요인 / 주의사항 / 정책 제언) 실제 데이터 기반의 전망만 제시하고 가상의 예측은 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    case 'tech_review':
      switch (sectionId) {
        case 'intro':
          return `"${topic} 기술의 정의, 핵심 특징, 등장 배경을 설명하라. (정의 / 특징 / 배경) 실제 기술 정보만 사용하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'mechanism':
          return `"기술의 동작 원리와 주요 구성 요소를 단계별로 설명하라. (Step 1 → Step 2 → Step 3) 실제 기술 사양만 사용하고 가상의 추정치는 금지하라. 구조 비교가 필요하면 간단한 다이어그램 표로 표현할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'benchmarks':
          return `"주요 성능 지표를 제시하고 경쟁 기술과 비교하라. 실제 벤치마크 데이터만 사용하고 가상의 추정치는 금지하라. 수치가 많을 경우 표나 성능 비교 차트를 활용할 수 있다. <div class="bar-chart">를 사용할 수 있다."`;
        case 'usecases':
          return `"실제 활용 사례 2~3개를 설명하라. 실제 기업명과 검증 가능한 사례만 포함하고 가상의 사례는 금지하라. 데이터가 포함될 경우 표로 정리할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'risks':
          return `"기술적 제약, 보안 위험, 윤리적 문제를 3가지 카테고리별로 정리하라. (제약 / 보안 / 윤리) 실제 사례와 검증 가능한 정보만 사용하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'conclusion':
          return `"향후 5년 내 예상되는 발전 방향과 응용 가능성을 제시하라. 실제 기술 트렌드 기반의 전망만 제시하고 가상의 예측은 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    case 'academic_summary':
      switch (sectionId) {
        case 'abstract':
          return `"연구 목적, 방법, 주요 결과, 의의를 설명하라. (목적 / 방법 / 결과 / 의의) 실제 연구 내용만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'background':
          return `"연구 배경과 필요성을 설명하라. (연구 필요성 / 기존 연구 한계 / 공백) 실제 연구 자료만 사용하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'methods':
          return `"연구 설계, 데이터 수집, 분석 방법을 번호 매기기로 설명하라. (1. 연구 설계 / 2. 데이터 / 3. 분석 방법) 실제 연구 방법만 포함하고 가상의 추정치는 금지하라. 복잡한 절차는 <table> 태그를 사용하여 표로 정리할 수 있다."`;
        case 'results':
          return `"주요 결과를 제시하라. 실제 연구 결과와 통계적 수치만 포함하고 가상의 추정치는 금지하라. 통계적 수치나 비교 데이터가 있으면 표나 그래프로 요약할 수 있다. <table> 태그나 <div class="bar-chart">를 사용할 수 있다."`;
        case 'discussion':
          return `"결과 해석, 기존 연구와의 비교, 한계점을 소제목 나눔으로 정리하라. (결과 해석 / 기존 연구 비교 / 한계점) 실제 연구 결과만 기반으로 논의하고 가상의 추정치는 금지하라. 비교 데이터가 있으면 <table> 태그를 사용하여 표로 정리할 수 있다."`;
        case 'conclusion':
          return `"연구의 학문적·실무적 의의를 설명하고 향후 활용 가능성을 제시하라. 실제 연구 결과 기반의 전망만 제시하고 가상의 예측은 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    case 'product_comparison':
      switch (sectionId) {
        case 'intro':
          return `"${topic} 제품군의 비교 목적과 범위를 설명하라. 실제 제품 정보만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'criteria':
          return `"비교 기준(성능, 가격 등)을 제시하라. (성능 / 가격 / 확장성 등) 실제 제품 사양만 사용하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있고, 필요하면 표로 정리할 수 있다."`;
        case 'table':
          return `"compareSpec.columns 기준으로 각 제품의 특성을 표로 정리하라. 실제 제품 정보만 포함하고 가상의 추정치는 금지하라. (📌 이 섹션은 표 필수) <table> 태그를 사용하라."`;
        case 'recommendations':
          return `"사용자 유형별 추천 제품과 이유를 시나리오별로 제시하라. (개인 / 기업 / 연구자) 실제 제품 성능 기반의 추천만 하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있고, 필요시 시나리오별 장단점을 표로 요약할 수 있다."`;
        case 'conclusion':
          return `"비교 결과를 종합해 최적 선택지를 요약 박스로 제시하라. (최종 권장안) 실제 제품 비교 결과만 기반으로 하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    case 'news_brief':
      switch (sectionId) {
        case 'summary':
          return `"뉴스의 핵심 사실과 내용을 요약하라. (핵심 사실 3줄) 실제 뉴스 내용만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'timeline':
          return `"사건의 시간적 흐름을 번호 매기기로 정리하라. 실제 사건과 날짜만 포함하고 가상의 추정치는 금지하라. 사건이 여러 개일 경우 타임라인 표나 차트로 정리할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'stakeholders':
          return `"주요 관계자와 이해관계를 설명하라. (인물 / 조직 / 그룹별) 실제 관계자와 검증 가능한 정보만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있고, 영향 범위가 복잡하면 표로 구분할 수 있다."`;
        case 'analysis':
          return `"사건의 배경, 원인, 의의를 분석하라. 실제 사건과 검증 가능한 정보만 기반으로 하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'outlook':
          return `"앞으로 예상되는 전개 방향을 시나리오별로 제시하라. (긍정 / 중립 / 부정) 실제 사건의 맥락과 검증 가능한 정보만 기반으로 하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    case 'howto_guide':
      switch (sectionId) {
        case 'intro':
          return `"이 가이드의 목표와 예상 성과를 설명하고 필요 조건을 명시하라. 실제 검증된 방법만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        case 'steps':
          return `"실행 절차를 단계별로 정리하라. 실제 검증된 절차만 포함하고 가상의 추정치는 금지하라. 절차가 복잡하면 플로우차트 형식으로 요약할 수 있도록 설명할 수 있다. <table> 태그를 사용할 수 있다."`;
        case 'tips':
          return `"효율성을 높이는 팁이나 모범 사례를 제시하라. 실제 검증된 팁만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있고, 필요하면 목록이나 간단한 표로 요약할 수 있다."`;
        case 'pitfalls':
          return `"자주 발생하는 실수와 예방 방법을 정리하라. (실수 유형 → 예방책) 실제 경험과 검증된 정보만 포함하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있고, 항목이 많으면 표 형식으로 구분할 수 있다."`;
        case 'conclusion':
          return `"핵심 요약을 요약 박스로 제시하고, 추가 자료나 도구를 안내하라. 실제 검증된 내용만 기반으로 하고 가상의 추정치는 금지하라. 내용을 정리할 필요가 있으면 <ul><li> 태그를 사용하여 불릿 포인트로 작성할 수 있다."`;
        default:
          return `"이 섹션의 내용을 적절하게 작성하라."`;
      }
    
    default:
      return `"이 섹션의 내용을 적절하게 작성하라."`;
  }
}

// 제목 중복 및 반복 패턴 제거 함수
function removeTitleDuplication(html: string, sectionTitle: string): string {
  // 섹션 제목에서 핵심 단어 추출 (숫자와 점 제거)
  const cleanTitle = sectionTitle.replace(/^\d+\.\s*/, '').trim();
  
  // HTML 시작 부분에서 제목 중복 제거
  let processedHtml = html;
  
  // 패턴 1: 제목이 단독으로 시작하는 경우
  const pattern1 = new RegExp(`^\\s*${cleanTitle}\\s*\\n?\\s*`, 'i');
  processedHtml = processedHtml.replace(pattern1, '');
  
  // 패턴 2: 제목 + 빈 줄 + 제목이 반복되는 경우
  const pattern2 = new RegExp(`^\\s*${cleanTitle}\\s*\\n+\\s*${cleanTitle}\\s*`, 'i');
  processedHtml = processedHtml.replace(pattern2, '');
  
  // 패턴 3: 제목 + <p>태그로 시작하는 경우
  const pattern3 = new RegExp(`^\\s*${cleanTitle}\\s*\\n?\\s*<p>`, 'i');
  processedHtml = processedHtml.replace(pattern3, '<p>');
  
  // 패턴 4: 반복되는 "이 섹션에서는..." 패턴 제거
  const pattern4 = /^<p>이 섹션에서는[^<]*<\/p>\s*/i;
  processedHtml = processedHtml.replace(pattern4, '');
  
  // 패턴 5: 반복되는 "이 섹션에서는..." 패턴 제거 (p 태그 없이)
  const pattern5 = /^이 섹션에서는[^<]*\n\s*/i;
  processedHtml = processedHtml.replace(pattern5, '');
  
  return processedHtml;
}

export async function writeSectionHTML({
  topic,
  sectionId,
  sectionTitle,
  sources,
  domain,
  denyList,
  compareSpec,
  topicType,
  attachmentsText,
}: {
  topic: string;
  sectionId: string;
  sectionTitle: string;
  sources: ReportSource[];
  domain?: string;
  denyList?: string[];
  compareSpec?: { columns: string[] };
  topicType?: string;
  attachmentsText?: string;
}): Promise<{ html: string; citations: number[] }> {
  const rules = lengthRules();
  const sourcesList = sources.map((s, i) => `${i + 1}. ${s.title} (${s.url})`).join("\n");
  const attachmentsSnippet = (attachmentsText || '').slice(0, 12000);

  const guardrailBlock = `
  [핵심 규칙]
  - 한국어로만 작성, 영어 사용 금지
  - HTML fragment만 출력 (<html> <body> 금지)
  - 가상 기업명(A사, B사) 사용 금지, 실제 기업명만 사용
  - sources가 비어있어도 즉시 작성 시작
  - 금지어(denyList) 사용시 대체 표현 사용
  - sources가 비어있으면 인용 표시 [1], [2] 등 절대 사용 금지
  
  [시각화]
  - 필요시에만 표/차트 생성 (강제 금지)
  - 표: <table> 태그 사용
  - 막대차트: <div class="bar-chart"> 사용
  - 선차트: <div class="line-chart"> 사용
  `;

  const sys = `${guardrailBlock}
  너는 출처 기반 레포트 작성 도우미다.
  
  [절대 금지]
  - 사용자에게 확인 요청 ("출처 확인 필요", "~해도 될지 확인" 등)
  - 가상 기업명 (A사, B사, X기업 등)
  - 가상 수치나 추정치, 구체적 수치
  - 섹션 제목으로 내용 시작
  - "통계청 자료", "공식 보고서", "공개 데이터" 등 출처가 없는데 출처가 있는 것처럼 표현
  - "실제 수치로 채워서 사용", "공식 통계로 대체" 등 가이드라인성 표현
  
  [필수 사항]
  - 한국어로만 작성
  - HTML fragment만 출력
  - 인용: sources가 있을 때만 <sup>[n]</sup> 형식 사용
  - sources가 비어있으면 인용 표시 절대 금지
  - sources가 비어있어도 즉시 작성 시작
  - 바로 본론부터 자연스럽게 시작
  - 내용에 따라 적절한 길이로 작성
  - sources가 비어있으면 일반적인 지식으로만 작성, 추정치나 구체적 수치 사용 금지
  - 구체적인 기관명이나 출처 언급 금지
  - 섹션 번호 사용 금지 (번호 없이 제목만 사용)
  `;

  const user = `
  주제: ${topic}
  ${domain ? `도메인: ${domain}` : ''}
  섹션: ${sectionTitle}
  ${denyList?.length ? `금지어: ${denyList.join(', ')}` : ''}
  ${compareSpec ? `비교 표 열: ${compareSpec.columns.join(', ')}` : ''}
  
  sources:\n${sourcesList}
  ${sourcesList.length === 0 ? '\n⚠️ sources가 비어있으므로 다음을 절대 사용하지 마라: 인용 표시 [1], [2] 등, "통계청 자료", "공식 보고서", "공개 데이터" 등 출처 언급, "실제 수치로 채워서 사용" 같은 가이드라인, 구체적인 기관명이나 출처, 추정치나 구체적 수치. 일반적인 지식으로만 작성하라.' : ''}
  ${attachmentsSnippet ? `\n[참고자료]\n${attachmentsSnippet}\n` : ''}
  
  작성 요구사항:
  ${getSectionPrompt(topicType || 'general', sectionId, topic)}
  
  위 섹션의 내용을 HTML로 작성하라.
  
  [중요] 섹션 번호 사용 금지
  
  번호 없이 제목만 사용하라.
  `;

  const response = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    reasoning: { effort: "medium" },
  });

  let html = response.output_text || "";

  // 제목 중복 제거 후처리
  html = removeTitleDuplication(html, sectionTitle);

  // 후처리 검증
  const validation = validateDraft(html, { denyList });
  if (validation.flags.denied.length > 0 || validation.flags.missing.length > 0) {
    const retrySys = `${sys}
    [재시도 지침]
    - 금지어 ${validation.flags.denied.join(', ')}를 절대 사용하지 마라.
    - 대신 동의어나 다른 표현을 사용하라.
    - 자연스럽게 대체 서술하라.`;

    const retryResponse = await client.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: retrySys },
        { role: "user", content: user },
      ],
      reasoning: { effort: "medium" },
    });

    const retryHtml = retryResponse.output_text || "";
    const retryValidation = validateDraft(retryHtml, { denyList });

    if (retryValidation.flags.denied.length > 0) {
      html = `<p><em>경고: 금지어 ${retryValidation.flags.denied.join(', ')}가 포함되어 대체 서술로 작성되었습니다.</em></p>\n${retryHtml}`;
    } else {
      html = retryHtml;
    }
  }

  // 인용 추출
  const citations = Array.from(new Set(Array.from(html.matchAll(/\[(\d+)\]/g)).map((m) => Number(m[1])))).filter(
    (n) => n >= 1 && n <= sources.length
  );

  return { html, citations };
}

export async function makeTitle(topic: string, sources: ReportSource[]) {
  const resp = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: "간결하고 명확한 한국어 보고서 제목 한 줄만 출력" },
      { role: "user", content: `토픽: ${topic}\n출처 수:${sources.length}` },
    ],
    reasoning: {
      effort: "low" // 제목 생성은 최소한의 추론으로 충분
    }
  });
  return resp.output_text?.trim() || topic;
}

export async function makeTLDR(sections: ReportSection[]) {
  const text = sections.map((s) => s.html.replace(/<[^>]+>/g, " ")).join("\n");
  const resp = await client.responses.create({
    model: OPENAI_MODEL,
    input: [
      { 
        role: "system", 
        content: `당신은 보고서 요약 전문가입니다. 
        
[📋 요약 작성 규칙]
- 전체 보고서의 핵심 내용만을 3-5문장으로 간결하게 요약
- 각 섹션의 주요 포인트를 종합하여 전체적인 맥락 제시
- 구체적인 수치나 세부사항은 제외하고 핵심 메시지만 포함
- "TL;DR", "요약", "핵심" 등의 제목이나 구조화된 형식 금지
- 순수한 요약 텍스트만 작성 (불릿 포인트, 번호 매기기 등 금지)
- 한국어로만 작성, 영어 사용 금지

[✅ 요약 예시]
"한국 전자상거래 시장은 모바일 중심의 성장세를 보이며, 주요 플랫폼들의 경쟁이 심화되고 있다. 물류 및 결제 인프라의 고도화와 오므니채널 통합이 핵심 트렌드로 부상하고 있으며, 개인화 추천과 라이브 커머스 등 새로운 서비스가 확산되고 있다. 중소기업 지원과 공정거래 규제가 중요한 정책 이슈로 대두되고 있다."

[🚫 금지사항]
- 구조화된 형식 (TL;DR, 핵심 포인트, 번호 매기기 등)
- 각 섹션별 세부 분석
- 구체적인 수치나 사례 나열
- 이모지나 특수 기호 사용
- 영어 단어나 약어 사용` 
      },
      { role: "user", content: `다음 보고서 내용을 위 규칙에 따라 요약해주세요:\n\n${text.slice(0, 8000)}` },
    ],
    reasoning: {
      effort: "medium" // 요약은 중간 수준의 추론 필요
    }
  });
  return resp.output_text?.trim() || "요약 없음";
}

export async function buildReport(input: BuildReportInput): Promise<ReportWriter> {
  const { topic, seedUrls = [], domain, denyList, compareColumns } = input;
  
  // 1. 주제 분류
  const topicType = classifyTopic(topic, domain);
  
  // 2. 목차 생성
  const toc = buildOutline(topicType, topic);
  
  // 3. 길이 규칙
  const rules = lengthRules();
  
  // 4. 크롤링 (임시 비활성화)
  const sources: ReportSource[] = [];
  
  // 5. 섹션별 생성
  const sections: ReportSection[] = [];
  let hasDeniedTerms = false;
  
  for (const item of toc) {
    const { html, citations } = await writeSectionHTML({
      topic,
      sectionId: item.id,
      sectionTitle: item.title,
      sources,
      domain,
      denyList,
      compareSpec: compareColumns ? { columns: compareColumns } : undefined,
      topicType, // ✅ topicType 추가
    });
    
    // 금지어 경고 확인
    if (html.includes('경고: 금지어')) {
      hasDeniedTerms = true;
    }
    
    sections.push({ id: item.id, title: item.title, html, citations });
  }
  
  // 6. 제목과 요약 생성
  const title = await makeTitle(topic, sources);
  let summary = await makeTLDR(sections);
  
  // 금지어 경고가 있으면 요약에 추가
  if (hasDeniedTerms) {
    summary = `<p><em>주의: 일부 금지어가 포함되어 대체 서술로 작성되었습니다.</em></p>\n${summary}`;
  }
  
  return {
    id: `sp_${Date.now()}`,
    title,
    summary,
    toc,
    sections,
    sources,
    meta: {
      sourceCount: sources.length,
      createdAt: new Date().toISOString(),
      model: "gpt-5-mini",
    },
  };
}
