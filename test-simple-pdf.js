const fs = require('fs');
const path = require('path');

// 간단한 PDF 테스트
async function testSimplePDF() {
  try {
    console.log('=== 간단한 PDF 테스트 시작 ===');
    
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
    
    // Base64 인코딩 테스트
    const base64Data = buffer.toString('base64');
    console.log('Base64 길이:', base64Data.length);
    console.log('Base64 미리보기:', base64Data.substring(0, 100) + '...');
    
    // OpenAI API 키 확인
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log('❌ OpenAI API 키가 설정되지 않았습니다.');
      return;
    }
    
    console.log('✅ OpenAI API 키가 설정되어 있습니다.');
    
    // 간단한 텍스트 추출 테스트
    const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    const textPattern = /[가-힣a-zA-Z0-9\s]{10,}/g;
    const matches = bufferString.match(textPattern);
    
    if (matches && matches.length > 0) {
      const extractedText = matches.join(' ').substring(0, 500);
      console.log('✅ 기본 텍스트 추출 성공');
      console.log('추출된 텍스트:', extractedText);
    } else {
      console.log('❌ 기본 텍스트 추출 실패');
    }
    
  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
}

testSimplePDF(); 