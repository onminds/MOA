const fs = require('fs');
const path = require('path');

// pdf-parse 테스트
async function testPdfParse() {
  try {
    console.log('=== pdf-parse 테스트 시작 ===');
    
    // pdf-parse 로드 테스트
    console.log('pdf-parse 로드 시도...');
    const pdfParse = require('pdf-parse');
    console.log('✅ pdf-parse 로드 성공');
    
    // 업로드된 PDF 파일 찾기
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'presentation-script');
    
    if (!fs.existsSync(uploadDir)) {
      console.log('❌ 업로드 디렉토리가 없습니다.');
      return;
    }
    
    const files = fs.readdirSync(uploadDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      console.log('❌ PDF 파일이 없습니다.');
      return;
    }
    
    const testFile = path.join(uploadDir, pdfFiles[0]);
    console.log('테스트 파일:', testFile);
    
    // 파일 읽기
    const buffer = fs.readFileSync(testFile);
    console.log('파일 크기:', buffer.length, 'bytes');
    
    // PDF 시그니처 확인
    const signature = buffer.toString('hex', 0, 4);
    console.log('PDF 시그니처:', signature);
    
    if (signature !== '25504446') {
      console.log('❌ 유효하지 않은 PDF 파일입니다.');
      return;
    }
    
    console.log('✅ 유효한 PDF 파일입니다.');
    
    // pdf-parse로 텍스트 추출
    console.log('pdf-parse로 텍스트 추출 시도...');
    const data = await pdfParse(buffer);
    
    console.log('📊 PDF 정보:', {
      페이지수: data.numpages,
      텍스트길이: data.text?.length || 0,
      메타데이터: data.info
    });
    
    if (data.text && data.text.trim().length > 0) {
      console.log('✅ 텍스트 추출 성공!');
      console.log('📝 텍스트 미리보기:', data.text.substring(0, 500) + '...');
      
      // 텍스트 품질 검사
      const hasKoreanText = /[가-힣]/.test(data.text);
      const hasEnglishText = /[a-zA-Z]/.test(data.text);
      const hasMeaningfulContent = data.text.length > 100 && (hasKoreanText || hasEnglishText);
      
      console.log('📊 텍스트 품질 검사:', {
        length: data.text.length,
        hasKorean: hasKoreanText,
        hasEnglish: hasEnglishText,
        hasMeaningfulContent: hasMeaningfulContent
      });
      
    } else {
      console.log('❌ 텍스트가 추출되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
}

testPdfParse(); 