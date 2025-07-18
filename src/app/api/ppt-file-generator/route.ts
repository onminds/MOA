import { NextRequest, NextResponse } from 'next/server';

interface PPTFileRequest {
  title: string;
  subtitle: string;
  slides: Array<{
    id: number;
    title: string;
    content: string[];
    notes?: string;
    images?: string[];
    chapterId?: number;
    layout?: string;
  }>;
  chapters: Array<{
    id: number;
    title: string;
    description: string;
    color: string;
  }>;
  designOptions: {
    theme: string;
    language: string;
    colorScheme: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const data: PPTFileRequest = await request.json();

    console.log('PPT 파일 생성 요청:', {
      title: data.title,
      slideCount: data.slides.length,
      chapterCount: data.chapters.length
    });

    // 실제 PPT 생성 API 호출 (여기서는 시뮬레이션)
    const pptFile = await generatePPTWithExternalAPI(data);

    if (pptFile.success) {
      return NextResponse.json({
        success: true,
        downloadUrl: pptFile.downloadUrl,
        fileName: pptFile.fileName,
        message: 'PPT 파일이 성공적으로 생성되었습니다.'
      });
    } else {
      throw new Error('PPT 생성 API에서 오류가 발생했습니다.');
    }

  } catch (error) {
    console.error('PPT 파일 생성 오류:', error);
    
    return NextResponse.json({ 
      success: false,
      error: '외부 PPT 생성 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    }, { status: 500 });
  }
}

// 외부 PPT 생성 API 호출 함수 (실제 구현 시 교체)
async function generatePPTWithExternalAPI(data: PPTFileRequest) {
  // 실제로는 다음 중 하나의 API를 호출:
  // 1. Microsoft Graph API (PowerPoint Online)
  // 2. Google Slides API
  // 3. Canva API
  // 4. Gamma API
  // 5. 기타 PPT 생성 서비스

  try {
    // 예시: Microsoft Graph API 호출
    // const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/items/{parent-id}/children', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.MICROSOFT_ACCESS_TOKEN}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     name: `${data.title}.pptx`,
    //     file: {},
    //     '@microsoft.graph.sourceUrl': 'https://templates.office.com/...'
    //   })
    // });

    // 현재는 시뮬레이션으로 응답
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 (실제 API 호출 시뮬레이션)

    const fileName = `${data.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_')}_AI프레젠테이션.pptx`;
    
    // 시뮬레이션 응답 (실제로는 API에서 받은 데이터 사용)
    return {
      success: true,
      downloadUrl: '/api/download-ppt/' + encodeURIComponent(fileName), // 실제 다운로드 URL
      fileName: fileName,
      fileSize: '2.5MB', // 예시
      slideCount: data.slides.length
    };

  } catch (error) {
    console.error('외부 PPT API 호출 오류:', error);
    return {
      success: false,
      error: '외부 PPT 생성 서비스 오류'
    };
  }
}

// 지원되는 PPT 생성 서비스 목록
const SUPPORTED_SERVICES = {
  MICROSOFT_GRAPH: 'microsoft',
  GOOGLE_SLIDES: 'google',
  CANVA_API: 'canva',
  GAMMA_API: 'gamma',
  BEAUTIFUL_AI: 'beautiful'
};

// 서비스별 설정
const SERVICE_CONFIG = {
  [SUPPORTED_SERVICES.MICROSOFT_GRAPH]: {
    endpoint: 'https://graph.microsoft.com/v1.0',
    authRequired: true,
    maxSlides: 50
  },
  [SUPPORTED_SERVICES.GOOGLE_SLIDES]: {
    endpoint: 'https://slides.googleapis.com/v1',
    authRequired: true,
    maxSlides: 100
  },
  [SUPPORTED_SERVICES.CANVA_API]: {
    endpoint: 'https://api.canva.com/v1',
    authRequired: true,
    maxSlides: 30
  }
};

// 어떤 API를 사용할지 설정 (환경 변수로 관리)
const CURRENT_SERVICE = process.env.PPT_SERVICE || 'simulation';

export { SUPPORTED_SERVICES, SERVICE_CONFIG, CURRENT_SERVICE }; 