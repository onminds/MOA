// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import mammoth from 'mammoth';

// 문서 내용 추출
export async function extractDocumentContent(file: File): Promise<string> {
  try {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    console.log(`문서 처리 시작: ${fileName} (${fileExtension})`);
    
    // HWP 파일은 지원하지 않음
    if (fileExtension === 'hwp') {
      throw new Error('한글 문서(.hwp)는 현재 지원되지 않습니다. Microsoft Word(.docx), 구형 Word(.doc), 또는 텍스트 파일(.txt)로 변환 후 업로드해주세요.');
    }
    
    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();
    
    let textContent = '';
    
    // 파일 형식에 따른 처리
    switch (fileExtension) {
      case 'docx':
        // Word 문서 (.docx) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docxError) {
          console.log('Word 문서 파싱 실패:', docxError);
          throw new Error('Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'doc':
        // 구형 Word 문서 (.doc) 처리
        try {
          // ArrayBuffer를 Buffer로 변환
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          textContent = result.value;
          console.log('구형 Word 문서 파싱 성공:', textContent.length, '문자');
        } catch (docError) {
          console.log('구형 Word 문서 파싱 실패:', docError);
          throw new Error('구형 Word 문서를 읽을 수 없습니다.');
        }
        break;
        
      case 'txt':
        // 텍스트 파일 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('텍스트 파일 파싱 성공:', textContent.length, '문자');
        } catch (txtError) {
          console.log('텍스트 파일 파싱 실패:', txtError);
          throw new Error('텍스트 파일을 읽을 수 없습니다.');
        }
        break;
        
      case 'pdf':
        // PDF 파일 처리 (간단한 텍스트 추출)
        try {
          // PDF 처리는 별도 라이브러리가 필요하므로 일단 텍스트로 시도
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('PDF 파일 파싱 시도:', textContent.length, '문자');
        } catch (pdfError) {
          console.log('PDF 파일 파싱 실패:', pdfError);
          throw new Error('PDF 파일을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
        }
        break;
        
      default:
        // 기본 텍스트 처리
        try {
          const decoder = new TextDecoder('utf-8');
          textContent = decoder.decode(arrayBuffer);
          console.log('기본 텍스트 파싱 성공:', textContent.length, '문자');
        } catch (defaultError) {
          console.log('기본 텍스트 파싱 실패:', defaultError);
          throw new Error(`지원하지 않는 파일 형식입니다: ${fileExtension}. 지원되는 형식: .docx, .doc, .txt`);
        }
    }
    
    // 내용이 너무 짧거나 바이너리인지 확인
    if (textContent.length < 10) {
      throw new Error('문서에서 텍스트를 추출할 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
    }
    
    // 바이너리 데이터인지 확인 (일반적으로 읽을 수 없는 문자들이 많으면 바이너리)
    const readableChars = textContent.replace(/[^\w\s가-힣]/g, '').length;
    const totalChars = textContent.length;
    const readabilityRatio = readableChars / totalChars;
    
    if (readabilityRatio < 0.3) {
      throw new Error('바이너리 파일입니다. 텍스트 문서를 업로드해주세요. 지원되는 형식: .docx, .doc, .txt');
    }
    
    console.log(`문서 처리 완료: ${textContent.length} 문자, 가독성 비율: ${(readabilityRatio * 100).toFixed(1)}%`);
    return textContent;
    
  } catch (error) {
    console.error('문서 내용 추출 오류:', error);
    throw new Error('문서 내용을 읽을 수 없습니다. 지원되는 형식: .docx, .doc, .txt');
  }
}

// 웹사이트 내용 추출
export async function extractWebsiteContent(url: string): Promise<string> {
  try {
    console.log('웹사이트 스크래핑 시작:', url);
    
    // URL 유효성 검사
    let targetUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      targetUrl = 'https://' + url;
    }
    
    // AbortController를 사용한 타임아웃 설정
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃
    
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log('HTML 길이:', html.length);
    
    // HTML에서 메타데이터 추출
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    
    const keywordsMatch = html.match(/<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i);
    const keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
    
    // HTML 태그 제거 및 텍스트 정리
    let text = html
      // 스크립트와 스타일 태그 제거
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      // HTML 태그 제거
      .replace(/<[^>]*>/g, ' ')
      // HTML 엔티티 디코딩
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // 연속된 공백 정리
      .replace(/\s+/g, ' ')
      .trim();
    
    // 텍스트가 너무 짧으면 기본적인 텍스트 추출 시도
    if (text.length < 100) {
      console.log('기본 텍스트 추출이 너무 짧음, 대안 방법 시도');
      
      // 더 간단한 텍스트 추출
      text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // 메타데이터와 본문을 결합
    let fullContent = '';
    
    if (title) {
      fullContent += `제목: ${title}\n\n`;
    }
    
    if (description) {
      fullContent += `설명: ${description}\n\n`;
    }
    
    if (keywords) {
      fullContent += `키워드: ${keywords}\n\n`;
    }
    
    fullContent += `웹사이트 내용:\n${text}`;
    
    // 내용이 너무 짧은지 확인
    if (fullContent.length < 50) {
      throw new Error('웹사이트에서 충분한 텍스트를 추출할 수 없습니다.');
    }
    
    console.log('웹사이트 스크래핑 완료:', fullContent.length, '문자');
    console.log('추출된 제목:', title);
    console.log('추출된 설명:', description);
    
    return fullContent;
    
  } catch (error) {
    console.error('웹사이트 내용 추출 오류:', error);
    
    // 구체적인 오류 메시지 제공
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('웹사이트 로딩 시간이 초과되었습니다.');
      } else if (error.message.includes('fetch')) {
        throw new Error('웹사이트에 접근할 수 없습니다. URL을 확인해주세요.');
      } else if (error.message.includes('HTTP')) {
        throw new Error('웹사이트에서 오류가 발생했습니다. URL을 확인해주세요.');
      }
    }
    
    throw new Error('웹사이트 내용을 가져올 수 없습니다. URL을 확인해주세요.');
  }
} 