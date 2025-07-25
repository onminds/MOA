// Node.js에서 fetch 사용을 위한 설정
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testPresentationAPI() {
  try {
    console.log('🧪 발표 대본 생성 API 테스트 시작...');
    
    const testData = {
      topic: "Chapter 8. Cheese - 치즈의 역사와 제조 과정",
      duration: "10",
      audience: "students",
      purpose: "educate",
      keyPoints: ["치즈의 요리 역사", "치즈 제조 과정", "치즈 종류별 특징"],
      tone: "friendly",
      additionalInfo: "",
      fileContent: "CheeseI\nChapter 8.\nNamsu Oh, Ph.D.\nDepartment of Food Science and Biotechnology, Korea University\n\nObjectives\nTrace a brief culinary history ofcheese.\nExplain the cheese-making processoverall.\nIdentify the different types of cheese and their characteristics.\n\nCheese is one of the most versatile and beloved dairy products in the world. It has been a staple in human diets for thousands of years, with evidence of cheese-making dating back to ancient civilizations.",
      imageText: ""
    };

    console.log('📤 요청 데이터:', {
      topic: testData.topic,
      duration: testData.duration,
      audience: testData.audience,
      purpose: testData.purpose,
      fileContentLength: testData.fileContent.length
    });

    const response = await fetch('http://localhost:3000/api/presentation-script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log('📥 응답 상태:', response.status);
    console.log('📥 응답 헤더:', Object.fromEntries(response.headers.entries()));

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ 발표 대본 생성 성공!');
      console.log('📄 대본 길이:', result.script?.length || 0);
      console.log('📄 대본 미리보기:', result.script?.substring(0, 200) + '...');
    } else {
      console.log('❌ 발표 대본 생성 실패');
      console.log('❌ 오류:', result.error);
    }

  } catch (error) {
    console.error('💥 테스트 중 오류:', error);
  }
}

testPresentationAPI(); 