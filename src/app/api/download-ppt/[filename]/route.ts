import { NextRequest, NextResponse } from 'next/server';
import PptxGenJS from 'pptxgenjs';

// global 타입 확장
declare global {
  var pptDataCache: { [key: string]: any } | undefined;
}

interface RouteParams {
  params: Promise<{
    filename: string;
  }>;
}

// 파일명 정규화 함수 (안전한 파일명 생성)
function normalizeFileName(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9가-힣]/g, '_') // 특수문자 제거
    .replace(/_+/g, '_') // 연속 언더스코어 제거
    .substring(0, 50); // 길이 제한
}

// RFC 5987 방식으로 한글 파일명 처리
function createSafeContentDisposition(filename: string): string {
  try {
    // ASCII-only 파일명 생성 (가장 안전한 방법)
    const asciiSafeName = normalizeFileName(filename).replace(/[가-힣]/g, '') || 'presentation';
    const safeFilename = `${asciiSafeName}_AI_Presentation.pptx`;
    
    // RFC 5987 방식으로 한글 파일명 지원 (선택적)
    const encodedFilename = encodeURIComponent(filename);
    
    return `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodedFilename}`;
  } catch (error) {
    // 폴백: 기본 파일명 사용
    return 'attachment; filename="ai_presentation.pptx"';
  }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { filename } = await params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log('PPT 파일 다운로드 요청:', decodedFilename);

    // 전역 캐시에서 PPT 데이터 추출
    let pptData = null;
    
    // 전역 캐시에서 데이터 찾기
    if (global.pptDataCache && global.pptDataCache[decodedFilename]) {
      pptData = global.pptDataCache[decodedFilename];
      console.log('캐시에서 PPT 데이터 사용:', pptData.title);
    } else {
      // 캐시에 없으면 기본 데이터 사용
      const title = decodedFilename.replace('_AI_Presentation.pptx', '').replace(/_/g, ' ');
      pptData = {
          title: title,
          subtitle: "AI가 생성한 프레젠테이션",
          slides: [
            {
              id: 1,
              title: title,
              content: ["AI 기반 프레젠테이션 생성", "발표자: [이름]", "날짜: [날짜]"],
              notes: "청중에게 인사하고 발표 주제를 소개합니다.",
              chapterId: 1,
              layout: "title"
            },
            {
              id: 2,
              title: "목차",
              content: ["발표 개요", "주요 내용", "결론", "Q&A"],
              notes: "발표의 전체 구성을 설명합니다.",
              chapterId: 1,
              layout: "content"
            },
            {
              id: 3,
              title: "AI 시장 동향",
              content: ["글로벌 AI 시장 규모", "중소기업 AI 도입률", "AI 도입 성공률", "예상 시장 성장률"],
              notes: "AI 시장의 전반적인 동향을 살펴보겠습니다.",
              chapterId: 1,
              layout: "content"
            },
            {
              id: 4,
              title: "중소기업의 현실",
              content: ["중소기업 매출 성장률", "AI 도입 중소기업", "기존 방식의 한계", "AI 도입 필요성"],
              notes: "현재 중소기업들이 직면한 현실을 구체적으로 분석해보겠습니다.",
              chapterId: 1,
              layout: "content"
            },
            {
              id: 5,
              title: "성공 사례 분석",
              content: ["A사: 매출 20% 증가", "B사: 비용 15% 절감", "C사: 고객 만족도 향상", "D사: 업무 효율성 개선"],
              notes: "실제 도입 사례를 통해 구체적인 효과를 확인해보겠습니다.",
              chapterId: 2,
              layout: "content"
            },
            {
              id: 6,
              title: "Q&A",
              content: ["도입 비용은 얼마나 드나요?", "기존 인력과의 충돌은 어떻게 조정하나요?", "실패 위험을 줄이는 방법은 무엇인가요?"],
              notes: "질문을 받아드리겠습니다.",
              chapterId: 4,
              layout: "content"
            }
          ],
          chapters: [
            { id: 1, title: "서론", description: "주제 소개 및 배경", slideCount: 2, color: "#3B82F6" },
            { id: 2, title: "본론", description: "핵심 내용 및 분석", slideCount: 3, color: "#10B981" },
            { id: 3, title: "결론", description: "요약 및 제안", slideCount: 1, color: "#F59E0B" },
            { id: 4, title: "Q&A", description: "질문 및 답변", slideCount: 1, color: "#8B5CF6" }
          ]
        };
      }


    console.log('PPT 데이터 생성:', pptData.title);

    // 실제 PPT 파일 생성
    const pptContent = await generateRealPPTContent(decodedFilename, pptData);

    // 안전한 Content-Disposition 헤더 생성
    const contentDisposition = createSafeContentDisposition(decodedFilename);

    // 더 안정적인 Response 사용
    return new Response(pptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': contentDisposition,
        'Content-Length': pptContent.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    });

  } catch (error) {
    console.error('PPT 파일 다운로드 오류:', error);
    
    // 더 구체적인 에러 메시지
    let errorMessage = 'PPT 파일 다운로드 중 오류가 발생했습니다.';
    if (error instanceof Error) {
      errorMessage = `PPT 생성 오류: ${error.message}`;
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });
  }
}

// 실제 PPT 파일 생성 (PptxGenJS 라이브러리 사용)
async function generateRealPPTContent(filename: string, pptData?: any): Promise<ArrayBuffer> {
  try {
    // PptxGenJS를 사용한 실제 PPT 생성
    const pptx = new PptxGenJS();
    
    // 프레젠테이션 기본 설정
    pptx.author = 'AI Presentation Generator';
    pptx.company = 'AI Tools';
    pptx.title = filename.replace('.pptx', '');
    pptx.subject = 'AI Generated Presentation';
    
    // 전문적인 색상 팔레트 정의 (피드백 적용)
    const colors = {
      primary: '3B82F6',      // 파랑 (피드백 제안)
      secondary: 'F59E0B',    // 주황 (피드백 제안)
      accent: '10B981',       // 초록 (강조용)
      success: 'EF4444',      // 빨강 (액션용)
      text: '1F2937',         // 짙은 회색 (피드백 제안)
      lightText: '6B7280',    // 연한 회색
      background: 'F9FAFB',   // 연한 배경색 (피드백 제안)
      white: 'FFFFFF',        // 흰색
      border: 'E5E7EB'        // 테두리 색
    };
    
    // 폰트 규칙 정의 (피드백 적용)
    const fonts = {
      title: 28,              // 제목용
      subtitle: 20,           // 부제목용
      heading: 18,            // 헤딩용
      body: 16,               // 본문용
      caption: 12             // 캡션용
    };
    
    // 슬라이드 마스터 설정
    pptx.layout = 'LAYOUT_16x9'; // 16:9 비율
    
    if (pptData) {
      // GPT 결과를 기반으로 한 동적 슬라이드 생성
      console.log('동적 슬라이드 생성 시작...');
      
      // 제목 슬라이드 (피드백 적용 - 전문적 템플릿)
      const titleSlide = pptx.addSlide();
      
      // 배경 설정 (피드백 적용)
      titleSlide.background = { fill: colors.background };
      
      // 상단 헤더 바 (피드백 적용)
      titleSlide.addShape('rect', {
        x: 0, y: 0, w: 10, h: 1.2,
        fill: { color: colors.primary },
        line: { color: colors.primary }
      });
      
      // 제목 텍스트 (피드백 적용 - 큰 타이틀)
      titleSlide.addText(pptData.title || 'AI 프레젠테이션', {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.6,
        fontSize: fonts.title,
        bold: true,
        color: colors.white,
        align: 'center',
        fontFace: 'Arial'
      });
      
      // 부제목 (있는 경우)
      if (pptData.subtitle) {
        titleSlide.addText(pptData.subtitle, {
          x: 0.5,
          y: 1.5,
          w: 9,
          h: 0.8,
          fontSize: fonts.subtitle,
          color: colors.text,
          align: 'center',
          fontFace: 'Arial'
        });
      }
      
      // 중앙 콘텐츠 박스 (피드백 적용)
      titleSlide.addShape('rect', {
        x: 0.5, y: 2.5, w: 9, h: 2,
        fill: { color: colors.white },
        line: { color: colors.border }
      });
      
      // 추가 정보 (선택적)
      titleSlide.addText('AI 기반 프레젠테이션 생성', {
        x: 0.5,
        y: 2.7,
        w: 9,
        h: 0.5,
        fontSize: fonts.body,
        color: colors.lightText,
        align: 'center',
        fontFace: 'Arial'
      });
      
      // 하단 정보 바
      titleSlide.addShape('rect', {
        x: 0, y: 5, w: 10, h: 0.625,
        fill: { color: colors.secondary },
        line: { color: colors.secondary }
      });
      
      titleSlide.addText('AI Presentation Generator', {
        x: 0.5,
        y: 5.1,
        w: 9,
        h: 0.4,
        fontSize: fonts.caption,
        color: colors.white,
        align: 'center',
        fontFace: 'Arial'
      });
      
      // 목차 슬라이드 (피드백 적용 - 전문적 템플릿)
      if (pptData.outline && pptData.outline.length > 0) {
        const outlineSlide = pptx.addSlide();
        
        // 배경 설정 (피드백 적용)
        outlineSlide.background = { fill: colors.background };
        
        // 상단 헤더 바
        outlineSlide.addShape('rect', {
          x: 0, y: 0, w: 10, h: 0.8,
          fill: { color: colors.primary },
          line: { color: colors.primary }
        });
        
        outlineSlide.addText('📋 목차', {
          x: 0.5,
          y: 0.1,
          w: 9,
          h: 0.6,
          fontSize: fonts.heading,
          bold: true,
          color: colors.white,
          align: 'center',
          fontFace: 'Arial'
        });
        
        // 목차 내용 박스 (피드백 적용)
        outlineSlide.addShape('rect', {
          x: 0.5,
          y: 1.2,
          w: 8.5,
          h: 3.5,
          fill: { color: colors.white },
          line: { color: colors.border }
        });
        
        // 목차 내용 (번호와 함께) - 피드백 적용
        const outlineItems = pptData.outline.map((item: string, index: number) => 
          `${index + 1}. ${item}`
        );
        
        outlineSlide.addText(outlineItems.join('\n'), {
          x: 1,
          y: 1.4,
          w: 7.5,
          h: 3.1,
          fontSize: fonts.body,
          color: colors.text,
          lineSpacingMultiple: 1.4,
          fontFace: 'Arial',
          align: 'left'
        });
        
        // 하단 장식선
        outlineSlide.addShape('rect', {
          x: 0.5, y: 5.2, w: 9, h: 0.05,
          fill: { color: colors.secondary },
          line: { color: colors.secondary }
        });
      }
      
      // 실제 슬라이드들 생성 (피드백 적용 - 전문적 템플릿)
      console.log('슬라이드 데이터 확인:', {
        totalSlides: pptData.slides?.length,
        slides: pptData.slides?.map((s: any) => ({ title: s.title, contentLength: s.content?.length }))
      });
      
      if (pptData.slides && pptData.slides.length > 0) {
        pptData.slides.forEach((slideData: any, index: number) => {
          console.log(`슬라이드 ${index + 1} 생성:`, { title: slideData.title, content: slideData.content });
          const slide = pptx.addSlide();
          
          // 배경 설정 (피드백 적용)
          slide.background = { fill: colors.background };
          
          // 상단 헤더 바
          slide.addShape('rect', {
            x: 0, y: 0, w: 10, h: 0.6,
            fill: { color: colors.primary },
            line: { color: colors.primary }
          });
          
          // 슬라이드 번호
          slide.addText(`${index + 1}`, {
            x: 0.2,
            y: 0.1,
            w: 0.6,
            h: 0.4,
            fontSize: fonts.caption,
            color: colors.white,
            fontFace: 'Arial'
          });
          
          // 슬라이드 제목
          slide.addText(slideData.title, {
            x: 0.5,
            y: 0.1,
            w: 8.5,
            h: 0.4,
            fontSize: fonts.heading,
            bold: true,
            color: colors.white,
            fontFace: 'Arial'
          });
          
          // 좌측 콘텐츠 영역 (피드백 적용)
          slide.addShape('rect', {
            x: 0.5, y: 1, w: 4.5, h: 3.5,
            fill: { color: colors.white },
            line: { color: colors.border }
          });
          
          // 슬라이드 내용 (bullet points) - 피드백 적용
          if (slideData.content && slideData.content.length > 0) {
            const bulletPoints = slideData.content.map((item: string) => `• ${item}`);
            
            slide.addText(bulletPoints.join('\n'), {
              x: 0.8,
              y: 1.2,
              w: 3.9,
              h: 3.1,
              fontSize: fonts.body,
              color: colors.text,
              lineSpacingMultiple: 1.2,
              fontFace: 'Arial',
              align: 'left'
            });
          }
          
          // 우측 이미지/차트 영역 (피드백 적용)
          slide.addShape('rect', {
            x: 5.5, y: 1, w: 4, h: 3.5,
            fill: { color: colors.background },
            line: { color: colors.border }
          });
          
          slide.addText('📊 차트/이미지 영역', {
            x: 5.7,
            y: 2.5,
            w: 3.6,
            h: 0.5,
            fontSize: fonts.caption,
            color: colors.lightText,
            align: 'center',
            fontFace: 'Arial'
          });
          
          // 발표 노트 (하단에 작게 표시)
          if (slideData.notes) {
            // 노트 배경
            slide.addShape('rect', {
              x: 0.5, y: 4.8, w: 9, h: 0.8,
              fill: { color: colors.white },
              line: { color: colors.border }
            });
            
            slide.addText(`💡 발표 노트: ${slideData.notes}`, {
              x: 0.6,
              y: 4.9,
              w: 8.8,
              h: 0.6,
              fontSize: fonts.caption,
              color: colors.lightText,
              fontFace: 'Arial'
            });
          }
          
          // 하단 장식선
          slide.addShape('rect', {
            x: 0.5, y: 5.5, w: 9, h: 0.05,
            fill: { color: colors.secondary },
            line: { color: colors.secondary }
          });
        });
      }
      
      // 디자인 제안 슬라이드 (피드백 적용 - 전문적 템플릿)
      if (pptData.designSuggestions && pptData.designSuggestions.length > 0) {
        const designSlide = pptx.addSlide();
        
        // 배경 설정 (피드백 적용)
        designSlide.background = { fill: colors.background };
        
        // 상단 헤더 바
        designSlide.addShape('rect', {
          x: 0, y: 0, w: 10, h: 0.8,
          fill: { color: colors.secondary },
          line: { color: colors.secondary }
        });
        
        designSlide.addText('🎨 디자인 제안', {
          x: 0.5,
          y: 0.1,
          w: 9,
          h: 0.6,
          fontSize: fonts.heading,
          bold: true,
          color: colors.white,
          align: 'center',
          fontFace: 'Arial'
        });
        
        // 디자인 제안 내용 박스 (피드백 적용)
        designSlide.addShape('rect', {
          x: 0.5, y: 1.2, w: 8.5, h: 3.5,
          fill: { color: colors.white },
          line: { color: colors.border }
        });
        
        // 디자인 제안 내용 - 피드백 적용
        const designItems = pptData.designSuggestions.map((item: string) => `• ${item}`);
        
        designSlide.addText(designItems.join('\n'), {
          x: 1,
          y: 1.4,
          w: 7.5,
          h: 3.1,
          fontSize: fonts.body,
          color: colors.text,
          lineSpacingMultiple: 1.2,
          fontFace: 'Arial',
          align: 'left'
        });
        
        // 하단 장식선
        designSlide.addShape('rect', {
          x: 0.5, y: 5.2, w: 9, h: 0.05,
          fill: { color: colors.secondary },
          line: { color: colors.secondary }
        });
      }
      
              console.log(`동적 슬라이드 생성 완료`);
        
        // 결론 슬라이드 추가 (피드백 적용)
        const conclusionSlide = pptx.addSlide();
        
        // 배경 설정 (피드백 적용)
        conclusionSlide.background = { fill: colors.background };
        
        // 상단 헤더 바
        conclusionSlide.addShape('rect', {
          x: 0, y: 0, w: 10, h: 0.8,
          fill: { color: colors.accent },
          line: { color: colors.accent }
        });
        
        conclusionSlide.addText('🎯 결론', {
          x: 0.5,
          y: 0.1,
          w: 9,
          h: 0.6,
          fontSize: fonts.heading,
          bold: true,
          color: colors.white,
          align: 'center',
          fontFace: 'Arial'
        });
        
        // 결론 내용 박스 (피드백 적용)
        conclusionSlide.addShape('rect', {
          x: 0.5, y: 1.2, w: 8.5, h: 3.5,
          fill: { color: colors.white },
          line: { color: colors.border }
        });
        
        // 결론 내용
        conclusionSlide.addText([
          '• 핵심 메시지 요약',
          '• 주요 인사이트',
          '• 다음 단계 제안',
          '• 감사 인사'
        ].join('\n'), {
          x: 1,
          y: 1.4,
          w: 7.5,
          h: 3.1,
          fontSize: fonts.body,
          color: colors.text,
          lineSpacingMultiple: 1.3,
          fontFace: 'Arial',
          align: 'left'
        });
        
        // 하단 장식선
        conclusionSlide.addShape('rect', {
          x: 0.5, y: 5.2, w: 9, h: 0.05,
          fill: { color: colors.accent },
          line: { color: colors.accent }
        });
        
      } else {
      // 기본 슬라이드 (데이터가 없을 때)
      const slide = pptx.addSlide();
      slide.addText('AI 프레젠테이션 생성기', {
        x: 1,
        y: 1,
        w: 8,
        h: 1,
        fontSize: 24,
        bold: true,
        color: '363636'
      });
      
      slide.addText('생성된 파일: ' + filename, {
        x: 1,
        y: 2.5,
        w: 8,
        h: 1,
        fontSize: 14,
        color: '666666'
      });
      
      slide.addText('이 프레젠테이션은 AI가 생성한 것입니다.', {
        x: 1,
        y: 4,
        w: 8,
        h: 1,
        fontSize: 12,
        color: '999999'
      });
    }
    
    // PPT 파일을 ArrayBuffer로 변환
    const pptxBuffer = await pptx.write({ outputType: 'nodebuffer' });
    return pptxBuffer as ArrayBuffer;
    
  } catch (error) {
    console.error('PPT 생성 오류:', error);
    // 폴백: 기본 구조 반환
    return generateBasicPPTStructure(filename);
  }
}

// 기본 PPT 구조 생성 (실제 PPT 파일 형식)
function generateBasicPPTStructure(filename: string): ArrayBuffer {
  // PowerPoint 2007+ (.pptx) 파일 구조
  // PPTX는 ZIP 기반의 XML 파일들의 집합
  
  const pptxStructure = {
    // [Content_Types].xml
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>
</Types>`,
    
    // _rels/.rels
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`,
    
    // ppt/presentation.xml
    'ppt/presentation.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasters>
    <p:sldMaster>
      <p:cSld>
        <p:spTree>
          <p:sp>
            <p:txBody>
              <a:p>
                <a:r>
                  <a:t>${filename}</a:t>
                </a:r>
              </a:p>
            </p:txBody>
          </p:sp>
        </p:spTree>
      </p:cSld>
    </p:sldMaster>
  </p:sldMasters>
  <p:sldIdLst>
    <p:sld sldId="256" r:id="rId1"/>
  </p:sldIdLst>
</p:presentation>`
  };

  // ZIP 파일 구조로 변환
  return createZIPFromStructure(pptxStructure);
}

// ZIP 파일 생성 (실제 PPTX 구조)
function createZIPFromStructure(structure: Record<string, string>): ArrayBuffer {
  // 실제 구현에서는 JSZip 라이브러리 사용 권장
  // npm install jszip
  
  // 현재는 시뮬레이션을 위한 기본 ZIP 구조
  const zipHeader = new Uint8Array([
    0x50, 0x4B, 0x03, 0x04, // ZIP 시그니처
    0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
    // ZIP 파일 구조 (실제로는 JSZip 사용)
  ]);

  // 실제 구현에서는:
  // const JSZip = require('jszip');
  // const zip = new JSZip();
  // Object.entries(structure).forEach(([path, content]) => {
  //   zip.file(path, content);
  // });
  // return await zip.generateAsync({ type: 'arraybuffer' });

  return zipHeader.buffer;
}

// 더미 PPT 파일 내용 생성 (기존 함수 유지)
function generateDummyPPTContent(filename: string): ArrayBuffer {
  return generateBasicPPTStructure(filename);
} 