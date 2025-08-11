import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

interface Slide {
  slideNumber: number;
  text: string;
  images: string[];
  slideType: 'text' | 'image' | 'mixed';
  layout: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('PPTX 파서 API 호출됨');
    console.log('파일명:', file.name, '크기:', file.size, 'bytes');
    
    const fileName = file.name.toLowerCase();
    const isPPTX = fileName.endsWith('.pptx');
    
    if (!isPPTX) {
      return NextResponse.json({ error: 'PPTX 파일만 지원됩니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const slides: Slide[] = [];

    try {
      // JSZip으로 PPTX 파일 압축 해제
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(buffer);
      
      console.log('📦 PPTX 파일 압축 해제 완료');
      
      // 슬라이드 목록 가져오기
      const slideFiles = Object.keys(zipContent.files).filter(key => 
        key.startsWith('ppt/slides/slide') && key.endsWith('.xml')
      );
      
      console.log('📊 발견된 슬라이드 수:', slideFiles.length);
      
      // 각 슬라이드 처리
      for (let i = 0; i < slideFiles.length; i++) {
        const slideFile = slideFiles[i];
        const slideNumber = i + 1;
        
        console.log(`📄 슬라이드 ${slideNumber} 처리 중...`);
        
        try {
          // 슬라이드 XML 읽기
          const slideXml = await zipContent.files[slideFile].async('string');
          
          // 텍스트 추출
          const textContent = extractTextFromSlideXml(slideXml);
          
          // 이미지 추출
          const images = await extractImagesFromSlide(zipContent, slideNumber);
          
          // 레이아웃 정보 추출
          const layout = extractLayoutFromSlideXml(slideXml);
          
          // 슬라이드 타입 결정
          const slideType = determineSlideType(textContent, images);
          
          slides.push({
            slideNumber,
            text: textContent,
            images,
            slideType,
            layout
          });
          
          console.log(`✅ 슬라이드 ${slideNumber} 처리 완료:`, {
            textLength: textContent.length,
            imageCount: images.length,
            slideType,
            layout
          });
          
        } catch (slideError) {
          console.error(`❌ 슬라이드 ${slideNumber} 처리 실패:`, slideError);
          slides.push({
            slideNumber,
            text: '슬라이드 처리 중 오류가 발생했습니다.',
            images: [],
            slideType: 'text',
            layout: 'unknown'
          });
        }
      }
      
      console.log('📊 최종 처리 결과:', {
        총슬라이드: slides.length,
        성공슬라이드: slides.filter(s => s.text.length > 0).length,
        실패슬라이드: slides.filter(s => s.text.length === 0).length
      });
      
      return NextResponse.json({
        success: true,
        totalSlides: slides.length,
        slides: slides,
        environment: process.env.VERCEL === '1' ? 'Vercel' : '호스트'
      });
      
    } catch (parseError) {
      console.error('❌ PPTX 파싱 실패:', parseError);
      return NextResponse.json(
        { error: 'PPTX 파일을 파싱할 수 없습니다.' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('API 처리 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 슬라이드 XML에서 텍스트 추출
function extractTextFromSlideXml(xml: string): string {
  try {
    // XML 파싱 (간단한 정규식 사용)
    const textMatches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
    if (!textMatches) return '';
    
    const texts = textMatches.map(match => {
      const textMatch = match.match(/<a:t[^>]*>([^<]+)<\/a:t>/);
      return textMatch ? textMatch[1] : '';
    });
    
    return texts.join(' ').trim();
  } catch (error) {
    console.error('텍스트 추출 오류:', error);
    return '';
  }
}

// 슬라이드에서 이미지 추출
async function extractImagesFromSlide(zipContent: JSZip, slideNumber: number): Promise<string[]> {
  try {
    const images: string[] = [];
    
    // 슬라이드의 관계 파일 찾기
    const relsFile = `ppt/slides/_rels/slide${slideNumber}.xml.rels`;
    if (zipContent.files[relsFile]) {
      const relsXml = await zipContent.files[relsFile].async('string');
      
      // 이미지 관계 추출
      const imageMatches = relsXml.match(/Target="[^"]*\.(png|jpg|jpeg|gif)"/g);
      if (imageMatches) {
        for (const match of imageMatches) {
          const targetMatch = match.match(/Target="([^"]+)"/);
          if (targetMatch) {
            const imagePath = targetMatch[1].replace('../', 'ppt/');
            if (zipContent.files[imagePath]) {
              const imageBuffer = await zipContent.files[imagePath].async('uint8array');
              const base64Image = Buffer.from(imageBuffer).toString('base64');
              images.push(`data:image/png;base64,${base64Image}`);
            }
          }
        }
      }
    }
    
    return images;
  } catch (error) {
    console.error('이미지 추출 오류:', error);
    return [];
  }
}

// 슬라이드 레이아웃 추출
function extractLayoutFromSlideXml(xml: string): string {
  try {
    const layoutMatch = xml.match(/type="([^"]+)"/);
    return layoutMatch ? layoutMatch[1] : 'unknown';
  } catch (error) {
    console.error('레이아웃 추출 오류:', error);
    return 'unknown';
  }
}

// 슬라이드 타입 결정
function determineSlideType(text: string, images: string[]): 'text' | 'image' | 'mixed' {
  if (text.length > 50 && images.length === 0) {
    return 'text';
  } else if (text.length === 0 && images.length > 0) {
    return 'image';
  } else {
    return 'mixed';
  }
} 