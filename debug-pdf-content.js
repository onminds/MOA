const fs = require('fs');
const path = require('path');

// PDF 내용 디버깅 스크립트
async function debugPDFContent() {
  try {
    console.log('=== PDF 내용 디버깅 시작 ===');
    
    // pdf-parse 로드
    const pdfParse = require('pdf-parse');
    
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
    
    // 가장 최근 파일 선택
    const testFile = path.join(uploadDir, pdfFiles[pdfFiles.length - 1]);
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
    console.log('📄 pdf-parse로 텍스트 추출 중...');
    const data = await pdfParse(buffer);
    
    console.log('📊 PDF 정보:', {
      페이지수: data.numpages,
      텍스트길이: data.text?.length || 0,
      메타데이터: data.info
    });
    
    if (data.text && data.text.trim().length > 0) {
      console.log('✅ 텍스트 추출 성공!');
      console.log('📝 전체 텍스트 내용:');
      console.log('='.repeat(80));
      console.log(data.text);
      console.log('='.repeat(80));
      
      // 텍스트 품질 분석
      const text = data.text;
      const hasKoreanText = /[가-힣]/.test(text);
      const hasEnglishText = /[a-zA-Z]/.test(text);
      const hasNumbers = /[0-9]/.test(text);
      const hasPunctuation = /[.!?]/.test(text);
      
      console.log('📊 텍스트 품질 분석:', {
        전체길이: text.length,
        한글포함: hasKoreanText,
        영어포함: hasEnglishText,
        숫자포함: hasNumbers,
        문장부호포함: hasPunctuation,
        의미있는내용: text.length >= 20 && (hasKoreanText || hasEnglishText || hasNumbers)
      });
      
      // 발표 대본 생성 시뮬레이션
      console.log('\n🎭 발표 대본 생성 시뮬레이션:');
      console.log('='.repeat(80));
      
      const mockTopic = '치즈 제조 과정';
      const mockDuration = '10';
      const mockAudience = 'students';
      const mockPurpose = 'educate';
      
      console.log('📋 입력 정보:');
      console.log('- 주제:', mockTopic);
      console.log('- 발표 시간:', mockDuration + '분');
      console.log('- 대상 청중: 학생/수강생');
      console.log('- 발표 목적: 교육/지식 공유');
      console.log('- 참고 자료 길이:', text.length);
      
      // 참고 자료 품질 검사 (실제 코드와 동일)
      const hasMeaningfulContent = text.length >= 20 && (hasKoreanText || hasEnglishText || hasNumbers);
      
      if (hasMeaningfulContent) {
        console.log('✅ 참고 자료가 유효합니다 - 대본 생성에 사용됨');
        
        // 실제로 사용될 참고 자료 (길이 제한 적용)
        let referenceContent = text;
        if (text.length > 3000) {
          console.log('📝 참고 자료가 너무 길어 요약이 필요합니다 (3000자 초과)');
          referenceContent = text.substring(0, 3000) + '\n\n[내용이 너무 길어 일부만 표시됩니다.]';
        }
        
        console.log('📄 실제 사용될 참고 자료 길이:', referenceContent.length);
        console.log('📄 참고 자료 미리보기:');
        console.log('-'.repeat(40));
        console.log(referenceContent.substring(0, 500) + '...');
        console.log('-'.repeat(40));
        
        console.log('✅ 이 참고 자료가 발표 대본 생성에 사용됩니다!');
      } else {
        console.log('❌ 참고 자료가 유효하지 않습니다 - 기본 정보만으로 대본 생성');
      }
      
    } else {
      console.log('❌ 텍스트가 추출되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('💥 디버깅 중 오류 발생:', error);
  }
}

debugPDFContent(); 