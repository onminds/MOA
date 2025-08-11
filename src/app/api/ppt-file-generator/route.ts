import { NextRequest, NextResponse } from 'next/server';



// global 타입 확장
declare global {
  var pptDataCache: { [key: string]: any } | undefined;
}

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

    console.log('🔍 PPT 파일 생성 요청:', {
      title: data.title,
      slideCount: data.slides.length,
      chapterCount: data.chapters.length
    });
    
    // 디버깅: 받은 데이터 상세 확인
    console.log('🔍 받은 슬라이드 데이터:', data.slides);
    console.log('🔍 디자인 옵션:', data.designOptions);

    // ✅ 직접 PPT 바이너리 생성 및 반환
    const pptBuffer = await generateRealPPTContent(data.title, data);
    const fileName = createSafePPTFileName(data.title);
    
    // 🧪 디버깅: pptBuffer 타입 확인
    console.log('🔍 pptBuffer 타입 확인:', {
      type: typeof pptBuffer,
      isBuffer: Buffer.isBuffer(pptBuffer),
      isArrayBuffer: pptBuffer instanceof ArrayBuffer,
      isUint8Array: pptBuffer instanceof Uint8Array,
      byteLength: pptBuffer.byteLength
    });
    
    console.log('✅ PPT 파일 생성 완료:', {
      fileName,
      fileSize: `${Math.round(pptBuffer.byteLength / 1024)}KB`,
      slideCount: data.slides.length
    });

    // 💡 pptBuffer를 반드시 Buffer로 변환
    const binaryBody = Buffer.from(pptBuffer);

    // PPT 바이너리를 직접 반환
    return new NextResponse(binaryBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('PPT 파일 생성 오류:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'PPT 파일 생성 중 오류가 발생했습니다. 다시 시도해주세요.' 
    }, { status: 500 });
  }
}

// 파일명 정규화 함수 (안전한 파일명 생성 - 영문만)
function normalizeFileName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, '_') // 영문, 숫자만 허용
    .replace(/_+/g, '_') // 연속 언더스코어 제거
    .substring(0, 50); // 길이 제한
}

// 안전한 PPT 파일명 생성
function createSafePPTFileName(title: string): string {
  const normalizedTitle = normalizeFileName(title);
  return `${normalizedTitle}_AI_Presentation.pptx`;
}



// 실제 PPT 파일 생성 함수 (download-ppt API와 동일)
async function generateRealPPTContent(filename: string, pptData: any): Promise<Buffer> {
  try {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const pptx = new PptxGenJS();
    
    // 프레젠테이션 기본 설정
    pptx.author = 'AI Presentation Generator';
    pptx.company = 'AI Tools';
    pptx.title = filename.replace('.pptx', '');
    pptx.subject = 'AI Generated Presentation';
    
    // 웹 프리뷰와 동일한 템플릿 색상 사용 (안전한 색상 처리)
    // 슬라이드별 개별 색상 값 사용
    const firstSlide = pptData.slides?.[0];
    const templateColors = {
      primary: firstSlide?.primaryColor || pptData.designOptions?.colors?.primary || '3B82F6',
      secondary: firstSlide?.secondaryColor || pptData.designOptions?.colors?.secondary || '8B5CF6',
      accent: firstSlide?.accentColor || pptData.designOptions?.colors?.accent || 'F59E0B'
    };
    
    console.log('템플릿 색상 데이터:', templateColors);
    
    // ✅ 안전한 색상 처리 함수
    const sanitizeColor = (color: unknown, fallback = '3B82F6'): string => {
      if (typeof color === 'string') {
        const cleanColor = color.trim();
        if (cleanColor === '') { return fallback; }
        return cleanColor.replace('#', '');
      }
      if (typeof color === 'object' && color !== null && 'hex' in color) {
        return String((color as any).hex).replace('#', '');
      }
      return fallback;
    };
    
    // ✅ 안전한 색상 배열 처리 함수 (간결한 버전)
    const processColorArray = (colors: unknown[]): string[] => {
      if (!Array.isArray(colors)) {
        return ['3B82F6', '8B5CF6', 'F59E0B'];
      }
      return colors.map(color => sanitizeColor(color));
    };
    
    const colors = {
      primary: sanitizeColor(templateColors.primary || '3B82F6'),
      secondary: sanitizeColor(templateColors.secondary || '8B5CF6'),
      accent: sanitizeColor(templateColors.accent || 'F59E0B'),
      text: sanitizeColor('1F2937'),
      lightText: sanitizeColor('6B7280'),
      background: sanitizeColor('F9FAFB'),
      white: sanitizeColor('FFFFFF'),
      border: sanitizeColor('E5E7EB')
    };
    
    console.log('처리된 색상:', colors);
    
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
    
    // 실제 슬라이드들 생성 (안전한 색상 처리)
    if (pptData.slides && pptData.slides.length > 0) {
      pptData.slides.forEach((slideData: any, index: number) => {
        console.log(`슬라이드 ${index + 1} 생성:`, { title: slideData.title, content: slideData.content });
        const slide = pptx.addSlide();
        
        // ✅ 슬라이드별 색상 처리
        const slideColors = {
          primary: sanitizeColor(slideData?.primaryColor, colors.primary),
          secondary: sanitizeColor(slideData?.secondaryColor, colors.secondary),
          accent: sanitizeColor(slideData?.accentColor, colors.accent)
        };
        
        // 기본 배경 설정
        slide.background = { color: `#${slideColors.primary}` };
        
        // 슬라이드 제목
        slide.addText(slideData.title, {
          x: 0.5, y: 0.5, w: 9, h: 1,
          fontSize: fonts.title, bold: true, color: '#FFFFFF', fontFace: 'Arial',
          align: 'center', valign: 'middle'
        });
        
        // 슬라이드 내용
        if (slideData.content && slideData.content.length > 0) {
          const layout = slideData.layout || 'content';
          
          if (layout === 'title') {
            slide.addText(slideData.content.join('\n'), {
              x: 0.5, y: 2, w: 9, h: 2,
              fontSize: fonts.title, color: `#${colors.text}`, lineSpacingMultiple: 1.3,
              fontFace: 'Arial', align: 'center', bold: true
            });
          } else if (layout === 'timeline') {
            const timelineItems = slideData.content.map((item: string, idx: number) => 
              `${idx + 1} ${item}`
            );
            slide.addText(timelineItems.join('\n'), {
              x: 1, y: 1.5, w: 8, h: 3,
              fontSize: fonts.body, color: `#${colors.white}`, lineSpacingMultiple: 1.4,
              fontFace: 'Arial', align: 'left'
            });
          } else {
            slideData.content.forEach((item: string, idx: number) => {
              slide.addText(`• ${item}`, {
                x: 1, y: 1.5 + (idx * 0.5), w: 8, h: 0.4,
                fontSize: fonts.body, color: `#${colors.white}`, lineSpacingMultiple: 1.2,
                fontFace: 'Arial', align: 'left'
              });
            });
          }
        }
        

      });
    }
    
    console.log('PPT 생성 완료. 총 슬라이드 수:', pptData.slides.length);
    
    // PPT 파일을 Buffer로 변환 (더 안전한 방법)
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    return pptxBuffer as Buffer;
    
  } catch (error) {
    console.error('PPT 생성 오류:', error);
    throw error;
  }
}

// 아래 상수들은 더 이상 export하지 않습니다.
// const SUPPORTED_SERVICES = { ... }
// const SERVICE_CONFIG = { ... }
// const CURRENT_SERVICE = ... 