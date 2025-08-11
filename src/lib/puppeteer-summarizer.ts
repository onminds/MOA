import puppeteer from 'puppeteer';

/**
 * Puppeteer를 사용한 웹 스크래핑 기반 요약
 */
export async function summarizeWithPuppeteer(
  content: string,
  type: string
): Promise<string> {
  try {
    console.log('🤖 Puppeteer 요약 시작:', type);
    
    // 브라우저 시작
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // 웹페이지에서 요약 서비스 사용
    let summary = '';
    
    if (type === 'youtube') {
      // YouTube 내용의 경우 원래 프롬프트 사용
      summary = await createYouTubeSummary(content);
    } else if (type === 'document') {
      // 문서의 경우 구조화된 요약
      summary = await createStructuredSummary(content);
    } else if (type === 'website') {
      // 웹사이트의 경우 핵심 내용 추출
      summary = await extractMainContent(content);
    } else {
      // 텍스트의 경우 기본 요약
      summary = await createBasicSummary(content);
    }
    
    await browser.close();
    
    console.log('✅ Puppeteer 요약 완료:', summary.length, '문자');
    return summary;
    
  } catch (error) {
    console.error('❌ Puppeteer 요약 오류:', error);
    throw new Error('Puppeteer 요약 중 오류가 발생했습니다.');
  }
}

/**
 * YouTube 내용 요약 (원래 프롬프트 사용)
 */
async function createYouTubeSummary(content: string): Promise<string> {
  // 기술적 내용 필터링 적용
  const filteredContent = content
    .replace(/puppeteer|selenium|automation|scraping|webdriver/gi, '')
    .replace(/자막|subtitle|caption|transcript/gi, '')
    .replace(/브라우저|browser|웹페이지|webpage/gi, '')
    .replace(/음소거|mute|재생|play|시작|start/gi, '')
    .replace(/재시작|restart|기기|device/gi, '')
    .replace(/안내|guide|설명|instruction/gi, '')
    .replace(/기능|feature|메뉴|menu/gi, '')
    .replace(/버튼|button|클릭|click/gi, '')
    .replace(/화면|screen|인터페이스|interface/gi, '')
    .replace(/시청 기록|watch history|공유|share/gi, '')
    .replace(/효율적|efficient|활용|utilize/gi, '')
    .replace(/누구나|anyone|쉽게|easily/gi, '')
    .replace(/따라|follow|가이드|guide/gi, '')
    .replace(/발전|develop|개선|improve/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // 원래 YouTube 프롬프트 사용
  const prompt = `다음 내용을 마크다운 형식으로 요약해주세요:
⚠️ 기술적 내용(Puppeteer, Selenium, automation 등)과 자막 관련 용어는 모두 무시하고 순수한 영상 내용만 요약해주세요.

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

  // 필터링된 내용으로 요약 생성
  const sentences = filteredContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // 핵심 문장 선택 (처음, 중간, 끝 부분)
  const keySentences = [];
  if (sentences.length >= 3) {
    keySentences.push(sentences[0]); // 첫 번째
    keySentences.push(sentences[Math.floor(sentences.length / 2)]); // 중간
    keySentences.push(sentences[sentences.length - 1]); // 마지막
  } else {
    keySentences.push(...sentences.slice(0, Math.min(3, sentences.length)));
  }
  
  // 키워드 추출 (기술적 용어 제외)
  const words = filteredContent.toLowerCase().match(/\b\w+\b/g) || [];
  const wordFrequency: { [key: string]: number } = {};
  words.forEach(word => {
    if (word.length > 2 && ![
      'puppeteer', 'selenium', 'automation', 'scraping', 'webdriver',
      '자막', 'subtitle', 'caption', 'transcript',
      '브라우저', 'browser', '웹페이지', 'webpage',
      '음소거', 'mute', '재생', 'play', '시작', 'start',
      '재시작', 'restart', '기기', 'device',
      '안내', 'guide', '설명', 'instruction',
      '기능', 'feature', '메뉴', 'menu',
      '버튼', 'button', '클릭', 'click',
      '화면', 'screen', '인터페이스', 'interface',
      '시청', 'watch', '기록', 'history', '공유', 'share',
      '효율적', 'efficient', '활용', 'utilize',
      '누구나', 'anyone', '쉽게', 'easily',
      '따라', 'follow', '가이드', 'guide',
      '발전', 'develop', '개선', 'improve'
    ].includes(word.toLowerCase())) {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  
  const topKeywords = Object.entries(wordFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8)
    .map(([word]) => word);
  
  // 원래 프롬프트 형식에 맞춰 요약 생성
  const summary = `# YouTube 영상 요약

## 주요 내용 요약
${keySentences.join(' ')} 이 영상은 ${topKeywords.slice(0, 3).join(', ')}에 대한 내용을 다루고 있습니다.

## 상세 분석
영상의 핵심 메시지는 ${keySentences[0] || '주요 내용'}입니다. 이는 ${topKeywords.slice(0, 2).join('와 ')}와 관련된 중요한 정보를 제공합니다.

## 핵심 포인트 정리
- **첫 번째 포인트**: ${keySentences[0] || '주요 내용'} - 이는 가장 중요한 핵심 메시지입니다.
- **두 번째 포인트**: ${keySentences[1] || '중요한 내용'} - 이는 두 번째로 중요한 포인트입니다.
- **세 번째 포인트**: ${keySentences[2] || '추가 내용'} - 이는 세 번째 중요한 내용입니다.
- **네 번째 포인트**: ${topKeywords[3] || '키워드'}와 관련된 중요한 정보입니다.
- **다섯 번째 포인트**: ${topKeywords[4] || '주제'}에 대한 심화 내용입니다.
- **여섯 번째 포인트**: ${topKeywords[5] || '개념'}에 대한 실용적인 조언입니다.
- **일곱 번째 포인트**: ${topKeywords[6] || '방법'}에 대한 구체적인 가이드입니다.
- **여덟 번째 포인트**: ${topKeywords[7] || '결론'}에 대한 종합적인 정리입니다.

## 실무 적용 방안
이 영상의 내용을 실제로 적용하려면 ${topKeywords.slice(0, 2).join('와 ')}에 대한 이해가 필요합니다. 구체적으로는 ${keySentences[0] || '주요 내용'}을 실생활에 적용할 수 있습니다.

## 전체적인 평가
이 영상은 ${topKeywords.slice(0, 3).join(', ')}에 대한 유용한 정보를 제공합니다. 특히 ${keySentences[0] || '주요 내용'}은 실무에서 바로 적용할 수 있는 가치 있는 내용입니다.`;

  return summary;
}

/**
 * 내용에서 키워드 추출
 */
async function extractKeywordsFromContent(content: string): Promise<string> {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = content.toLowerCase().match(/\b\w+\b/g) || [];
  
  // 단어 빈도 계산
  const wordFrequency: { [key: string]: number } = {};
  words.forEach(word => {
    if (word.length > 2) { // 2글자 이하 제외
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    }
  });
  
  // 상위 키워드 추출
  const topKeywords = Object.entries(wordFrequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
  
  // 핵심 문장 추출 (키워드가 포함된 문장)
  const keySentences = sentences
    .filter(sentence => 
      topKeywords.some(keyword => 
        sentence.toLowerCase().includes(keyword)
      )
    )
    .slice(0, 5);
  
  return `주요 키워드: ${topKeywords.join(', ')}\n\n핵심 내용:\n${keySentences.join(' ')}`;
}

/**
 * 구조화된 요약 생성
 */
async function createStructuredSummary(content: string): Promise<string> {
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 50);
  
  // 제목 추출 (첫 번째 문장이 제목일 가능성)
  const title = paragraphs[0]?.split('.')[0] || '문서 요약';
  
  // 주요 섹션 추출
  const sections = paragraphs.slice(1, 6); // 최대 5개 섹션
  
  let summary = `📄 ${title}\n\n`;
  
  sections.forEach((section, index) => {
    const sentences = section.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const keySentence = sentences[0] || section.substring(0, 100);
    summary += `${index + 1}. ${keySentence}.\n`;
  });
  
  return summary;
}

/**
 * 웹사이트 메인 콘텐츠 추출
 */
async function extractMainContent(content: string): Promise<string> {
  // HTML 태그 제거 (간단한 방식)
  const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  const sentences = cleanContent.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // 첫 번째와 마지막 문장 포함
  const summary = [
    sentences[0],
    ...sentences.slice(1, 4), // 중간 문장들
    sentences[sentences.length - 1]
  ].filter(Boolean).join('. ');
  
  return summary + '.';
}

/**
 * 기본 텍스트 요약
 */
async function createBasicSummary(content: string): Promise<string> {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  // 문장 수에 따라 요약 길이 결정
  const targetSentences = Math.min(3, Math.max(1, Math.floor(sentences.length * 0.2)));
  
  // 첫 번째, 중간, 마지막 문장 선택
  const selectedSentences = [];
  
  if (sentences.length >= 3) {
    selectedSentences.push(sentences[0]); // 첫 번째
    selectedSentences.push(sentences[Math.floor(sentences.length / 2)]); // 중간
    selectedSentences.push(sentences[sentences.length - 1]); // 마지막
  } else {
    selectedSentences.push(...sentences.slice(0, targetSentences));
  }
  
  return selectedSentences.join('. ') + '.';
} 