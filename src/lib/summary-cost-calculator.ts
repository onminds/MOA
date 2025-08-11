import { calculateTokens, estimateCost } from './token-validator';

/**
 * AI 요약 비용 계산 함수
 */
export function calculateSummaryCost(
  inputText: string,
  model: string = 'gpt-4',
  maxOutputTokens: number = 2000
): number {
  // 입력 토큰 계산
  const inputTokens = calculateTokens(inputText);
  
  // 출력 토큰은 예상치 (실제로는 응답 길이에 따라 달라짐)
  const outputTokens = Math.min(maxOutputTokens, inputTokens * 0.3); // 입력의 30% 정도로 예상
  
  // 비용 계산
  const cost = estimateCost(inputTokens, outputTokens, model as any);
  
  // 원화로 변환 (1달러 = 약 1300원)
  const costInKRW = cost * 1300;
  
  return costInKRW;
}

/**
 * 비용이 비싼지 확인 (100원 이상)
 */
export function isExpensiveSummary(
  inputText: string, 
  model: string = 'gpt-4', 
  maxOutputTokens: number = 2000
): boolean {
  const cost = calculateSummaryCost(inputText, model, maxOutputTokens);
  return cost >= 100; // 50원 → 100원으로 변경
}

/**
 * 비용 정보 반환
 */
export function getSummaryCostInfo(
  inputText: string,
  model: string = 'gpt-4',
  maxOutputTokens: number = 2000
): {
  cost: number;
  isExpensive: boolean;
  inputTokens: number;
  estimatedOutputTokens: number;
  model: string;
} {
  const inputTokens = calculateTokens(inputText);
  const outputTokens = Math.min(maxOutputTokens, inputTokens * 0.3);
  const cost = calculateSummaryCost(inputText, model, maxOutputTokens);
  
  return {
    cost,
    isExpensive: cost >= 50,
    inputTokens,
    estimatedOutputTokens: outputTokens,
    model
  };
} 