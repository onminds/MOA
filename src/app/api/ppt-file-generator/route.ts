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

// 파일명 정규화 함수 (안전한 파일명 생성)
function normalizeFileName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9가-힣]/g, '_') // 특수문자 제거
    .replace(/_+/g, '_') // 연속 언더스코어 제거
    .substring(0, 50); // 길이 제한
}

// 안전한 PPT 파일명 생성
function createSafePPTFileName(title: string): string {
  const normalizedTitle = normalizeFileName(title);
  return `${normalizedTitle}_AI_Presentation.pptx`;
}

// 실제 PPT 생성 함수 (PptxGenJS 사용)
async function generatePPTWithExternalAPI(data: PPTFileRequest) {
  try {
    console.log('PPT 생성 시작:', {
      title: data.title,
      slideCount: data.slides.length,
      chapterCount: data.chapters.length
    });

    // 실제 PPT 파일 생성
    const pptContent = await generateRealPPTContent(data.title, data);
    
    // 파일명 생성
    const fileName = createSafePPTFileName(data.title);
    
    // 파일을 임시 저장 (실제 구현에서는 파일 시스템이나 클라우드 스토리지 사용)
    // 여기서는 메모리에 저장하고 download-ppt API에서 직접 생성하도록 함
    
    // 다운로드 URL 생성 (파일명과 데이터를 함께 전달)
    const downloadUrl = `/api/download-ppt/${encodeURIComponent(fileName)}?data=${encodeURIComponent(JSON.stringify(data))}`;
    
    return {
      success: true,
      downloadUrl: downloadUrl,
      fileName: fileName,
      fileSize: `${Math.round(pptContent.byteLength / 1024)}KB`,
      slideCount: data.slides.length,
      // 실제 파일 데이터를 세션에 저장하거나 다른 방법으로 전달
      pptData: data
    };
  } catch (error) {
    console.error('PPT 생성 오류:', error);
    return {
      success: false,
      error: 'PPT 생성 중 오류가 발생했습니다.'
    };
  }
}

// 실제 PPT 파일 생성 함수 (download-ppt API와 동일)
async function generateRealPPTContent(filename: string, pptData: any): Promise<ArrayBuffer> {
  try {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    
    // 프레젠테이션 기본 설정
    pptx.author = 'AI Presentation Generator';
    pptx.company = 'AI Tools';
    pptx.title = filename.replace('.pptx', '');
    pptx.subject = 'AI Generated Presentation';
    
    // 전문적인 색상 팔레트 정의
    const colors = {
      primary: '3B82F6',
      secondary: 'F59E0B',
      accent: '10B981',
      text: '1F2937',
      lightText: '6B7280',
      background: 'F9FAFB',
      white: 'FFFFFF',
      border: 'E5E7EB'
    };
    
    const fonts = {
      title: 28,
      subtitle: 20,
      heading: 18,
      body: 16,
      caption: 12
    };
    
    // 슬라이드 마스터 설정
    pptx.layout = 'LAYOUT_16x9';
    
    console.log('슬라이드 생성 시작:', {
      totalSlides: pptData.slides?.length,
      slides: pptData.slides?.map((s: any) => ({ title: s.title, contentLength: s.content?.length }))
    });
    
    // 실제 슬라이드들 생성
    if (pptData.slides && pptData.slides.length > 0) {
      pptData.slides.forEach((slideData: any, index: number) => {
        console.log(`슬라이드 ${index + 1} 생성:`, { title: slideData.title, content: slideData.content });
        const slide = pptx.addSlide();
        
        // 배경 설정
        slide.background = { fill: colors.background };
        
        // 상단 헤더 바
        slide.addShape('rect', {
          x: 0, y: 0, w: 10, h: 0.6,
          fill: { color: colors.primary },
          line: { color: colors.primary }
        });
        
        // 슬라이드 번호
        slide.addText(`${index + 1}`, {
          x: 0.2, y: 0.1, w: 0.6, h: 0.4,
          fontSize: fonts.caption, color: colors.white, fontFace: 'Arial'
        });
        
        // 슬라이드 제목
        slide.addText(slideData.title, {
          x: 0.5, y: 0.1, w: 8.5, h: 0.4,
          fontSize: fonts.heading, bold: true, color: colors.white, fontFace: 'Arial'
        });
        
        // 좌측 콘텐츠 영역
        slide.addShape('rect', {
          x: 0.5, y: 1, w: 4.5, h: 3.5,
          fill: { color: colors.white }, line: { color: colors.border }
        });
        
        // 슬라이드 내용 (bullet points)
        if (slideData.content && slideData.content.length > 0) {
          const bulletPoints = slideData.content.map((item: string) => `• ${item}`);
          slide.addText(bulletPoints.join('\n'), {
            x: 0.8, y: 1.2, w: 3.9, h: 3.1,
            fontSize: fonts.body, color: colors.text, lineSpacingMultiple: 1.2,
            fontFace: 'Arial', align: 'left'
          });
        }
        
        // 우측 이미지/차트 영역
        slide.addShape('rect', {
          x: 5.5, y: 1, w: 4, h: 3.5,
          fill: { color: colors.background }, line: { color: colors.border }
        });
        
        slide.addText('📊 차트/이미지 영역', {
          x: 5.7, y: 2.5, w: 3.6, h: 0.5,
          fontSize: fonts.caption, color: colors.lightText, align: 'center', fontFace: 'Arial'
        });
        
        // 발표 노트 (하단에 작게 표시)
        if (slideData.notes) {
          slide.addShape('rect', {
            x: 0.5, y: 4.8, w: 9, h: 0.8,
            fill: { color: colors.white }, line: { color: colors.border }
          });
          
          slide.addText(`💡 발표 노트: ${slideData.notes}`, {
            x: 0.6, y: 4.9, w: 8.8, h: 0.6,
            fontSize: fonts.caption, color: colors.lightText, fontFace: 'Arial'
          });
        }
        
        // 하단 장식선
        slide.addShape('rect', {
          x: 0.5, y: 5.5, w: 9, h: 0.05,
          fill: { color: colors.secondary }, line: { color: colors.secondary }
        });
      });
    }
    
    console.log('PPT 생성 완료. 총 슬라이드 수:', pptData.slides.length);
    
    // PPT 파일을 ArrayBuffer로 변환
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    return pptxBuffer as ArrayBuffer;
    
  } catch (error) {
    console.error('PPT 생성 오류:', error);
    throw error;
  }
}

// 아래 상수들은 더 이상 export하지 않습니다.
// const SUPPORTED_SERVICES = { ... }
// const SERVICE_CONFIG = { ... }
// const CURRENT_SERVICE = ... 