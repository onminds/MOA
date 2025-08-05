const fs = require('fs');
const path = require('path');

// PDF 파일 분석 함수
function analyzePDFContent(filePath) {
  try {
    console.log('=== PDF 파일 분석 시작 ===');
    console.log('파일 경로:', filePath);
    
    if (!fs.existsSync(filePath)) {
      console.error('파일이 존재하지 않습니다:', filePath);
      return;
    }
    
    const buffer = fs.readFileSync(filePath);
    console.log('파일 크기:', buffer.length, 'bytes');
    
    // PDF 시그니처 확인
    const signature = buffer.toString('hex', 0, 4);
    console.log('PDF 시그니처:', signature);
    
    if (signature !== '25504446') {
      console.error('유효하지 않은 PDF 파일입니다.');
      return;
    }
    
    // 텍스트 추출 시도
    const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 100000));
    console.log('텍스트 길이:', bufferString.length);
    console.log('텍스트 미리보기:', bufferString.substring(0, 500));
    
    // 메타데이터 패턴 분석
    const metadataPatterns = [
      'StructTreeRoot',
      'obj',
      'endobj',
      'R',
      'PDF',
      'Creator',
      'Producer',
      'CreationDate',
      'ModDate'
    ];
    
    const analysis = {
      totalLength: bufferString.length,
      hasMetadata: false,
      metadataCount: 0,
      hasRealText: false,
      hasSentences: false,
      hasKoreanText: false,
      hasEnglishText: false,
      metadataRatio: 0,
      contentPreview: bufferString.substring(0, 200)
    };
    
    // 메타데이터 검사
    for (const pattern of metadataPatterns) {
      const matches = bufferString.match(new RegExp(pattern, 'g'));
      if (matches) {
        analysis.metadataCount += matches.length;
        analysis.hasMetadata = true;
      }
    }
    
    // 실제 텍스트 검사
    analysis.hasRealText = /[A-Za-z가-힣]{20,}/.test(bufferString);
    analysis.hasSentences = /[A-Za-z가-힣][^.!?]*[.!?]/.test(bufferString);
    analysis.hasKoreanText = /[가-힣]/.test(bufferString);
    analysis.hasEnglishText = /[a-zA-Z]/.test(bufferString);
    analysis.metadataRatio = analysis.metadataCount / Math.max(bufferString.length / 100, 1);
    
    console.log('=== 분석 결과 ===');
    console.log('총 길이:', analysis.totalLength);
    console.log('메타데이터 패턴 수:', analysis.metadataCount);
    console.log('메타데이터 비율:', analysis.metadataRatio.toFixed(2));
    console.log('실제 텍스트 있음:', analysis.hasRealText);
    console.log('문장 구조 있음:', analysis.hasSentences);
    console.log('한국어 텍스트:', analysis.hasKoreanText);
    console.log('영어 텍스트:', analysis.hasEnglishText);
    console.log('내용 미리보기:', analysis.contentPreview);
    
    // 실제 텍스트 추출 시도
    const realTextPatterns = [
      /[A-Z][a-z\s]{30,}[.!?]/g,
      /[가-힣][가-힣\s]{20,}[.!?]/g,
      /\(([A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{30,})\)/g,
      /"([A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{30,})"/g
    ];
    
    let extractedText = '';
    for (let i = 0; i < realTextPatterns.length; i++) {
      const pattern = realTextPatterns[i];
      const matches = bufferString.match(pattern);
      
      if (matches && matches.length > 0) {
        console.log(`패턴 ${i + 1}에서 ${matches.length}개 매치 발견`);
        
        const filteredMatches = matches
          .map(match => {
            if (pattern.source.includes('\\(')) {
              return match.replace(/\(([^)]+)\)/, '$1');
            } else if (pattern.source.includes('"')) {
              return match.replace(/"([^"]+)"/, '$1');
            }
            return match;
          })
          .filter(text => {
            const hasRealWords = /[A-Za-z가-힣]{8,}/.test(text);
            const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot)/);
            const hasMeaningfulLength = text.trim().length > 20;
            const hasPunctuation = /[.!?,]/.test(text);
            
            return hasRealWords && notMetadata && hasMeaningfulLength && hasPunctuation;
          });
        
        if (filteredMatches.length > 0) {
          const potentialText = filteredMatches.join(' ');
          if (potentialText.length > extractedText.length) {
            extractedText = potentialText;
            console.log(`패턴 ${i + 1}에서 텍스트 추출 성공:`, potentialText.length, '자');
            console.log('추출된 텍스트 미리보기:', potentialText.substring(0, 200));
          }
        }
      }
    }
    
    if (extractedText.length > 0) {
      console.log('✅ 텍스트 추출 성공!');
      console.log('최종 추출 텍스트 길이:', extractedText.length);
      console.log('최종 추출 텍스트:', extractedText.substring(0, 500));
    } else {
      console.log('❌ 텍스트 추출 실패');
    }
    
  } catch (error) {
    console.error('PDF 분석 중 오류:', error);
  }
}

// 테스트 실행
const testFile = path.join(__dirname, 'test-pdf-with-text.pdf');
analyzePDFContent(testFile); 