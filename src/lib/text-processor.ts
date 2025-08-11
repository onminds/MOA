import OpenAI from 'openai';
import { getSummaryCostInfo } from './summary-cost-calculator';
import { summarizeWithPuppeteer } from './puppeteer-summarizer';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 텍스트 압축 함수
export function compressText(text: string, maxLength: number = 8000): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  console.log(`📝 텍스트 압축 시작: ${text.length} → ${maxLength} 문자`);
  
  // 문장 단위로 분할
  const sentences = text.split(/[.!?]/).filter(sentence => sentence.trim().length > 0);
  
  // 압축된 텍스트 구성
  let compressedText = '';
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentLength + trimmedSentence.length + 1 <= maxLength) {
      compressedText += (compressedText ? '. ' : '') + trimmedSentence;
      currentLength += trimmedSentence.length + 1;
    } else {
      break;
    }
  }
  
  console.log(`✅ 텍스트 압축 완료: ${compressedText.length} 문자`);
  return compressedText;
}

// 더 지능적인 텍스트 압축 함수
export function smartCompressText(text: string, maxTokens: number = 12000): string {
  // 대략적인 토큰 계산 (1 토큰 ≈ 4 문자)
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  console.log(`🧠 지능적 텍스트 압축 시작: ${text.length} → ${maxChars} 문자`);
  
  // 문장 단위로 분할
  const sentences = text.split(/[.!?]/).filter(sentence => sentence.trim().length > 0);
  
  // 압축된 텍스트 구성
  let compressedText = '';
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentLength + trimmedSentence.length + 1 <= maxChars) {
      compressedText += (compressedText ? '. ' : '') + trimmedSentence;
      currentLength += trimmedSentence.length + 1;
    } else {
      break;
    }
  }
  
  console.log(`✅ 지능적 텍스트 압축 완료: ${compressedText.length} 문자`);
  return compressedText;
}

// 극한 압축 함수 (새로 추가)
export function extremeCompressText(text: string, maxTokens: number = 1000): string {
  // 대략적인 토큰 계산 (1 토큰 ≈ 4 문자)
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return text;
  }
  
  console.log(`🔥 극한 텍스트 압축 시작: ${text.length} → ${maxChars} 문자`);
  
  // 문장 단위로 분할
  const sentences = text.split(/[.!?]/).filter(sentence => sentence.trim().length > 0);
  
  // 극한 압축: 짧은 문장들만 선택 (200자 → 300자로 늘림)
  const shortSentences = sentences.filter(sentence => sentence.trim().length < 300);
  
  // 압축된 텍스트 구성
  let compressedText = '';
  let currentLength = 0;
  
  for (const sentence of shortSentences) {
    const trimmedSentence = sentence.trim();
    if (currentLength + trimmedSentence.length + 1 <= maxChars) {
      compressedText += (compressedText ? '. ' : '') + trimmedSentence;
      currentLength += trimmedSentence.length + 1;
    } else {
      break;
    }
  }
  
  // 만약 짧은 문장이 없으면 강제로 앞부분만 사용
  if (compressedText.length === 0) {
    compressedText = text.substring(0, maxChars);
  }
  
  // 최소 길이 보장 (최소 1500자)
  if (compressedText.length < 1500 && text.length > 1500) {
    compressedText = text.substring(0, Math.max(1500, maxChars));
  }
  
  console.log(`✅ 극한 텍스트 압축 완료: ${compressedText.length} 문자`);
  return compressedText;
}

// 텍스트 분할 함수
export function splitTextForSummary(text: string, maxTokens: number = 12000): string[] {
  // 대략적인 토큰 계산 (1 토큰 ≈ 4 문자)
  const maxChars = maxTokens * 4;
  
  if (text.length <= maxChars) {
    return [text];
  }
  
  console.log(`📝 텍스트 분할 시작: ${text.length} 문자 → ${maxTokens} 토큰`);
  
  const parts: string[] = [];
  const sentences = text.split(/[.!?]/).filter(sentence => sentence.trim().length > 0);
  
  let currentPart = '';
  let currentLength = 0;
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentLength + trimmedSentence.length + 1 <= maxChars) {
      currentPart += (currentPart ? '. ' : '') + trimmedSentence;
      currentLength += trimmedSentence.length + 1;
    } else {
      if (currentPart) {
        parts.push(currentPart);
      }
      currentPart = trimmedSentence;
      currentLength = trimmedSentence.length;
    }
  }
  
  if (currentPart) {
    parts.push(currentPart);
  }
  
  console.log(`✅ 텍스트 분할 완료: ${parts.length}개 부분`);
  return parts;
}

// 요약 생성 함수
export async function generateSummary(content: string, type: string): Promise<string> {
  try {
    // YouTube STT 결과 검증
    if (type === 'youtube') {
      const filteredContent = filterWhisperResult(content);
      
      // 의미 있는 단어 수 확인
      const meaningfulWords = filteredContent.match(/[가-힣a-zA-Z0-9]{2,}/g);
      if (!meaningfulWords || meaningfulWords.length < 10) {
        console.log('❌ Whisper STT 결과에 의미 있는 단어가 부족합니다.');
        return '음성 인식 결과가 부족합니다. 더 명확한 음성이나 자막이 있는 영상을 사용해주세요.';
      }
      
      if (filteredContent.length < 200) {
        console.log('❌ Whisper STT 결과가 너무 짧거나 의미가 없습니다.');
        return 'YouTube 영상의 음성을 텍스트로 변환할 수 없었습니다. 자막이 있는 영상이나 더 명확한 음성의 영상을 사용해주세요.';
      }
      
      content = filteredContent;
    }

    // 비용 계산 (GPT-3.5-turbo 사용)
    const costInfo = getSummaryCostInfo(content, 'gpt-3.5-turbo', 2000);
    console.log('💰 요약 비용 정보:', {
      cost: costInfo.cost.toFixed(2) + '원',
      isExpensive: costInfo.isExpensive,
      inputTokens: costInfo.inputTokens,
      estimatedOutputTokens: costInfo.estimatedOutputTokens,
      contentLength: content.length
    });

    // 요약은 비용 제한 없이 OpenAI 사용
    console.log('🤖 OpenAI 사용:', costInfo.cost.toFixed(2) + '원');
    
    // 파일 크기 체크 (50KB = 51,200 bytes)
    const isLargeFile = content.length > 51200;
    
    // 입력 내용이 너무 길면 압축
    let processedContent = content;
    
    // 대략적인 토큰 수 계산 (1 토큰 ≈ 4 문자)
    const estimatedTokens = content.length / 4;
    
    // 모델 선택: GPT-3.5-turbo 사용 (비용 절약)
    const model = "gpt-3.5-turbo";
    
    console.log(`📊 입력 내용 분석: ${content.length} 문자, ${estimatedTokens.toFixed(0)} 토큰`);
    
    // 토큰 수가 너무 많으면 압축
    if (estimatedTokens > 12000) {
      console.log(`📝 입력 내용이 너무 깁니다. ${estimatedTokens.toFixed(0)} 토큰 → 극한 압축 처리`);
      processedContent = extremeCompressText(content, 3000); // 1000 → 3000으로 증가
      console.log(`🔥 극한 텍스트 압축 시작: ${content.length} → ${processedContent.length} 문자`);
      console.log(`✅ 극한 텍스트 압축 완료: ${processedContent.length} 문자`);
      }
      
      console.log(`📝 최종 처리된 내용 길이: ${processedContent.length} 문자`);
    console.log(`모델 선택: ${model} (파일 크기: ${content.length} bytes, 50KB 이상: ${isLargeFile})`);

    // YouTube 타입의 경우 더 간단한 프롬프트 사용
    let prompt = '';
    if (type === 'youtube') {
      prompt = `다음 YouTube 영상의 내용을 분석하여 마크다운 형식으로 요약해주세요:

## 주요 내용 요약
핵심 포인트와 주요 메시지를 정리하여 3-4문단으로 작성해주세요. 영상의 전체적인 맥락과 목적을 명확히 설명해주세요.

## 상세 분석
내용의 배경, 주요 개념, 의미를 4-5문단으로 분석해주세요. 각 섹션별로 깊이 있는 분석을 제공하고, 중요한 세부사항들을 포함해주세요.

## 핵심 포인트 정리
가장 중요한 8-10개의 핵심 포인트를 정리해주세요. 각 포인트는 구체적이고 명확하게 작성해주세요.

- **첫 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **두 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **세 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **네 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **다섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **일곱 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여덟 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **아홉 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **열 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안

## 실무 적용 방안
실제 업무나 학습에 적용할 수 있는 방안을 2-3문단으로 제시해주세요. 구체적인 활용 방법과 예시를 포함해주세요.

## 전체적인 평가
내용의 가치와 인사이트를 2-3문단으로 평가해주세요. 미래의 발전 방향이나 개선점도 포함해주세요.

---
**요약은 최소 1500자 이상으로 작성하고, 이해하기 쉽고 체계적으로 구성해주세요.**`;
      
      console.log('📝 YouTube 프롬프트 생성 완료:', prompt.length, '문자');
      console.log('📄 YouTube 프롬프트 내용:');
      console.log('─'.repeat(50));
      console.log(prompt);
      console.log('─'.repeat(50));
    } else {
      // YouTube 타입이 아닌 경우에만 기술적 내용 필터링 적용
      const shouldFilterTechnical = type !== 'youtube';
      
      prompt = type === 'document' ? `다음 문서를 분석하여 마크다운 형식으로 요약해주세요:

## 주요 내용 요약
핵심 포인트와 주요 메시지를 정리하여 3-4문단으로 작성해주세요. 문서의 전체적인 맥락과 목적을 명확히 설명해주세요.

## 상세 분석
내용의 배경, 주요 개념, 의미를 4-5문단으로 분석해주세요. 각 섹션별로 깊이 있는 분석을 제공하고, 중요한 세부사항들을 포함해주세요.

## 핵심 포인트 정리
가장 중요한 8-10개의 핵심 포인트를 정리해주세요. 각 포인트는 구체적이고 명확하게 작성해주세요.

- **첫 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **두 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **세 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **네 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **다섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **일곱 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여덟 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **아홉 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **열 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안

## 실무 적용 방안
실제 업무나 학습에 적용할 수 있는 방안을 2-3문단으로 제시해주세요. 구체적인 활용 방법과 예시를 포함해주세요.

## 전체적인 평가
내용의 가치와 인사이트를 2-3문단으로 평가해주세요. 미래의 발전 방향이나 개선점도 포함해주세요.

---
**요약은 최소 1500자 이상으로 작성하고, 이해하기 쉽고 체계적으로 구성해주세요.**` :
            `다음 내용을 마크다운 형식으로 요약해주세요:
${shouldFilterTechnical ? `⚠️ 기술적 내용(Puppeteer, Selenium, automation 등)과 자막 관련 용어, UI 안내 메시지(음소거, 재생, 버튼, 메뉴 공유, 시청기록 등), 기능 설명은 모두 무시하고 순수한 영상 내용만 요약해주세요.` : ''}

## 주요 내용 요약
핵심 포인트와 주요 메시지를 정리하여 3-4문단으로 작성해주세요. 영상의 전체적인 맥락과 목적을 명확히 설명해주세요.

## 상세 분석
내용의 배경, 주요 개념, 의미를 4-5문단으로 분석해주세요. 각 섹션별로 깊이 있는 분석을 제공하고, 중요한 세부사항들을 포함해주세요.

## 핵심 포인트 정리
가장 중요한 8-10개의 핵심 포인트를 정리해주세요. 각 포인트는 구체적이고 명확하게 작성해주세요.

- **첫 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **두 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **세 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **네 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **다섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여섯 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **일곱 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **여덟 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **아홉 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안
- **열 번째 포인트**: 매우 상세한 설명과 중요성, 그리고 실제 적용 방안

## 실무 적용 방안
실제 업무나 학습에 적용할 수 있는 방안을 2-3문단으로 제시해주세요. 구체적인 활용 방법과 예시를 포함해주세요.

## 전체적인 평가
내용의 가치와 인사이트를 2-3문단으로 평가해주세요. 미래의 발전 방향이나 개선점도 포함해주세요.

---
**요약은 최소 1500자 이상으로 작성하고, 이해하기 쉽고 체계적으로 구성해주세요.**`;
    }

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `다음 내용을 위의 형식에 따라 요약해주세요:\n\n${processedContent}`
        }
      ],
      max_tokens: type === 'youtube' ? 4000 : (isLargeFile ? 4000 : 3000), // YouTube 타입은 4000 토큰으로 증가
      temperature: 0.7,
    });

    console.log('🤖 OpenAI API 호출 완료');
    console.log('📝 시스템 프롬프트 길이:', prompt.length, '문자');
    console.log('📝 사용자 메시지 길이:', processedContent.length, '문자');
    console.log('📝 max_tokens:', type === 'youtube' ? 4000 : (isLargeFile ? 4000 : 3000));

    const result = completion.choices[0]?.message?.content || '요약을 생성할 수 없습니다.';
    console.log(`✅ 요약 생성 완료: ${result.length} 문자`);
    console.log(`📄 요약 내용 샘플 (처음 200자):`);
    console.log(result.substring(0, 200));
    
    // 결과가 너무 짧으면 오류로 처리
    if (result.length < 100) { // 50 → 100으로 증가
      console.log(`❌ 요약이 너무 짧습니다: ${result.length} 문자`);
      console.log(`📄 전체 결과: ${result}`);
      
      // YouTube 타입인 경우 더 관대한 처리
      if (type === 'youtube' && result.length >= 50) { // 100 → 50으로 더 관대하게
        console.log(`📝 YouTube 타입이므로 짧은 요약도 허용`);
        return result;
      }
      
      // 요약이 실패한 경우 더 간단한 요약 시도
      console.log('📝 간단한 요약으로 재시도...');
      return await generateSimpleSummary(processedContent, type);
    }
    
    // 토큰 사용량 확인
    const promptTokens = completion.usage?.prompt_tokens || 0;
    const completionTokens = completion.usage?.completion_tokens || 0;
    const totalTokens = completion.usage?.total_tokens || 0;
    console.log(`📊 토큰 사용량: 프롬프트 ${promptTokens}, 완성 ${completionTokens}, 총 ${totalTokens}`);
    
    return result;
    
  } catch (error) {
    console.error('OpenAI 요약 생성 오류:', error);
    
    // 토큰 제한 오류인 경우 더 짧은 요약 시도
    if (error instanceof Error && error.message.includes('context length')) {
      console.log('토큰 제한 오류 발생. 더 짧은 요약으로 재시도...');
      return await generateShortSummary(content);
    }
    
    // 일반적인 오류인 경우 간단한 요약 시도
    console.log('📝 일반 오류 발생. 간단한 요약으로 재시도...');
    return await generateSimpleSummary(content, type);
  }
}

// Whisper STT 결과를 필터링하는 함수
function filterWhisperResult(content: string): string {
  let filtered = content;

  // 1. 의미 없는 문자들 제거
  filtered = filtered.replace(/[ㅋㅎㅇㅠㅜㅡㅣㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ]+/g, '');
  
  // 2. 연속된 같은 문자 제거 (더 강력하게)
  filtered = filtered.replace(/(.)\1{2,}/g, '$1'); // 3번 이상 반복되는 문자를 1개로
  
  // 3. 의미 없는 반복 패턴 제거 (예: "피규어 피규어 피규어")
  filtered = filtered.replace(/(\S+)(?:\s+\1){2,}/g, '$1');
  
  // 4. 연속된 특수문자 제거
  filtered = filtered.replace(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]+/g, ' ');
  
  // 5. 연속된 공백을 하나로
  filtered = filtered.replace(/\s+/g, ' ').trim();
  
  // 6. 추가 필터링: 연속된 같은 글자 패턴 제거
  filtered = filtered.replace(/([가-힣])\1{3,}/g, '$1'); // 한글 연속 제거
  filtered = filtered.replace(/([a-zA-Z])\1{3,}/g, '$1'); // 영문 연속 제거
  filtered = filtered.replace(/([0-9])\1{3,}/g, '$1'); // 숫자 연속 제거
  
  // 7. 의미 있는 단어가 포함되어 있는지 확인
  const meaningfulWords = filtered.match(/[가-힣a-zA-Z0-9]{2,}/g);
  if (!meaningfulWords || meaningfulWords.length < 5) {
    return content; // 의미 없는 경우 원본 반환
  }
  
  // 8. 최소 길이 확인
  if (filtered.length < 100) {
    return content; // 너무 짧은 경우 원본 반환
  }
  
  return filtered;
}

// 간단한 요약을 생성하는 함수
async function generateSimpleSummary(content: string, type: string): Promise<string> {
  try {
    const model = "gpt-3.5-turbo";
    
    let prompt = "주어진 내용을 간단하게 요약해주세요. 핵심 내용만 200자 이상으로 작성해주세요.";
    
    if (type === 'youtube') {
      prompt = "YouTube 영상의 내용을 간단하게 요약해주세요. 주요 포인트와 핵심 메시지를 200자 이상으로 작성해주세요. 음성 인식 결과가 부족하거나 반복적인 내용이 있어도 가능한 한 의미있는 요약을 제공해주세요.";
    }

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: prompt
        },
        {
          role: "user",
          content: `다음 내용을 요약해주세요:\n\n${content}`
        }
      ],
      max_tokens: 1500, // 1000 → 1500으로 증가
      temperature: 0.5,
    });

    const result = completion.choices[0]?.message?.content || '요약을 생성할 수 없습니다.';
    
    if (result.length < 50) {
      return type === 'youtube' 
        ? 'YouTube 영상의 내용을 요약할 수 없었습니다. 자막이 있는 영상이나 더 명확한 음성의 영상을 사용해주세요.'
        : '내용을 요약할 수 없었습니다. 다시 시도해주세요.';
    }
    
    return result;
  } catch (error) {
    console.error('❌ 간단한 요약 생성 오류:', error);
    return type === 'youtube' 
      ? 'YouTube 영상의 내용을 요약할 수 없었습니다. 자막이 있는 영상이나 더 명확한 음성의 영상을 사용해주세요.'
      : '내용을 요약할 수 없었습니다. 다시 시도해주세요.';
  }
}

// 더 짧은 요약을 생성하는 함수
export async function generateShortSummary(content: string): Promise<string> {
  try {
    // GPT-3.5-turbo 사용 (비용 절약)
    const model = "gpt-3.5-turbo";
    
    // 극한 압축 적용
    let processedContent = extremeCompressText(content, 500); // 800 → 500으로 줄임
    
    // 압축 후에도 여전히 길면 더 극한 압축
    if (processedContent.length / 4 > 2000) {
      console.log(`📝 극한 압축 필요`);
      processedContent = extremeCompressText(content, 250); // 400 → 250으로 줄임
    }
    
    // 여전히 길면 강제로 앞부분만 사용
    if (processedContent.length / 4 > 2000) {
      console.log(`📝 강제 앞부분 사용`);
      processedContent = processedContent.substring(0, 1000); // 250 토큰 = 1,000 문자
    }

    console.log(`📝 짧은 요약 - 모델 선택: ${model} (파일 크기: ${content.length} bytes)`);
    console.log(`📝 압축된 내용 길이: ${processedContent.length} 문자`);

    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: "system",
          content: "주어진 내용을 간결하게 요약해주세요. 핵심만 200자 이상으로 작성해주세요."
        },
        {
          role: "user",
          content: `다음 내용을 요약해주세요:\n\n${processedContent}`
        }
      ],
      max_tokens: 1500, // 토큰 수 늘림 (1000 → 1500, 500 → 1000)
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || '요약을 생성할 수 없습니다.';
  } catch (error) {
    console.error('❌ 짧은 요약 생성 오류:', error);
    return '입력 내용이 너무 길어서 요약을 생성할 수 없습니다. 더 짧은 내용으로 다시 시도해주세요.';
  }
}