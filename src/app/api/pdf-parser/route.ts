import { NextRequest, NextResponse } from 'next/server';

interface PDFObject {
  objectNumber: number;
  generationNumber: number;
  content: string;
  type: string;
  stream?: string;
}

interface PDFPage {
  pageNumber: number;
  text: string;
  images: string[];
  pageType: 'text' | 'image' | 'mixed';
  objects: PDFObject[];
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('PDF 파서 API 호출됨');
    console.log('파일명:', file.name, '크기:', file.size, 'bytes');
    
    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf');
    
    if (!isPDF) {
      return NextResponse.json({ error: 'PDF 파일만 지원됩니다.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pages: PDFPage[] = [];

    try {
      // PDF 시그니처 확인
      const pdfSignature = buffer.toString('hex', 0, 4);
      console.log('PDF 시그니처:', pdfSignature);
      
      if (pdfSignature !== '25504446') {
        return NextResponse.json({ error: '유효하지 않은 PDF 파일입니다.' }, { status: 400 });
      }

      // PDF 내부 구조 파싱
      const pdfContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1000000));
      console.log('📄 PDF 내부 구조 파싱 시작...');
      
      // 1. PDF 객체 추출
      const objects = extractPDFObjects(pdfContent);
      console.log('📊 발견된 PDF 객체 수:', objects.length);
      
      // 2. 페이지 정보 추출
      const pageObjects = extractPageObjects(objects);
      console.log('📄 발견된 페이지 수:', pageObjects.length);
      
      // 3. 각 페이지 처리
      for (let i = 0; i < pageObjects.length; i++) {
        const pageObj = pageObjects[i];
        const pageNumber = i + 1;
        
        console.log(`📄 페이지 ${pageNumber} 처리 중...`);
        
        try {
          // 페이지 텍스트 추출
          const textContent = extractTextFromPage(pageObj, objects);
          
          // 페이지 이미지 추출
          const images = extractImagesFromPage(pageObj, objects);
          
          // 페이지 타입 결정
          const pageType = determinePageType(textContent, images);
          
          pages.push({
            pageNumber,
            text: textContent,
            images,
            pageType,
            objects: [pageObj]
          });
          
          console.log(`✅ 페이지 ${pageNumber} 처리 완료:`, {
            textLength: textContent.length,
            imageCount: images.length,
            pageType
          });
          
        } catch (pageError) {
          console.error(`❌ 페이지 ${pageNumber} 처리 실패:`, pageError);
          pages.push({
            pageNumber,
            text: '페이지 처리 중 오류가 발생했습니다.',
            images: [],
            pageType: 'text',
            objects: []
          });
        }
      }
      
      console.log('📊 최종 처리 결과:', {
        총페이지: pages.length,
        성공페이지: pages.filter(p => p.text.length > 0).length,
        실패페이지: pages.filter(p => p.text.length === 0).length
      });
      
      return NextResponse.json({
        success: true,
        totalPages: pages.length,
        pages: pages,
        environment: process.env.VERCEL === '1' ? 'Vercel' : '호스트'
      });
      
    } catch (parseError) {
      console.error('❌ PDF 파싱 실패:', parseError);
      return NextResponse.json(
        { error: 'PDF 파일을 파싱할 수 없습니다.' },
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

// PDF 객체 추출
function extractPDFObjects(pdfContent: string): PDFObject[] {
  const objects: PDFObject[] = [];
  
  // PDF 객체 패턴: "숫자 숫자 obj" ~ "endobj"
  const objectPattern = /(\d+)\s+(\d+)\s+obj\s*([\s\S]*?)endobj/g;
  let match;
  
  while ((match = objectPattern.exec(pdfContent)) !== null) {
    const objectNumber = parseInt(match[1]);
    const generationNumber = parseInt(match[2]);
    const content = match[3].trim();
    
    // 객체 타입 결정
    let type = 'unknown';
    if (content.includes('/Type /Page')) type = 'page';
    else if (content.includes('/Type /Catalog')) type = 'catalog';
    else if (content.includes('/Type /Pages')) type = 'pages';
    else if (content.includes('/Type /Font')) type = 'font';
    else if (content.includes('/Type /XObject')) type = 'xobject';
    else if (content.includes('/Type /Stream')) type = 'stream';
    
    // 스트림 데이터 추출
    let stream = '';
    if (content.includes('stream')) {
      const streamMatch = content.match(/stream\s*([\s\S]*?)endstream/);
      if (streamMatch) {
        stream = streamMatch[1];
      }
    }
    
    objects.push({
      objectNumber,
      generationNumber,
      content,
      type,
      stream
    });
  }
  
  return objects;
}

// 페이지 객체 추출
function extractPageObjects(objects: PDFObject[]): PDFObject[] {
  return objects.filter(obj => obj.type === 'page');
}

// 페이지에서 텍스트 추출
function extractTextFromPage(pageObj: PDFObject, allObjects: PDFObject[]): string {
  try {
    let text = '';
    
    // 1. 페이지 객체에서 직접 텍스트 추출
    const pageText = extractTextFromObject(pageObj);
    if (pageText) text += pageText + ' ';
    
    // 2. 페이지가 참조하는 다른 객체들에서 텍스트 추출
    const referencedObjects = findReferencedObjects(pageObj, allObjects);
    
    for (const refObj of referencedObjects) {
      const refText = extractTextFromObject(refObj);
      if (refText) text += refText + ' ';
    }
    
    // 3. 텍스트 정제
    text = cleanExtractedText(text);
    
    return text.trim();
    
  } catch (error) {
    console.error('페이지 텍스트 추출 오류:', error);
    return '';
  }
}

// 객체에서 텍스트 추출
function extractTextFromObject(obj: PDFObject): string {
  try {
    let text = '';
    
    // BT/ET 블록에서 텍스트 추출
    const btPattern = /BT\s*([\s\S]*?)ET/g;
    let btMatch;
    
    while ((btMatch = btPattern.exec(obj.content)) !== null) {
      const btContent = btMatch[1];
      
      // Tj 명령에서 텍스트 추출
      const tjPattern = /Tj\s*\(([^)]+)\)/g;
      let tjMatch;
      
      while ((tjMatch = tjPattern.exec(btContent)) !== null) {
        text += tjMatch[1] + ' ';
      }
      
      // TJ 명령에서 텍스트 추출
      const tjArrayPattern = /TJ\s*\[([^\]]+)\]/g;
      let tjArrayMatch;
      
      while ((tjArrayMatch = tjArrayPattern.exec(btContent)) !== null) {
        const arrayContent = tjArrayMatch[1];
        const textMatches = arrayContent.match(/\(([^)]+)\)/g);
        if (textMatches) {
          textMatches.forEach(match => {
            const textMatch = match.match(/\(([^)]+)\)/);
            if (textMatch) {
              text += textMatch[1] + ' ';
            }
          });
        }
      }
    }
    
    return text;
    
  } catch (error) {
    console.error('객체 텍스트 추출 오류:', error);
    return '';
  }
}

// 참조된 객체 찾기
function findReferencedObjects(pageObj: PDFObject, allObjects: PDFObject[]): PDFObject[] {
  const referencedObjects: PDFObject[] = [];
  
  // 페이지 객체에서 참조 패턴 찾기
  const refPattern = /(\d+)\s+(\d+)\s+R/g;
  let refMatch;
  
  while ((refMatch = refPattern.exec(pageObj.content)) !== null) {
    const objectNumber = parseInt(refMatch[1]);
    const generationNumber = parseInt(refMatch[2]);
    
    // 해당 객체 찾기
    const referencedObj = allObjects.find(obj => 
      obj.objectNumber === objectNumber && obj.generationNumber === generationNumber
    );
    
    if (referencedObj) {
      referencedObjects.push(referencedObj);
    }
  }
  
  return referencedObjects;
}

// 페이지에서 이미지 추출
function extractImagesFromPage(pageObj: PDFObject, allObjects: PDFObject[]): string[] {
  try {
    const images: string[] = [];
    
    // XObject 이미지 찾기
    const xObjectPattern = /\/XObject\s*<<\s*([^>]+)>>/g;
    let xObjectMatch;
    
    while ((xObjectMatch = xObjectPattern.exec(pageObj.content)) !== null) {
      const xObjectContent = xObjectMatch[1];
      
      // 이미지 객체 참조 찾기
      const imageRefPattern = /\/Im(\d+)\s+(\d+)\s+(\d+)\s+R/g;
      let imageRefMatch;
      
      while ((imageRefMatch = imageRefPattern.exec(xObjectContent)) !== null) {
        const objectNumber = parseInt(imageRefMatch[2]);
        const generationNumber = parseInt(imageRefMatch[3]);
        
        // 이미지 객체 찾기
        const imageObj = allObjects.find(obj => 
          obj.objectNumber === objectNumber && obj.generationNumber === generationNumber
        );
        
        if (imageObj && imageObj.stream) {
          // Base64로 인코딩 (실제로는 더 복잡한 처리 필요)
          const base64Image = Buffer.from(imageObj.stream, 'binary').toString('base64');
          images.push(`data:image/png;base64,${base64Image}`);
        }
      }
    }
    
    return images;
    
  } catch (error) {
    console.error('이미지 추출 오류:', error);
    return [];
  }
}

// 추출된 텍스트 정제
function cleanExtractedText(text: string): string {
  try {
    // 1. 제어 문자 제거
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // 2. 특수 문자 정리
    text = text.replace(/[^\w\s가-힣\.\,\!\?\-\(\)]/g, ' ');
    
    // 3. 연속된 공백 정리
    text = text.replace(/\s+/g, ' ');
    
    // 4. 의미 없는 텍스트 필터링
    text = text.replace(/\b(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate)\b/g, '');
    
    // 5. 너무 짧은 단어 제거
    text = text.split(' ').filter(word => word.length > 2).join(' ');
    
    return text.trim();
    
  } catch (error) {
    console.error('텍스트 정제 오류:', error);
    return text;
  }
}

// 페이지 타입 결정
function determinePageType(text: string, images: string[]): 'text' | 'image' | 'mixed' {
  if (text.length > 50 && images.length === 0) {
    return 'text';
  } else if (text.length === 0 && images.length > 0) {
    return 'image';
  } else {
    return 'mixed';
  }
} 