// OpenAI 모델 가격 정보 (1K 토큰당 USD)
export const MODEL_PRICING = {
  // GPT-5 (특별 모델)
  'gpt-5': {
    input: 0.015,  // $0.015 per 1K tokens
    output: 0.045  // $0.045 per 1K tokens
  },
  
  // GPT-4 시리즈 (비싼 모델)
  'gpt-4-turbo-preview': {
    input: 0.01,
    output: 0.03
  },
  'gpt-4': {
    input: 0.03,
    output: 0.06
  },
  
  // GPT-4o mini (저렴한 모델)
  'gpt-4o-mini': {
    input: 0.00015,  // $0.15 per 1M tokens
    output: 0.0006   // $0.60 per 1M tokens
  },
  
  // GPT-3.5 시리즈 (가장 저렴)
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015
  },
  'gpt-3.5-turbo-0125': {
    input: 0.0005,
    output: 0.0015
  }
};

// 기본 모델 설정
export const DEFAULT_MODELS = {
  primary: 'gpt-5',              // 메인 응답
  streaming: 'gpt-4o-mini',      // 스트리밍
  fallback: 'gpt-3.5-turbo-0125' // 폴백
};
