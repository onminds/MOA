import OpenAI from 'openai';

// OpenAI 클라이언트를 싱글톤으로 관리
let openaiInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

// 개발 환경에서만 인스턴스 리셋 함수 제공
export function resetOpenAIClient(): void {
  if (process.env.NODE_ENV === 'development') {
    openaiInstance = null;
  }
} 