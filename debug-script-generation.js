const fs = require('fs');
const path = require('path');

// 발표 대본 생성 과정 디버깅 스크립트
async function debugScriptGeneration() {
  try {
    console.log('=== 발표 대본 생성 과정 디버깅 ===');
    
    // 1. PDF 파일 확인
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
    console.log('📄 테스트 파일:', testFile);
    
    // 2. PDF 내용 추출
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(testFile);
    const data = await pdfParse(buffer);
    
    console.log('📊 PDF 정보:', {
      파일명: path.basename(testFile),
      페이지수: data.numpages,
      텍스트길이: data.text?.length || 0,
      메타데이터: data.info
    });
    
    if (!data.text || data.text.trim().length === 0) {
      console.log('❌ PDF에서 텍스트를 추출할 수 없습니다.');
      console.log('💡 이 파일은 이미지 기반 PDF이거나 텍스트 추출이 불가능한 형식입니다.');
      return;
    }
    
    console.log('✅ PDF 텍스트 추출 성공');
    console.log('📝 추출된 텍스트 길이:', data.text.length);
    console.log('📝 텍스트 미리보기:');
    console.log('-'.repeat(50));
    console.log(data.text.substring(0, 500) + '...');
    console.log('-'.repeat(50));
    
    // 3. 발표 대본 생성 시뮬레이션
    console.log('\n🎭 발표 대본 생성 시뮬레이션:');
    console.log('='.repeat(80));
    
    const mockFormData = {
      topic: '치즈 제조 과정',
      duration: '10',
      audience: 'students',
      purpose: 'educate',
      tone: 'professional',
      keyPoints: ['치즈의 역사', '제조 과정', '분류 체계'],
      additionalInfo: '학생들을 위한 교육용 발표'
    };
    
    console.log('📋 입력 정보:');
    console.log('- 주제:', mockFormData.topic);
    console.log('- 발표 시간:', mockFormData.duration + '분');
    console.log('- 대상 청중: 학생/수강생');
    console.log('- 발표 목적: 교육/지식 공유');
    console.log('- 참고 자료 길이:', data.text.length);
    
    // 4. 참고 자료 품질 검사 (실제 코드와 동일)
    const text = data.text;
    const hasKoreanText = /[가-힣]/.test(text);
    const hasEnglishText = /[a-zA-Z]/.test(text);
    const hasNumbers = /[0-9]/.test(text);
    
    const hasMeaningfulContent = text.length >= 20 && (hasKoreanText || hasEnglishText || hasNumbers);
    
    console.log('📊 참고 자료 품질 검사:', {
      전체길이: text.length,
      한글포함: hasKoreanText,
      영어포함: hasEnglishText,
      숫자포함: hasNumbers,
      의미있는내용: hasMeaningfulContent
    });
    
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
      
      // 5. 프롬프트 생성 시뮬레이션
      console.log('\n📝 프롬프트 생성 시뮬레이션:');
      console.log('='.repeat(80));
      
      const audienceMap = {
        'students': '학생/수강생',
        'colleagues': '동료/팀원',
        'executives': '경영진/상급자',
        'clients': '고객/클라이언트',
        'general': '일반 대중',
        'professionals': '전문가/업계 관계자',
        'investors': '투자자/파트너'
      };
      
      const purposeMap = {
        'educate': '교육/지식 공유',
        'inform': '정보 전달',
        'persuade': '설득/제안',
        'sell': '판매/마케팅',
        'report': '보고/업데이트',
        'inspire': '동기 부여/영감',
        'entertain': '오락/흥미'
      };
      
      let prompt = `다음 조건에 맞는 발표 대본을 작성해주세요:

**발표 정보:**
- 주제: ${mockFormData.topic}
- 발표 시간: ${mockFormData.duration}분
- 대상 청중: ${audienceMap[mockFormData.audience]}
- 발표 목적: ${purposeMap[mockFormData.purpose]}`;

      // 참고 자료 추가
      prompt += `

**참고 자료:**
${referenceContent}

위의 참고 자료를 바탕으로 발표 대본을 작성해주세요. 참고 자료의 핵심 내용을 발표에 포함하고, 자료의 구조와 정보를 활용하여 체계적인 발표 대본을 작성해주세요.`;

      if (mockFormData.keyPoints && mockFormData.keyPoints.length > 0) {
        prompt += `\n- 주요 포인트: ${mockFormData.keyPoints.map((point, index) => `${index + 1}. ${point}`).join('\n  ')}`;
      }

      if (mockFormData.additionalInfo) {
        prompt += `\n- 추가 정보: ${mockFormData.additionalInfo}`;
      }

      prompt += `

**대본 작성 요구사항:**
1. ${mockFormData.duration}분 발표에 적합한 분량으로 작성
2. 명확한 구조 (도입-본론-결론)
3. 시간별 섹션 구분 표시
4. 청중과의 상호작용 포인트 포함
5. 발표자가 실제로 말할 수 있는 자연스러운 문체
6. 적절한 강조점과 전환 구문 포함
7. 마지막에 발표 팁 제공`;

      console.log('📝 생성된 프롬프트 길이:', prompt.length);
      console.log('📝 프롬프트 미리보기:');
      console.log('-'.repeat(40));
      console.log(prompt.substring(0, 1000) + '...');
      console.log('-'.repeat(40));
      
      console.log('✅ 이 프롬프트가 OpenAI API에 전송되어 발표 대본이 생성됩니다!');
      
    } else {
      console.log('❌ 참고 자료가 유효하지 않습니다 - 기본 정보만으로 대본 생성');
      console.log('💡 이 경우 PDF 내용 없이 기본 정보만으로 대본이 생성됩니다.');
    }
    
  } catch (error) {
    console.error('💥 디버깅 중 오류 발생:', error);
  }
}

debugScriptGeneration(); 