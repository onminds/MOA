import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 템플릿 로드 함수
async function loadTemplate(templateName: string): Promise<string> {
  try {
    const templatePath = path.join(process.cwd(), 'src', 'templates', `${templateName}.html`);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    return templateContent;
  } catch (error) {
    console.error(`템플릿 로드 실패: ${templateName}`, error);
    throw new Error(`템플릿을 로드할 수 없습니다: ${templateName}`);
  }
}

// 템플릿에서 프롬프트 추출 함수
function extractPromptFromTemplate(templateContent: string): string | null {
  const promptMatch = templateContent.match(/<meta name="template-prompt" content="([^"]+)"/);
  return promptMatch ? promptMatch[1] : null;
}

// 목차에서 제목 추출 함수
function extractTocTitles(tocHtml: string): string[] {
  const tocMatches = tocHtml.match(/<div class="toc-item">(\d+\.\s*[^<]+)<\/div>/g);
  if (!tocMatches) return [];
  
  return tocMatches.map(match => {
    const titleMatch = match.match(/>(\d+\.\s*[^<]+)</);
    return titleMatch ? titleMatch[1].replace(/^\d+\.\s*/, '') : '';
  }).filter(title => title.length > 0);
}

// 스크립트 전체에서 각 섹션 제목 추출 (예: "3카드 섹션\n제목: ...")
function extractSectionTitlesFromScript(script: string): string[] {
  const sectionTitleMap = new Map<number, string>();
  const regex = /(\d+)카드 섹션\s*\n제목:\s*([^\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(script)) !== null) {
    const num = parseInt(match[1], 10);
    const title = match[2].trim();
    if (!Number.isNaN(num) && title) {
      sectionTitleMap.set(num, title);
    }
  }
  // 3~12번 슬라이드용 목차 배열 구성
  const titles: string[] = [];
  for (let n = 3; n <= 12; n++) {
    const t = sectionTitleMap.get(n);
    if (t) titles.push(t);
  }
  return titles;
}

// 임시 저장소 (실제 프로덕션에서는 Redis나 DB 사용 권장)
const tocStorage = new Map<string, string[]>();

// 목차 품질 보정 유틸
function cleanTocTitle(title: string): string {
  return String(title || '')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function clampTocTitle20(title: string): string {
  const t = cleanTocTitle(title);
  return t.length <= 20 ? t : t.slice(0, 20);
}

// 퍼센트 값 정규화: 숫자에 %가 없으면 추가, 공백 제거, 이중 %% 방지
function normalizePercent(raw: string | undefined, fallback?: string): string {
  if (!raw || raw.trim().length === 0) {
    return fallback ?? '';
  }
  let value = String(raw).trim();
  // 이미 % 포함: 공백 제거하고 마지막에 % 하나만 유지
  if (/%/.test(value)) {
    // 숫자와 기호 사이 공백 제거 (예: '83 %' -> '83%')
    value = value.replace(/\s*%\s*$/g, '%');
    // 중복 % 제거
    value = value.replace(/%+$/g, '%');
    return value;
  }
  // 숫자 형태만 있을 경우 % 추가
  const numericMatch = value.match(/^[\d.,]+$/);
  if (numericMatch) {
    return value + '%';
  }
  // 그 외는 원본 유지 (배수/단위 포함 등)
  return value;
}

// 공통 유틸: 오늘 날짜 문자열 (YYYY-MM-DD)
const DATE_STR = new Date().toISOString().slice(0, 10);
function currentDate(): string { return DATE_STR; }

// 공통 유틸: 문장 단위 분리 (마침표/물음표/느낌표/개행 기준)
const SENTENCE_SPLIT_REGEX = /[\.!?\n]+/;
function splitSentences(text: string): string[] {
  return text.split(SENTENCE_SPLIT_REGEX).map(s => s.trim()).filter(Boolean);
}

// 공통 스타일 지침(추론/출력)
const STYLE_SYSTEM = "다음 스타일 지침을 항상 준수하세요: reasoning.effort=low, text.verbosity=low. 불필요한 서론/사족/사과는 생략하고, 핵심만 간결하게 한국어로 답변하세요. JSON만 요구될 때는 JSON 외 텍스트 금지.";

// Responses API 출력 텍스트 안전 추출
function getOutputText(resp: any): string {
  try {
    if (resp && typeof resp.output_text === 'string') return resp.output_text;
    // 일부 SDK 변형 대응
    const possible = resp?.data?.[0]?.content?.[0]?.text?.value
      || resp?.content?.[0]?.text?.value
      || resp?.choices?.[0]?.message?.content;
    return typeof possible === 'string' ? possible : '';
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const { topic, slideCount = 5, section = 1, tocTitles: incomingTocTitles } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: '주제가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🎯 PPT 생성 시작');
    console.log('📝 주제:', topic);
    console.log('📊 총 섹션 수:', slideCount);
    console.log('📍 현재 섹션:', section);

    // 외부에서 목차가 들어온 경우 캐시에 선 저장(요청 간 일관성 보장)
    const preStorageKey = `${topic}_${slideCount}`;
    if (Array.isArray(incomingTocTitles) && incomingTocTitles.length === 10) {
      tocStorage.set(preStorageKey, incomingTocTitles.map(String));
    }

    // 1단계: 주제로 PPT 대본 생성
    const scriptPrompt = `[주제: ${topic}]로 ${slideCount}개의 카드 섹션으로 구성된 PPT 대본을 만들어줘.

    요구사항:
    1. 각 카드 섹션은 "1카드 섹션", "2카드 섹션" 형식으로 구분
    2. 각 섹션은 제목, 내용, 키포인트를 포함
    3. 전문적이고 구조화된 내용으로 작성
    4. 한국어로 작성
    5. 특히 3카드 섹션에는 최소 2개의 수치(퍼센트 % 또는 배수 '배')를 본문에 명시하세요.
    6. 특히 5카드 섹션에는 퍼센트(%)와 배수('배') 수치를 각각 1개 이상 본문에 직접 명시하세요.
    
    형식:
    1카드 섹션
    제목: [제목]
    내용: [상세 내용]
    키포인트: [핵심 포인트 3개]
    
    2카드 섹션
    제목: [제목]
    내용: [상세 내용]
    키포인트: [핵심 포인트 3개]
    
    ... (${slideCount}개까지)`;

    const scriptCompletion = await openai.chat.completions.create({
      model: "gpt-5-mini", // GPT-5-mini로 교체
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 프레젠테이션 대본 작성자입니다. 주어진 주제에 대해 구조화된 PPT 대본을 작성해주세요."
        },
        { role: "system", content: STYLE_SYSTEM },
        {
          role: "user",
          content: scriptPrompt
        }
      ]
    });

    const scriptContent = scriptCompletion.choices[0]?.message?.content;
    
    if (!scriptContent) {
      throw new Error('PPT 대본 생성에 실패했습니다.');
    }

    // 스크립트에서 섹션별 제목을 항상 추출 (3~12번)
    const scriptSectionTitles = extractSectionTitlesFromScript(scriptContent);
    const getSectionTitle = (n: number, fallback: string) => {
      const idx = n - 3; // 3번 섹션부터 시작
      return scriptSectionTitles[idx] || fallback;
    };

    // Modern company: 목차 타이틀을 일관되게 보장하는 헬퍼(10개 생성/캐시)
    const ensureTocTitlesMC = (): string[] => {
      const key = `${topic}_${slideCount}`;
      let titles = tocStorage.get(key);
      if (!titles || titles.length !== 10) {
        const fromScript = extractSectionTitlesFromScript(scriptContent);
        const built: string[] = [];
        for (let n = 3; n <= 12; n += 1) {
          const idx = n - 3;
          const t = fromScript[idx] || `${getSectionTitle(n, `섹션 ${n}`)}`;
          built.push(clampTocTitle20(t));
        }
        // 중복 제거(순서 보존) + 부족 시 채움
        const seen = new Set<string>();
        const unique = built.filter(t => (seen.has(t) ? false : (seen.add(t), true)));
        let filler = 1;
        while (unique.length < 10) {
          const cand = clampTocTitle20(`${topic} ${filler}`);
          if (!seen.has(cand)) { unique.push(cand); seen.add(cand); }
          filler += 1;
        }
        titles = unique.slice(0, 10);
        tocStorage.set(key, titles);
      }
      return titles;
    };

    // 2단계: 특정 섹션만 추출 (내구성 향상)
    // - 다양한 공백/개행/표기('키 포인트' 등) 허용
    // - 섹션 블록 사이에 다른 텍스트가 끼어도 비탐욕적으로 매칭
    const tolerantRegex = new RegExp(
      `${section}\\s*카드\\s*섹션[\\s\\S]*?제목\\s*:\\s*([^\\n]+)[\\s\\S]*?내용\\s*:\\s*([^\\n]+)[\\s\\S]*?키\\s*포인트?\\s*:\\s*([^\\n]+)`,
      'i'
    );
    let sectionMatch = scriptContent.match(tolerantRegex);
    // 구식 포맷 호환(정확한 줄바꿈 버전)
    if (!sectionMatch) {
      const legacyRegex = new RegExp(`${section}카드 섹션\\s*\\n제목:\\s*([^\\n]+)\\s*\\n내용:\\s*([^\\n]+)\\s*\\n키포인트:\\s*([^\\n]+)`, 'i');
      sectionMatch = scriptContent.match(legacyRegex);
    }

    let sectionTitle = '';
    let sectionContent = '';
    let sectionKeypoints: string[] = [];
    if (sectionMatch) {
      sectionTitle = sectionMatch[1].trim();
      sectionContent = sectionMatch[2].trim();
      sectionKeypoints = sectionMatch[3].trim().split(',').map(point => point.trim()).filter(Boolean);
    } else {
      // 최종 폴백: 블록이 없어도 생성이 멈추지 않도록 최소값 채움
      sectionTitle = getSectionTitle(section, `섹션 ${section}`);
      const sents = splitSentences(scriptContent);
      sectionContent = [sents[0], sents[1], sents[2]].filter(Boolean).join(' ');
      sectionKeypoints = sents.slice(3, 8).filter(Boolean).slice(0, 3);
    }

    // 본문 텍스트와 키포인트를 합친 코퍼스 (수치 검증/추출에 사용)
    const corpus = `${sectionContent} ${sectionKeypoints.join(' ')}`;
    const compact = (s: string) => s.replace(/\s+/g, '');

    // 3단계: HTML 생성
    let contentPrompt = '';
    
         // 템플릿 이름 결정
     let templateName = 'template1';
     if (section === 1) {
       templateName = 'Modern company/template1';
     } else if (section === 2) {
       templateName = 'Modern company/template2';
     } else if (section === 3) {
       templateName = 'Modern company/template3';
     } else if (section === 4) {
       templateName = 'Modern company/template4';
     } else if (section === 5) {
       templateName = 'Modern company/template5';
     } else if (section === 6) {
       templateName = 'Modern company/template6';
     } else if (section === 7) {
       templateName = 'Modern company/template7';
     } else if (section === 8) {
       templateName = 'Modern company/template8';
     } else if (section === 9) {
       templateName = 'Modern company/template9';
     } else if (section === 10) {
       templateName = 'Modern company/template10';
     } else if (section === 11) {
       templateName = 'Modern company/template11';
     } else if (section === 12) {
       templateName = 'Modern company/template12';
     }
    
    // 템플릿 로드
    const templateContent = await loadTemplate(templateName);
    
         // 템플릿에서 프롬프트 추출
     const templatePrompt = extractPromptFromTemplate(templateContent);
     
         // 프롬프트 메타 태그를 제거한 깨끗한 템플릿 생성
    // 더 강력한 프롬프트 제거 로직 (메타 태그가 여러 줄과 '>'를 포함해도 안전하게 제거)
    let cleanTemplateContent = templateContent
      // self-closing meta (e.g., <meta ... />) 제거 - 내용에 '>'가 있어도 '/>'까지 비탐욕적으로 매칭
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?\/>/gi, '')
      // 혹시 모를 닫는 태그 형태(<meta ...></meta>)도 제거
      .replace(/<meta\s+name=["']template-prompt["'][\s\S]*?<\/meta>/gi, '')
      // HTML/CSS/한 줄 주석 제거
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\n)\s*\/\/.*$/gm, '');
     
     if (templatePrompt) {
       // 템플릿에서 추출한 프롬프트 사용
       contentPrompt = templatePrompt
         .replace(/{{SECTION_TITLE}}/g, sectionTitle)
         .replace(/{{SECTION_CONTENT}}/g, sectionContent)
         .replace(/{{SECTION_KEYPOINTS}}/g, sectionKeypoints.join(', '));

       // 섹션 2: 목차 전용 프롬프트로 오버라이드 (사용자 프롬프트 기반 10개 항목 생성)
       if (section === 2) {
         contentPrompt = `아래 입력만 참고해 10개의 목차 항목을 생성하세요. 다른 텍스트는 금지.

입력
- 주제: ${sectionTitle}
- 본문: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- 정확히 10개 항목을 생성하고, 각 항목은 8~18자, 명사/구 중심의 간결한 제목
- 출력 형식은 다음만 허용: <div class="toc-item">01. 제목</div> ... <div class="toc-item">10. 제목</div>
- 중복/유사 제목 금지, 사용자 프롬프트의 의미를 반영
- 1~10번은 이후 슬라이드(3~12번)에서 순서대로 사용됨
`;
       }

       // 섹션 3은 수치 포함을 강제하는 전용 프롬프트로 오버라이드
       if (section === 3) {
         contentPrompt = `아래 입력만 사용하여 다음 키를 가진 텍스트 블록을 그대로 출력하세요. 다른 텍스트/마크다운 금지.

TITLE: {{목차 제목 또는 요약 제목}}
DESCRIPTION: {{2-3문장 설명}}
TRENDS: <li>항목1</li><li>항목2</li><li>항목3</li><li>항목4</li>
STATS: <div class="stat-item"><div class="stat-arrow"><i class="fas fa-arrow-up"></i></div><div class="stat-number">숫자</div><div class="stat-text">텍스트</div></div><div class="stat-item"><div class="stat-arrow"><i class="fas fa-chart-line"></i></div><div class="stat-number">숫자</div><div class="stat-text">텍스트</div></div>

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- STATS에는 최소 2개 항목을 포함
- 각 stat-number는 퍼센트(%) 또는 배수('배') 형식만 사용
- 모든 숫자 값은 위 입력(내용/키포인트)에 실제로 등장한 수치만 허용. 없으면 숫자를 만들지 말고 해당 항목을 텍스트 위주로 작성 (N/A는 쓰지 말 것)`;
       }

       // 섹션 5/6/8/9는 숫자 JSON 출력 강제 및 본문 수치만 허용
       if (section === 5) {
         contentPrompt = `아래 입력만 사용하여 JSON 하나만 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- 모든 숫자 값은 위 입력(내용/키포인트) 또는 모델 응답 내 실제 텍스트에 등장한 수치만 사용
- GAUGE_VALUE는 % 포함 퍼센트 형식만(없으면 "N/A")
- STAT_VALUE는 '배' 포함 배수 형식만(없으면 "N/A")

형식(JSON)
{"GAUGE_VALUE": string, "GAUGE_DESCRIPTION": string, "STAT_VALUE": string, "STAT_DESCRIPTION": string}`;
       } else if (section === 6) {
         contentPrompt = `아래 입력만 사용하여 JSON 하나만 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙(반드시 지킬 것)
- 모든 숫자 값은 위 입력(내용/키포인트)에 실제로 등장한 수치만 그대로 사용
- METRIC1_VALUE/METRIC2_VALUE는 숫자(단위 허용), METRIC3_VALUE는 % 형식
- 각 *_DESCRIPTION에는 해당 *_VALUE 수치가 그대로 포함되어야 하며, 최소 2문장(40~120자)으로 상세히 작성
- RESULT_PERCENTAGE는 % 형식이며 RESULT_TEXT도 동일 퍼센트 수치를 반드시 포함하고 1문장 25~60자로 작성
- 모든 TITLE은 간결(8자 이내)하게 작성
- 입력 본문에 해당 수치가 전혀 없으면 해당 *_VALUE는 "N/A"로 두고, *_DESCRIPTION/RESULT_TEXT는 수치 없이도 풍부하게(최소 2문장 또는 40자 이상) 작성

형식(JSON)
{"METRIC1_VALUE": string, "METRIC1_TITLE": string, "METRIC1_DESCRIPTION": string,
 "METRIC2_VALUE": string, "METRIC2_TITLE": string, "METRIC2_DESCRIPTION": string,
 "METRIC3_VALUE": string, "METRIC3_TITLE": string, "METRIC3_DESCRIPTION": string,
 "RESULT_PERCENTAGE": string, "RESULT_TEXT": string}`;
       } else if (section === 8) {
         contentPrompt = `아래 입력만 사용하여 JSON 하나만 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- 모든 숫자 값은 위 입력(내용/키포인트) 또는 모델 응답 내 실제 텍스트에 등장한 수치만 사용
- STAT_PERCENTAGE는 % 포함 퍼센트 형식만(없으면 "N/A")

형식(JSON)
{"DESCRIPTION": string,
 "FEEDBACK1_TEXT": string, "FEEDBACK2_TEXT": string, "FEEDBACK3_TEXT": string,
 "STAT_PERCENTAGE": string, "STAT_DESCRIPTION": string}`;
       } else if (section === 9) {
         contentPrompt = `아래 입력만 사용하여 JSON 하나만 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- 모든 숫자 값은 위 입력(내용/키포인트) 또는 모델 응답 내 실제 텍스트에 등장한 수치만 사용
- METRIC1_VALUE/METRIC2_VALUE/METRIC3_VALUE는 % 포함 퍼센트 형식만(없으면 "N/A")

형식(JSON)
{"METRIC1_VALUE": string, "METRIC1_TITLE": string, "METRIC1_DESCRIPTION": string,
 "METRIC2_VALUE": string, "METRIC2_TITLE": string, "METRIC2_DESCRIPTION": string,
 "METRIC3_VALUE": string, "METRIC3_TITLE": string, "METRIC3_DESCRIPTION": string,
 "RESULT_PERCENTAGE": string, "RESULT_TEXT": string}`;
       }
     } else {
      // 기본 프롬프트 (fallback)
      contentPrompt = `다음 내용을 바탕으로 슬라이드에 적합한 내용을 만들어줘:

      제목: ${sectionTitle}
      내용: ${sectionContent}
      키포인트: ${sectionKeypoints.join(', ')}

      요구사항:
      1. 제목은 간결하고 임팩트 있게 만들어주세요
      2. 내용은 슬라이드에 적합한 길이로 요약해주세요 (2-3문장)
      3. 키포인트는 3-5개로 정리해주세요
      4. 각 키포인트는 "•" 불릿 포인트로 시작해주세요
      5. 줄바꿈은 <br/> 태그를 사용해주세요
      6. 내용과 키포인트를 하나의 텍스트로 합쳐주세요

      내용만 출력해주세요. 다른 설명은 포함하지 마세요.`;
    }

    let slideContent = '';
    if (section !== 2) {
    const contentCompletion = await openai.chat.completions.create({
        model: "gpt-5-mini", // GPT-5-mini로 교체
      messages: [
        {
          role: "system",
          content: "당신은 프롬프트를 고품질 HTML 코드로 변환하는 전문 개발자입니다. 주어진 프롬프트를 분석하여 적절한 HTML 구조로 변환해주세요."
        },
          { role: "system", content: STYLE_SYSTEM },
        {
          role: "user",
          content: contentPrompt
        }
        ]
      });
      slideContent = contentCompletion.choices[0]?.message?.content || '';
    }

    // JSON 강제 섹션(5,6,8,9): JSON 파싱 시도 및 1회 재요청 실패 시 N/A 처리용 파싱 결과 저장
    const sectionsRequireJson = new Set([5, 6, 8, 9]);
    let parsedJson: any | null = null;
    function extractFirstJsonBlock(text: string): string | null {
      const match = text.match(/\{[\s\S]*\}/);
      return match ? match[0] : null;
    }
    if (sectionsRequireJson.has(section)) {
      const firstJson = slideContent ? extractFirstJsonBlock(slideContent) : null;
      if (firstJson) {
        try { parsedJson = JSON.parse(firstJson); } catch { parsedJson = null; }
      }
      if (!parsedJson) {
        // 재요청: JSON 하나만 출력 및 본문 등장 수치만 허용
        const retry = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "JSON 외 다른 텍스트를 출력하지 마세요. 숫자 필드는 본문(내용/키포인트)에 등장한 수치만 사용하세요. 없으면 N/A로 채우세요." },
            { role: "system", content: STYLE_SYSTEM },
            { role: "user", content: contentPrompt + "\n\n반드시 하나의 JSON만 출력하세요." }
          ]
        });
        slideContent = retry.choices[0]?.message?.content || slideContent;
        const retryJson = slideContent ? extractFirstJsonBlock(slideContent) : null;
        if (retryJson) {
          try { parsedJson = JSON.parse(retryJson); } catch { parsedJson = null; }
        }
      }
    }

    // 섹션 6과 7: 내용 미입력 방지를 위한 최소 필드 보정 (본문에서 추출)
    if (section === 6 && (!parsedJson || Object.keys(parsedJson).length === 0)) {
      parsedJson = {} as any;
    }
    if (section === 6) {
      const p = parsedJson as any;
      if (!p.METRIC1_VALUE) {
        p.METRIC1_VALUE = extractFirstPercentToken(corpus) || extractFirstMultipleToken(corpus) || extractFirstGeneralNumberToken(corpus) || 'N/A';
      }
      if (!p.METRIC2_VALUE) {
        p.METRIC2_VALUE = extractFirstPercentToken(corpus) || extractFirstMultipleToken(corpus) || extractFirstGeneralNumberToken(corpus) || 'N/A';
      }
      if (!p.METRIC3_VALUE) {
        p.METRIC3_VALUE = extractFirstPercentToken(corpus) || 'N/A';
      }
      if (p.METRIC3_VALUE === 'N/A' || !/%$/.test(String(p.METRIC3_VALUE))) {
        const fix = extractFirstPercentToken(corpus);
        if (fix) p.METRIC3_VALUE = fix;
      }
      if (!p.RESULT_PERCENTAGE) {
        p.RESULT_PERCENTAGE = extractFirstPercentToken(corpus) || extractFirstGeneralNumberToken(corpus) || 'N/A';
      }
      if (p.RESULT_PERCENTAGE !== 'N/A' && !/%$/.test(String(p.RESULT_PERCENTAGE))) {
        const percentFix = extractFirstPercentToken(corpus);
        if (percentFix) p.RESULT_PERCENTAGE = percentFix;
      }
      if (!p.METRIC1_TITLE) p.METRIC1_TITLE = '정책';
      if (!p.METRIC2_TITLE) p.METRIC2_TITLE = '규제';
      if (!p.METRIC3_TITLE) p.METRIC3_TITLE = '투자';
      if (!p.RESULT_TEXT) p.RESULT_TEXT = `${sectionTitle}의 순변화 추정`;
    }

    if (section === 7 && (!slideContent || !/TITLE:|SUBTITLE:|DESCRIPTION:|TECH1_TITLE:/i.test(slideContent))) {
      // 섹션 7 프롬프트 재요청: 필수 키를 포함하도록 강제
      const forcedPrompt7 = `아래 입력만 사용하여 다음 키를 포함한 텍스트를 반환하세요. 다른 텍스트/마크다운 금지.

TITLE: ${sectionTitle}
SUBTITLE: {{짧은 부제목 한 줄}}
DESCRIPTION: {{2-3문장 설명}}
TECH1_TITLE: {{한 줄}}
TECH2_TITLE: {{한 줄}}
TECH3_TITLE: {{한 줄}}
ARCH1_LABEL: {{한 단어}}
ARCH2_LABEL: {{한 단어}}
ARCH3_LABEL: {{한 단어}}

입력
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}
`;
      const retry7 = await openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: '요청된 키를 모두 포함하여 반환하세요. 다른 텍스트는 금지합니다.' },
          { role: 'system', content: STYLE_SYSTEM },
          { role: 'user', content: forcedPrompt7 }
        ]
      });
      slideContent = retry7.choices[0]?.message?.content || slideContent;
    }

    // 본문에 등장한 수치만 허용하기 위한 간단한 검증 유틸리티 (위에서 정의한 corpus/compact 사용)
    function hasPercentInCorpus(value: string): boolean {
      const v = compact(value);
      if (!/%$/.test(v)) return false;
      return compact(corpus).includes(v);
    }
    function hasMultipleInCorpus(value: string): boolean {
      const v = compact(value);
      if (!/배$/.test(v)) return false;
      return compact(corpus).includes(v);
    }

    // 본문에서 처음 나오는 수치 토큰 추출 유틸
    function extractFirstPercentToken(text: string): string | null {
      const m = text.match(/\b\d{1,3}(?:[.,]\d+)?\s*%/);
      return m ? m[0].replace(/\s+/g, '') : null;
    }
    function extractFirstMultipleToken(text: string): string | null {
      const m = text.match(/\b\d+(?:[.,]\d+)?\s*배/);
      return m ? m[0].replace(/\s+/g, '') : null;
    }
    function extractFirstNumberToken(text: string): string | null {
      const m = text.match(/\b\d{1,3}(?:[.,]\d+)?\b/);
      return m ? m[0] : null;
    }
    // 확장: 다양한 숫자 형식을 허용 (천단위 구분/소수점 포함)
    function extractFirstGeneralNumberToken(text: string): string | null {
      const m = text.match(/\b\d{1,3}(?:[,\.]\d{3})*(?:[.,]\d+)?\b/);
      return m ? m[0] : null;
    }
    function normalizeNumericString(value: string): string {
      if (!value) return '';
      return String(value).replace(/[^0-9.,]/g, '').replace(/,/g, '');
    }
    function hasAnyNumberInCorpus(value: string): boolean {
      const v = normalizeNumericString(value);
      if (!v) return false;
      const corpusNum = normalizeNumericString(corpus);
      return corpusNum.includes(v);
    }

    // 섹션 5: 퍼센트/배수 수치가 비어있으면 JSON 재요청 (보다 엄격한 추출 규칙)
    if (section === 5 && parsedJson) {
      const gaugeCandidate = normalizePercent(parsedJson?.GAUGE_VALUE ?? '', '');
      const statCandidate = typeof parsedJson?.STAT_VALUE === 'string' ? String(parsedJson.STAT_VALUE).trim() : '';
      const needRetry5 = !(gaugeCandidate && hasPercentInCorpus(gaugeCandidate)) || !(statCandidate && hasMultipleInCorpus(statCandidate));

      if (needRetry5) {
        const strictPrompt5 = `아래 입력에서 실제로 등장하는 수치만 사용하여 JSON 하나만 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- GAUGE_VALUE: 입력에 등장한 퍼센트(%) 하나를 그대로 사용. 없으면 "N/A"
- STAT_VALUE: 입력에 등장한 '배' 수치 하나를 그대로 사용. 없으면 "N/A"
- 모든 숫자는 입력 본문에 실제로 존재해야 함

형식(JSON)
{"GAUGE_VALUE": string, "GAUGE_DESCRIPTION": string, "STAT_VALUE": string, "STAT_DESCRIPTION": string}`;

        const retryStrict5 = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "JSON 외 다른 텍스트를 출력하지 마세요. 숫자는 입력 본문에 실제로 등장해야 합니다." },
            { role: "system", content: STYLE_SYSTEM },
            { role: "user", content: strictPrompt5 }
          ]
        });
        const strictContent = retryStrict5.choices[0]?.message?.content || '';
        const strictJson = strictContent ? extractFirstJsonBlock(strictContent) : null;
        if (strictJson) {
          try { parsedJson = JSON.parse(strictJson); } catch { /* ignore */ }
        }
      }
    }

         // 템플릿 로드 및 내용 삽입
     let htmlContent = '';
     if (section === 1) {
       // 섹션 1: 제목 + 부제목 (템플릿1은 {{SUBTITLE}} 사용)
       const subtitle = sectionContent && sectionContent.length > 0 ? sectionContent : (slideContent || '');
       htmlContent = cleanTemplateContent
        .replace(/{{TITLE}}/g, sectionTitle)
        .replace(/{{SUBTITLE}}/g, subtitle)
        .replace(/{{HEADER_LEFT}}/g, `${topic} 소개`)
        .replace(/{{HEADER_CENTER}}/g, currentDate())
        .replace(/{{HEADER_RIGHT}}/g, '');
    } else if (section === 2) {
      const storageKey = `${topic}_${slideCount}`;
      const titles = ensureTocTitlesMC(); // 1~10 제목 보장
      const tocContent = titles
        .map((t, i) => `<div class="toc-item">${String(i + 1).padStart(2, '0')}. ${t}</div>`)
        .join('\n');

      const headerLeft = `${topic} 목차`;
      const headerCenter = currentDate();
      const headerRight = '';
      const footerText = splitSentences(sectionContent)[0] || '';

      htmlContent = cleanTemplateContent
        .replace(/{{TITLE}}/g, '목차')
        .replace(/{{CONTENT}}/g, tocContent)
        .replace(/{{FOOTER_TEXT}}/g, footerText)
        .replace(/{{HEADER_LEFT}}/g, headerLeft)
        .replace(/{{HEADER_CENTER}}/g, currentDate())
        .replace(/{{HEADER_RIGHT}}/g, headerRight);
    } else if (section === 3) {
      // 섹션 3: 통계 + 트렌드
      // 목차에서 제목 가져오기 (3번 = 목차의 1번째 항목) — 항상 해당 인덱스 우선 사용
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[0] || getSectionTitle(3, `${sectionTitle}의 통계 및 트렌드`); // 목차 1번째 항목
      
      console.log('🔍 3번 슬라이드 원본 GPT 응답:');
      console.log('==================================================');
      console.log(slideContent);
      console.log('==================================================');
      
      // GPT 응답에서 각 부분을 파싱
      const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|DESCRIPTION|$)/);
      const descriptionMatch = slideContent.match(/DESCRIPTION:\s*([\s\S]+?)(?:\nTRENDS|$)/);
      const trendsMatch = slideContent.match(/TRENDS:\s*([\s\S]+?)(?:\nSTATS|$)/);
      const statsMatch = slideContent.match(/STATS:\s*([\s\S]+?)(?:\n[A-Z]+:|$)/);
      
      console.log('🔍 파싱 결과:');
      console.log('titleMatch:', titleMatch);
      console.log('descriptionMatch:', descriptionMatch);
      console.log('trendsMatch:', trendsMatch);
      console.log('statsMatch:', statsMatch);
      
      const title = tocTitle; // 목차 제목 사용
      const description = descriptionMatch && descriptionMatch[1].trim().length > 10 ? 
        descriptionMatch[1].trim() : 
        `${tocTitle}에 대한 분석을 통해 현재 동향과 미래 전망을 살펴보겠습니다. 데이터 기반의 인사이트를 통해 핵심 트렌드와 주요 통계를 확인할 수 있습니다.`;
      
      const trends = trendsMatch && trendsMatch[1].trim().length > 20 ? 
        trendsMatch[1].trim() : 
        `<li>${tocTitle} 관련 발전</li><li>시장 규모 확대</li><li>사용자 채택 증가</li><li>미래 전망 긍정적</li>`;
      
      // STATS 파싱: 실패 시 폴백 수치 제거
      let stats = '';
      if (statsMatch && statsMatch[1].trim().length > 50) {
        stats = statsMatch[1].trim();
        console.log('✅ STATS 파싱 성공:', stats);
      } else {
        stats = '';
        console.log('⚠️ STATS 파싱 실패, 빈 값 사용');
      }
      
      // 트렌드가 비어있지 않은지 확인
      const finalTrends = trends && trends.length > 10 ? trends : 
        `<li>${tocTitle} 기술 혁신</li><li>산업 적용 확산</li><li>투자 증가</li><li>글로벌 성장</li>`;
      
      // 최종 통계 데이터: 폴백 수치 제거
      const finalStats = stats && stats.length > 50 ? stats : '';
      
      console.log('🔍 3번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('제목:', title);
      console.log('설명:', description);
      console.log('트렌드:', finalTrends);
             console.log('최종 통계:', finalStats);
       
       const s3HeaderLeft = `${topic} 보고서`;
       const s3HeaderCenter = currentDate();
       const s3HeaderRight = '';

       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
         .replace(/{{DESCRIPTION}}/g, description)
         .replace(/{{TRENDS}}/g, finalTrends)
         .replace(/{{STATS}}/g, finalStats)
         .replace(/{{HEADER_LEFT}}/g, s3HeaderLeft)
         .replace(/{{HEADER_CENTER}}/g, s3HeaderCenter)
         .replace(/{{HEADER_RIGHT}}/g, s3HeaderRight);
    } else if (section === 4) {
      // 섹션 4: 우선순위 원형
      // 목차에서 제목 가져오기 (4번 = 목차의 2번째 항목)
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[1] || getSectionTitle(4, `${sectionTitle}의 우선순위 분석`); // 목차 2번째 항목
      
      // GPT 응답에서 각 부분을 파싱
      const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
      const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
      const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
      const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
      const subtitleMatch = slideContent.match(/SUBTITLE:\s*(.+?)(?:\n|$)/);
      const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
      const priorityCirclesMatch = slideContent.match(/PRIORITY_CIRCLES:\s*([\s\S]*?)(?:\n|$)/);
      
      const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 분석 보고서`;
      const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : currentDate();
      const headerRight = headerRightMatch ? headerRightMatch[1].trim() : 'AI 연구소';
      const title = tocTitle; // 목차 제목 사용
      const subtitle = subtitleMatch && subtitleMatch[1].trim().length > 5 ? 
        subtitleMatch[1].trim() : 
        `${tocTitle}의 핵심 요소`;
      const description = descriptionMatch && descriptionMatch[1].trim().length > 20 ? 
        descriptionMatch[1].trim() : 
        `${tocTitle}에 대한 체계적인 분석을 통해 핵심 요소들을 파악해보겠습니다. 다음 세 가지 우선순위를 통해 주요 특징과 발전 방향을 살펴보겠습니다. 각 요소는 상호 연관성을 가지며 전체적인 발전에 기여하고 있습니다.`;
      // 사용자 입력 기반으로 원형 라벨 구성 (한 줄, 최대 12자)
      const maxLen = 12;
      const truncateOneLine = (t: string) => {
        const s = (t || '').replace(/\n|<br\s*\/>/gi, ' ').replace(/[•\-\u00B7]/g, '').trim();
        return s.length > maxLen ? s.slice(0, maxLen) : s;
      };
      const uniqueLabels = Array.from(new Set((sectionKeypoints || []).map(truncateOneLine).filter(Boolean)));
      // sectionContent 보조 추출
      if (uniqueLabels.length < 3) {
        const extras = (sectionContent || '')
          .split(/[,·•\-\n]/)
          .map(truncateOneLine)
          .filter(Boolean);
        for (const e of extras) {
          if (uniqueLabels.length >= 3) break;
          if (!uniqueLabels.includes(e)) uniqueLabels.push(e);
        }
      }
      while (uniqueLabels.length < 3) uniqueLabels.push('핵심 요소');
      const labels = uniqueLabels.slice(0, 3);
      const finalPriorityCircles = `
        <div class="priority-circle priority-1"><div class="priority-number">01</div><div class="priority-text">${labels[0]}</div></div>
        <div class="priority-circle priority-2"><div class="priority-number">02</div><div class="priority-text">${labels[1]}</div></div>
        <div class="priority-circle priority-3"><div class="priority-number">03</div><div class="priority-text">${labels[2]}</div></div>
      `.trim();
      
      console.log('🔍 4번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('원본 응답:', slideContent);
      console.log('제목:', title);
      console.log('부제목:', subtitle);
      console.log('설명:', description);
             console.log('우선순위 원형:', finalPriorityCircles);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
         .replace(/{{SUBTITLE}}/g, subtitle)
        .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{PRIORITY_CIRCLES}}/g, finalPriorityCircles)
        .replace(/{{HEADER_LEFT}}/g, headerLeft)
        .replace(/{{HEADER_CENTER}}/g, currentDate())
        .replace(/{{HEADER_RIGHT}}/g, headerRight);
    } else if (section === 5) {
      // 섹션 5: 게이지 + 차트
      // 목차에서 제목 가져오기 (5번 = 목차의 3번째 항목)
      const storageKey = `${topic}_${slideCount}`;
      const tocTitles = tocStorage.get(storageKey) || [];
      const tocTitle = tocTitles[2] || getSectionTitle(5, `${sectionTitle}의 성과 지표`); // 목차 3번째 항목
      
      // JSON 파싱 결과 사용 (파싱 실패 시 N/A)
      const headerLeft = `${tocTitle} 연구소`;
      const headerCenter = currentDate();
      const headerRight = '';
      const title = tocTitle; // 목차 제목 사용
      // 상단 설명: 최소 3문장 보장
      let description = (parsedJson && typeof parsedJson.GAUGE_DESCRIPTION === 'string' && parsedJson.GAUGE_DESCRIPTION.trim().length > 0)
        ? parsedJson.GAUGE_DESCRIPTION.trim()
        : '';
      const sentences5 = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
      // 최적화: 공통 문장 분리 유틸 사용
      // const sentences5 = splitSentences(sectionContent);
      if (!description || description.split(/[.!?]/).filter(Boolean).length < 3) {
        const topThree = [sentences5[0], sentences5[1], sentences5[2]].filter(Boolean).join(' ');
        if (topThree) description = topThree;
      }
      const rawGaugeValue = normalizePercent(parsedJson?.GAUGE_VALUE ?? '', '');
      let gaugeValue = rawGaugeValue && hasPercentInCorpus(rawGaugeValue) ? rawGaugeValue : 'N/A';
      if (gaugeValue === 'N/A') gaugeValue = '';
      // 하단 게이지 설명: 최소 2문장 보장
      let gaugeDescription = (parsedJson && typeof parsedJson.GAUGE_DESCRIPTION === 'string') ? parsedJson.GAUGE_DESCRIPTION.trim() : '';
      if (!gaugeDescription || gaugeDescription.split(/[.!?]/).filter(Boolean).length < 2) {
        const two = [sentences5[1], sentences5[2] || sentences5[3]].filter(Boolean).join(' ');
        gaugeDescription = two || '관련 지표는 본문에서 정량적으로 확인되지 않았지만, 추세는 분명하게 나타납니다.';
      }
      const rawStatValue = (parsedJson && typeof parsedJson.STAT_VALUE === 'string') ? parsedJson.STAT_VALUE.trim() : '';
      const statValue = rawStatValue && hasMultipleInCorpus(rawStatValue) ? rawStatValue : '';
      // 하단 통계 설명: 최소 2문장 보장
      let statDescription = (parsedJson && typeof parsedJson.STAT_DESCRIPTION === 'string') ? parsedJson.STAT_DESCRIPTION.trim() : '';
      if (!statDescription || statDescription.split(/[.!?]/).filter(Boolean).length < 2) {
        const two2 = [sentences5[3] || sentences5[1], sentences5[4] || sentences5[2]].filter(Boolean).join(' ');
        statDescription = two2 || '정량 값은 명시되지 않았으나, 사례와 문맥에서 중요성이 강조됩니다.';
      }
      
      console.log('🔍 5번 슬라이드 파싱 결과:');
      console.log('목차 제목:', tocTitle);
      console.log('원본 응답:', slideContent);
      console.log('제목:', title);
      console.log('설명:', description);
      console.log('게이지 값:', gaugeValue);
      console.log('게이지 설명:', gaugeDescription);
      console.log('통계 값:', statValue);
      console.log('통계 설명:', statDescription);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
         .replace(/{{DESCRIPTION}}/g, description)
        .replace(/{{GAUGE_VALUE}}/g, gaugeValue)
        .replace(/{{GAUGE_DESCRIPTION}}/g, gaugeDescription)
        .replace(/{{STAT_VALUE}}/g, statValue)
        .replace(/{{STAT_DESCRIPTION}}/g, statDescription)
                 .replace(/{{HEADER_LEFT}}/g, headerLeft)
         .replace(/{{HEADER_CENTER}}/g, currentDate())
         .replace(/{{HEADER_RIGHT}}/g, headerRight);
     } else if (section === 6) {
       // 섹션 6: 일자리 변화와 새로운 기회
       // 제목 결정: 우선 목차, 없으면 스크립트에서 6카드 섹션 제목 추출
       const storageKey = `${topic}_${slideCount}`;
       let tocTitles = tocStorage.get(storageKey) || [];
       if (!tocTitles.length) {
         tocTitles = extractSectionTitlesFromScript(scriptContent);
       }
       const fallback6 = `${sectionTitle}의 일자리 변화`;
       const tocTitle = tocTitles[3] || fallback6; // 지정 인덱스만 사용

       // JSON 파싱 결과 사용 및 본문 수치 검증
       const headerLeft = `${tocTitle} 연구소`;
       const headerCenter = currentDate();
       const headerRight = '';
       const title = tocTitle; // 목차 제목 사용

       const metric1Raw = parsedJson?.METRIC1_VALUE ? String(parsedJson.METRIC1_VALUE).trim() : '';
       let metric1Value = metric1Raw && (compact(corpus).includes(compact(metric1Raw)) || hasAnyNumberInCorpus(metric1Raw)) ? metric1Raw : 'N/A';
       const metric1Title = parsedJson?.METRIC1_TITLE ? String(parsedJson.METRIC1_TITLE).trim() : 'N/A';
       let metric1Description = parsedJson?.METRIC1_DESCRIPTION ? String(parsedJson.METRIC1_DESCRIPTION).trim() : '';
       if (!metric1Description) {
         metric1Description = '정량 수치는 명시되지 않았지만, 관련 지표의 변화가 관찰됩니다.';
       }
 
       const metric2Raw = parsedJson?.METRIC2_VALUE ? String(parsedJson.METRIC2_VALUE).trim() : '';
       let metric2Value = metric2Raw && (compact(corpus).includes(compact(metric2Raw)) || hasAnyNumberInCorpus(metric2Raw)) ? metric2Raw : 'N/A';
       const metric2Title = parsedJson?.METRIC2_TITLE ? String(parsedJson.METRIC2_TITLE).trim() : 'N/A';
       let metric2Description = parsedJson?.METRIC2_DESCRIPTION ? String(parsedJson.METRIC2_DESCRIPTION).trim() : '';
       if (!metric2Description) {
         metric2Description = '수치가 없어도 방향성은 일관되며, 본문 근거가 이를 뒷받침합니다.';
       }
 
       const metric3Raw = normalizePercent(parsedJson?.METRIC3_VALUE ?? '', '');
       let metric3Value = metric3Raw && hasPercentInCorpus(metric3Raw) ? metric3Raw : 'N/A';
       const metric3Title = parsedJson?.METRIC3_TITLE ? String(parsedJson.METRIC3_TITLE).trim() : 'N/A';
       let metric3Description = parsedJson?.METRIC3_DESCRIPTION ? String(parsedJson.METRIC3_DESCRIPTION).trim() : '';
       if (!metric3Description) {
         metric3Description = '정확한 퍼센트는 제공되지 않았으나, 개선 추세는 명확합니다.';
       }
 
       const resultPercentageRaw = parsedJson?.RESULT_PERCENTAGE ? String(parsedJson.RESULT_PERCENTAGE).trim() : '';
       let resultPercentage = resultPercentageRaw && (compact(corpus).includes(compact(resultPercentageRaw)) || hasAnyNumberInCorpus(resultPercentageRaw)) ? resultPercentageRaw : '';
       let resultText = parsedJson?.RESULT_TEXT ? String(parsedJson.RESULT_TEXT).trim() : '';
       if (!resultText) {
         resultText = '정량 결과는 본문에 명시되지 않았으나, 핵심 메시지는 유지됩니다.';
       }
       
       console.log('🔍 6번 슬라이드 파싱 결과:');
       console.log('목차 제목:', tocTitle);
       console.log('원본 응답:', slideContent);
       console.log('제목:', title);
       console.log('메트릭1:', { value: metric1Value, title: metric1Title, description: metric1Description });
       console.log('메트릭2:', { value: metric2Value, title: metric2Title, description: metric2Description });
       console.log('메트릭3:', { value: metric3Value, title: metric3Title, description: metric3Description });
       console.log('결과:', { percentage: resultPercentage, text: resultText });
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
         .replace(/{{METRIC1_VALUE}}/g, metric1Value)
         .replace(/{{METRIC1_TITLE}}/g, metric1Title)
         .replace(/{{METRIC1_DESCRIPTION}}/g, metric1Description)
         .replace(/{{METRIC2_VALUE}}/g, metric2Value)
         .replace(/{{METRIC2_TITLE}}/g, metric2Title)
         .replace(/{{METRIC2_DESCRIPTION}}/g, metric2Description)
         .replace(/{{METRIC3_VALUE}}/g, metric3Value)
         .replace(/{{METRIC3_TITLE}}/g, metric3Title)
         .replace(/{{METRIC3_DESCRIPTION}}/g, metric3Description)
         .replace(/{{RESULT_PERCENTAGE}}/g, resultPercentage)
         .replace(/{{RESULT_TEXT}}/g, resultText)
                   .replace(/{{HEADER_LEFT}}/g, headerLeft)
         .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 7) {
        // 섹션 7: 한국의 AI 전략과 정책
        // 제목 결정: 목차 → 스크립트 → 템플릿 관련 폴백
        const storageKey = `${topic}_${slideCount}`;
        let tocTitles = tocStorage.get(storageKey) || [];
        if (!tocTitles.length) {
          tocTitles = extractSectionTitlesFromScript(scriptContent);
        }
        const fallback7 = `${sectionTitle}의 전략과 정책`;
        const tocTitle = tocTitles[4] || fallback7;
        
        // GPT 응답에서 각 부분을 파싱
        const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
        const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
        const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
        const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
        const subtitleMatch = slideContent.match(/SUBTITLE:\s*(.+?)(?:\n|$)/);
        const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
        const tech1TitleMatch = slideContent.match(/TECH1_TITLE:\s*(.+?)(?:\n|$)/);
        const tech2TitleMatch = slideContent.match(/TECH2_TITLE:\s*(.+?)(?:\n|$)/);
        const tech3TitleMatch = slideContent.match(/TECH3_TITLE:\s*(.+?)(?:\n|$)/);
        const arch1LabelMatch = slideContent.match(/ARCH1_LABEL:\s*(.+?)(?:\n|$)/);
        const arch2LabelMatch = slideContent.match(/ARCH2_LABEL:\s*(.+?)(?:\n|$)/);
        const arch3LabelMatch = slideContent.match(/ARCH3_LABEL:\s*(.+?)(?:\n|$)/);
        
        const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 연구소`;
        const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : '2025-08-15';
        const headerRight = headerRightMatch ? headerRightMatch[1].trim() : '@ai_future';
        const title = tocTitle; // 목차 제목 사용
        const subtitle = subtitleMatch && subtitleMatch[1].trim().length > 0 ? 
          subtitleMatch[1].trim() : 
          '';
        const description = descriptionMatch && descriptionMatch[1].trim().length > 0 ? 
          descriptionMatch[1].trim() : 
          '';
        const tech1Title = tech1TitleMatch && tech1TitleMatch[1].trim().length > 0 ? 
          tech1TitleMatch[1].trim() : 
          '';
        const tech2Title = tech2TitleMatch && tech2TitleMatch[1].trim().length > 0 ? 
          tech2TitleMatch[1].trim() : 
          '';
        const tech3Title = tech3TitleMatch && tech3TitleMatch[1].trim().length > 0 ? 
          tech3TitleMatch[1].trim() : 
          '';
        const arch1Label = arch1LabelMatch && arch1LabelMatch[1].trim().length > 0 ? 
          arch1LabelMatch[1].trim() : 
          '';
        const arch2Label = arch2LabelMatch && arch2LabelMatch[1].trim().length > 0 ? 
          arch2LabelMatch[1].trim() : 
          '';
        const arch3Label = arch3LabelMatch && arch3LabelMatch[1].trim().length > 0 ? 
          arch3LabelMatch[1].trim() : 
          '';
        
        console.log('🔍 7번 슬라이드 파싱 결과:');
        console.log('목차 제목:', tocTitle);
        console.log('원본 응답:', slideContent);
        console.log('제목:', title);
        console.log('부제목:', subtitle);
        console.log('설명:', description);
        console.log('기술1:', tech1Title);
        console.log('기술2:', tech2Title);
        console.log('기술3:', tech3Title);
        console.log('아치1:', arch1Label);
        console.log('아치2:', arch2Label);
               console.log('아치3:', arch3Label);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{TECH1_TITLE}}/g, tech1Title)
          .replace(/{{TECH2_TITLE}}/g, tech2Title)
          .replace(/{{TECH3_TITLE}}/g, tech3Title)
          .replace(/{{ARCH1_LABEL}}/g, arch1Label)
          .replace(/{{ARCH2_LABEL}}/g, arch2Label)
          .replace(/{{ARCH3_LABEL}}/g, arch3Label)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 8) {
        // 섹션 8: AI 윤리와 도전과제
        // 제목 결정: 목차 → 스크립트 → 템플릿 관련 폴백
        const storageKey = `${topic}_${slideCount}`;
        let tocTitles = tocStorage.get(storageKey) || [];
        if (!tocTitles.length) {
          tocTitles = extractSectionTitlesFromScript(scriptContent);
        }
        const fallback8 = `${sectionTitle}의 윤리와 도전과제`;
        const tocTitle = tocTitles[5] || fallback8;

        // JSON 파싱 결과 사용 및 본문 수치 검증
        const headerLeft = `${tocTitle} 연구소`;
        const headerCenter = currentDate();
        const headerRight = '';
        const title = tocTitle; // 목차 제목 사용
        const description = (parsedJson?.DESCRIPTION && String(parsedJson.DESCRIPTION).trim().length > 0)
          ? String(parsedJson.DESCRIPTION).trim()
          : sectionContent;
        const feedback1Text = (parsedJson?.FEEDBACK1_TEXT && String(parsedJson.FEEDBACK1_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK1_TEXT).trim()
          : (sectionKeypoints[0] || (sectionContent.split(/[\.!?\n]/)[0] || '').trim());
        const feedback2Text = (parsedJson?.FEEDBACK2_TEXT && String(parsedJson.FEEDBACK2_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK2_TEXT).trim()
          : (sectionKeypoints[1] || (sectionContent.split(/[\.!?\n]/)[1] || sectionKeypoints[0] || '').trim());
        const feedback3Text = (parsedJson?.FEEDBACK3_TEXT && String(parsedJson.FEEDBACK3_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK3_TEXT).trim()
          : (sectionKeypoints[2] || (sectionContent.split(/[\.!?\n]/)[2] || sectionKeypoints[1] || '').trim());
        const statPercentageCandidate = normalizePercent(parsedJson?.STAT_PERCENTAGE ?? '', '');
        let statPercentage = (statPercentageCandidate && hasPercentInCorpus(statPercentageCandidate))
          ? statPercentageCandidate
          : (extractFirstPercentToken(corpus) || '');
        let statDescription = (parsedJson?.STAT_DESCRIPTION && String(parsedJson.STAT_DESCRIPTION).trim().length > 0)
          ? String(parsedJson.STAT_DESCRIPTION).trim()
          : '';

        // 하단 설명 2문장 보장
        const s8Sentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
        if (!statDescription || statDescription.split(/[.!?]/).filter(Boolean).length < 2) {
          const twoLines = [s8Sentences[0], s8Sentences[1] || s8Sentences[2]].filter(Boolean).join(' ');
          statDescription = twoLines || sectionTitle;
        }

        // 퍼센트가 없으면 배수/일반 숫자라도 확보
        if (!statPercentage) {
          const multiple = extractFirstMultipleToken(corpus);
          const general = extractFirstGeneralNumberToken ? extractFirstGeneralNumberToken(corpus) : null;
          statPercentage = multiple || (general ? `${general}` : '');
        }
        if (!statPercentage) {
          statPercentage = '기준 대비 상승 추세';
        }

        // 강제 재요청: %나 '배' 수치가 전혀 없을 때, 본문 내 수치만 사용하여 반드시 포함하도록
        const hasPercentOrMultiple = /%|배$/.test(statPercentage);
        if (!hasPercentOrMultiple) {
          const strictPrompt8 = `아래 입력에서 실제로 등장하는 퍼센트(%) 또는 '배' 수치 하나만 선택해 JSON으로 반환하세요. 다른 텍스트/마크다운 금지.

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

규칙
- STAT_PERCENTAGE: 입력 본문 또는 키포인트에서 등장하는 % 또는 '배' 수치 중 하나를 그대로 사용(반드시 % 또는 '배' 포함)
- STAT_DESCRIPTION: 해당 수치를 포함한 2문장 설명

형식(JSON)
{"STAT_PERCENTAGE": string, "STAT_DESCRIPTION": string}`;

          try {
            const retryStrict8 = await openai.chat.completions.create({
              model: 'gpt-5-mini',
              messages: [
                { role: 'system', content: 'JSON 외 다른 텍스트를 출력하지 마세요. 숫자는 입력 본문에 실제로 등장한 퍼센트(%) 또는 배수(배)만 허용합니다.' },
                { role: 'system', content: STYLE_SYSTEM },
                { role: 'user', content: strictPrompt8 }
              ]
            });
            const strictContent8 = retryStrict8.choices[0]?.message?.content || '';
            const strictJson8 = strictContent8 ? extractFirstJsonBlock(strictContent8) : null;
            if (strictJson8) {
              try {
                const pj = JSON.parse(strictJson8);
                if (pj?.STAT_PERCENTAGE && (/%|배$/.test(String(pj.STAT_PERCENTAGE).trim()))) {
                  statPercentage = String(pj.STAT_PERCENTAGE).trim();
                }
                if (pj?.STAT_DESCRIPTION && String(pj.STAT_DESCRIPTION).trim().length > 0) {
                  statDescription = String(pj.STAT_DESCRIPTION).trim();
                }
              } catch {}
            }
          } catch {}
        }

        if (!statPercentage) {
          statPercentage = '기준 대비 상승 추세';
        }
        // 설명에 최종 수치가 없다면 괄호로 보조 표기
        if (statPercentage && !statDescription.includes(statPercentage)) {
          statDescription = `${statDescription} (지표: ${statPercentage})`;
        }
        
        console.log('🔍 8번 슬라이드 파싱 결과:');
        console.log('목차 제목:', tocTitle);
        console.log('원본 응답:', slideContent);
        console.log('제목:', title);
        console.log('설명:', description);
        console.log('피드백1:', feedback1Text);
        console.log('피드백2:', feedback2Text);
        console.log('피드백3:', feedback3Text);
        console.log('통계 퍼센트:', statPercentage);
               console.log('통계 설명:', statDescription);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{FEEDBACK1_TEXT}}/g, feedback1Text)
          .replace(/{{FEEDBACK2_TEXT}}/g, feedback2Text)
          .replace(/{{FEEDBACK3_TEXT}}/g, feedback3Text)
          .replace(/{{STAT_PERCENTAGE}}/g, statPercentage)
          .replace(/{{STAT_DESCRIPTION}}/g, statDescription)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 9) {
        // 섹션 9: 사용자 지정 레이아웃(3단 스텝)
        const storageKey = `${topic}_${slideCount}`;
        const tocTitles = tocStorage.get(storageKey) || [];
        const fallback9 = `${sectionTitle}의 기술·비즈니스 사례`;
        const tocTitle = tocTitles[6] || getSectionTitle(9, fallback9);

        const headerLeft = `${tocTitle} 연구소`;
        const headerCenter = currentDate();
        const headerRight = '';
        const title = tocTitle;
        const subtitle = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
        const description = sectionContent;

        // 스텝 내용: 최소 2줄 보장(문장 결합). 키포인트 부족시 본문 문장으로 채움
        const sentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
        const ensureTwoLines = (primary?: string, altIdx = 0) => {
          const a = primary && primary.trim().length > 0 ? primary.trim() : (sentences[altIdx] || '');
          const b = sentences[altIdx + 1] || sentences[0] || '';
          const text = [a, b].filter(Boolean).join(' ');
          return text.length > 0 ? text : '핵심 단계 설명을 준비하세요';
        };
        const step1 = ensureTwoLines(sectionKeypoints[0], 0);
        const step2 = ensureTwoLines(sectionKeypoints[1], 2);
        const step3 = ensureTwoLines(sectionKeypoints[2], 4);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{STEP1_TEXT}}/g, step1)
          .replace(/{{STEP2_TEXT}}/g, step2)
          .replace(/{{STEP3_TEXT}}/g, step3)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 10) {
        // 섹션 10: 미래 준비사항
        // 목차에서 제목 가져오기 (10번 = 목차의 8번째 항목)
        const storageKey = `${topic}_${slideCount}`;
        const tocTitles = tocStorage.get(storageKey) || [];
        const tocTitle = tocTitles[7] || `${sectionTitle}의 미래 준비사항`; // 목차 8번째 항목
        
        // GPT 응답에서 각 부분을 파싱
        const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
        const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
        const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
        const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
        const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
        const practicesTitleMatch = slideContent.match(/PRACTICES_TITLE:\s*(.+?)(?:\n|$)/);
        const practice1NumberMatch = slideContent.match(/PRACTICE1_NUMBER:\s*(.+?)(?:\n|$)/);
        const practice1TextMatch = slideContent.match(/PRACTICE1_TEXT:\s*(.+?)(?:\n|$)/);
        const practice2NumberMatch = slideContent.match(/PRACTICE2_NUMBER:\s*(.+?)(?:\n|$)/);
        const practice2TextMatch = slideContent.match(/PRACTICE2_TEXT:\s*(.+?)(?:\n|$)/);
        const practice3NumberMatch = slideContent.match(/PRACTICE3_NUMBER:\s*(.+?)(?:\n|$)/);
        const practice3TextMatch = slideContent.match(/PRACTICE3_TEXT:\s*(.+?)(?:\n|$)/);
        
        const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 연구소`;
        const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : currentDate();
        const headerRight = headerRightMatch ? headerRightMatch[1].trim() : '';
        const title = tocTitle; // 목차 제목 사용
        const description = (descriptionMatch && descriptionMatch[1].trim().length > 0)
          ? descriptionMatch[1].trim()
          : sectionContent;
        const practicesTitle = (practicesTitleMatch && practicesTitleMatch[1].trim().length > 0)
          ? practicesTitleMatch[1].trim()
          : `${sectionTitle} 관련 준비사항`;
        const practice1Number = practice1NumberMatch ? practice1NumberMatch[1].trim() : '01';
        let practice1Text = (practice1TextMatch && practice1TextMatch[1].trim().length > 0)
          ? practice1TextMatch[1].trim()
          : (sectionKeypoints[0] || '');
        const practice2Number = practice2NumberMatch ? practice2NumberMatch[1].trim() : '02';
        let practice2Text = (practice2TextMatch && practice2TextMatch[1].trim().length > 0)
          ? practice2TextMatch[1].trim()
          : (sectionKeypoints[1] || '');
        const practice3Number = practice3NumberMatch ? practice3NumberMatch[1].trim() : '03';
        let practice3Text = (practice3TextMatch && practice3TextMatch[1].trim().length > 0)
          ? practice3TextMatch[1].trim()
          : (sectionKeypoints[2] || '');

        // 폴백 강화: 문장 2개를 결합해 최소 2줄 분량 보장
        const sentences10 = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
        const ensureTwoLines10 = (current: string, kpIdx: number, sentIdx: number) => {
          const base = (current && current.trim().length >= 10) ? current.trim() : (sectionKeypoints[kpIdx] || '').trim();
          if (base && base.length >= 10) return base;
          const a = sentences10[sentIdx] || sentences10[0] || tocTitle;
          const b = sentences10[sentIdx + 1] || '';
          const joined = [a, b].filter(Boolean).join(' ');
          return joined || tocTitle;
        };
        practice1Text = ensureTwoLines10(practice1Text, 0, 0);
        practice2Text = ensureTwoLines10(practice2Text, 1, 2);
        practice3Text = ensureTwoLines10(practice3Text, 2, 4);
        
        console.log('🔍 10번 슬라이드 파싱 결과:');
        console.log('목차 제목:', tocTitle);
        console.log('원본 응답:', slideContent);
        console.log('제목:', title);
        console.log('설명:', description);
        console.log('준비사항 제목:', practicesTitle);
        console.log('준비사항1:', { number: practice1Number, text: practice1Text });
        console.log('준비사항2:', { number: practice2Number, text: practice2Text });
               console.log('준비사항3:', { number: practice3Number, text: practice3Text });
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{PRACTICES_TITLE}}/g, practicesTitle)
          .replace(/{{PRACTICE1_NUMBER}}/g, practice1Number)
          .replace(/{{PRACTICE1_TEXT}}/g, practice1Text)
          .replace(/{{PRACTICE2_NUMBER}}/g, practice2Number)
          .replace(/{{PRACTICE2_TEXT}}/g, practice2Text)
          .replace(/{{PRACTICE3_NUMBER}}/g, practice3Number)
          .replace(/{{PRACTICE3_TEXT}}/g, practice3Text)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
           .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 11) {
        // 섹션 11: 전략 4단 스텝 레이아웃
        const storageKey = `${topic}_${slideCount}`;
        const tocTitles = tocStorage.get(storageKey) || [];
        const tocTitle = tocTitles[8] || getSectionTitle(11, `${sectionTitle}의 요약 및 행동계획`);

        const headerLeft = '';
        const headerCenter = currentDate();
        const headerRight = '';
        const title = tocTitle;
        const subtitle = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
        const description = sectionContent;

        // 02/03/04가 비지 않도록 강한 폴백: 키포인트 → 불릿라인 → 문장 순으로 채움
        const bulletLines = sectionContent
          .split(/\n+/)
          .map((l) => l.trim())
          .filter((l) => /^(?:[-•\u2022]|\d+\.|\d+\)|\*)\s*/.test(l))
          .map((l) => l.replace(/^(?:[-•\u2022]|\d+\.|\d+\)|\*)\s*/, '').trim())
          .filter(Boolean);

        const sentenceLines = sectionContent
          .split(/[\.!?\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        const candidates: string[] = [];
        for (let i = 0; i < sectionKeypoints.length; i += 1) {
          if (sectionKeypoints[i] && sectionKeypoints[i].trim().length > 0) {
            candidates.push(sectionKeypoints[i].trim());
          }
        }
        // 불릿 추가
        for (const b of bulletLines) {
          if (candidates.length >= 4) break;
          if (!candidates.includes(b)) candidates.push(b);
        }
        // 문장 추가
        for (const s of sentenceLines) {
          if (candidates.length >= 4) break;
          if (!candidates.includes(s)) candidates.push(s);
        }

        // 최종 스텝 텍스트 결정 (최소 4개 보장: 부족하면 마지막 요소를 반복)
        while (candidates.length < 4) {
          candidates.push(candidates[candidates.length - 1] || subtitle || title);
        }

        const step1 = candidates[0];
        const step2 = candidates[1];
        const step3 = candidates[2];
        const step4 = candidates[3];
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{STEP1_TEXT}}/g, step1)
          .replace(/{{STEP2_TEXT}}/g, step2)
          .replace(/{{STEP3_TEXT}}/g, step3)
          .replace(/{{STEP4_TEXT}}/g, step4)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
      } else if (section === 12) {
        // 섹션 12: 감사합니다 & 참고자료
        // 목차에서 제목 가져오기 (12번 = 목차의 10번째 항목)
        const storageKey = `${topic}_${slideCount}`;
        const tocTitles = tocStorage.get(storageKey) || [];
        const tocTitle = tocTitles[9] || `${sectionTitle}의 감사 인사`; // 목차 10번째 항목
        
        // GPT 응답에서 각 부분을 파싱
        const headerLeftMatch = slideContent.match(/HEADER_LEFT:\s*(.+?)(?:\n|$)/);
        const headerCenterMatch = slideContent.match(/HEADER_CENTER:\s*(.+?)(?:\n|$)/);
        const headerRightMatch = slideContent.match(/HEADER_RIGHT:\s*(.+?)(?:\n|$)/);
        const subtitleMatch = slideContent.match(/SUBTITLE:\s*(.+?)(?:\n|$)/);
        const titleMatch = slideContent.match(/TITLE:\s*(.+?)(?:\n|$)/);
        const descriptionMatch = slideContent.match(/DESCRIPTION:\s*(.+?)(?:\n|$)/);
        const referencesLabelMatch = slideContent.match(/REFERENCES_LABEL:\s*(.+?)(?:\n|$)/);
        const reference1LinkMatch = slideContent.match(/REFERENCE1_LINK:\s*(.+?)(?:\n|$)/);
        const reference2LinkMatch = slideContent.match(/REFERENCE2_LINK:\s*(.+?)(?:\n|$)/);
        const reference3LinkMatch = slideContent.match(/REFERENCE3_LINK:\s*(.+?)(?:\n|$)/);
        const emailLabelMatch = slideContent.match(/EMAIL_LABEL:\s*(.+?)(?:\n|$)/);
        const emailAddressMatch = slideContent.match(/EMAIL_ADDRESS:\s*(.+?)(?:\n|$)/);
        const websiteLabelMatch = slideContent.match(/WEBSITE_LABEL:\s*(.+?)(?:\n|$)/);
        const websiteUrlMatch = slideContent.match(/WEBSITE_URL:\s*(.+?)(?:\n|$)/);
        
        const headerLeft = headerLeftMatch ? headerLeftMatch[1].trim() : `${tocTitle} 연구소`;
        const headerCenter = headerCenterMatch ? headerCenterMatch[1].trim() : '2025-08-15';
        const headerRight = headerRightMatch ? headerRightMatch[1].trim() : '@ai_future';

        // 프롬프트 기반 상단 메시지/본문 구성
        const sectionSentences = sectionContent
          .split(/[\.!?\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        const subtitle = (subtitleMatch && subtitleMatch[1].trim().length > 3)
          ? subtitleMatch[1].trim()
          : (sectionSentences[0] || '');

        // 제목은 "감사합니다"만 유지
        const title = '감사합니다';

        // 하단 본문은 프롬프트(섹션 본문)의 두 번째 문장을 우선 사용
        const description = (descriptionMatch && descriptionMatch[1].trim().length > 10)
          ? descriptionMatch[1].trim()
          : (sectionSentences[1] || sectionSentences[0] || '');

        // 오른쪽 "주요 참고" 영역 비활성화를 위해 빈 문자열로 대체
        const referencesLabel = '';
        const reference1Link = '';
        const reference2Link = '';
        const reference3Link = '';
        const emailLabel = '이메일'; // 고정 라벨
        const emailAddress = emailAddressMatch && emailAddressMatch[1].trim().length > 5 ? 
          emailAddressMatch[1].trim() : 
          'contact@ai-future.kr';
        const websiteLabel = '웹사이트'; // 고정 라벨
        const websiteUrl = websiteUrlMatch && websiteUrlMatch[1].trim().length > 3 ? 
          websiteUrlMatch[1].trim() : 
          'ai-future.kr';
        
        console.log('🔍 12번 슬라이드 파싱 결과:');
        console.log('목차 제목:', tocTitle);
        console.log('원본 응답:', slideContent);
        console.log('제목:', title);
        console.log('부제목:', subtitle);
        console.log('설명:', description);
        console.log('참고자료 라벨:', referencesLabel);
        console.log('참고자료1:', reference1Link);
        console.log('참고자료2:', reference2Link);
        console.log('참고자료3:', reference3Link);
        console.log('이메일 라벨:', emailLabel);
        console.log('이메일 주소:', emailAddress);
        console.log('웹사이트 라벨:', websiteLabel);
               console.log('웹사이트 주소:', websiteUrl);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{REFERENCES_LABEL}}/g, referencesLabel)
          .replace(/{{REFERENCE1_LINK}}/g, reference1Link)
          .replace(/{{REFERENCE2_LINK}}/g, reference2Link)
          .replace(/{{REFERENCE3_LINK}}/g, reference3Link)
          .replace(/{{EMAIL_LABEL}}/g, emailLabel)
          .replace(/{{EMAIL_ADDRESS}}/g, emailAddress)
          .replace(/{{WEBSITE_LABEL}}/g, websiteLabel)
          .replace(/{{WEBSITE_URL}}/g, websiteUrl)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
             } else {
         // 일반 섹션: 일반 형식으로 처리
         htmlContent = cleanTemplateContent
           .replace(/{{TITLE}}/g, sectionTitle)
           .replace(/{{CONTENT}}/g, slideContent)
          .replace(/{{HEADER_LEFT}}/g, 'AI 미래 전망')
          .replace(/{{HEADER_CENTER}}/g, '2025-08-05')
          .replace(/{{HEADER_RIGHT}}/g, '@aifuture2025');
      }

    // 최종 안전 치환: 화면에 'N/A'가 보이지 않도록 제거
    if (typeof htmlContent === 'string') {
      htmlContent = htmlContent.replace(/>\s*N\/A\s*</g, '><');
      }

    console.log('✅ HTML 생성 완료!');

    // 빈 출력 방지: 섹션 5/6에서 어떤 이유로든 htmlContent가 비면 최소 템플릿으로 채움
    if ((!htmlContent || htmlContent.trim().length === 0) && (section === 5 || section === 6)) {
      const sents = splitSentences(sectionContent);
      const basicDesc = [sents[0], sents[1], sents[2]].filter(Boolean).join(' ');
      const percent = extractFirstGeneralNumberToken ? (extractFirstGeneralNumberToken(sectionContent) || '') : '';
      if (section === 5) {
        htmlContent = cleanTemplateContent
          .replace(/{{TITLE}}/g, sectionTitle)
          .replace(/{{DESCRIPTION}}/g, basicDesc)
          .replace(/{{GAUGE_VALUE}}/g, percent ? `${percent}%` : '')
          .replace(/{{GAUGE_DESCRIPTION}}/g, sents[1] || basicDesc)
          .replace(/{{STAT_VALUE}}/g, percent ? `${percent}배` : '')
          .replace(/{{STAT_DESCRIPTION}}/g, sents[2] || sents[0] || basicDesc)
          .replace(/{{HEADER_LEFT}}/g, `${topic} 연구소`)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, '');
      } else {
        const m1 = sents[0] || sectionTitle;
        const m2 = sents[1] || m1;
        const m3 = sents[2] || m2;
        htmlContent = cleanTemplateContent
          .replace(/{{TITLE}}/g, sectionTitle)
          .replace(/{{METRIC1_VALUE}}/g, percent ? `${percent}` : 'N/A')
          .replace(/{{METRIC1_TITLE}}/g, '지표1')
          .replace(/{{METRIC1_DESCRIPTION}}/g, m1)
          .replace(/{{METRIC2_VALUE}}/g, percent ? `${percent}` : 'N/A')
          .replace(/{{METRIC2_TITLE}}/g, '지표2')
          .replace(/{{METRIC2_DESCRIPTION}}/g, m2)
          .replace(/{{METRIC3_VALUE}}/g, percent ? `${percent}%` : '')
          .replace(/{{METRIC3_TITLE}}/g, '지표3')
          .replace(/{{METRIC3_DESCRIPTION}}/g, m3)
          .replace(/{{RESULT_PERCENTAGE}}/g, percent ? `${percent}%` : '')
          .replace(/{{RESULT_TEXT}}/g, sents[0] || sectionTitle)
          .replace(/{{HEADER_LEFT}}/g, `${topic} 연구소`)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, '');
      }
    }

    return NextResponse.json({ 
      html: htmlContent,
      format: 'html',
      topic: topic,
      section: section,
      totalSections: slideCount,
      script: scriptContent
    });

  } catch (error) {
    console.error('❌ 슬라이드 생성 오류:', error);
    return NextResponse.json(
      { error: '슬라이드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 