// AI 모델 및 프롬프트/길이 규칙을 중앙관리하는 설정

export const AI_MODEL = 'gpt-5-mini';

// Responses API 추론 노력 설정: 'low' | 'medium' | 'high'
export const REASONING_EFFORT = 'low';

// 글자 수 규칙
export const WORD_RULE = {
  defaultWordLimit: 600,
  minOffset: 100, // 최소 = 제한 - minOffset
  minLowerBound: 200, // 절대 최소 하한
  noLimitMin: 400, // 제한이 없을 때 최소 하한(표시는 하지 않음)
};

// 자동 보완/확장 규칙
export const SUPPLEMENT_RULE = {
  addChars: 200, // 현재 글자수 대비 추가 목표
  maxChars: 500, // 한 문항 최대 목표 글자수
};

// 하이퍼파라미터 기본값
export const HYPERPARAMS = {
  temperatureMain: 0.3,
  temperatureSupplement: 0.4,
};

// 답변 간 다양성/중복 억제 규칙
export const DIVERSITY_RULE = {
  similarityThreshold: 0.72, // 이 이상이면 유사하다고 판단하여 재작성
  maxDiversifyAttempts: 2,   // 문항별 재다양화 최대 시도 수
  // 아주 간단한 한국어 불용어 목록 (토크나이저 없이도 대략적 필터링)
  stopwords: [
    '저는','그리고','또한','하며','통해','하여','대한','있는','있습니다','했습니다','합니다','했다','한다','등','및','으로','에서','에게','에게서','부터','까지','으로써','와','과','은','는','이','가','을','를','의'
  ],
};


