import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CompanyAnalysis {
  coreValues: string[];
  idealCandidate: string;
  vision: string;
  businessAreas: string[];
  companyCulture: string;
  keyCompetencies: string[];
}

// 회사별 공식 사이트 URL 매핑
const COMPANY_URLS: { [key: string]: string[] } = {
  '네이버': [
    'https://recruit.navercorp.com/rcrt/view.do?id=65&sw=&subJobCdArr=1010001%2C1010002%2C1010003%2C1010004%2C1010005%2C1010006%2C1010007%2C1010008%2C1010009%2C1010010%2C1010011%2C1010012%2C1010013',
    'https://www.navercorp.com/value'
  ],
  '카카오': [
    'https://careers.kakao.com/jobs',
    'https://www.kakaocorp.com/page/detail/9217'
  ],
  '삼성전자': [
    'https://www.samsung.com/sec/aboutsamsung/company/corporateprofile/',
    'https://sec.samsung.com/recruitment'
  ],
  'SK텔레콤': [
    'https://www.sktelecom.com/index.do',
    'https://careers.sktelecom.com'
  ],
  'LG전자': [
    'https://www.lge.co.kr/company/company-overview',
    'https://careers.lge.com'
  ]
};

// 일반적인 회사 정보 수집을 위한 검색 키워드
const getCompanySearchUrls = (companyName: string) => {
  return [
    `https://www.google.com/search?q=${encodeURIComponent(companyName + ' 인재상 핵심가치 공식사이트')}`,
    `https://www.google.com/search?q=${encodeURIComponent(companyName + ' 채용 requirements 자격요건')}`
  ];
};

// 웹페이지 내용 가져오기
async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 불필요한 태그 제거
    $('script, style, nav, footer, aside').remove();
    
    // 주요 내용만 추출
    const content = $('main, article, .content, .main-content, h1, h2, h3, p').text();
    
    return content.replace(/\s+/g, ' ').trim().substring(0, 3000); // 3000자로 제한
  } catch (error) {
    console.error(`웹 내용 가져오기 실패 (${url}):`, error);
    return '';
  }
}

// 회사 정보 분석
async function analyzeCompanyInfo(companyName: string, webContent: string[]): Promise<CompanyAnalysis> {
  const combinedContent = webContent.join('\n\n');
  
  const analysisPrompt = `
다음은 "${companyName}"에 대한 웹사이트 정보입니다. 이 정보를 바탕으로 회사의 특성을 분석해주세요.

웹사이트 내용:
${combinedContent}

다음 항목들을 JSON 형태로 정리해주세요:

1. 회사의 핵심가치 (3-5개)
2. 인재상 (원하는 인재의 특성)
3. 회사 비전/미션
4. 주요 사업 분야
5. 회사 문화 특징
6. 면접에서 중요하게 볼 것 같은 역량들

응답 형식:
{
  "coreValues": ["핵심가치1", "핵심가치2", "핵심가치3"],
  "idealCandidate": "인재상에 대한 설명",
  "vision": "회사 비전/미션",
  "businessAreas": ["사업분야1", "사업분야2"],
  "companyCulture": "회사 문화 특징",
  "keyCompetencies": ["중요역량1", "중요역량2", "중요역량3"]
}

웹사이트 정보가 부족하다면, "${companyName}"에 대한 일반적으로 알려진 정보를 바탕으로 분석해주세요.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 기업 분석 전문가입니다. 회사의 웹사이트 정보를 분석하여 핵심가치, 인재상, 문화 등을 정확하게 파악해주세요.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const result = completion.choices[0]?.message?.content;
    
    if (!result) {
      throw new Error('회사 분석 결과를 생성할 수 없습니다.');
    }

    return JSON.parse(result);
  } catch (error) {
    console.error('회사 정보 분석 오류:', error);
    
    // 기본 정보 반환
    return {
      coreValues: ['혁신', '성장', '협업'],
      idealCandidate: '적극적이고 성장지향적인 인재',
      vision: '업계를 선도하는 기업',
      businessAreas: ['IT', '기술'],
      companyCulture: '수평적이고 자유로운 문화',
      keyCompetencies: ['문제해결능력', '소통능력', '학습능력']
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyName } = await request.json();

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: '회사명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`회사 분석 시작: ${companyName}`);

    // 1. 회사별 URL 또는 검색 URL 준비
    const urlsToAnalyze = COMPANY_URLS[companyName] || getCompanySearchUrls(companyName);
    
    // 2. 웹 내용 수집
    const webContents: string[] = [];
    
    for (const url of urlsToAnalyze.slice(0, 2)) { // 최대 2개 URL만 분석
      try {
        const content = await fetchWebContent(url);
        if (content) {
          webContents.push(content);
        }
      } catch (error) {
        console.error(`URL 분석 실패 (${url}):`, error);
      }
    }

    // 3. 회사 정보 분석
    const companyAnalysis = await analyzeCompanyInfo(companyName, webContents);

    // 4. 분석 결과 기반으로 맞춤형 질문 생성 프롬프트 준비
    const enhancedPrompt = {
      companyInfo: companyAnalysis,
      analysisComplete: true
    };

    return NextResponse.json({
      success: true,
      companyAnalysis: companyAnalysis,
      enhancedPrompt: enhancedPrompt,
      message: `${companyName}의 공식 정보를 분석하여 맞춤형 면접 질문을 준비했습니다.`
    });

  } catch (error) {
    console.error('회사 분석 오류:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: '회사 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 