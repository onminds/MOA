const fs = require('fs');

// 간단한 PDF 파일 생성 (실제 텍스트 포함)
function createTestPDF() {
  try {
    console.log('=== 테스트 PDF 파일 생성 시작 ===');
    
    // PDF 헤더
    const pdfContent = `%PDF-1.7
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 200
>>
stream
BT
/F1 12 Tf
72 720 Td
(치즈에 대한 발표 자료) Tj
0 -20 Td
(치즈는 우유를 응고시켜 만든 유제품입니다.) Tj
0 -20 Td
(치즈의 종류는 매우 다양하며, 각각 고유한 맛과 향을 가지고 있습니다.) Tj
0 -20 Td
(치즈는 단백질과 칼슘이 풍부한 영양가 높은 식품입니다.) Tj
0 -20 Td
(치즈는 요리에서 중요한 재료로 사용되며, 다양한 요리에 활용됩니다.) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000200 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`;

    const outputPath = 'test-pdf-with-text.pdf';
    fs.writeFileSync(outputPath, pdfContent);
    
    console.log('✅ 테스트 PDF 파일 생성 완료:', outputPath);
    console.log('파일 크기:', fs.statSync(outputPath).size, 'bytes');
    
    // 생성된 파일 분석
    const buffer = fs.readFileSync(outputPath);
    const bufferString = buffer.toString('utf8');
    
    console.log('=== 생성된 PDF 분석 ===');
    console.log('총 길이:', bufferString.length);
    console.log('실제 텍스트 있음:', /[A-Za-z가-힣]{20,}/.test(bufferString));
    console.log('한국어 텍스트:', /[가-힣]/.test(bufferString));
    console.log('영어 텍스트:', /[a-zA-Z]/.test(bufferString));
    console.log('내용 미리보기:', bufferString.substring(0, 500));
    
  } catch (error) {
    console.error('PDF 생성 중 오류:', error);
  }
}

createTestPDF(); 