import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 회사별 공식 사이트 URL 매핑
const COMPANY_URLS: { [key: string]: string[] } = {
  '네이버': [
    'https://recruit.navercorp.com/rcrt/view.do?id=65&sw=&subJobCdArr=1010001%2C1010002%2C1010003%2C1010004%2C1010005%2C1010006%2C1010007%2C1010008%2C1010009%2C1010010%2C1010011%2C1010012%2C1010013',
    'https://www.navercorp.com/ko/company/naver'
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
  ],
  '펄어비스': [
    'https://www.pearlabyss.com/ko/company/overview',
    'https://careers.pearlabyss.com'
  ],
  '쿠팡': [
    'https://www.coupang.com/about',
    'https://careers.coupang.com'
  ],
  '토스': [
    'https://toss.im/about',
    'https://toss.im/careers'
  ],
  '당근마켓': [
    'https://about.daangn.com',
    'https://careers.daangn.com'
  ],
  '대성마이맥': [
    'https://www.dsm.co.kr',
    'https://www.dsm.co.kr/company/overview',
    'https://www.dsm.co.kr/recruit'
  ]
};

// 일반적인 회사 정보 수집을 위한 URL 생성
const getCompanySearchUrls = (companyName: string) => {
  // 일반적인 회사 웹사이트 패턴
  const commonPatterns = [
    `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.co.kr`,
    `https://${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
    `https://${companyName.toLowerCase().replace(/\s+/g, '')}.co.kr`,
    `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.kr`,
    `https://${companyName.toLowerCase().replace(/\s+/g, '')}.kr`
  ];
  
  // 특수한 회사명 처리
  const specialCases: { [key: string]: string[] } = {
    '대성마이맥': [
      'https://www.dsm.co.kr',
      'https://www.dsm.co.kr/company',
      'https://www.dsm.co.kr/recruit'
    ],
    '해성디에스': [
      'https://www.haesungds.com',
      'https://www.haesungds.com/company',
      'https://www.haesungds.com/recruit',
      'https://www.haesungds.co.kr',
      'https://www.haesungds.co.kr/company'
    ],
    '현대자동차': [
      'https://www.hyundai.com/kr/ko/company',
      'https://recruit.hyundai.com'
    ],
    '기아': [
      'https://www.kia.com/kr/company',
      'https://recruit.kia.com'
    ],
    '포스코': [
      'https://www.posco.co.kr/kr/company',
      'https://recruit.posco.com'
    ]
  };
  
  return specialCases[companyName] || commonPatterns;
};

// 회사명에서 업계 추측
const guessIndustryFromCompanyName = (companyName: string): string => {
  const name = companyName.toLowerCase();
  
  // 반도체/전자 관련 키워드 (최우선)
  if (name.includes('반도체') || name.includes('디스') || name.includes('하성') ||
      name.includes('삼성전자') || name.includes('sk하이닉스') || name.includes('하이닉스') ||
      name.includes('마이크론') || name.includes('미쓰비시') || name.includes('도시바') ||
      name.includes('인피니온') || name.includes('nxp') || name.includes('스탠다드') ||
      name.includes('칩') || name.includes('메모리') || name.includes('ic') ||
      name.includes('wafer') || name.includes('fab') || name.includes('foundry')) {
    return '반도체/전자';
  }
  
  // IT/소프트웨어 관련 키워드
  if (name.includes('소프트') || name.includes('시스템') || name.includes('정보') || 
      name.includes('테크') || name.includes('디지털') || name.includes('네트워크') ||
      name.includes('컴퓨터') || name.includes('데이터') || name.includes('ai') ||
      name.includes('it') || name.includes('platform') || name.includes('solution') ||
      name.includes('개발') || name.includes('프로그램') || name.includes('앱')) {
    return 'IT/소프트웨어';
  }
  
  // 자동차 관련 키워드
  if (name.includes('자동차') || name.includes('현대') || name.includes('기아') ||
      name.includes('bmw') || name.includes('벤츠') || name.includes('아우디') ||
      name.includes('토요타') || name.includes('혼다') || name.includes('닛산') ||
      name.includes('포드') || name.includes('쉐보레') || name.includes('쌍용')) {
    return '자동차/부품';
  }
  
  // 제조업 관련 키워드
  if (name.includes('제조') || name.includes('산업') || name.includes('공업') ||
      name.includes('전자') || name.includes('화학') || name.includes('철강') ||
      name.includes('중공업') || name.includes('건설') || name.includes('조선') ||
      name.includes('포스코') || name.includes('lg화학') || name.includes('롯데케미칼')) {
    return '제조업';
  }
  
  // 금융 관련 키워드
  if (name.includes('은행') || name.includes('증권') || name.includes('보험') ||
      name.includes('카드') || name.includes('금융') || name.includes('투자') ||
      name.includes('신한') || name.includes('국민') || name.includes('하나') ||
      name.includes('우리') || name.includes('기업') || name.includes('농협')) {
    return '금융업';
  }
  
  // 유통/서비스 관련 키워드
  if (name.includes('마켓') || name.includes('쇼핑') || name.includes('유통') ||
      name.includes('서비스') || name.includes('컨설팅') || name.includes('교육') ||
      name.includes('쿠팡') || name.includes('당근') || name.includes('배달') ||
      name.includes('카카오') || name.includes('네이버') || name.includes('토스')) {
    return '서비스업';
  }
  
  // 바이오/헬스케어 관련 키워드
  if (name.includes('바이오') || name.includes('제약') || name.includes('의료') ||
      name.includes('헬스') || name.includes('생명') || name.includes('의약') ||
      name.includes('한미') || name.includes('유한') || name.includes('동아') ||
      name.includes('제넨') || name.includes('셀트리온') || name.includes('삼성바이오')) {
    return '바이오/헬스케어';
  }
  
  // 통신 관련 키워드
  if (name.includes('통신') || name.includes('sk텔레콤') || name.includes('kt') ||
      name.includes('lg유플러스') || name.includes('lg u+') || name.includes('유플러스')) {
    return '통신업';
  }
  
  return '일반기업';
};

// 회사 정보를 찾기 위한 대체 방법들
const getAlternativeCompanyInfo = async (companyName: string) => {
  const alternativeSources = [];
  
  // 1. 채용 사이트에서 정보 수집
  const jobSites = [
    `https://www.saramin.co.kr/zf_user/search?searchword=${encodeURIComponent(companyName)}`,
    `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(companyName)}`,
    `https://www.incruit.com/search/?q=${encodeURIComponent(companyName)}`
  ];
  
  // 2. 기업 정보 사이트
  const companyInfoSites = [
    `https://www.nicebizinfo.com/search?q=${encodeURIComponent(companyName)}`,
    `https://www.bizinfo.go.kr/web/lay1/program/S1T122C008/menu.do?code=1&searchKeyword=${encodeURIComponent(companyName)}`
  ];
  
  // 3. 뉴스 및 언론사 정보
  const newsSites = [
    `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(companyName + ' 인재상')}`,
    `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(companyName + ' 기업문화')}`
  ];
  
  return [...jobSites, ...companyInfoSites, ...newsSites];
};

// 웹페이지 내용 가져오기
async function fetchWebContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      // 타임아웃 설정
      signal: AbortSignal.timeout(10000) // 10초 타임아웃
    });
    
    if (!response.ok) {
      console.warn(`웹사이트 접근 실패 (${url}): HTTP ${response.status}`);
      return '';
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 불필요한 태그 제거
    $('script, style, nav, footer, aside').remove();
    
    // 주요 내용만 추출
    const content = $('main, article, .content, .main-content, h1, h2, h3, p').text();
    
    return content.replace(/\s+/g, ' ').trim().substring(0, 3000); // 3000자로 제한
  } catch (error) {
    console.warn(`웹 내용 가져오기 실패 (${url}):`, error instanceof Error ? error.message : '알 수 없는 오류');
    return '';
  }
}

// 회사 정보 분석
async function analyzeCompanyInfo(companyName: string, webContent: string[]): Promise<any> {
  const combinedContent = webContent.join('\n\n');
  const industry = guessIndustryFromCompanyName(companyName);
  
  const analysisPrompt = `
다음은 "${companyName}"에 대한 웹사이트 정보입니다. 이 정보를 바탕으로 회사의 특성을 분석해주세요.

웹사이트 내용:
${combinedContent}

**중요: 반드시 아래 JSON 형식으로만 응답해주세요. 다른 설명, 텍스트, 마크다운 코드 블록은 포함하지 마세요. 모든 내용은 한국어로 작성해주세요.**

{
  "coreValues": ["핵심가치1", "핵심가치2", "핵심가치3"],
  "idealCandidate": "인재상에 대한 설명",
  "vision": "회사 비전/미션",
  "businessAreas": ["사업분야1", "사업분야2"],
  "companyCulture": "회사 문화 특징",
  "keyCompetencies": ["중요역량1", "중요역량2", "중요역량3"]
}

**분석 가이드라인:**
1. 웹사이트 정보가 부족한 경우, "${companyName}"의 업계 특성(${industry})과 일반적인 기업 문화를 바탕으로 분석해주세요.
2. 중소기업의 경우 창의성, 유연성, 성장지향적 특성을 고려해주세요.
3. 대기업의 경우 체계성, 전문성, 안정성을 고려해주세요.
4. 반도체/전자 기업의 경우 정밀성, 품질관리, 기술혁신, 연구개발, 안정성, 반도체 패키징, 웨이퍼 처리, IC 제조, 메모리 기술 등을 강조해주세요.
5. IT/소프트웨어 기업의 경우 혁신성, 학습능력, 적응력, 문제해결능력을 강조해주세요.
6. 자동차/부품 기업의 경우 안전성, 품질관리, 기술혁신, 협업능력을 강조해주세요.
7. 제조업의 경우 정확성, 안전성, 품질관리, 체계성을 강조해주세요.
8. 금융업의 경우 신뢰성, 정확성, 고객중심, 리스크관리를 강조해주세요.
9. 서비스업의 경우 고객서비스, 소통능력, 창의성, 유연성을 강조해주세요.
10. 바이오/헬스케어의 경우 정확성, 안전성, 연구개발, 윤리성을 강조해주세요.
11. 통신업의 경우 고객서비스, 기술혁신, 안정성, 네트워크 관리능력을 강조해주세요.

**모든 응답은 반드시 한국어로 작성해주세요.** 웹사이트 정보가 부족하더라도 회사명과 업계 특성을 바탕으로 합리적인 분석을 제공해주세요.
응답은 오직 위의 JSON 형식만 포함해야 합니다.
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 한국의 기업 분석 전문가입니다. 회사의 웹사이트 정보를 분석하여 핵심가치, 인재상, 문화 등을 정확하게 파악해주세요. **반드시 요청된 JSON 형식으로만 응답해주세요. 다른 설명, 텍스트, 마크다운 코드 블록은 절대 포함하지 마세요.** 모든 응답은 한국어로 작성해주세요. 응답은 오직 유효한 JSON 객체만 포함해야 합니다.'
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

    // JSON 응답 정리 및 검증
    let cleanedResult = result.trim();
    
    // JSON 블록이 있는지 확인하고 추출
    const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResult = jsonMatch[0];
    }
    
    // 불필요한 문자 제거
    cleanedResult = cleanedResult.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // 추가 정리 작업
    cleanedResult = cleanedResult
      .replace(/[\u2018\u2019]/g, "'") // 스마트 따옴표를 일반 따옴표로
      .replace(/[\u201C\u201D]/g, '"') // 스마트 따옴표를 일반 따옴표로
      .replace(/\n/g, ' ') // 줄바꿈 제거
      .replace(/\r/g, '') // 캐리지 리턴 제거
      .replace(/\t/g, ' ') // 탭 제거
      .replace(/\s+/g, ' ') // 연속된 공백을 하나로
      .trim();
    
    try {
      return JSON.parse(cleanedResult);
    } catch (parseError) {
      console.error('JSON 파싱 실패, 원본 응답:', result);
      console.error('정리된 응답:', cleanedResult);
      
      // 더 강력한 JSON 정리 시도
      try {
        // 따옴표 문제 해결
        let fixedResult = cleanedResult
          .replace(/([^"\\])\s*"/g, '$1"') // 키 앞의 따옴표 정리
          .replace(/"\s*([^"\\])/g, '"$1') // 키 뒤의 따옴표 정리
          .replace(/([^"\\])\s*:/g, '$1":') // 콜론 앞 정리
          .replace(/:\s*([^"\\])/g, ':"$1') // 콜론 뒤 정리
          .replace(/,\s*}/g, '}') // 마지막 쉼표 제거
          .replace(/,\s*]/g, ']'); // 배열 마지막 쉼표 제거
        
        return JSON.parse(fixedResult);
      } catch (secondParseError) {
        console.error('두 번째 JSON 파싱 시도 실패:', secondParseError);
        
        // 기본 JSON 구조 생성 시도
        try {
          // 핵심 키워드 추출
          const coreValuesMatch = result.match(/핵심가치[":\s]*\[([^\]]+)\]/);
          const idealCandidateMatch = result.match(/인재상[":\s]*([^,\n]+)/);
          const visionMatch = result.match(/비전[":\s]*([^,\n]+)/);
          const businessAreasMatch = result.match(/사업분야[":\s]*\[([^\]]+)\]/);
          const companyCultureMatch = result.match(/문화[":\s]*([^,\n]+)/);
          const keyCompetenciesMatch = result.match(/역량[":\s]*\[([^\]]+)\]/);
          
          const fallbackResult = {
            coreValues: coreValuesMatch ? 
              coreValuesMatch[1].split(',').map(v => v.trim().replace(/['"]/g, '')) : 
              ['혁신', '성장', '협업'],
            idealCandidate: idealCandidateMatch ? 
              idealCandidateMatch[1].trim().replace(/['"]/g, '') : 
              '적극적이고 성장지향적인 인재',
            vision: visionMatch ? 
              visionMatch[1].trim().replace(/['"]/g, '') : 
              '업계를 선도하는 기업',
            businessAreas: businessAreasMatch ? 
              businessAreasMatch[1].split(',').map(v => v.trim().replace(/['"]/g, '')) : 
              ['IT', '기술'],
            companyCulture: companyCultureMatch ? 
              companyCultureMatch[1].trim().replace(/['"]/g, '') : 
              '수평적이고 자유로운 문화',
            keyCompetencies: keyCompetenciesMatch ? 
              keyCompetenciesMatch[1].split(',').map(v => v.trim().replace(/['"]/g, '')) : 
              ['문제해결능력', '소통능력', '학습능력']
          };
          
          console.log('키워드 추출을 통한 기본 구조 생성:', fallbackResult);
          return fallbackResult;
          
        } catch (fallbackError) {
          console.error('키워드 추출 실패:', fallbackError);
          throw new Error('AI 응답을 JSON으로 파싱할 수 없습니다.');
        }
      }
    }
  } catch (error) {
    console.error('회사 정보 분석 오류:', error);
    
    // JSON 파싱 오류인 경우 기본 정보 반환
    if (error instanceof Error && error.message.includes('JSON')) {
      console.log('JSON 파싱 실패로 기본 정보 반환');
      
      // 업계별 기본 정보 제공
      const industry = guessIndustryFromCompanyName(companyName);
      let defaultInfo;
      
      if (industry === '반도체/전자') {
        defaultInfo = {
          coreValues: ['정밀성', '품질관리', '기술혁신'],
          idealCandidate: '반도체 업계에 대한 전문성과 정밀성을 갖춘 인재',
          vision: '반도체 패키징 분야의 글로벌 리더',
          businessAreas: ['반도체 패키징', '전자부품 제조'],
          companyCulture: '정밀성과 품질을 중시하는 기술 중심 문화',
          keyCompetencies: ['정밀성', '품질관리', '기술혁신', '연구개발']
        };
      } else {
        defaultInfo = {
      coreValues: ['혁신', '성장', '협업'],
      idealCandidate: '적극적이고 성장지향적인 인재',
      vision: '업계를 선도하는 기업',
      businessAreas: ['IT', '기술'],
      companyCulture: '수평적이고 자유로운 문화',
      keyCompetencies: ['문제해결능력', '소통능력', '학습능력']
    };
      }
      
      return defaultInfo;
    }
    
    // 다른 오류는 그대로 던지기
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { companyName, jobTitle } = await request.json();

    if (!companyName) {
      return NextResponse.json(
        { success: false, error: '회사명이 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`회사 분석 시작: ${companyName}`);
    const webContents: string[] = [];
    let content: string | null = null;

    // 1. 사람인을 최우선으로 정보 수집
    console.log(`[1순위] 사람인(Saramin)에서 정보 수집 시도...`);
    const saraminUrl = `https://www.saramin.co.kr/zf_user/search?search_area=main&search_done=y&search_optional_item=y&searchType=company&searchword=${encodeURIComponent(companyName)}`;
    content = await fetchWebContent(saraminUrl);

    if (content && content.length > 50) {
        console.log(`✅ 사람인 정보 수집 성공 (${content.length}자)`);
        webContents.push(content);
    } else {
        console.log(`❌ 사람인 정보 수집 실패 또는 내용 부족. 다음 소스를 시도합니다.`);
        
        // 2. 잡코리아에서 정보 수집 (차선책)
        console.log(`[2순위] 잡코리아(JobKorea)에서 정보 수집 시도...`);
        const jobKoreaUrl = `https://www.jobkorea.co.kr/Search/?stext=${encodeURIComponent(companyName)}`;
        content = await fetchWebContent(jobKoreaUrl);
        if (content && content.length > 50) {
            console.log(`✅ 잡코리아 정보 수집 성공 (${content.length}자)`);
            webContents.push(content);
        } else {
            console.log(`❌ 잡코리아 정보 수집 실패 또는 내용 부족. 다음 소스를 시도합니다.`);
            
            // 3. 공식 웹사이트 등 기존 방식으로 정보 수집
            console.log(`[3순위] 공식 웹사이트에서 정보 수집 시도...`);
            const otherUrls = COMPANY_URLS[companyName] || getCompanySearchUrls(companyName);
            for (const url of otherUrls.slice(0, 2)) { // Try up to 2 official sites
                content = await fetchWebContent(url);
                if (content && content.length > 50) {
                    console.log(`✅ 공식 웹사이트 정보 수집 성공: ${url} (${content.length}자)`);
                    webContents.push(content);
                    // If we get one good result from the official site, that's probably enough.
                    break; 
                }
            }
        }
    }

    if (webContents.length === 0) {
      console.log(`⚠️ 모든 소스에서 ${companyName}에 대한 유의미한 정보를 찾지 못했습니다. 회사명만으로 분석을 시도합니다.`);
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
    console.error('회사 정보 분석 오류:', error);
    
    let errorMessage = '회사 분석 중 오류가 발생했습니다.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // JSON 파싱 오류인 경우 특별 처리
      if (error.message.includes('JSON')) {
        errorMessage = 'AI 응답 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
        statusCode = 422; // Unprocessable Entity
      }
      
      // 네트워크 오류인 경우
      if (error.message.includes('fetch') || error.message.includes('network')) {
        errorMessage = '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.';
        statusCode = 503; // Service Unavailable
      }
      
      // 타임아웃 오류인 경우
      if (error.message.includes('timeout') || error.message.includes('AbortSignal')) {
        errorMessage = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
        statusCode = 408; // Request Timeout
      }
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : '알 수 없는 오류' : undefined
      },
      { status: statusCode }
    );
  }
}
