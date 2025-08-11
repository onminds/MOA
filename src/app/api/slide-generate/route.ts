import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 슬라이드 타입별 템플릿 매핑
const templateMap: { [key: string]: string } = {
  'intro': 'Modern company/template1.html',
  'stat-trend': 'Modern company/template3.html',
  'challenge': 'Modern company/template6.html',
  'case-success': 'Modern company/template7.html',
  'case-failure': 'Modern company/template8.html',
  'policy': 'Modern company/template10.html',
  'solution': 'Modern company/template11.html',
  'conclusion': 'Modern company/template12.html',
  'market-overview': 'Modern company/template3.html',
  'consumer-insight': 'Modern company/template9.html',
  'learning-method': 'Modern company/template4.html',
  'public-opinion': 'Modern company/template9.html',
  'literacy': 'Modern company/template4.html'
};

// 타입별 필수 필드 정의
const requiredFieldsByType: { [key: string]: string[] } = {
  'intro': ['TITLE', 'DESCRIPTION'],
  'stat-trend': ['TITLE', 'DESCRIPTION', 'TRENDS', 'STATS'],
  'challenge': ['TITLE', 'DESCRIPTION', 'CHALLENGES'],
  'case-success': ['TITLE', 'DESCRIPTION', 'EXAMPLES'],
  'case-failure': ['TITLE', 'DESCRIPTION', 'EXAMPLES'],
  'policy': ['TITLE', 'DESCRIPTION', 'POLICIES'],
  'solution': ['TITLE', 'DESCRIPTION', 'SOLUTIONS'],
  'conclusion': ['TITLE', 'DESCRIPTION'],
  'market-overview': ['TITLE', 'DESCRIPTION', 'MARKET'],
  'consumer-insight': ['TITLE', 'DESCRIPTION', 'INSIGHTS'],
  'learning-method': ['TITLE', 'DESCRIPTION', 'METHODS'],
  'public-opinion': ['TITLE', 'DESCRIPTION', 'OPINIONS'],
  'literacy': ['TITLE', 'DESCRIPTION', 'LITERACY']
};

// 템플릿 경로 가져오는 유틸 함수 (완전 재작성)
function getTemplatePath(type: string, selectedTemplate?: string): string {
  console.log(`🔍 템플릿 선택 분석:`);
  console.log(`   - 슬라이드 타입: ${type}`);
  console.log(`   - 선택된 템플릿: ${selectedTemplate}`);
  
  // 사용자가 템플릿을 선택한 경우 무조건 해당 템플릿 사용
  if (selectedTemplate && selectedTemplate !== '') {
    // template4 -> template4.html
    const templatePath = `Modern company/${selectedTemplate}.html`;
    console.log(`   ✅ 사용자 선택 템플릿 사용: ${templatePath}`);
    return templatePath;
  }
  
  // 선택하지 않은 경우에만 기본 매핑 사용
  const defaultTemplate = templateMap[type] || 'Modern company/template1.html';
  console.log(`   🔄 기본 매핑 템플릿 사용: ${defaultTemplate}`);
  return defaultTemplate;
}

// 템플릿 치환 함수 (완전 재작성)
function populateTemplate(template: string, type: string, data: Record<string, string>): string {
  let result = template;
  
  console.log(`🔧 템플릿 치환 시작:`);
  console.log(`   - 사용 가능한 데이터:`, Object.keys(data));
  console.log(`   - 데이터 값들:`, data);

  // 모든 가능한 필드에 대해 치환 시도
  const allPossibleFields = [
    'TITLE', 'DESCRIPTION', 'TRENDS', 'STATS', 'CHALLENGES', 
    'EXAMPLES', 'POLICIES', 'SOLUTIONS', 'MARKET', 'INSIGHTS', 
    'METHODS', 'OPINIONS', 'LITERACY', 'HEADER_LEFT', 'HEADER_CENTER', 
    'HEADER_RIGHT', 'CONTENT', 'SUBTITLE', 'GAUGE_VALUE', 'GAUGE_DESCRIPTION',
    'STAT_VALUE', 'STAT_DESCRIPTION', 'PRIORITY_CIRCLES'
  ];

  // 1단계: 직접 매칭되는 필드들 치환
  allPossibleFields.forEach((field) => {
    const value = data[field] || '';
    if (value) {
      result = result.replace(new RegExp(`{{${field}}}`, 'g'), value);
      console.log(`   ✅ ${field} 치환 완료: "${value.substring(0, 50)}..."`);
    }
  });

  // 2단계: 매핑된 필드들 치환
  const fieldMappings = {
    'HEADER_CENTER': ['TITLE'],
    'CONTENT': ['DESCRIPTION'],
    'HEADER_LEFT': [''],
    'HEADER_RIGHT': ['']
  };

  Object.entries(fieldMappings).forEach(([templateField, sourceFields]) => {
    const value = sourceFields.map(field => data[field]).find(val => val) || '';
    if (value) {
      result = result.replace(new RegExp(`{{${templateField}}}`, 'g'), value);
      console.log(`   🔄 ${templateField} 매핑 치환: "${value.substring(0, 50)}..."`);
    }
  });

  // 3단계: 특별한 필드들 처리
  // TRENDS를 리스트 아이템으로 변환
  if (data['TRENDS']) {
    const trendsList = data['TRENDS']
      .split('\n')
      .filter(line => line.trim())
      .map(line => `<li>${line.trim()}</li>`)
      .join('\n');
    result = result.replace(/{{TRENDS}}/g, trendsList);
    console.log(`   📊 TRENDS 리스트 변환 완료`);
  }

  // STATS를 통계 텍스트로 변환
  if (data['STATS']) {
    const statsText = data['STATS'].replace(/\n/g, ' ').trim();
    result = result.replace(/{{STATS}}/g, statsText);
    console.log(`   📈 STATS 텍스트 변환 완료`);
  }

  // CHALLENGES를 리스트 아이템으로 변환
  if (data['CHALLENGES']) {
    const challengesList = data['CHALLENGES']
      .split('\n')
      .filter(line => line.trim())
      .map(line => `<li>${line.trim()}</li>`)
      .join('\n');
    result = result.replace(/{{CHALLENGES}}/g, challengesList);
    console.log(`   🚧 CHALLENGES 리스트 변환 완료`);
  }

  // 4단계: 빈 필드들을 기본값으로 치환
  const emptyFieldDefaults = {
    'HEADER_LEFT': '',
    'HEADER_RIGHT': '',
    'HEADER_CENTER': data['TITLE'] || '',
    'CONTENT': data['DESCRIPTION'] || ''
  };

  Object.entries(emptyFieldDefaults).forEach(([field, defaultValue]) => {
    result = result.replace(new RegExp(`{{${field}}}`, 'g'), defaultValue);
    if (defaultValue) {
      console.log(`   🎯 ${field} 기본값 설정: "${defaultValue.substring(0, 50)}..."`);
    }
  });

  // 5단계: 남은 모든 플레이스홀더 제거
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  // 6단계: 강제 가로 텍스트 CSS 추가
  result = result.replace(/<style>/g, `<style>
    * {
      writing-mode: horizontal-tb !important;
      text-orientation: mixed !important;
      white-space: normal !important;
      word-wrap: break-word !important;
      word-break: keep-all !important;
    }
    h1, h2, h3, p, span, div, li, ul, ol {
      writing-mode: horizontal-tb !important;
      text-orientation: mixed !important;
      white-space: normal !important;
      word-wrap: break-word !important;
      word-break: keep-all !important;
      overflow-wrap: break-word !important;
      line-height: normal !important;
      text-align: left !important;
    }
    .title, h1 {
      writing-mode: horizontal-tb !important;
      text-orientation: mixed !important;
      white-space: normal !important;
      word-wrap: break-word !important;
      word-break: keep-all !important;
    }
    .description, p {
      writing-mode: horizontal-tb !important;
      text-orientation: mixed !important;
      white-space: normal !important;
      word-wrap: break-word !important;
      word-break: keep-all !important;
    }
  `);
  
  console.log(`   ✅ 템플릿 치환 완료!`);
  return result;
}

// 타입별 프롬프트 생성 함수 (완전 개선된 버전)
function buildPromptByType(type: string, title: string, description: string): string {
  const basePrompt = `슬라이드 제목: ${title}
슬라이드 설명: ${description}

이 슬라이드는 "${title}"에 대한 내용을 담고 있습니다. 주제에 맞는 구체적이고 의미 있는 한국어 내용을 작성해주세요.

중요: 
1. 반드시 아래 형식으로만 출력해주세요. 다른 설명이나 추가 텍스트는 포함하지 마세요.
2. 모든 내용은 한국어로 작성해주세요.
3. 주제에 맞는 구체적이고 실용적인 내용을 작성해주세요.
4. HTML 태그나 마크다운 코드 블록을 사용하지 마세요. 순수 텍스트만 작성해주세요.
5. 각 필드는 새로운 줄로 시작하고 콜론(:)으로 구분해주세요.

출력 형식:`;

  switch (type) {
    case 'intro':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}`;
    
    case 'stat-trend':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
TRENDS: (주제와 관련된 핵심 트렌드 3~4줄로 구체적으로 작성)
STATS: (주제와 관련된 구체적인 수치와 통계 정보 포함)`;
    
    case 'challenge':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
CHALLENGES: (주제와 관련된 중요한 장애요인이나 문제점 3~4개를 항목별로 구체적으로 작성)`;
    
    case 'case-success':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
EXAMPLES: (주제와 관련된 성공 사례 2~3개를 구체적으로 작성)`;
    
    case 'case-failure':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
EXAMPLES: (주제와 관련된 실패 사례나 한계점 2~3개를 구체적으로 작성)`;
    
    case 'policy':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
POLICIES: (주제와 관련된 정책이나 제도 3~4개를 구체적으로 작성)`;
    
    case 'solution':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
SOLUTIONS: (주제와 관련된 해결 방안 3~4개를 구체적으로 작성)`;
    
    case 'conclusion':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}`;
    
    case 'market-overview':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
MARKET: (주제와 관련된 시장 현황 분석을 구체적으로 작성)`;
    
    case 'consumer-insight':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
INSIGHTS: (주제와 관련된 소비자 인사이트를 구체적으로 작성)`;
    
    case 'learning-method':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
METHODS: (주제와 관련된 학습 방법 3~4개를 구체적으로 작성)`;
    
    case 'public-opinion':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
OPINIONS: (주제와 관련된 여론 분석을 구체적으로 작성)`;
    
    case 'literacy':
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}
LITERACY: (주제와 관련된 리터러시 교육 방안을 구체적으로 작성)`;
    
    default:
      return `${basePrompt}
TITLE: ${title}
DESCRIPTION: ${description}`;
  }
}

// 슬라이드 구조 생성 함수 (완전 개선된 버전)
async function generateSlideStructure(topic: string): Promise<any[]> {
  const prompt = `
너는 발표 슬라이드를 구성하는 전문가야.

사용자가 입력한 발표 주제에 맞게 다음과 같은 슬라이드 구조를 JSON 배열로 생성해줘.

중요:
1. 모든 제목과 설명은 한국어로 작성해주세요.
2. 주제에 맞는 구체적이고 의미 있는 내용으로 작성해주세요.
3. 제목은 간결하고 명확하게 작성해주세요.

출력 규칙:
1. 5~7개의 슬라이드를 생성할 것
2. 각 슬라이드는 다음 3가지 정보를 포함
   - title: 슬라이드 제목 (한국어)
   - description: 해당 슬라이드에서 전달하고자 하는 요약 설명 (한국어)
   - type: 슬라이드의 콘텐츠 유형 (아래 목록에서 선택)

슬라이드 type 목록:
- intro
- stat-trend
- challenge
- case-success
- case-failure
- policy
- solution
- literacy
- conclusion
- market-overview
- consumer-insight
- learning-method
- public-opinion

요청 주제: "${topic}"

정확히 JSON 배열 형태로만 출력해줘. 설명은 생략하고 JSON만 출력해.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "당신은 프레젠테이션 구조 설계 전문가입니다. 주제에 맞는 슬라이드 구조를 한국어로 JSON 배열로 생성해주세요."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('슬라이드 구조 생성에 실패했습니다.');
  }

  try {
    // JSON 파싱 시도
    const slides = JSON.parse(content);
    return Array.isArray(slides) ? slides : [];
  } catch (error) {
    console.error('JSON 파싱 실패:', content);
    // 기본 구조 반환 (한국어)
    return [
      {
        title: `${topic} - 소개`,
        description: `${topic}에 대한 기본적인 소개와 배경`,
        type: 'intro'
      },
      {
        title: `${topic} - 현황 분석`,
        description: `${topic}의 현재 상황과 통계`,
        type: 'stat-trend'
      },
      {
        title: `${topic} - 문제점`,
        description: `${topic}에서 발생하는 주요 문제점들`,
        type: 'challenge'
      },
      {
        title: `${topic} - 해결 방안`,
        description: `${topic}의 문제점에 대한 해결책`,
        type: 'solution'
      },
      {
        title: `${topic} - 결론`,
        description: `${topic}에 대한 종합적인 결론`,
        type: 'conclusion'
      }
    ];
  }
}

// 슬라이드 HTML 생성 함수 (완전 개선된 버전)
async function generateSlidesFromGPTResponse(slides: any[], selectedTemplate?: string): Promise<{html: string, type: string, title: string}[]> {
  const resultSlides: {html: string, type: string, title: string}[] = [];

  for (const section of slides) {
    console.log(`📝 ${section.type} 슬라이드 생성 중...`);
    console.log(`🎨 선택된 템플릿: ${selectedTemplate || '자동 선택'}`);
    
    const prompt = buildPromptByType(section.type, section.title, section.description);
    console.log(`📝 AI 프롬프트:`, prompt);

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 프레젠테이션 슬라이드 내용 전문가입니다. 주어진 정보를 바탕으로 적절한 내용을 생성해주세요. HTML 태그나 마크다운을 사용하지 말고 순수 텍스트만 작성해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '';
    console.log(`🤖 AI 응답:`, content);
    
    const contentData: Record<string, string> = {};
    
    // HTML 태그와 마크다운 코드 블록 제거
    let cleanContent = content
      .replace(/```html\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    
    console.log(`🧹 정리된 내용:`, cleanContent);
    
    // 모든 가능한 필드에 대해 파싱 시도
    const allPossibleFields = [
      'TITLE', 'DESCRIPTION', 'TRENDS', 'STATS', 'CHALLENGES', 
      'EXAMPLES', 'POLICIES', 'SOLUTIONS', 'MARKET', 'INSIGHTS', 
      'METHODS', 'OPINIONS', 'LITERACY'
    ];

    allPossibleFields.forEach((field) => {
      const match = cleanContent.match(new RegExp(`${field}:\\s*([\\s\\S]*?)(?:\\n[A-Z]+:|$)`));
      contentData[field] = match ? match[1].trim() : '';
      if (match) {
        console.log(`✅ ${field} 파싱 성공: "${match[1].trim().substring(0, 50)}..."`);
      } else {
        console.log(`❌ ${field} 파싱 실패`);
      }
    });

    // 템플릿 파일 읽기 및 적용 (선택된 템플릿 사용)
    const templatePath = path.join(process.cwd(), 'src', 'templates', getTemplatePath(section.type, selectedTemplate));
    console.log(`📄 사용할 템플릿: ${getTemplatePath(section.type, selectedTemplate)}`);
    
    const template = await fs.readFile(templatePath, 'utf-8');
    const html = populateTemplate(template, section.type, contentData);

    resultSlides.push({ html, type: section.type, title: section.title });
    console.log(`✅ ${section.type} 슬라이드 완료 (템플릿: ${getTemplatePath(section.type, selectedTemplate)})`);
  }

  return resultSlides;
}

export async function POST(request: NextRequest) {
  try {
    const { topic, slideCount = 6, section = 1, template } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: '주제가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log('🎯 PPT 생성 시작');
    console.log('📝 주제:', topic);
    console.log('📊 총 슬라이드 수:', slideCount);
    console.log('📍 현재 섹션:', section);
    console.log('🎨 선택된 템플릿:', template || '자동 선택');

    // 슬라이드 구조 생성 (단순화된 버전)
    const slideStructure = await generateSlideStructure(topic);
    console.log('📊 슬라이드 구조:', slideStructure);

    // 특정 섹션의 슬라이드 정보 추출
    const currentSlide = slideStructure[section - 1];
    if (!currentSlide) {
      throw new Error(`섹션 ${section}을 찾을 수 없습니다.`);
    }

    console.log(`🎯 현재 슬라이드 타입: ${currentSlide.type}`);
    console.log(`🎨 적용될 템플릿: ${getTemplatePath(currentSlide.type, template)}`);

    // 단일 슬라이드 HTML 생성 (선택된 템플릿 사용)
    const htmlSlides = await generateSlidesFromGPTResponse([currentSlide], template);
    const htmlContent = htmlSlides[0].html;

    console.log('✅ HTML 생성 완료!');

    return NextResponse.json({ 
      html: htmlContent,
      format: 'html',
      topic: topic,
      section: section,
      totalSections: slideStructure.length,
      slideStructure: slideStructure,
      currentSlide: currentSlide,
      usedTemplate: getTemplatePath(currentSlide.type, template),
      selectedTemplate: template
    });

  } catch (error) {
    console.error('❌ 슬라이드 생성 오류:', error);
    return NextResponse.json(
      { error: '슬라이드 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 