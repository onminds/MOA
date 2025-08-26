import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
export const runtime = 'nodejs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Unsplash 이미지 검색 함수
async function searchUnsplashImages(query: string, count: number = 1, sessionKey: string = 'default'): Promise<string[]> {
  try {
    const accessKey = process.env.UNSPLASH_ACCESS_KEY;
    
    if (!accessKey) {
      console.warn('Unsplash API 키가 설정되지 않음 - 키워드 기반 기본 이미지 사용');
      // 키워드를 영어로 번역
      const englishQuery = await translateToEnglish(query);
      console.log('🔍 번역된 키워드:', englishQuery);
      
      // 키워드 기반 이미지 매핑
      const keywordImageMap = await getImageByKeyword(englishQuery, sessionKey);
      return [keywordImageMap];
    }

    // 영어 키워드로 변환 (더 나은 검색 결과를 위해)
    const englishQuery = await translateToEnglish(query);
    
    const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(englishQuery)}&per_page=${Math.min(count, 30)}&orientation=landscape&content_filter=high`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Client-ID ${accessKey}`,
        'Accept-Version': 'v1'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Unsplash API 오류: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Unsplash에서 받은 이미지들을 중복 방지 선택으로 처리
      const allImages = data.results.map((photo: any) => 
        `${photo.urls.regular}?w=800&h=600&fit=crop&crop=center`
      );
      
      // 중복 방지 선택
      const selectedImages: string[] = [];
      for (let i = 0; i < count && i < allImages.length; i++) {
        const uniqueImage = selectUniqueImage(sessionKey, allImages);
        selectedImages.push(uniqueImage);
      }
      
      return selectedImages;
    }
    
    // 검색 결과가 없으면 키워드 기반 이미지 반환
    console.log('🔄 Unsplash 검색 결과 없음 - 키워드 기반 이미지 사용');
    const keywordBasedImage = await getImageByKeyword(englishQuery, sessionKey);
    return [keywordBasedImage];
    
  } catch (error) {
    console.error('Unsplash 이미지 검색 실패:', error);
    // 오류 시에도 키워드 기반 이미지 사용
    try {
      const englishQuery = await translateToEnglish(query);
      const keywordBasedImage = await getImageByKeyword(englishQuery, sessionKey);
      return [keywordBasedImage];
    } catch (fallbackError) {
      console.error('키워드 기반 이미지 선택도 실패:', fallbackError);
      // 최후의 수단: 기본 이미지
      const defaultImages = [
        'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop'
      ];
      const randomIndex = Math.floor(Math.random() * defaultImages.length);
      return [defaultImages[randomIndex]];
    }
  }
}

// 한글을 영어로 번역하는 함수 (더 나은 Unsplash 검색을 위해)
async function translateToEnglish(koreanText: string): Promise<string> {
  try {
    const prompt = `다음 한글 텍스트를 Unsplash 이미지 검색에 적합한 영어 키워드로 번역해주세요. 구체적이고 시각적인 단어 위주로 3-5개 단어로 구성해주세요.

한글 텍스트: ${koreanText}

영어 키워드:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 한글을 영어로 번역하는 전문가입니다. 이미지 검색에 적합한 키워드를 생성합니다.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 50
    });

    const englishKeywords = response.choices[0]?.message?.content?.trim() || '';
    return englishKeywords || koreanText;
  } catch (error) {
    console.error('번역 실패:', error);
    // 번역 실패시 기본 키워드 매핑
    const keywordMap: { [key: string]: string } = {
      'AI': 'artificial intelligence technology',
      '인공지능': 'artificial intelligence',
      '데이터': 'data analytics',
      '기술': 'technology innovation',
      '미래': 'future technology',
      '비즈니스': 'business meeting',
      '분석': 'data analysis',
      '전략': 'strategy planning',
      '혁신': 'innovation technology',
      '디지털': 'digital transformation'
    };
    
    for (const [korean, english] of Object.entries(keywordMap)) {
      if (koreanText.includes(korean)) {
        return english;
      }
    }
    
    return 'technology business innovation';
  }
}

// 키워드 기반 이미지 선택 함수
async function getImageByKeyword(englishKeywords: string, sessionKey: string = 'default'): Promise<string> {
  // 키워드를 소문자로 변환하고 공백으로 분리
  const keywords = englishKeywords.toLowerCase().split(/[\s,]+/);
  
  // 키워드별 이미지 매핑 (카테고리별로 여러 이미지 제공)
  const keywordImageMap: { [key: string]: string[] } = {
    // AI & Technology
    'artificial': [
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&h=600&fit=crop'
    ],
    'intelligence': [
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&h=600&fit=crop'
    ],
    'ai': [
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1555255707-c07966088b7b?w=800&h=600&fit=crop'
    ],
    'technology': [
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop'
    ],
    'digital': [
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop'
    ],
    
    // Data & Analytics
    'data': [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop'
    ],
    'analytics': [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop'
    ],
    'chart': [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop'
    ],
    'analysis': [
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&h=600&fit=crop'
    ],
    
    // Business & Meeting
    'business': [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop'
    ],
    'meeting': [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop'
    ],
    'strategy': [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop'
    ],
    'planning': [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop'
    ],
    'team': [
      'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop'
    ],
    
    // Innovation & Future
    'innovation': [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop'
    ],
    'future': [
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop'
    ],
    'development': [
      'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop'
    ],
    
    // Network & Connection
    'network': [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop'
    ],
    'connection': [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop'
    ],
    'communication': [
      'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop'
    ],
    
    // Healthcare & Medical
    'health': [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&h=600&fit=crop'
    ],
    'medical': [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&h=600&fit=crop'
    ],
    'healthcare': [
      'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=800&h=600&fit=crop'
    ],
    
    // Education & Learning
    'education': [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop'
    ],
    'learning': [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop'
    ],
    'training': [
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=600&fit=crop',
      'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&h=600&fit=crop'
    ]
  };
  
  // 키워드 매칭 및 중복 방지 이미지 선택
  for (const keyword of keywords) {
    if (keywordImageMap[keyword]) {
      const images = keywordImageMap[keyword];
      console.log(`🎯 키워드 "${keyword}" 매칭됨 - 중복 방지 이미지 선택`);
      return selectUniqueImage(sessionKey, images);
    }
  }
  
  // 매칭되는 키워드가 없으면 기본 이미지에서 중복 방지 선택
  console.log('🔄 매칭되는 키워드 없음 - 기본 이미지에서 중복 방지 선택');
  const defaultImages = [
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&h=600&fit=crop', // AI/Technology
    'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=600&fit=crop', // Data/Analytics
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', // Business/Meeting
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop', // Innovation
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&h=600&fit=crop', // Future/Tech
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=600&fit=crop', // Teamwork
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop', // Charts/Data
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop', // Network/Connection
    'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=600&fit=crop', // Digital/Code
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop'  // Strategy/Planning
  ];
  return selectUniqueImage(sessionKey, defaultImages);
}

// 중복 방지 이미지 선택 함수
function selectUniqueImage(sessionKey: string, availableImages: string[]): string {
  // 세션별 사용된 이미지 추적
  if (!usedImagesStorage.has(sessionKey)) {
    usedImagesStorage.set(sessionKey, new Set<string>());
  }
  
  const usedImages = usedImagesStorage.get(sessionKey)!;
  
  // 사용되지 않은 이미지 필터링
  const unusedImages = availableImages.filter(img => !usedImages.has(img));
  
  // 모든 이미지가 사용되었으면 초기화 (새로운 라운드 시작)
  if (unusedImages.length === 0) {
    console.log('🔄 모든 이미지 사용됨 - 이미지 풀 초기화');
    usedImages.clear();
    const selectedImage = availableImages[Math.floor(Math.random() * availableImages.length)];
    usedImages.add(selectedImage);
    return selectedImage;
  }
  
  // 사용되지 않은 이미지 중에서 랜덤 선택
  const selectedImage = unusedImages[Math.floor(Math.random() * unusedImages.length)];
  usedImages.add(selectedImage);
  
  console.log(`🎯 고유 이미지 선택됨 (${usedImages.size}/${availableImages.length} 사용됨)`);
  return selectedImage;
}

// 내용 기반 아이콘 선택 함수
function selectIconsForContent(title: string, content: string, keypoints: string[]): { leftIcon: string, rightIcon: string } {
  const allText = `${title} ${content} ${keypoints.join(' ')}`.toLowerCase();
  
  // 아이콘 매핑 테이블
  const iconMappings = [
    // 기술/AI 관련
    { keywords: ['ai', '인공지능', '기계학습', '딥러닝', '알고리즘', 'machine', 'learning'], icons: ['fas fa-robot', 'fas fa-microchip'] },
    { keywords: ['데이터', '분석', '통계', 'data', 'analytics', '빅데이터'], icons: ['fas fa-chart-bar', 'fas fa-database'] },
    { keywords: ['네트워크', '연결', '통신', 'network', '클라우드', 'cloud'], icons: ['fas fa-network-wired', 'fas fa-cloud'] },
    { keywords: ['보안', '암호', 'security', '방화벽', '해킹'], icons: ['fas fa-shield-alt', 'fas fa-lock'] },
    
    // 비즈니스 관련
    { keywords: ['비즈니스', '경영', '전략', 'business', '매출', '수익'], icons: ['fas fa-briefcase', 'fas fa-chart-line'] },
    { keywords: ['마케팅', '광고', '브랜드', 'marketing', '홍보'], icons: ['fas fa-bullhorn', 'fas fa-users'] },
    { keywords: ['금융', '투자', '은행', 'finance', '돈', '자금'], icons: ['fas fa-dollar-sign', 'fas fa-piggy-bank'] },
    { keywords: ['성장', '발전', '향상', '증가', 'growth'], icons: ['fas fa-arrow-up', 'fas fa-rocket'] },
    
    // 의료/건강 관련
    { keywords: ['의료', '건강', '병원', 'medical', '치료', '진단'], icons: ['fas fa-heartbeat', 'fas fa-user-md'] },
    { keywords: ['연구', '실험', '개발', 'research', '과학'], icons: ['fas fa-flask', 'fas fa-microscope'] },
    
    // 교육 관련
    { keywords: ['교육', '학습', '훈련', 'education', '지식'], icons: ['fas fa-graduation-cap', 'fas fa-book'] },
    { keywords: ['혁신', '창의', '아이디어', 'innovation', '발명'], icons: ['fas fa-lightbulb', 'fas fa-cogs'] },
    
    // 산업/제조 관련
    { keywords: ['제조', '생산', '공장', 'manufacturing', '산업'], icons: ['fas fa-industry', 'fas fa-tools'] },
    { keywords: ['자동화', '로봇', 'automation', '효율'], icons: ['fas fa-robot', 'fas fa-cogs'] },
    
    // 환경/에너지 관련
    { keywords: ['환경', '에너지', '친환경', 'energy', '지속가능'], icons: ['fas fa-leaf', 'fas fa-solar-panel'] },
    { keywords: ['교통', '운송', '물류', 'transport', '배송'], icons: ['fas fa-truck', 'fas fa-shipping-fast'] },
    
    // 일반적인 비즈니스 용어들 (더 넓은 매칭)
    { keywords: ['관리', '운영', '시스템', 'system', '프로세스', 'process'], icons: ['fas fa-cogs', 'fas fa-tasks'] },
    { keywords: ['서비스', '고객', 'service', 'customer', '사용자', 'user'], icons: ['fas fa-users', 'fas fa-handshake'] },
    { keywords: ['품질', '성능', 'quality', 'performance', '효과', '결과'], icons: ['fas fa-star', 'fas fa-trophy'] },
    { keywords: ['계획', '전략', 'plan', 'strategy', '목표', 'goal'], icons: ['fas fa-bullseye', 'fas fa-map'] },
    { keywords: ['문제', '해결', 'problem', 'solution', '개선', '향상'], icons: ['fas fa-wrench', 'fas fa-check-circle'] },
    { keywords: ['정보', '지식', 'information', 'knowledge', '학습'], icons: ['fas fa-info-circle', 'fas fa-brain'] },
    { keywords: ['시장', '경쟁', 'market', 'competition', '기회'], icons: ['fas fa-chart-pie', 'fas fa-chess'] },
    { keywords: ['미래', '전망', 'future', '발전', 'development'], icons: ['fas fa-crystal-ball', 'fas fa-arrow-up'] }
  ];
  
  // 매칭되는 아이콘 찾기
  for (const mapping of iconMappings) {
    const matchedKeywords = mapping.keywords.filter(keyword => allText.includes(keyword));
    if (matchedKeywords.length > 0) {
      console.log(`🎯 아이콘 매칭: "${matchedKeywords.join(', ')}" -> ${mapping.icons.join(', ')}`);
      return {
        leftIcon: mapping.icons[0],
        rightIcon: mapping.icons[1] || mapping.icons[0]
      };
    }
  }
  
  // 키워드 매칭 실패시 - 다양한 기본 아이콘 풀에서 랜덤 선택
  const fallbackIconSets = [
    { leftIcon: 'fas fa-lightbulb', rightIcon: 'fas fa-chart-line' },      // 아이디어 + 성과
    { leftIcon: 'fas fa-cogs', rightIcon: 'fas fa-rocket' },               // 시스템 + 성장
    { leftIcon: 'fas fa-users', rightIcon: 'fas fa-target' },              // 팀워크 + 목표
    { leftIcon: 'fas fa-brain', rightIcon: 'fas fa-trophy' },              // 지능 + 성취
    { leftIcon: 'fas fa-puzzle-piece', rightIcon: 'fas fa-star' },         // 해결책 + 우수성
    { leftIcon: 'fas fa-handshake', rightIcon: 'fas fa-medal' },           // 협력 + 성과
    { leftIcon: 'fas fa-eye', rightIcon: 'fas fa-thumbs-up' },             // 관찰 + 승인
    { leftIcon: 'fas fa-compass', rightIcon: 'fas fa-flag' },              // 방향 + 목표
    { leftIcon: 'fas fa-key', rightIcon: 'fas fa-gem' },                   // 핵심 + 가치
    { leftIcon: 'fas fa-magic', rightIcon: 'fas fa-crown' },               // 혁신 + 리더십
    { leftIcon: 'fas fa-fire', rightIcon: 'fas fa-mountain' },             // 열정 + 도전
    { leftIcon: 'fas fa-seedling', rightIcon: 'fas fa-tree' },             // 시작 + 성장
    { leftIcon: 'fas fa-bolt', rightIcon: 'fas fa-sun' },                  // 에너지 + 밝음
    { leftIcon: 'fas fa-heart', rightIcon: 'fas fa-smile' },               // 열정 + 만족
    { leftIcon: 'fas fa-diamond', rightIcon: 'fas fa-award' }              // 품질 + 인정
  ];
  
  // 제목과 내용의 길이를 기반으로 인덱스 생성 (일관성 있는 선택)
  const textHash = (title + content).length;
  const selectedSet = fallbackIconSets[textHash % fallbackIconSets.length];
  
  console.log(`🔄 키워드 매칭 실패 - 폴백 아이콘 사용: ${selectedSet.leftIcon}, ${selectedSet.rightIcon}`);
  return selectedSet;
}

// 대본 내용을 기반으로 이미지 검색 키워드 생성
async function generateImageKeywords(title: string, content: string, keypoints: string[]): Promise<string> {
  try {
    const prompt = `다음 PPT 슬라이드 내용을 바탕으로 관련 이미지를 찾기 위한 검색 키워드를 생성해주세요.

제목: ${title}
내용: ${content}
키포인트: ${keypoints.join(', ')}

규칙:
- 구체적이고 시각적인 키워드로 작성
- 영어와 한글을 적절히 조합
- 이미지로 표현 가능한 개념 위주
- 3-5개 단어로 구성
- 추상적인 개념보다는 구체적인 사물이나 상황 위주

검색 키워드:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: '당신은 PPT 슬라이드에 적합한 이미지 검색 키워드를 생성하는 전문가입니다.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100
    });

    return response.choices[0]?.message?.content?.trim() || `${title} ${keypoints[0] || ''}`;
  } catch (error) {
    console.error('이미지 키워드 생성 실패:', error);
    return `${title} ${keypoints[0] || ''}`;
  }
}

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

// 이미지 사용 추적 저장소 (중복 방지용)
const usedImagesStorage = new Map<string, Set<string>>();

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

// 제목/소제목 길이 제한(주제목 20자, 소제목 15자)
function clampTitle20(title: string): string {
  const s = String(title || '').trim().replace(/\s+/g, ' ');
  return s.length <= 20 ? s : s.slice(0, 20);
}

function clampSubtitle15(text: string): string {
  const s = String(text || '').trim().replace(/\s+/g, ' ');
  return s.length <= 15 ? s : s.slice(0, 15);
}

// 목차 품질 보정: 대괄호 제거 및 20자 이내로 정리
function cleanTocTitle(title: string): string {
  return String(title || '')
    .replace(/[\[\]]/g, '') // [] 모두 제거
    .replace(/\s+/g, ' ')
    .trim();
}
function clampTocTitle20(title: string): string {
  const cleaned = cleanTocTitle(title);
  return cleaned.length <= 20 ? cleaned : cleaned.slice(0, 20);
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

// 숫자/퍼센트/배수 토큰 유틸리티
function extractFirstPercentToken(text: string): string {
  const m = text.match(/\b\d{1,3}(?:[\d,.]*?)%/);
  return m ? m[0].replace(/\s+/g, '') : '';
}
function extractFirstMultipleToken(text: string): string {
  const m = text.match(/\b\d+(?:[\d,.]*?)\s*배\b/);
  return m ? m[0].replace(/\s+/g, '') : '';
}
function extractFirstGeneralNumberToken(text: string): string {
  const m = text.match(/\b\d[\d,.]*\b/);
  return m ? m[0] : '';
}
function hasPercentInCorpus(value: string): boolean {
  return /%/.test(value || '');
}

// 대본 캐시 저장소 (메모리 기반)
const scriptStorage = new Map<string, string>();

export async function POST(request: NextRequest) {
    const { topic, slideCount = 5, section = 1, tocTitles: incomingTocTitles, script: incomingScript } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: '주제가 필요합니다.' },
        { status: 400 }
      );
    }
    
    // 세션별 고유 키 생성 (주제 + 슬라이드 수로 구성)
    const sessionKey = `${topic}_${slideCount}`;

    console.log('🎯 PPT 생성 시작');
    console.log('📝 주제:', topic);
    console.log('📊 총 섹션 수:', slideCount);
    console.log('📍 현재 섹션:', section);

    // 외부에서 목차가 들어온 경우 캐시에 선 저장(요청 간 일관성 보장)
    const preStorageKey = `${topic}_${slideCount}`;
    if (Array.isArray(incomingTocTitles) && incomingTocTitles.length === 10) {
      tocStorage.set(preStorageKey, incomingTocTitles.map(String));
    }

    // 1단계: 대본 생성 또는 재사용
    let scriptContent: string = '';
    const scriptKey = `${topic}_${slideCount}_script`;
    
    // 기존 대본이 있으면 재사용, 없으면 새로 생성
    if (incomingScript && typeof incomingScript === 'string' && incomingScript.trim().length > 0) {
      scriptContent = incomingScript;
      scriptStorage.set(scriptKey, scriptContent);
      console.log('📜 기존 대본 재사용 (클라이언트에서 전달)');
    } else if (scriptStorage.has(scriptKey)) {
      scriptContent = scriptStorage.get(scriptKey)!;
      console.log('📜 기존 대본 재사용 (서버 캐시)');
    } else {
      console.log('📜 새 대본 생성 시작');
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

      try {
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
        scriptContent = scriptCompletion.choices[0]?.message?.content || '';
      } catch (e) {
        console.error('스크립트 생성 실패, 폴백 사용:', e);
      }
      // 폴백: OpenAI 실패 시에도 섹션 4가 멈추지 않도록 최소 스크립트 구성
      if (!scriptContent || scriptContent.trim().length === 0) {
        scriptContent = `3카드 섹션\n제목: ${topic}\n내용: ${topic} 소개와 배경 설명.\n키포인트: 핵심 개요, 주요 현황, 배경\n\n4카드 섹션\n제목: ${topic}\n내용: ${topic}의 핵심 요소와 중요 포인트.\n키포인트: 포인트1, 포인트2, 포인트3`;
      }
      
      // 새로 생성한 대본을 캐시에 저장
      scriptStorage.set(scriptKey, scriptContent);
    }
    
    // 생성된 전체 대본을 콘솔에 출력 (CMD에서 확인용) - 첫 번째 섹션일 때만
    if (section === 1) {
      try {
        console.log('\n📜 전체 PPT 대본 시작');
        console.log('==================================================');
        // 대본을 청크 단위로 나누어 출력하여 짤림 방지
        const chunks = scriptContent.match(/.{1,2000}/g) || [scriptContent];
        chunks.forEach((chunk, index) => {
          console.log(`[대본 청크 ${index + 1}/${chunks.length}]`);
          console.log(chunk);
          if (index < chunks.length - 1) console.log('--- 계속 ---');
        });
        console.log('==================================================');
        console.log('📜 전체 PPT 대본 끝\n');
      } catch (err) {
        console.error('대본 출력 중 오류:', err);
      }
    }

    // 스크립트에서 섹션별 제목을 항상 추출 (3~12번)
    const scriptSectionTitles = extractSectionTitlesFromScript(scriptContent);
    const getSectionTitle = (n: number, fallback: string) => {
      const idx = n - 3; // 3번 섹션부터 시작
      return scriptSectionTitles[idx] || fallback;
    };

    // 2단계: 특정 섹션만 추출 (내구성 향상)
    const tolerantRegex = new RegExp(
      `${section}\\s*카드\\s*섹션[\\s\\S]*?제목\\s*:\\s*([^\\n]+)[\\s\\S]*?내용\\s*:\\s*([^\\n]+)[\\s\\S]*?키\\s*포인트?\\s*:\\s*([^\\n]+)`,
      'i'
    );
    let sectionMatch = scriptContent.match(tolerantRegex);
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
      // 폴백: 생성이 멈추지 않도록 최소 데이터 채움
      sectionTitle = getSectionTitle(section, `섹션 ${section}`);
      const sents = splitSentences(scriptContent);
      sectionContent = [sents[0], sents[1], sents[2]].filter(Boolean).join(' ');
      sectionKeypoints = sents.slice(3, 8).filter(Boolean).slice(0, 3);
    }

    // 목차 기반 제목 헬퍼 (섹션 3~12 → 목차 1~10)
    const tocKey = `${topic}_${slideCount}`;
    const getTocTitles = (): string[] => tocStorage.get(tocKey) || scriptSectionTitles;
    const getTocTitleForSection = (n: number, fallback: string): string => {
      const titles = getTocTitles();
      const idx = n - 3;
      const t = titles[idx];
      return t && t.trim().length > 0 ? t : getSectionTitle(n, fallback);
    };
    const displayTitle = (section >= 3 && section <= 12)
      ? clampTitle20(getTocTitleForSection(section, sectionTitle))
      : clampTitle20(sectionTitle);

    // 본문 텍스트와 키포인트를 합친 코퍼스 (수치 검증/추출에 사용)
    const corpus = `${sectionContent} ${sectionKeypoints.join(' ')}`;
    const compact = (s: string) => s.replace(/\s+/g, '');

    // 슬라이드 조립용 변수(미선언 사용 오류 방지)
    let htmlContent: string = '';
    // 기본적으로 섹션 본문을 사용(템플릿 전용 포맷이 오면 이후 로직에서 치환)
    let slideContent: string = sectionContent;

    // 3단계: HTML 생성
    let contentPrompt = '';
    
         // 템플릿 이름 결정
     let templateName = 'template1';
     if (section === 1) {
       templateName = 'Clinique Slide/template1';
     } else if (section === 2) {
       templateName = 'Clinique Slide/template2';
     } else if (section === 3) {
       templateName = 'Clinique Slide/template3';
     } else if (section === 4) {
       templateName = 'Clinique Slide/template4';
     } else if (section === 5) {
       templateName = 'Clinique Slide/template5';
     } else if (section === 6) {
       templateName = 'Clinique Slide/template6';
     } else if (section === 7) {
       templateName = 'Clinique Slide/template7';
     } else if (section === 8) {
       templateName = 'Clinique Slide/template8';
     } else if (section === 9) {
       templateName = 'Clinique Slide/template9';
     } else if (section === 10) {
       templateName = 'Clinique Slide/template10';
     } else if (section === 11) {
       templateName = 'Clinique Slide/template11';
     } else if (section === 12) {
       templateName = 'Clinique Slide/template12';
     }
    
    // 템플릿 로드
    const templateContent = await loadTemplate(templateName);
    console.log(`🔧 섹션 ${section} 템플릿 로드됨:`, templateName, '길이:', templateContent.length);
    
         // 템플릿에서 프롬프트 추출
     const templatePrompt = extractPromptFromTemplate(templateContent);
    console.log(`🔧 섹션 ${section} 프롬프트 추출됨:`, templatePrompt ? '성공' : '실패');
     
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
     
    try {
     if (templatePrompt) {
        // 섹션 1: Clinique template1 동적 채움(소제목/태그라인 1줄, WEBSITE 제거)
        if (section === 1) {
          // GPT로 섹션 1 내용 생성 (15자 이내 소제목)
          const section1Prompt = `아래 입력을 바탕으로 PPT 첫 페이지용 내용을 생성해주세요.

입력:
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

다음 형식으로 출력하세요:
TITLE: [20자 이내 PPT 제목]
SUBTITLE: [15자 이내 핵심 요약]
TAGLINE: [20자 이내 한줄 설명]

중요한 규칙:
- TITLE은 20자 이내로 PPT의 제목 느낌으로 작성
- SUBTITLE은 반드시 15자 이내로 작성하되, 완전한 의미를 담은 문장으로 작성하세요. 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다. 15자 안에서 완성된 내용으로 작성하세요. 마침표(.)는 붙이지 마세요.
- TAGLINE은 20자 이내로 간결한 설명
- 각 항목은 지정된 글자 수를 절대 초과하지 마세요`;

          let gpt1Response = '';
          try {
            const s1Resp = await openai.chat.completions.create({
              model: 'gpt-5-mini',
              messages: [
                { role: 'system', content: STYLE_SYSTEM },
                { role: 'user', content: section1Prompt }
              ]
            });
            gpt1Response = s1Resp.choices[0]?.message?.content?.trim() || '';
          } catch (err) {
            console.error('섹션 1 GPT 호출 실패:', err);
          }

          // GPT 응답에서 값 추출
          const extractValue = (key: string, fallback: string) => {
            const match = gpt1Response.match(new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`));
            return match ? match[1].trim() : fallback;
          };

          const title = extractValue('TITLE', sectionTitle);
          let subtitle = extractValue('SUBTITLE', (sectionContent.split(/[\.!?\n]/)[0] || '').slice(0, 15));
          // 소제목에서 마침표 제거
          subtitle = subtitle.replace(/\.$/, '');
          const tagline = extractValue('TAGLINE', (sectionKeypoints[0] || subtitle || title).slice(0, 20));
          
          // 본문 컨텐츠: 첫 2~3개의 의미 있는 문장으로 구성하여 빈칸 방지
          const s1 = splitSentences(sectionContent);
          let contentText = [s1[0], s1[1], s1[2]].filter(Boolean).join('<br/>');
          if (!contentText) {
            contentText = sectionKeypoints.filter(Boolean).slice(0, 3).join('<br/>');
          }
          
          // 이미지 검색 및 추가 (섹션 1 - 왼쪽)
          console.log('🖼️ 섹션 1 이미지 검색 시작');
          const imageKeywords = await generateImageKeywords(title, sectionContent, sectionKeypoints);
          console.log('🔍 섹션 1 이미지 키워드:', imageKeywords);
          const imageUrls = await searchUnsplashImages(imageKeywords, 1, sessionKey);
          const imageUrl = imageUrls.length > 0 ? imageUrls[0] : '';
          console.log('🖼️ 섹션 1 이미지 URL:', imageUrl);
          
          htmlContent = cleanTemplateContent
            .replace(/\{\{TITLE\}\}/g, title)
            .replace(/\{\{SUBTITLE\}\}/g, subtitle)
            .replace(/\{\{TAGLINE\}\}/g, tagline)
            .replace(/\{\{WEBSITE\}\}/g, '')
            .replace(/\{\{IMAGE_URL\}\}/g, imageUrl)
            .replace(/\{\{CONTENT\}\}/g, contentText);
        }
       // 템플릿에서 추출한 프롬프트 사용
       contentPrompt = templatePrompt
         .replace(/\{\{SECTION_TITLE\}\}/g, sectionTitle)
         .replace(/\{\{SECTION_CONTENT\}\}/g, sectionContent)
         .replace(/\{\{SECTION_KEYPOINTS\}\}/g, sectionKeypoints.join(', '));

       // 섹션 2: 목차 HTML 생성 및 주입
       if (section === 2) {
         const storageKey = `${topic}_${slideCount}`;
         // 스크립트에서 섹션별 제목을 직접 추출해 목차로 사용 (일관성 보장)
         let titles = extractSectionTitlesFromScript(scriptContent);
         // 정확히 10개가 되도록 보강
         const needCount = 10;
         let n = 3;
         while (titles.length < needCount && n <= 12) {
           titles.push(getSectionTitle(n, `섹션 ${n}`));
           n += 1;
         }
         titles = titles.slice(0, needCount);
                 // 목차는 더 긴 제목 허용 (20자까지)
        const cleanedTitles = titles.map((t)=> clampTocTitle20(cleanTocTitle(t)));
         tocStorage.set(storageKey, cleanedTitles);
        const tocHtml = cleanedTitles.map((t,i)=>`<div class="toc-item">${String(i+1).padStart(2,'0')}. ${t}</div>`).join('');
         const footerText = splitSentences(sectionContent)[0] || '';
         
         // 이미지 검색 및 추가 (섹션 2 - 오른쪽)
         console.log('🖼️ 섹션 2 이미지 검색 시작');
         const imageKeywords2 = await generateImageKeywords('목차', sectionContent, sectionKeypoints);
         console.log('🔍 섹션 2 이미지 키워드:', imageKeywords2);
         const imageUrls2 = await searchUnsplashImages(imageKeywords2, 1, sessionKey);
         const imageUrl2 = imageUrls2.length > 0 ? imageUrls2[0] : '';
         console.log('🖼️ 섹션 2 이미지 URL:', imageUrl2);
         
         htmlContent = cleanTemplateContent
           .replace(/\{\{TITLE\}\}/g, '목차')
           .replace(/\{\{CONTENT\}\}/g, tocHtml)
           .replace(/\{\{FOOTER_TEXT\}\}/g, footerText)
           .replace(/\{\{IMAGE_URL\}\}/g, imageUrl2);
       }

        // 섹션 3: 1줄 소제목, 각 박스 제목 1줄/내용 3문장 생성 (목차 1번이 제목)
       if (section === 3) {
         contentPrompt = `아래 입력만 사용하여 다음 키를 가진 텍스트 블록을 그대로 출력하세요. 다른 텍스트/마크다운 금지.

TITLE: ${sectionTitle}
SUBTITLE: ${sectionContent.split(/[\.!?\n]/)[0] || ''}
BOX1_TITLE: ${sectionKeypoints[0] || ''}
BOX1_ICON: ${sectionKeypoints[0] ? 'fas fa-rocket' : ''}
BOX1_TEXT: ${sectionKeypoints[0] ? sectionKeypoints[0].split(/[\.!?\n]/)[0] || '' : ''}
BOX2_TITLE: ${sectionKeypoints[1] || ''}
BOX2_ICON: ${sectionKeypoints[1] ? 'fas fa-lightbulb' : ''}
BOX2_TEXT: ${sectionKeypoints[1] ? sectionKeypoints[1].split(/[\.!?\n]/)[0] || '' : ''}
BOX3_TITLE: ${sectionKeypoints[2] || ''}
BOX3_ICON: ${sectionKeypoints[2] ? 'fas fa-chart-line' : ''}
BOX3_TEXT: ${sectionKeypoints[2] ? sectionKeypoints[2].split(/[\.!?\n]/)[0] || '' : ''}
FOOTER_TEXT: ${sectionContent.split(/[\.!?\n]/)[0] || ''}

입력
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙
- TITLE은 20자 이내로 간결하게 작성 ppt의 제목느낌으로 작성
- SUBTITLE은 반드시 15자 이내로 작성하되, 완전한 의미를 담은 문장으로 작성하세요. 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다. 15자 안에서 완성된 내용으로 작성하세요. 마침표(.)는 붙이지 마세요.
- 각 BOX*_TEXT는 문장 구분이 명확한 2~3문장으로 작성
- 숫자(%, 배, 일반 숫자)가 본문에 있다면 적어도 1개 이상 포함
- 모든 값은 위 입력에서 유추되거나 직접 등장한 내용만 사용
- 각 항목은 지정된 글자 수를 절대 초과하지 마세요`;

        // GPT로 섹션 3 내용 생성
        let gptResponse = '';
        try {
          const s3Resp = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: STYLE_SYSTEM },
              { role: 'user', content: contentPrompt }
            ]
          });
          gptResponse = s3Resp.choices[0]?.message?.content?.trim() || '';
        } catch (err) {
          console.error('섹션 3 GPT 호출 실패:', err);
        }

        // GPT 응답에서 값 추출
        const extractValue = (key: string, fallback: string) => {
          const match = gptResponse.match(new RegExp(`${key}:\\s*(.+?)(?:\\n|$)`));
          return match ? match[1].trim() : fallback;
        };

        // 템플릿3 토큰 주입 (GPT 응답 우선, 폴백으로 기존 로직)
         const s3 = sectionContent.split(/[\.!?\n]+/).map(s=>s.trim()).filter(Boolean);
        const title3 = extractValue('TITLE', clampTitle20(getTocTitleForSection(3, sectionTitle)));
        let subtitle3 = extractValue('SUBTITLE', (s3[0] || '').split(/[\.!?\n]/)[0].trim());
        // 소제목에서 마침표 제거
        subtitle3 = subtitle3.replace(/\.$/, '');
         if (subtitle3.length > 120) subtitle3 = subtitle3.slice(0, 120);

        const normalize = (t:string) => String(t||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
        const tokenize = (t:string) => normalize(t)
           .replace(/[^가-힣a-zA-Z0-9\s]/g,' ')
           .split(/\s+/)
           .map(s=>s.trim())
           .filter(s=>s.length>=2);
        const scoreSentence = (title:string, sent:string) => {
          const kw = new Set(tokenize(title));
          const words = tokenize(sent);
          let score = 0;
          for (const w of words) if (kw.has(w)) score += 2;
          if (/[0-9%]+/.test(sent)) score += 1;
          if (sent.length >= 20) score += 1;
          return score;
        };
        const candidatePool = Array.from(new Set([
          ...s3,
          ...sectionKeypoints.map(k=>normalize(k)),
          ...sectionContent.split(/[\,·;:\u3001\u3002]/).map(normalize)
        ].filter(Boolean)));

        const usedTexts = new Set<string>();
        const pickThreeForTitle = (boxTitle:string): string => {
          const scored = candidatePool
            .map(s=>({ s, score: scoreSentence(boxTitle, s) }))
            .sort((a,b)=> b.score - a.score);
          const lines: string[] = [];
          for (const {s} of scored) {
            const v = normalize(s);
            if (!v || usedTexts.has(v)) continue;
            const hasKw = tokenize(boxTitle).some(k=>v.includes(k));
            if (!hasKw) continue;
            if (v.replace(/\s+/g,'').length < 12) continue;
            lines.push(v);
            usedTexts.add(v);
            if (lines.length === 3) break;
          }
          if (lines.length < 3) {
            const frags = candidatePool
              .flatMap(t => t.split(/[\.]/).map(normalize))
              .filter(Boolean);
            for (const f of frags) {
              const v = normalize(f);
              if (!v || usedTexts.has(v)) continue;
              if (tokenize(boxTitle).some(k=>v.includes(k)) && v.replace(/\s+/g,'').length >= 10) {
                lines.push(v);
                usedTexts.add(v);
              }
              if (lines.length === 3) break;
            }
          }
          while (lines.length < 3) {
            const fill = `${normalize(boxTitle)} 관련 핵심 포인트`;
            if (!usedTexts.has(fill)) { lines.push(fill); usedTexts.add(fill); } else { lines.push(normalize(boxTitle)); }
          }
          return lines.slice(0,3).join('<br/>' );
        };

        // GPT 응답에서 박스 내용 추출 (폴백으로 기존 로직)
        const box1Title = extractValue('BOX1_TITLE', sectionKeypoints[0] || s3[0] || '핵심 1');
        const box2Title = extractValue('BOX2_TITLE', sectionKeypoints[1] || s3[1] || '핵심 2');
        const box3Title = extractValue('BOX3_TITLE', sectionKeypoints[2] || s3[2] || '핵심 3');
        
        const box1Text = extractValue('BOX1_TEXT', pickThreeForTitle(box1Title));
        const box2Text = extractValue('BOX2_TEXT', pickThreeForTitle(box2Title));
        const box3Text = extractValue('BOX3_TEXT', pickThreeForTitle(box3Title));
        
        const footerText3 = extractValue('FOOTER_TEXT', s3[0] || '');

         htmlContent = cleanTemplateContent
           .replace(/\{\{TITLE\}\}/g, title3)
          .replace(/\{\{SUBTITLE\}\}/g, subtitle3) // GPT가 이미 15자 이내로 생성했으므로 추가 자르기 없음
           .replace(/\{\{BOX1_TITLE\}\}/g, box1Title)
           .replace(/\{\{BOX1_ICON\}\}/g, 'fas fa-rocket')
           .replace(/\{\{BOX1_TEXT\}\}/g, box1Text)
           .replace(/\{\{BOX2_TITLE\}\}/g, box2Title)
           .replace(/\{\{BOX2_ICON\}\}/g, 'fas fa-lightbulb')
           .replace(/\{\{BOX2_TEXT\}\}/g, box2Text)
           .replace(/\{\{BOX3_TITLE\}\}/g, box3Title)
           .replace(/\{\{BOX3_ICON\}\}/g, 'fas fa-chart-line')
           .replace(/\{\{BOX3_TEXT\}\}/g, box3Text)
           .replace(/\{\{FOOTER_TEXT\}\}/g, footerText3);
       }

       // 섹션 4: 불릿 3개 + 이미지(옵션)
       if (section === 4) {
         console.log('🔧 섹션4 조립 시작', { sectionTitle, sectionContent, sectionKeypoints });
         
         try {
           const s4 = sectionContent.split(/[\.!?\n]+/).map(s=>s.trim()).filter(Boolean);
           console.log('🔧 섹션4 문장 분리 완료:', s4.length, '개');
           
           const title4 = clampTitle20(getTocTitleForSection(4, sectionTitle));
           console.log('🔧 섹션4 제목 생성:', title4);
           
         let subtitle4 = (s4[0] || '').split(/[\.!?\n]/)[0].trim();
         if (subtitle4.length > 120) subtitle4 = subtitle4.slice(0, 120);
           console.log('🔧 섹션4 부제목 생성:', subtitle4);
           
         const makeLines = (start:number, count:number) => {
            const seen = new Set<string>();
            const lines: string[] = [];
            let idx = start;
              let attempts = 0;
              const maxAttempts = 20; // 무한루프 방지
              
              // 1단계: s4 배열에서 문장 가져오기
              while (lines.length < count && idx < s4.length && attempts < maxAttempts) {
              const cand = (s4[idx] || '').trim();
                if (cand && !seen.has(cand)) { 
                  lines.push(cand); 
                  seen.add(cand); 
                }
              idx += 1;
                attempts += 1;
              }
              
              // 2단계: 키포인트에서 채우기
              let kpIdx = 0;
              attempts = 0;
              while (lines.length < count && attempts < maxAttempts) {
                if (kpIdx >= sectionKeypoints.length) break;
                const fb = (sectionKeypoints[kpIdx] || '').trim();
                if (fb && !seen.has(fb)) { 
                  lines.push(fb); 
                  seen.add(fb); 
                }
                kpIdx += 1;
                attempts += 1;
              }
              
              // 3단계: 부족하면 기본값으로 채우기
            while (lines.length < count) {
                const fallback = `항목 ${lines.length + 1}`;
                if (!seen.has(fallback)) {
                  lines.push(fallback);
                  seen.add(fallback);
                } else {
                  lines.push(`내용 ${lines.length + 1}`);
                }
              }
              
            return lines.slice(0, count).join('<br/>');
          };
           
           console.log('🔧 섹션4 불릿 텍스트 생성 시작');
           
           // 더 간단하고 안전한 방식으로 불릿 텍스트 생성
           const allContent = [...s4, ...sectionKeypoints].filter(Boolean);
           const bullet1Text = (allContent[0] || sectionKeypoints[0] || '첫 번째 항목').slice(0, 200);
           console.log('🔧 섹션4 불릿1 완료:', bullet1Text.length, '글자');
           
           const bullet2Text = (allContent[1] || sectionKeypoints[1] || '두 번째 항목').slice(0, 200);
           console.log('🔧 섹션4 불릿2 완료:', bullet2Text.length, '글자');
           
           const bullet3Text = (allContent[2] || sectionKeypoints[2] || '세 번째 항목').slice(0, 200);
           console.log('🔧 섹션4 불릿3 완료:', bullet3Text.length, '글자');
           
           console.log('🔧 섹션4 불릿 텍스트 생성 완료');
           
         const footerText4 = s4[0] || '';
           
           // 이미지 검색 및 추가 (섹션 4 - 왼쪽)
           console.log('🖼️ 섹션 4 이미지 검색 시작');
           const imageKeywords4 = await generateImageKeywords(sectionTitle, sectionContent, sectionKeypoints);
           console.log('🔍 섹션 4 이미지 키워드:', imageKeywords4);
           const imageUrls4 = await searchUnsplashImages(imageKeywords4, 1, sessionKey);
           const imageUrl = imageUrls4.length > 0 ? imageUrls4[0] : '';
           console.log('🖼️ 섹션 4 이미지 URL:', imageUrl);

           // GPT로 15자 이내 부제목 생성
           const section4SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${subtitle4}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

           let gptSubtitle = subtitle4;
           try {
             const subtitleResp = await openai.chat.completions.create({
               model: 'gpt-5-mini',
               messages: [
                 { role: 'system', content: STYLE_SYSTEM },
                 { role: 'user', content: section4SubtitlePrompt }
               ]
             });
             const response = subtitleResp.choices[0]?.message?.content?.trim() || '';
             if (response) {
               gptSubtitle = response;
             }
           } catch (err) {
             console.error('섹션 4 부제목 GPT 호출 실패:', err);
           }

           // 소제목에서 마침표 제거
           gptSubtitle = gptSubtitle.replace(/\.$/, '');
           const safeSubtitle = gptSubtitle;
           console.log('🔧 섹션4 안전한 부제목:', safeSubtitle);
           
           console.log('🔧 섹션4 HTML 치환 시작');
           console.log('🔧 cleanTemplateContent 길이:', cleanTemplateContent.length);

         htmlContent = cleanTemplateContent
           .replace(/\{\{TITLE\}\}/g, title4)
             .replace(/\{\{SUBTITLE\}\}/g, safeSubtitle)
           .replace(/\{\{BULLET1_ICON\}\}/g, 'fas fa-check-circle')
           .replace(/\{\{BULLET1_TEXT\}\}/g, bullet1Text)
           .replace(/\{\{BULLET2_ICON\}\}/g, 'fas fa-bolt')
           .replace(/\{\{BULLET2_TEXT\}\}/g, bullet2Text)
           .replace(/\{\{BULLET3_ICON\}\}/g, 'fas fa-star')
           .replace(/\{\{BULLET3_TEXT\}\}/g, bullet3Text)
           .replace(/\{\{IMAGE_URL\}\}/g, imageUrl)
           .replace(/\{\{FOOTER_TEXT\}\}/g, footerText4);
           
           console.log('🔧 섹션4 HTML 치환 완료, htmlContent 길이:', htmlContent.length);
           console.log('🔧 섹션4 htmlContent 시작 100자:', htmlContent.slice(0, 100));
           console.log('✅ 섹션4 조립 완료');
         } catch (err) {
           console.error('❌ 섹션4 조립 중 오류:', err);
           throw err;
         }
       } else if (section === 5) {
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

                 // 섹션 5: 아이콘 제거 - 간단한 기본 아이콘 사용
        const defaultLeftIcon = 'fas fa-lightbulb';
        const defaultRightIcon = 'fas fa-chart-line';
        console.log('🔧 섹션 5 기본 아이콘 사용:', defaultLeftIcon, defaultRightIcon);
        console.log('🔧 섹션 5 처리 시작 - 제목:', sectionTitle);
        console.log('🔧 섹션 5 내용 길이:', sectionContent.length);

         // 섹션 5: 템플릿5 토큰 채우기
         try {
           const s5Resp = await openai.chat.completions.create({
             model: 'gpt-5-mini',
             messages: [
               { role: 'system', content: STYLE_SYSTEM },
               { role: 'user', content: contentPrompt }
             ]
           });
           const raw = s5Resp.choices[0]?.message?.content?.trim() || '';
           let jsonText = raw;
           if (!/^\s*\{[\s\S]*\}\s*$/.test(raw)) {
             const m = raw.match(/\{[\s\S]*\}/);
             if (m) jsonText = m[0];
           }
           let parsed: any = {};
           try { parsed = JSON.parse(jsonText); } catch { parsed = {}; }

           // 값 보정 및 폴백
           const gaugeValue = normalizePercent(parsed.GAUGE_VALUE || extractFirstPercentToken(corpus) || '', '');
           const statValue = parsed.STAT_VALUE || extractFirstMultipleToken(corpus) || extractFirstGeneralNumberToken(corpus) || '';
           let gaugeDescription: string = (parsed.GAUGE_DESCRIPTION || '').toString().trim();
           let statDescription: string = (parsed.STAT_DESCRIPTION || '').toString().trim();
           if (!gaugeDescription) {
             const sents = splitSentences(sectionContent);
             gaugeDescription = [sents[0], sents[1]].filter(Boolean).join(' ');
             if (gaugeValue) gaugeDescription = `${gaugeDescription} (${gaugeValue})`;
           }
           if (!statDescription) {
             const sents = splitSentences(sectionContent);
             statDescription = [sents[2] || sents[1] || sents[0]].filter(Boolean).join(' ');
             if (statValue) statDescription = `${statDescription} (${statValue})`;
           }

           // 타이틀/소제목/콘텐츠 박스 구성
           const title5 = clampTitle20(getTocTitleForSection(5, sectionTitle));
           
           // GPT로 15자 이내 부제목 생성
           const originalSubtitle5 = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
           const section5SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle5}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

           let subtitle5 = originalSubtitle5;
           try {
             const subtitle5Resp = await openai.chat.completions.create({
               model: 'gpt-5-mini',
               messages: [
                 { role: 'system', content: STYLE_SYSTEM },
                 { role: 'user', content: section5SubtitlePrompt }
               ]
             });
             const response = subtitle5Resp.choices[0]?.message?.content?.trim() || '';
             if (response) {
               subtitle5 = response;
             }
           } catch (err) {
             console.error('섹션 5 부제목 GPT 호출 실패:', err);
           }
           // 소제목에서 마침표 제거
           subtitle5 = subtitle5.replace(/\.$/, '');
           const lines5 = splitSentences(sectionContent);
           const contentBox = [lines5[0], lines5[1], lines5[2], lines5[3]].filter(Boolean).slice(0, 4).join('<br/>');
           const clamp10 = (t:string) => String(t||'').trim().slice(0,10);
           const leftText = clamp10(gaugeDescription || lines5[0] || '');
           const rightText = clamp10(statDescription || lines5[1] || '');

           htmlContent = cleanTemplateContent
             .replace(/\{\{TITLE\}\}/g, title5)
             .replace(/\{\{SUBTITLE\}\}/g, subtitle5)
             .replace(/\{\{CONTENT_BOX\}\}/g, contentBox)
             .replace(/\{\{GAUGE_DESCRIPTION\}\}/g, leftText)
             .replace(/\{\{STAT_DESCRIPTION\}\}/g, rightText)
             .replace(/\{\{LEFT_ICON\}\}/g, defaultLeftIcon)
             .replace(/\{\{RIGHT_ICON\}\}/g, defaultRightIcon);
           
           console.log('🔧 섹션 5 아이콘 교체 완료 (성공 케이스)');
           console.log('🔧 섹션 5 HTML 길이:', htmlContent.length);
           console.log('🔧 섹션 5 제목:', title5);
           console.log('🔧 섹션 5 부제목:', subtitle5);
         } catch {
           // 실패 시 폴백: 최소 텍스트 채움
           const title5 = clampTitle20(getTocTitleForSection(5, sectionTitle));
           let subtitle5 = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();

           const lines5 = splitSentences(sectionContent);
           const contentBox = [lines5[0], lines5[1], lines5[2], lines5[3]].filter(Boolean).slice(0, 4).join('<br/>');
           const clamp10 = (t:string) => String(t||'').trim().slice(0,10);
           const leftText = clamp10(lines5[0] || '');
           const rightText = clamp10(lines5[1] || '');
           htmlContent = cleanTemplateContent
             .replace(/\{\{TITLE\}\}/g, title5)
             .replace(/\{\{SUBTITLE\}\}/g, subtitle5)
             .replace(/\{\{CONTENT_BOX\}\}/g, contentBox)
             .replace(/\{\{GAUGE_DESCRIPTION\}\}/g, leftText)
             .replace(/\{\{STAT_DESCRIPTION\}\}/g, rightText)
             .replace(/\{\{LEFT_ICON\}\}/g, defaultLeftIcon)
             .replace(/\{\{RIGHT_ICON\}\}/g, defaultRightIcon);
           
           console.log('🔧 섹션 5 아이콘 교체 완료 (폴백 케이스)');
           console.log('🔧 섹션 5 폴백 HTML 길이:', htmlContent.length);
           console.log('🔧 섹션 5 폴백 제목:', title5);
           console.log('🔧 섹션 5 폴백 부제목:', subtitle5);
         }
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

         // 섹션 6: 템플릿6 토큰 채우기
         try {
           const s6Resp = await openai.chat.completions.create({
             model: 'gpt-5-mini',
             messages: [
               { role: 'system', content: STYLE_SYSTEM },
               { role: 'user', content: contentPrompt }
             ]
           });
           const raw = s6Resp.choices[0]?.message?.content?.trim() || '';
           let jsonText = raw;
           if (!/^\s*\{[\s\S]*\}\s*$/.test(raw)) {
             const m = raw.match(/\{[\s\S]*\}/);
             if (m) jsonText = m[0];
           }
           let parsed: any = {};
           try { parsed = JSON.parse(jsonText); } catch { parsed = {}; }

           const title6 = clampTitle20(getTocTitleForSection(6, sectionTitle));
           const scrubNA = (s: any) => String(s || '')
             .replace(/N\/A/gi, '')
             .replace(/\s{2,}/g, ' ')
             .trim();
           let resultText = scrubNA(parsed.RESULT_TEXT || splitSentences(sectionContent)[0] || '');
           const resultPercentage = scrubNA(normalizePercent(parsed.RESULT_PERCENTAGE || extractFirstPercentToken(corpus) || '', ''));

           const metric1Title = scrubNA(parsed.METRIC1_TITLE || '지표 1');
           const metric2Title = scrubNA(parsed.METRIC2_TITLE || '지표 2');
           const metric3Title = scrubNA(parsed.METRIC3_TITLE || '지표 3');
           const metric1Desc = scrubNA(parsed.METRIC1_DESCRIPTION || splitSentences(sectionContent)[0] || '');
           const metric2Desc = scrubNA(parsed.METRIC2_DESCRIPTION || splitSentences(sectionContent)[1] || '');
           const metric3Desc = scrubNA(parsed.METRIC3_DESCRIPTION || splitSentences(sectionContent)[2] || '');

           // RESULT_PERCENTAGE가 빈 값이면 해당 li 태그 전체 제거
           let processedTemplate = cleanTemplateContent;
           if (!resultPercentage || resultPercentage.trim() === '') {
             // 공백이나 줄바꿈이 있어도 처리되도록 더 유연한 정규식 사용
             processedTemplate = processedTemplate.replace(/<li>\s*\{\{RESULT_PERCENTAGE\}\}\s*<\/li>/g, '');
             console.log('🔧 섹션 6: 빈 RESULT_PERCENTAGE li 태그 제거됨');
           }
           
           htmlContent = processedTemplate
             .replace(/\{\{TITLE\}\}/g, title6)
             .replace(/\{\{RESULT_TEXT\}\}/g, resultText)
             .replace(/\{\{METRIC1_TITLE\}\}/g, metric1Title)
             .replace(/\{\{METRIC1_DESCRIPTION\}\}/g, metric1Desc)
             .replace(/\{\{METRIC2_TITLE\}\}/g, metric2Title)
             .replace(/\{\{METRIC2_DESCRIPTION\}\}/g, metric2Desc)
             .replace(/\{\{METRIC3_TITLE\}\}/g, metric3Title)
             .replace(/\{\{METRIC3_DESCRIPTION\}\}/g, metric3Desc)
             .replace(/\{\{RESULT_PERCENTAGE\}\}/g, resultPercentage);
         } catch {
           // 실패 시 폴백
           const title6 = clampTitle20(getTocTitleForSection(6, sectionTitle));
           const scrubNA2 = (s: any) => String(s || '')
             .replace(/N\/A/gi, '')
             .replace(/\s{2,}/g, ' ')
             .trim();
           const lines6 = splitSentences(sectionContent);
           const resultText = scrubNA2(lines6[0] || '');
           const resultPercentage = scrubNA2(extractFirstPercentToken(corpus) || '');
           
           // 폴백 케이스에서도 빈 RESULT_PERCENTAGE li 태그 제거
           let processedTemplateFallback = cleanTemplateContent;
           if (!resultPercentage || resultPercentage.trim() === '') {
             // 공백이나 줄바꿈이 있어도 처리되도록 더 유연한 정규식 사용
             processedTemplateFallback = processedTemplateFallback.replace(/<li>\s*\{\{RESULT_PERCENTAGE\}\}\s*<\/li>/g, '');
             console.log('🔧 섹션 6 폴백: 빈 RESULT_PERCENTAGE li 태그 제거됨');
           }
           
           htmlContent = processedTemplateFallback
             .replace(/\{\{TITLE\}\}/g, title6)
             .replace(/\{\{RESULT_TEXT\}\}/g, resultText)
             .replace(/\{\{METRIC1_TITLE\}\}/g, sectionKeypoints[0] || '지표 1')
             .replace(/\{\{METRIC1_DESCRIPTION\}\}/g, lines6[0] || '')
             .replace(/\{\{METRIC2_TITLE\}\}/g, sectionKeypoints[1] || '지표 2')
             .replace(/\{\{METRIC2_DESCRIPTION\}\}/g, lines6[1] || '')
             .replace(/\{\{METRIC3_TITLE\}\}/g, sectionKeypoints[2] || '지표 3')
             .replace(/\{\{METRIC3_DESCRIPTION\}\}/g, lines6[2] || '')
             .replace(/\{\{RESULT_PERCENTAGE\}\}/g, resultPercentage);
         }
       } else if (section === 7) {
         // 섹션 7: 기술 트렌드 3박스 (각 박스 2줄로 제한)
         const title7 = clampTitle20(getTocTitleForSection(7, sectionTitle));
         const s7 = sectionContent.split(/[\.\!\?\n]+/).map(s=>s.trim()).filter(Boolean);
         
         // GPT로 15자 이내 부제목 생성
         const originalSubtitle7 = (s7[0] || '').split(/[\.\!\?\n]/)[0].trim();
         const section7SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle7}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

         let subtitle7 = originalSubtitle7;
         try {
           const subtitle7Resp = await openai.chat.completions.create({
             model: 'gpt-5-mini',
             messages: [
               { role: 'system', content: STYLE_SYSTEM },
               { role: 'user', content: section7SubtitlePrompt }
             ]
           });
           const response = subtitle7Resp.choices[0]?.message?.content?.trim() || '';
           if (response) {
             subtitle7 = response;
           }
         } catch (err) {
           console.error('섹션 7 부제목 GPT 호출 실패:', err);
         }
         // 소제목에서 마침표 제거
         subtitle7 = subtitle7.replace(/\.$/, '');
         


         // GPT로 섹션 7 박스 내용 생성 (2줄 제한)
         const section7Prompt = `다음 내용을 바탕으로 3개의 기술 박스 내용을 생성해주세요.

입력:
- 제목: ${sectionTitle}
- 내용: ${sectionContent}
- 키포인트: ${sectionKeypoints.join(', ')}

다음 형식으로 출력하세요:
TECH1: [첫 번째 기술 관련 내용을 정확히 2줄로 완전히 작성]
TECH2: [두 번째 기술 관련 내용을 정확히 2줄로 완전히 작성]
TECH3: [세 번째 기술 관련 내용을 정확히 2줄로 완전히 작성]

중요한 규칙:
- 각 TECH 내용은 반드시 정확히 2줄로 작성하세요
- 각 줄은 완전한 문장으로 구성하되 의미가 완결되어야 합니다
- "...", "…", "등등", "기타", "~등" 같은 생략 표시는 절대 사용하지 마세요
- 내용이 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 각 줄은 구체적이고 명확한 내용으로 작성하세요
- 서로 다른 내용으로 중복 없이 작성하세요
- 첫 번째 줄과 두 번째 줄이 자연스럽게 연결되도록 작성하세요`;

         let gpt7Response = '';
         try {
           const s7Resp = await openai.chat.completions.create({
             model: 'gpt-5-mini',
             messages: [
               { role: 'system', content: STYLE_SYSTEM },
               { role: 'user', content: section7Prompt }
             ]
           });
           gpt7Response = s7Resp.choices[0]?.message?.content?.trim() || '';
         } catch (err) {
           console.error('섹션 7 GPT 호출 실패:', err);
         }

         // GPT 응답에서 값 추출 및 정제
         const extractTechValue = (key: string, fallback: string) => {
           const match = gpt7Response.match(new RegExp(`${key}:\\s*(.+?)(?=\\nTECH|$)`, 's'));
           if (match) {
             let content = match[1].trim();
             
             // 생략 표시 제거
             content = content
               .replace(/\.{3,}/g, '') // ... 제거
               .replace(/…/g, '') // … 제거
               .replace(/\s*등등\s*/g, '') // 등등 제거
               .replace(/\s*기타\s*/g, '') // 기타 제거
               .replace(/\s*~등\s*/g, '') // ~등 제거
               .replace(/\s*등\s*$/g, '') // 문장 끝의 등 제거
               .trim();
             
             // 2줄로 분리하고 정제
             const lines = content.split(/\n/).map(l => l.trim()).filter(Boolean);
             
             // 각 줄이 완전한 문장이 되도록 보정
             const processedLines = lines.slice(0, 2).map(line => {
               // 문장 끝에 마침표가 없으면 추가
               if (line && !line.match(/[.!?]$/)) {
                 line += '.';
               }
               return line;
             });
             
             // 2줄이 안 되면 첫 번째 줄을 분할하여 2줄로 만들기
             if (processedLines.length === 1 && processedLines[0].length > 40) {
               const longLine = processedLines[0];
               const midPoint = Math.floor(longLine.length / 2);
               const splitPoint = longLine.indexOf(' ', midPoint);
               if (splitPoint > 0) {
                 const firstHalf = longLine.substring(0, splitPoint).trim();
                 const secondHalf = longLine.substring(splitPoint).trim();
                 return `${firstHalf}<br/>${secondHalf}`;
               }
             }
             
             // 최종적으로 2줄 보장
             while (processedLines.length < 2) {
               processedLines.push('관련 기술 발전이 지속되고 있습니다.');
             }
             
             return processedLines.slice(0, 2).join('<br/>');
           }
           return fallback;
         };

         // 폴백 함수: 2줄로 제한된 완전한 내용 생성
         const make2LinesByIndex = (boxIndex: number): string => {
           let keyLine = (sectionKeypoints[boxIndex] || '').trim();
           let contentLine = (s7[boxIndex] || s7[0] || '').trim();
           
           // 생략 표시 제거
           const cleanText = (text: string) => {
             return text
               .replace(/\.{3,}/g, '') // ... 제거
               .replace(/…/g, '') // … 제거
               .replace(/\s*등등\s*/g, '') // 등등 제거
               .replace(/\s*기타\s*/g, '') // 기타 제거
               .replace(/\s*~등\s*/g, '') // ~등 제거
               .replace(/\s*등\s*$/g, '') // 문장 끝의 등 제거
               .trim();
           };
           
           keyLine = cleanText(keyLine);
           contentLine = cleanText(contentLine);
           
           // 완전한 문장으로 만들기
           const ensureCompleteSentence = (text: string, fallback: string) => {
             if (!text) return fallback;
             if (!text.match(/[.!?]$/)) {
               text += '.';
             }
             return text;
           };
           
           const line1 = ensureCompleteSentence(
             keyLine || contentLine || `기술 ${boxIndex + 1}의 핵심 요소`,
             `기술 ${boxIndex + 1}의 핵심 요소입니다.`
           );
           
           const line2 = ensureCompleteSentence(
             (keyLine && contentLine && keyLine !== contentLine) 
               ? contentLine 
               : `이 기술은 지속적으로 발전하고 있습니다`,
             `관련 기술 발전이 지속되고 있습니다.`
           );
           
           return [line1, line2].slice(0, 2).join('<br/>');
         };

         const tech1 = extractTechValue('TECH1', make2LinesByIndex(0));
         const tech2 = extractTechValue('TECH2', make2LinesByIndex(1));
         const tech3 = extractTechValue('TECH3', make2LinesByIndex(2));

         htmlContent = cleanTemplateContent
           .replace(/\{\{TITLE\}\}/g, title7)
           .replace(/\{\{SUBTITLE\}\}/g, subtitle7)
           .replace(/\{\{TECH1_TITLE\}\}/g, tech1)
           .replace(/\{\{TECH2_TITLE\}\}/g, tech2)
           .replace(/\{\{TECH3_TITLE\}\}/g, tech3);
       } else if (section === 8) {
         // 섹션 8: AI 윤리와 도전과제 (원래 로직 복원)
        const storageKey = `${topic}_${slideCount}`;
        let tocTitles = tocStorage.get(storageKey) || [];
        if (!tocTitles.length) {
          tocTitles = extractSectionTitlesFromScript(scriptContent);
        }
        const fallback8 = `${sectionTitle}의 윤리와 도전과제`;
        const tocTitle = tocTitles[5] || fallback8;

        const headerLeft = `${tocTitle} 연구소`;
        const headerCenter = currentDate();
        const headerRight = '';
        const title = tocTitle; // 목차 제목 사용
         // 템플릿 JSON 파싱값(없을 수 있으므로 안전하게 선언)
         const parsedJson: any = undefined;
         let description = (parsedJson?.DESCRIPTION && String(parsedJson.DESCRIPTION).trim().length > 0)
          ? String(parsedJson.DESCRIPTION).trim()
          : sectionContent;
         // GPT로 15자 이내 부제목 생성
         const originalDescription = description;
         const section8SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalDescription}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

         try {
           const subtitle8Resp = await openai.chat.completions.create({
             model: 'gpt-5-mini',
             messages: [
               { role: 'system', content: STYLE_SYSTEM },
               { role: 'user', content: section8SubtitlePrompt }
             ]
           });
           const response = subtitle8Resp.choices[0]?.message?.content?.trim() || '';
           if (response) {
             description = response;
           } else {
             // 폴백: 기존 로직
             if (description.includes('\n')) {
           description = description.split(/[\.!?\n]/)[0].trim();
         }
           }
         } catch (err) {
           console.error('섹션 8 부제목 GPT 호출 실패:', err);
           // 폴백: 기존 로직
           if (description.includes('\n')) {
             description = description.split(/[\.!?\n]/)[0].trim();
           }
         }
         // 소제목에서 마침표 제거
         description = description.replace(/\.$/, '');
        const feedback1TextRaw = (parsedJson?.FEEDBACK1_TEXT && String(parsedJson.FEEDBACK1_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK1_TEXT).trim()
          : (sectionKeypoints[0] || (sectionContent.split(/[\.!?\n]/)[0] || '').trim());
        
        // feedback1Text도 2줄로 확장
        const expandFeedback1 = (text: string) => {
          const allSentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
          const keypoints = sectionKeypoints.filter(Boolean);
          
          if (!text || text.trim().length === 0) {
            // 빈 텍스트인 경우: 키포인트와 섹션 내용 조합
            const result = [];
            if (keypoints[0]) result.push(keypoints[0]);
            if (allSentences[0] && !result.includes(allSentences[0])) result.push(allSentences[0]);
            if (result.length < 2 && allSentences[1] && !result.includes(allSentences[1])) result.push(allSentences[1]);
            return result.slice(0, 2).join('. ');
          }
          
          // 기존 텍스트 분석
          const textSentences = text.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
          
          if (textSentences.length >= 2) {
            // 이미 2줄 이상이면 첫 2줄 반환
            return textSentences.slice(0, 2).join('. ');
          }
          
          // 1줄뿐이면 추가 내용으로 확장
          const result = [...textSentences];
          
          // 키포인트에서 추가
          for (const kp of keypoints) {
            if (result.length >= 2) break;
            if (!result.some(r => r.includes(kp) || kp.includes(r))) {
              result.push(kp);
            }
          }
          
          // 섹션 내용에서 추가
          for (const sentence of allSentences) {
            if (result.length >= 2) break;
            if (!result.some(r => r.includes(sentence) || sentence.includes(r))) {
              result.push(sentence);
            }
          }
          
          return result.slice(0, 2).join('. ');
        };
        
        const feedback1Text = expandFeedback1(feedback1TextRaw);
        console.log('🔧 섹션 8 feedback1Text 확장:');
        console.log('  원본:', feedback1TextRaw);
        console.log('  확장:', feedback1Text);
        console.log('  길이:', feedback1Text.length, '글자');
        console.log('  문장 수:', feedback1Text.split(/[\.!?\n]+/).filter(Boolean).length, '개');
         const feedback2TextRaw = (parsedJson?.FEEDBACK2_TEXT && String(parsedJson.FEEDBACK2_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK2_TEXT).trim()
          : (sectionKeypoints[1] || (sectionContent.split(/[\.!?\n]/)[1] || sectionKeypoints[0] || '').trim());
         const feedback3TextRaw = (parsedJson?.FEEDBACK3_TEXT && String(parsedJson.FEEDBACK3_TEXT).trim().length > 0)
          ? String(parsedJson.FEEDBACK3_TEXT).trim()
          : (sectionKeypoints[2] || (sectionContent.split(/[\.!?\n]/)[2] || sectionKeypoints[1] || '').trim());
         
         // feedback2Text와 feedback3Text도 2줄로 확장하는 함수
         const expandFeedbackText = (text: string, startIndex: number = 0) => {
           const allSentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
           const keypoints = sectionKeypoints.filter(Boolean);
           
           if (!text || text.trim().length === 0) {
             // 빈 텍스트인 경우: 키포인트와 섹션 내용 조합
             const result = [];
             if (keypoints[startIndex]) result.push(keypoints[startIndex]);
             if (allSentences[startIndex] && !result.includes(allSentences[startIndex])) result.push(allSentences[startIndex]);
             if (result.length < 2 && allSentences[startIndex + 1] && !result.includes(allSentences[startIndex + 1])) result.push(allSentences[startIndex + 1]);
             if (result.length < 2 && keypoints[startIndex + 1] && !result.includes(keypoints[startIndex + 1])) result.push(keypoints[startIndex + 1]);
             return result.slice(0, 2).join('. ');
           }
           
           // 기존 텍스트 분석
           const textSentences = text.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
           
           if (textSentences.length >= 2) {
             // 이미 2줄 이상이면 첫 2줄 반환
             return textSentences.slice(0, 2).join('. ');
           }
           
           // 1줄뿐이면 추가 내용으로 확장
           const result = [...textSentences];
           
           // 키포인트에서 추가 (중복 방지)
           for (let i = startIndex; i < keypoints.length && result.length < 2; i++) {
             const kp = keypoints[i];
             if (!result.some(r => r.includes(kp) || kp.includes(r))) {
               result.push(kp);
             }
           }
           
           // 섹션 내용에서 추가 (중복 방지)
           for (let i = startIndex; i < allSentences.length && result.length < 2; i++) {
             const sentence = allSentences[i];
             if (!result.some(r => r.includes(sentence) || sentence.includes(r))) {
               result.push(sentence);
             }
           }
           
           return result.slice(0, 2).join('. ');
         };
         
         const feedback2Text = expandFeedbackText(feedback2TextRaw, 1);
         console.log('🔧 섹션 8 feedback2Text 확장:');
         console.log('  원본:', feedback2TextRaw);
         console.log('  확장:', feedback2Text);
         console.log('  길이:', feedback2Text.length, '글자');
         console.log('  문장 수:', feedback2Text.split(/[\.!?\n]+/).filter(Boolean).length, '개');
         let statPercentage = normalizePercent(parsedJson?.STAT_PERCENTAGE ?? '', '');
         if (!(statPercentage && hasPercentInCorpus(statPercentage))) {
           statPercentage = extractFirstPercentToken(corpus) || '';
         }
         let statDescriptionRaw = (parsedJson?.STAT_DESCRIPTION && String(parsedJson.STAT_DESCRIPTION).trim().length > 0)
          ? String(parsedJson.STAT_DESCRIPTION).trim()
          : '';
         if (!statDescriptionRaw) {
        const s8Sentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
           statDescriptionRaw = [s8Sentences[0], s8Sentences[1] || s8Sentences[2]].filter(Boolean).join(' ');
        }
         
         // statDescription도 2줄로 확장
         const statDescription = expandFeedbackText(statDescriptionRaw, 2);
         console.log('🔧 섹션 8 statDescription 확장:');
         console.log('  원본:', statDescriptionRaw);
         console.log('  확장:', statDescription);
         console.log('  길이:', statDescription.length, '글자');
         console.log('  문장 수:', statDescription.split(/[\.!?\n]+/).filter(Boolean).length, '개');

        // 퍼센트가 없으면 배수/일반 숫자라도 확보
        if (!statPercentage) {
          const multiple = extractFirstMultipleToken(corpus);
          const general = extractFirstGeneralNumberToken ? extractFirstGeneralNumberToken(corpus) : null;
          statPercentage = multiple || (general ? `${general}` : '');
        }
        if (!statPercentage) {
          statPercentage = '기준 대비 상승 추세';
        }
         // 설명에 최종 수치가 없다면 두 줄 제한 유지하며 보조 표기 생략
       
       // 이미지 검색 및 추가 (섹션 8 - 2개 이미지, 중복 방지)
       console.log('🖼️ 섹션 8 이미지 검색 시작');
       const imageKeywords8_1 = await generateImageKeywords(feedback1Text, sectionContent, [sectionKeypoints[0] || '']);
       const imageKeywords8_2 = await generateImageKeywords(statPercentage, sectionContent, [sectionKeypoints[1] || '']);
       console.log('🔍 섹션 8 이미지 키워드1:', imageKeywords8_1);
       console.log('🔍 섹션 8 이미지 키워드2:', imageKeywords8_2);
       
       // 각 이미지에 대해 서로 다른 세션 키 사용하여 중복 방지
       const sessionKey8_1 = `${sessionKey}_img1`;
       const sessionKey8_2 = `${sessionKey}_img2`;
       
       const imageUrls8_1 = await searchUnsplashImages(imageKeywords8_1, 3, sessionKey8_1); // 더 많은 옵션 요청
       const imageUrls8_2 = await searchUnsplashImages(imageKeywords8_2, 3, sessionKey8_2); // 더 많은 옵션 요청
       
       // selectUniqueImage를 사용하여 중복 방지
       let image1Url = '';
       let image2Url = '';
       
       if (imageUrls8_1.length > 0) {
         image1Url = selectUniqueImage(sessionKey8_1, imageUrls8_1);
       }
       
       if (imageUrls8_2.length > 0) {
         // 첫 번째 이미지와 다른 이미지 선택 보장
         const availableImages8_2 = imageUrls8_2.filter(url => url !== image1Url);
         if (availableImages8_2.length > 0) {
           image2Url = selectUniqueImage(sessionKey8_2, availableImages8_2);
         } else {
           // 대안 키워드로 재시도
           console.log('🔄 섹션 8 이미지2 대안 키워드로 재시도');
           const alternativeKeywords = await generateImageKeywords(feedback2Text || statDescription, sectionContent, [sectionKeypoints[2] || sectionKeypoints[0] || '']);
           const alternativeUrls = await searchUnsplashImages(alternativeKeywords, 3, `${sessionKey8_2}_alt`);
           const filteredAlternatives = alternativeUrls.filter(url => url !== image1Url);
           if (filteredAlternatives.length > 0) {
             image2Url = selectUniqueImage(`${sessionKey8_2}_alt`, filteredAlternatives);
           } else {
             // 최후의 수단: 일반적인 키워드로 검색
             const fallbackUrls = await searchUnsplashImages('technology business data', 5, `${sessionKey8_2}_fallback`);
             const fallbackFiltered = fallbackUrls.filter(url => url !== image1Url);
             if (fallbackFiltered.length > 0) {
               image2Url = selectUniqueImage(`${sessionKey8_2}_fallback`, fallbackFiltered);
             }
           }
         }
       }
       
       // 최종 중복 검증 및 강제 분리
       if (image1Url && image2Url && image1Url === image2Url) {
         console.log('🚨 섹션 8 최종 중복 감지 - 강제 분리 실행');
         // 하드코딩된 대체 이미지 풀 사용
         const hardcodedImages = [
           'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400',
           'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
           'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400',
           'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=400',
           'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400'
         ];
         const differentImage = hardcodedImages.find(url => url !== image1Url);
         if (differentImage) {
           image2Url = differentImage;
           console.log('✅ 하드코딩된 대체 이미지로 교체:', image2Url);
         }
       }
       
       console.log('🖼️ 섹션 8 이미지1 URL:', image1Url);
       console.log('🖼️ 섹션 8 이미지2 URL:', image2Url);
       console.log('🔍 섹션 8 이미지 중복 여부:', image1Url === image2Url ? '❌ 중복됨' : '✅ 서로 다름');
       
       // 중복 방지 성공률 로깅
       if (image1Url && image2Url) {
         console.log('🎯 섹션 8 이미지 중복 방지 시스템:', image1Url !== image2Url ? '성공' : '실패');
       }
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{FEEDBACK1_TEXT}}/g, feedback1Text)
          .replace(/{{FEEDBACK2_TEXT}}/g, feedback2Text)
            .replace(/{{FEEDBACK3_TEXT}}/g, expandFeedbackText(feedback3TextRaw, 2))
          .replace(/{{STAT_PERCENTAGE}}/g, statPercentage)
          .replace(/{{STAT_DESCRIPTION}}/g, statDescription)
          .replace(/{{IMAGE1_URL}}/g, image1Url)
          .replace(/{{IMAGE2_URL}}/g, image2Url)
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
        
        // GPT로 15자 이내 부제목 생성
        const originalSubtitle9 = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
        const section9SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle9}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

        let subtitle = originalSubtitle9;
        try {
          const subtitle9Resp = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: STYLE_SYSTEM },
              { role: 'user', content: section9SubtitlePrompt }
            ]
          });
          const response = subtitle9Resp.choices[0]?.message?.content?.trim() || '';
          if (response) {
            subtitle = response;
          }
        } catch (err) {
          console.error('섹션 9 부제목 GPT 호출 실패:', err);
        }
        // 소제목에서 마침표 제거
        subtitle = subtitle.replace(/\.$/, '');
        const description = sectionContent;

        // 섹션 9: 아이콘 제거 - 간단한 기본 아이콘 사용
        const defaultLeftIcon9 = 'fas fa-shield-alt';
        const defaultRightIcon9 = 'fas fa-balance-scale';
        console.log('🔧 섹션 9 기본 아이콘 사용:', defaultLeftIcon9, defaultRightIcon9);

         // 스텝 내용: 제목 한 줄 / 본문 4줄 보장
        const sentences = sectionContent.split(/[\.!?\n]+/).map(s => s.trim()).filter(Boolean);
         const ensureLines = (primary?: string, altIdx = 0, lines = 4) => {
           const chunks: string[] = [];
           // primary가 제목이면 제목은 한 줄로 유지하므로 본문은 sentences에서 채움
           for (let i = altIdx; i < altIdx + lines && i < sentences.length; i++) {
             if (sentences[i]) chunks.push(sentences[i]);
           }
           return chunks.slice(0, lines).join('<br/>');
         };
         // 제목(한 줄)과 본문(4줄)
         const step1Title = (sectionKeypoints[0] || sentences[0] || tocTitle).split(/\n/)[0].trim();
         const step1Body = ensureLines(undefined, 0, 4);
         let step2Title = (sectionKeypoints[1] || sentences[2] || tocTitle).split(/\n/)[0].trim();
         let step2Body = ensureLines(undefined, 2, 4);
         if (!step2Body || step2Body.trim().length === 0) {
           const fallbackLines = [
             sectionKeypoints[1], sentences[1], sentences[0], sectionKeypoints[0]
           ].map(s => (s || '').trim()).filter(Boolean);
           while (fallbackLines.length < 4) fallbackLines.push(step1Title);
           step2Body = fallbackLines.slice(0,4).join('<br/>');
         }
         if (!step2Title || step2Title.trim().length === 0) {
           step2Title = sectionKeypoints[1] || sentences[1] || step1Title;
         }
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{DESCRIPTION}}/g, description)
           .replace(/{{STEP1_TEXT}}/g, step1Title)
           .replace(/{{STEP2_TEXT}}/g, step1Body)
           .replace(/{{STEP3_TEXT}}/g, step2Title)
           .replace(/{{STEP4_TEXT}}/g, step2Body)
          .replace(/{{LEFT_ICON}}/g, defaultLeftIcon9)
          .replace(/{{RIGHT_ICON}}/g, defaultRightIcon9)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
         
        console.log('🔧 섹션 9 아이콘 교체 완료');
        console.log('🔧 STEP1_TEXT:', step1Title);
        console.log('🔧 STEP2_TEXT:', step1Body);
        console.log('🔧 STEP3_TEXT:', step2Title);
        console.log('🔧 STEP4_TEXT:', step2Body);
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
        const title = cleanTocTitle(tocTitle); // 목차 제목 사용
        
        // GPT로 15자 이내 부제목 생성
        const originalSubtitle10 = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
        const section10SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle10}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

        let subtitle10 = originalSubtitle10;
        try {
          const subtitle10Resp = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: STYLE_SYSTEM },
              { role: 'user', content: section10SubtitlePrompt }
            ]
          });
          const response = subtitle10Resp.choices[0]?.message?.content?.trim() || '';
          if (response) {
            subtitle10 = response;
          }
        } catch (err) {
          console.error('섹션 10 부제목 GPT 호출 실패:', err);
        }
        // 소제목에서 마침표 제거
        subtitle10 = subtitle10.replace(/\.$/, '');
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

        // 왼쪽 본문 3줄 보강(아이템 텍스트를 3문장으로 구성)
        const s10 = sectionContent.split(/[\.!?\n]+/).map(s=>s.trim()).filter(Boolean);
        const to3Lines = (t:string, startIdx:number) => {
          const acc: string[] = [];
          const pushIf = (s?:string) => { const v = (s||'').trim(); if (v) acc.push(v); };
          pushIf(t);
          pushIf(s10[startIdx]);
          pushIf(s10[startIdx+1]);
          pushIf(s10[startIdx+2]);
          while (acc.length < 3) pushIf(s10[acc.length] || sectionKeypoints[acc.length] || '');
          return acc.slice(0,3).join('<br/>');
        };
        practice1Text = to3Lines(practice1Text, 0);
        practice2Text = to3Lines(practice2Text, 2);
        practice3Text = to3Lines(practice3Text, 4);

        // 하단 아이콘 영역(템플릿 변형 호환)을 위한 1줄 라벨 생성
        const toOneLine = (t:string, fb:string) => {
          const base = (t || '').split(/[\.\!?\n]/)[0].trim();
          const v = base || (fb || '').split(/[\.\!?\n]/)[0].trim();
          return v || '핵심 요약';
        };
        const item1Label = toOneLine(practice1Text, sectionKeypoints[0] || s10[0] || title);
        const item2Label = toOneLine(practice2Text, sectionKeypoints[1] || s10[1] || title);
 
        // 우측 플로우차트 라벨(최대 5단계) 생성: 키포인트/문장 기반
        const flowCandidates = [
          sectionKeypoints[0], sectionKeypoints[1], sectionKeypoints[2],
          s10[0], s10[1], s10[2], s10[3], s10[4]
        ].map(t => (t || '').replace(/<[^>]+>/g, '').trim()).filter(Boolean);
        const flow = (idx:number, fallback:string) => (flowCandidates[idx] || fallback).split(/[\.!?\n]/)[0].trim().slice(0, 7);
        const FLOW1 = flow(0, '준비');
        const FLOW2 = flow(1, '초기 검토');
        const FLOW3 = flow(2, '평가');
        const FLOW4 = flow(3, '결정');
        const FLOW5 = flow(4, '출시');
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, clampSubtitle15((subtitle10.split(/[\.!?\n]/)[0] || '').trim()))
          .replace(/{{DESCRIPTION}}/g, description)
          .replace(/{{PRACTICES_TITLE}}/g, practicesTitle)
          .replace(/{{PRACTICE1_NUMBER}}/g, practice1Number)
          .replace(/{{PRACTICE1_TEXT}}/g, practice1Text)
          .replace(/{{PRACTICE2_NUMBER}}/g, practice2Number)
          .replace(/{{PRACTICE2_TEXT}}/g, practice2Text)
          .replace(/{{PRACTICE3_NUMBER}}/g, practice3Number)
          .replace(/{{PRACTICE3_TEXT}}/g, practice3Text)
          // 좌측 아이템 텍스트도 본문 3줄을 그대로 사용
          .replace(/{{ITEM1_TEXT}}/g, practice1Text)
          .replace(/{{ITEM2_TEXT}}/g, practice2Text)
          // 플로우차트 라벨 주입
          .replace(/{{FLOW1}}/g, FLOW1)
          .replace(/{{FLOW2}}/g, FLOW2)
          .replace(/{{FLOW3}}/g, FLOW3)
          .replace(/{{FLOW4}}/g, FLOW4)
          .replace(/{{FLOW5}}/g, FLOW5)
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
        
        // GPT로 15자 이내 부제목 생성
        const originalSubtitle11 = (sectionContent.split(/[\.!?\n]/)[0] || '').trim();
        const section11SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle11}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

        let subtitle = originalSubtitle11;
        try {
          const subtitle11Resp = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: STYLE_SYSTEM },
              { role: 'user', content: section11SubtitlePrompt }
            ]
          });
          const response = subtitle11Resp.choices[0]?.message?.content?.trim() || '';
          if (response) {
            subtitle = response;
          }
        } catch (err) {
          console.error('섹션 11 부제목 GPT 호출 실패:', err);
        }
        // 소제목에서 마침표 제거
        subtitle = subtitle.replace(/\.$/, '');
        let description = sectionContent;

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
        for (const b of bulletLines) { if (candidates.length >= 4) break; if (!candidates.includes(b)) candidates.push(b); }
        for (const s of sentenceLines) { if (candidates.length >= 4) break; if (!candidates.includes(s)) candidates.push(s); }
        while (candidates.length < 4) { candidates.push(candidates[candidates.length - 1] || subtitle || title); }

        const step1 = candidates[0];
        const step2 = candidates[1];
        const step3 = candidates[2];
        const step4 = candidates[3];
       
        // 템플릿 11 토큰 맞춤 채우기
        const contentText = sentenceLines.slice(0, 2).join(' ') || description;
        const marketStats = (sectionKeypoints.find(k => /%|배|\d/.test(k)) || sentenceLines.find(s=>/%|배|\d/.test(s)) || '').trim();
       
       // 이미지 검색 및 추가 (섹션 11 - 오른쪽)
       console.log('🖼️ 섹션 11 이미지 검색 시작');
       const imageKeywords11 = await generateImageKeywords(title, sectionContent, sectionKeypoints);
       console.log('🔍 섹션 11 이미지 키워드:', imageKeywords11);
       const imageUrls11 = await searchUnsplashImages(imageKeywords11, 1, sessionKey);
       const imageUrl11 = imageUrls11.length > 0 ? imageUrls11[0] : '';
       console.log('🖼️ 섹션 11 이미지 URL:', imageUrl11);
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, subtitle)
          .replace(/{{CONTENT_TEXT}}/g, contentText)
          .replace(/{{KEYPOINT1_TEXT}}/g, step1)
          .replace(/{{KEYPOINT2_TEXT}}/g, step2)
          .replace(/{{KEYPOINT3_TEXT}}/g, step3)
          .replace(/{{KEYPOINT4_TEXT}}/g, step4)
          .replace(/{{MARKET_STATS}}/g, marketStats)
          .replace(/{{IMAGE_URL}}/g, imageUrl11)
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
        
        const headerLeft = '';
        const headerCenter = currentDate();
        const headerRight = '';

        // 소제목: 본문 첫 문장, 15자 이내로 제한
        const sectionSentences = sectionContent
          .split(/[\.!?\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        // GPT로 15자 이내 부제목 생성
        const originalSubtitle12 = (subtitleMatch && subtitleMatch[1].trim().length > 3)
          ? subtitleMatch[1].trim()
          : (sectionSentences[0] || '');
        const section12SubtitlePrompt = `다음 내용을 바탕으로 15자 이내의 완성된 부제목을 만들어주세요.

내용: ${originalSubtitle12}
키포인트: ${sectionKeypoints.join(', ')}

중요한 규칙:
- 반드시 15자 이내로 작성하세요
- 완전한 의미를 담은 문장으로 작성하세요
- 절대 중간에 끊어지거나 짤린 느낌이 나면 안됩니다
- 15자 안에서 완성된 내용으로 작성하세요
- 마침표(.)는 붙이지 마세요
- 지정된 글자 수를 절대 초과하지 마세요

15자 이내 완성된 부제목:`;

        let subtitle = originalSubtitle12;
        try {
          const subtitle12Resp = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
              { role: 'system', content: STYLE_SYSTEM },
              { role: 'user', content: section12SubtitlePrompt }
            ]
          });
          const response = subtitle12Resp.choices[0]?.message?.content?.trim() || '';
          if (response) {
            subtitle = response;
          }
        } catch (err) {
          console.error('섹션 12 부제목 GPT 호출 실패:', err);
        }
        // 소제목에서 마침표 제거
        subtitle = subtitle.replace(/\.$/, '');

        const title = '감사합니다';

        // 하단 본문(두 번째 문장)
        const description = (descriptionMatch && descriptionMatch[1].trim().length > 10)
          ? descriptionMatch[1].trim()
          : (sectionSentences[1] || sectionSentences[0] || '');

        // 메시지/권고사항/연락처 보강
        const msg1 = sectionKeypoints[0] || sectionSentences[0] || '';
        const msg2 = sectionKeypoints[1] || sectionSentences[1] || '';
        const msg3 = sectionKeypoints[2] || sectionSentences[2] || '';
        const rec1 = sectionSentences[3] || sectionKeypoints[0] || '';
        const rec2 = sectionSentences[4] || sectionKeypoints[1] || '';
        const rec3 = sectionSentences[5] || sectionKeypoints[2] || '';
        const contactInfo = (emailAddressMatch && emailAddressMatch[1].trim().length > 5)
          ? emailAddressMatch[1].trim()
          : '문의: contact@ai-future.kr | 웹: ai-future.kr';
       
       htmlContent = cleanTemplateContent
         .replace(/{{TITLE}}/g, title)
          .replace(/{{SUBTITLE}}/g, '')
          // 상단 메시지/본문은 템플릿의 요약/권고사항 블록에서 각각 사용됨
          .replace(/{{MESSAGE1_TEXT}}/g, msg1)
          .replace(/{{MESSAGE2_TEXT}}/g, msg2)
          .replace(/{{MESSAGE3_TEXT}}/g, msg3)
          .replace(/{{RECOMMENDATION1_TEXT}}/g, rec1)
          .replace(/{{RECOMMENDATION2_TEXT}}/g, rec2)
          .replace(/{{RECOMMENDATION3_TEXT}}/g, rec3)
          .replace(/{{CONTACT_INFO}}/g, contactInfo)
          .replace(/{{HEADER_LEFT}}/g, headerLeft)
          .replace(/{{HEADER_CENTER}}/g, currentDate())
          .replace(/{{HEADER_RIGHT}}/g, headerRight);
             } else if (!htmlContent) {
         // 일반 섹션: 일반 형식으로 처리(아직 채워지지 않은 경우만)
         htmlContent = cleanTemplateContent
           .replace(/{{TITLE}}/g, displayTitle)
           .replace(/{{CONTENT}}/g, slideContent)
          .replace(/{{HEADER_LEFT}}/g, 'AI 미래 전망')
          .replace(/{{HEADER_CENTER}}/g, '2025-08-05')
          .replace(/{{HEADER_RIGHT}}/g, '@aifuture2025');
        }

      }
    } catch (err) {
      console.error('❌ 섹션 조립 중 오류', { section, err });
      htmlContent = cleanTemplateContent
        .replace(/{{TITLE}}/g, sectionTitle)
        .replace(/{{CONTENT}}/g, splitSentences(sectionContent).slice(0,3).join('<br/>'));
      }

    // 최종 안전 치환: 화면에 'N/A' 및 대괄호([ ])가 보이지 않도록 제거
    if (typeof htmlContent === 'string') {
      htmlContent = htmlContent
        .replace(/>\s*N\/A\s*</g, '><')
        .replace(/\[/g, '')
        .replace(/\]/g, '');
      }

    // 섹션 4 폴백: 어떤 이유로든 비어 있으면 최소 불릿 3개 채워서 렌더 보장
    if ((!htmlContent || htmlContent.trim().length === 0) && section === 4) {
      const s4 = sectionContent.split(/[\.\!\?\n]+/).map(s=>s.trim()).filter(Boolean);
      const title4 = clampTitle20(getTocTitleForSection(4, sectionTitle));
      let subtitle4 = (s4[0] || '').split(/[\.\!\?\n]/)[0].trim();
      if (subtitle4.length > 120) subtitle4 = subtitle4.slice(0, 120);
      const fallbackLine = (idx:number) => s4[idx] || sectionKeypoints[idx] || s4[0] || sectionTitle || '';
      const bullet1Text = [fallbackLine(0), s4[1] || '', s4[2] || ''].filter(Boolean).slice(0,4).join('<br/>');
      const bullet2Text = [fallbackLine(1), s4[3] || '', s4[4] || ''].filter(Boolean).slice(0,4).join('<br/>');
      const bullet3Text = [fallbackLine(2), s4[5] || '', s4[6] || ''].filter(Boolean).slice(0,4).join('<br/>');
      const footerText4 = s4[0] || '';
      const imageUrl = '';
      const fallbackSubtitle = subtitle4.length > 50 ? subtitle4.slice(0, 50) : subtitle4;
      htmlContent = cleanTemplateContent
        .replace(/\{\{TITLE\}\}/g, title4)
        .replace(/\{\{SUBTITLE\}\}/g, fallbackSubtitle)
        .replace(/\{\{BULLET1_ICON\}\}/g, 'fas fa-check-circle')
        .replace(/\{\{BULLET1_TEXT\}\}/g, bullet1Text)
        .replace(/\{\{BULLET2_ICON\}\}/g, 'fas fa-bolt')
        .replace(/\{\{BULLET2_TEXT\}\}/g, bullet2Text)
        .replace(/\{\{BULLET3_ICON\}\}/g, 'fas fa-star')
        .replace(/\{\{BULLET3_TEXT\}\}/g, bullet3Text)
        .replace(/\{\{IMAGE_URL\}\}/g, imageUrl)
        .replace(/\{\{FOOTER_TEXT\}\}/g, footerText4);
    }

    console.log('✅ HTML 생성 완료!');

    // 최종 HTML을 콘솔에 출력 (CMD에서 확인용)
    try {
      console.log('\n🧩 최종 HTML 시작');
      console.log('==================================================');
      const htmlString = typeof htmlContent === 'string' ? htmlContent : String(htmlContent);
      // HTML을 청크 단위로 나누어 출력하여 짤림 방지
      const htmlChunks = htmlString.match(/.{1,3000}/g) || [htmlString];
      htmlChunks.forEach((chunk, index) => {
        console.log(`[HTML 청크 ${index + 1}/${htmlChunks.length}]`);
        console.log(chunk);
        if (index < htmlChunks.length - 1) console.log('--- HTML 계속 ---');
      });
      console.log('==================================================');
      console.log('🧩 최종 HTML 끝\n');
    } catch (err) {
      console.error('HTML 출력 중 오류:', err);
    }

    return NextResponse.json({ 
      html: htmlContent,
      format: 'html',
      topic: topic,
      section: section,
      totalSections: slideCount,
      script: scriptContent
    });

} 