import OpenAI from 'openai';
import { getSummaryCostInfo } from './summary-cost-calculator';
import { summarizeWithPuppeteer } from './puppeteer-summarizer';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface Section {
  title: string;
  text: string;
}

/**
 * 1) PDF 텍스트를 "제1장", "1." 같은 헤더 패턴으로 섹션 단위 분할
 */
function extractSections(text: string): Section[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  console.log('📄 원본 라인 수:', lines.length);
  console.log('📄 앞 5줄 미리보기:', lines.slice(0, 5));
  
  // 3줄 정도 헤더 제거 (표지·챕터 제목 스킵)
  const contentLines = lines.slice(3);
  console.log('📄 헤더 제거 후 라인 수:', contentLines.length);
  console.log('📄 헤더 제거 후 앞 3줄:', contentLines.slice(0, 3));

  // 헤더 패턴 인덱스 수집 (더 다양한 패턴 포함)
  const idxs = contentLines
    .map((l, i) => ({ l, i }))
    .filter(x => 
      /^\d+[\.\)]/.test(x.l) || 
      /^제\d+장/.test(x.l) || 
      /^[가-힣]+\s*[0-9]+[\.\)]/.test(x.l) ||
      /^[A-Z][a-z]+\s*[0-9]+[\.\)]/.test(x.l) ||
      /^[가-힣]{2,}\s*[:：]/.test(x.l)
    )
    .map(x => x.i);

  // 헤더가 없으면 전체를 하나의 섹션으로 처리
  if (idxs.length === 0) {
    return [{ title: '전체 내용', text: contentLines.join(' ') }];
  }

  const sections: Section[] = [];
  for (let j = 0; j < idxs.length; j++) {
    const start = idxs[j];
    const end = idxs[j + 1] ?? contentLines.length;
    const title = contentLines[start];
    const body = contentLines.slice(start + 1, end).join(' ').trim();
    
    // 본문이 있는 경우만 추가
    if (body.length > 10) {
      sections.push({ title, text: body });
    }
  }

  return sections.length > 0 ? sections : [{ title: '전체 내용', text: contentLines.join(' ') }];
}

/**
 * 각 섹션을 2~3문장으로 요약하고,
 * 마지막에 모든 섹션 요약을 합쳐서 한 번 더 압축
 */
async function summarizeSections(sections: Section[]): Promise<string> {
  const partials: { title: string; summary: string }[] = [];

  for (const sec of sections) {
    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        max_tokens: 200,
        messages: [
          {
            role: 'system',
            content: '문서의 해당 섹션을 2–3문장으로 발표용으로 요약해 주세요. 핵심 개념과 중요한 내용을 포함해주세요.'
          },
          {
            role: 'user',
            content: `섹션 제목: ${sec.title}\n\n내용:\n${sec.text.substring(0, 1000)}`
          }
        ]
      });
      const summary = res.choices[0]?.message?.content?.trim() ?? '';
      if (summary) {
        partials.push({ title: sec.title, summary });
      }
    } catch (error) {
      console.error('섹션 요약 실패:', error);
      // 요약 실패 시 원본 텍스트 사용
      partials.push({ title: sec.title, summary: sec.text.substring(0, 200) + '...' });
    }
  }

  // 섹션이 하나뿐이거나 요약이 실패한 경우 원본 반환
  if (partials.length <= 1) {
    return partials[0]?.summary || sections[0]?.text.substring(0, 1000) || '';
  }

  // 섹션별 요약을 하나로 합친 뒤, 다시 압축 요약
  const combined = partials
    .map(p => `■ ${p.title}: ${p.summary}`)
    .join('\n');

  try {
    const finalRes = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: '여러 섹션 요약을 하나의 발표 개요로 5~7문장으로 압축해 주세요. 각 섹션의 핵심 내용을 포함해주세요.'
        },
        {
          role: 'user',
          content: combined
        }
      ]
    });
    return finalRes.choices[0]?.message?.content?.trim() ?? combined;
  } catch (error) {
    console.error('통합 요약 실패:', error);
    return combined;
  }
}

/**
 * 기존 함수와의 호환성을 위한 래퍼 함수
 */
export async function summarizeText(text: string): Promise<string> {
  try {
    // 비용 계산 (GPT-3.5-turbo 사용)
    const costInfo = getSummaryCostInfo(text, 'gpt-3.5-turbo', 2000);
    console.log('💰 PDF 요약 비용 정보:', {
      cost: costInfo.cost.toFixed(2) + '원',
      isExpensive: costInfo.isExpensive,
      inputTokens: costInfo.inputTokens,
      estimatedOutputTokens: costInfo.estimatedOutputTokens,
      contentLength: text.length
    });

    // 요약은 비용 제한 없이 OpenAI 사용
    console.log('🤖 OpenAI 사용:', costInfo.cost.toFixed(2) + '원');
    console.log('📄 섹션별 PDF 요약 시작...');
    
    // 섹션 추출
    const sections = extractSections(text);
    console.log(`📚 추출된 섹션 수: ${sections.length}`);
    
    // 섹션별 요약 및 통합
    const summary = await summarizeSections(sections);
    
    console.log('✅ 섹션별 요약 완료');
    return summary;
  } catch (error) {
    console.log('❌ 섹션별 요약 실패, 기존 방식으로 폴백:', error);
    
    // 기존 방식으로 폴백
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "주어진 텍스트를 핵심 내용만 남기고 요약해주세요. 발표 대본 작성에 필요한 중요한 정보는 유지하되, 불필요한 세부사항은 제거해주세요."
          },
          {
            role: "user",
            content: `다음 텍스트를 2000자 이내로 요약해주세요:\n\n${text}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.3,
      });

      return completion.choices[0]?.message?.content || text.substring(0, 2000);
    } catch (fallbackError) {
      console.log('❌ 폴백 요약도 실패, 원본 텍스트 자르기:', fallbackError);
      return text.substring(0, 2000) + '...';
    }
  }
} 