import { TopicType, TocItem } from "./types";

export function buildOutline(
  topicType: TopicType,
  topic: string
): TocItem[] {
  const common: TocItem[] = [
    { id: "intro", title: "주제 개요" },
    { id: "overview", title: "전반적 특징" },
    { id: "trends", title: "일반적 동향" },
    { id: "considerations", title: "고려사항" },
    { id: "conclusion", title: "전망·결론" },
  ];

  switch (topicType) {
    case "market_research":
      return [
        { id: "overview", title: `${topic} 개요` },
        { id: "trends", title: "시장 동향·트렌드" },
        { id: "landscape", title: "시장 구조·특징" },
        { id: "patterns", title: "일반적 패턴·경향" },
        { id: "risks", title: "리스크·규제 요인" },
        { id: "conclusion", title: "전망·시사점" },
      ];
    case "tech_review":
      return [
        { id: "intro", title: `${topic} 기술 개요` },
        { id: "mechanism", title: "동작 원리·구성 요소" },
        { id: "characteristics", title: "기술적 특징·장단점" },
        { id: "usecases", title: "활용 사례" },
        { id: "risks", title: "제약·보안·윤리 이슈" },
        { id: "conclusion", title: "향후 발전 전망" },
      ];
    case "academic_summary":
      return [
        { id: "abstract", title: "초록" },
        { id: "background", title: "연구 배경" },
        { id: "methods", title: "방법" },
        { id: "results", title: "결과" },
        { id: "discussion", title: "논의" },
        { id: "conclusion", title: "의의·활용 가능성" },
      ];
    case "product_comparison":
      return [
        { id: "intro", title: `${topic} 비교 개요` },
        { id: "criteria", title: "비교 기준·평가 지표" },
        { id: "analysis", title: "비교 분석" },
        { id: "recommendations", title: "적합 시나리오·추천 대상" },
        { id: "conclusion", title: "결론" },
      ];
    case "news_brief":
      return [
        { id: "summary", title: "요약" },
        { id: "timeline", title: "타임라인" },
        { id: "context", title: "배경·맥락" },
        { id: "analysis", title: "분석" },
        { id: "outlook", title: "전망" },
      ];
    case "howto_guide":
      return [
        { id: "intro", title: `목표: ${topic}` },
        { id: "steps", title: "단계별 절차" },
        { id: "tips", title: "모범 사례·팁" },
        { id: "pitfalls", title: "주의사항·실수 방지" },
        { id: "conclusion", title: "마무리·추가 참고" },
      ];
    default:
      return common;
  }
}

export function lengthRules() {
  return {
    paragraphsPerSection: "적절한 길이로", // 고정 문단 수 제거
    sentencesPerParagraph: "자연스럽게",  // 고정 문장 수 제거
    bulletsPerList: "필요한 만큼",        // 고정 불릿 수 제거
    requireOneTable: false,              // AI가 판단에 따라 선택적으로 표 생성
  };
}
