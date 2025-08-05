const fs = require('fs');
const path = require('path');

// PDF 파일 테스트 함수
async function testPDFProcessing() {
  try {
    console.log('=== PDF 처리 테스트 시작 ===');
    
    // pdf-parse 라이브러리 로드
    const pdfParse = require('pdf-parse');
    
    // 테스트용 PDF 파일 경로 (public/uploads/presentation-script/ 폴더에서 찾기)
    const uploadDir = path.join(__dirname, 'public', 'uploads', 'presentation-script');
    
    console.log('업로드 디렉토리 확인:', uploadDir);
    
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      console.log('업로드된 파일들:', files);
      
      // PDF 파일 찾기
      const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
      console.log('PDF 파일들:', pdfFiles);
      
      if (pdfFiles.length > 0) {
        const testFile = path.join(uploadDir, pdfFiles[0]);
        console.log('테스트할 PDF 파일:', testFile);
        
        // PDF 파일 읽기
        const dataBuffer = fs.readFileSync(testFile);
        console.log('PDF 파일 크기:', dataBuffer.length, 'bytes');
        
        // PDF 시그니처 확인
        const pdfSignature = dataBuffer.toString('hex', 0, 4);
        console.log('PDF 시그니처:', pdfSignature);
        
        if (pdfSignature !== '25504446') {
          console.error('❌ 유효하지 않은 PDF 파일입니다.');
          return;
        }
        
        console.log('✅ 유효한 PDF 파일입니다.');
        
        // pdf-parse로 텍스트 추출 시도
        try {
          console.log('📄 pdf-parse로 텍스트 추출 시도 중...');
          const data = await pdfParse(dataBuffer);
          
          console.log('📊 PDF 정보:', {
            페이지수: data.numpages,
            텍스트길이: data.text?.length || 0,
            메타데이터: data.info
          });
          
          if (data.text && data.text.trim().length > 0) {
            console.log('✅ 텍스트 추출 성공!');
            console.log('📝 텍스트 미리보기:', data.text.substring(0, 500) + '...');
          } else {
            console.log('❌ 텍스트가 추출되지 않았습니다.');
          }
          
        } catch (parseError) {
          console.error('❌ pdf-parse 실패:', parseError.message);
        }
        
      } else {
        console.log('❌ 테스트할 PDF 파일이 없습니다.');
      }
    } else {
      console.log('❌ 업로드 디렉토리가 존재하지 않습니다.');
    }
    
  } catch (error) {
    console.error('💥 테스트 중 오류 발생:', error);
  }
}

// 테스트 실행
testPDFProcessing(); 