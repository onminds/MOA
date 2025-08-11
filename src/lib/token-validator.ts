import { getOpenAIClient } from './openai';

// 정확한 토큰 계산을 위한 인터페이스
interface TokenValidationResult {
  isValid: boolean;
  estimatedTokens: number;
  maxAllowedTokens: number;
  error?: string;
}

// GPT 모델별 토큰 제한
const MODEL_LIMITS = {
  'gpt-4': 8192,
  'gpt-4-turbo': 128000,
  'gpt-3.5-turbo': 4096,
  'gpt-3.5-turbo-16k': 16384,
} as const;

// 안전 마진 (토큰 제한의 80%까지만 사용)
const SAFETY_MARGIN = 0.8;

/**
 * 정확한 토큰 수를 계산합니다.
 * OpenAI의 tiktoken 라이브러리와 유사한 방식으로 계산
 */
export function calculateTokens(text: string): number {
  if (!text) return 0;
  
  // 한국어: 대략 1글자 = 1토큰
  const koreanChars = (text.match(/[가-힣]/g) || []).length;
  
  // 영어: 단어 단위로 계산 (평균 1.3토큰/단어)
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  const englishTokens = englishWords.reduce((total, word) => {
    return total + Math.ceil(word.length * 0.3 + 1); // 단어당 평균 1.3토큰
  }, 0);
  
  // 숫자와 특수문자: 1:1 비율
  const otherChars = text.length - koreanChars - englishWords.join('').length;
  
  // 공백과 구두점: 0.5토큰으로 계산
  const spacesAndPunctuation = (text.match(/[\s\p{P}]/gu) || []).length * 0.5;
  
  return Math.ceil(koreanChars + englishTokens + otherChars + spacesAndPunctuation);
}

/**
 * 토큰 제한을 검증합니다.
 */
export function validateTokenLimit(
  systemPrompt: string,
  userPrompt: string,
  model: keyof typeof MODEL_LIMITS = 'gpt-4'
): TokenValidationResult {
  const systemTokens = calculateTokens(systemPrompt);
  const userTokens = calculateTokens(userPrompt);
  const totalTokens = systemTokens + userTokens;
  
  const maxTokens = MODEL_LIMITS[model];
  const safeLimit = Math.floor(maxTokens * SAFETY_MARGIN);
  
  return {
    isValid: totalTokens <= safeLimit,
    estimatedTokens: totalTokens,
    maxAllowedTokens: safeLimit,
    error: totalTokens > safeLimit 
      ? `토큰 수 초과: ${totalTokens}/${safeLimit} (${model} 모델 제한: ${maxTokens})`
      : undefined
  };
}

/**
 * 응답 토큰 제한을 계산합니다.
 */
export function calculateResponseTokenLimit(
  systemTokens: number,
  userTokens: number,
  model: keyof typeof MODEL_LIMITS = 'gpt-4'
): number {
  const maxTokens = MODEL_LIMITS[model];
  const usedTokens = systemTokens + userTokens;
  const availableTokens = Math.floor(maxTokens * SAFETY_MARGIN) - usedTokens;
  
  // 최소 100토큰, 최대 4000토큰으로 제한
  return Math.max(100, Math.min(4000, availableTokens));
}

/**
 * 비용 예측을 위한 토큰 계산
 */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: keyof typeof MODEL_LIMITS = 'gpt-4'
): number {
  const rates = {
    'gpt-4': { input: 0.03, output: 0.06 }, // $0.03 per 1K input, $0.06 per 1K output
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 },
  };
  
  const rate = rates[model];
  const inputCost = (inputTokens / 1000) * rate.input;
  const outputCost = (outputTokens / 1000) * rate.output;
  
  return inputCost + outputCost;
} 