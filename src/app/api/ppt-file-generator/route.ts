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
  try {
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 (실제 API 호출 시뮬레이션)
    const fileName = `${data.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_')}_AI프레젠테이션.pptx`;
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

// 아래 상수들은 더 이상 export하지 않습니다.
// const SUPPORTED_SERVICES = { ... }
// const SERVICE_CONFIG = { ... }
// const CURRENT_SERVICE = ... 