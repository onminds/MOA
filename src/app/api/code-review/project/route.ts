import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 토큰 제한 설정
const MAX_TOKENS_PER_REQUEST = 8000; // 안전한 여유를 두고 설정
const MAX_FILES_PER_BATCH = 5; // 한 번에 처리할 파일 수 제한

export async function POST(request: NextRequest) {
  try {
    const { files, projectStructure, context } = await request.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('프로젝트 코드리뷰 API 호출됨');
    console.log('파일 수:', files.length);
    console.log('프로젝트 구조:', projectStructure);

    // 파일들을 언어별로 그룹화
    const filesByLanguage: { [key: string]: any[] } = {};
    
    files.forEach((file: any) => {
      // file.name이 없는 경우 기본값 사용
      const fileName = file.name || file.path || 'unknown.txt';
      const language = detectLanguage(fileName);
      if (!filesByLanguage[language]) {
        filesByLanguage[language] = [];
      }
      filesByLanguage[language].push(file);
    });

    console.log('언어별 파일 분류:', Object.keys(filesByLanguage));

    // 전체 리뷰 결과를 저장할 배열
    const allReviews: string[] = [];
    
    // 언어별로 배치 처리
    for (const [language, languageFiles] of Object.entries(filesByLanguage)) {
      console.log(`${language} 파일 처리 시작: ${languageFiles.length}개 파일`);
      
      // 파일들을 배치로 나누기
      const batches = [];
      for (let i = 0; i < languageFiles.length; i += MAX_FILES_PER_BATCH) {
        batches.push(languageFiles.slice(i, i + MAX_FILES_PER_BATCH));
      }
      
      // 각 배치별로 리뷰 수행
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`${language} 배치 ${batchIndex + 1}/${batches.length} 처리 중...`);
        
        const batchReview = await analyzeFileBatch(language, batch, batchIndex + 1, batches.length);
        allReviews.push(batchReview);
        
        // API 호출 간격을 두어 rate limit 방지
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // 전체 요약 리뷰 생성
    const summaryReview = await generateSummaryReview(allReviews, projectStructure, context);
    
    console.log('프로젝트 코드리뷰 생성 완료');

    return NextResponse.json({
      success: true,
      review: summaryReview,
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      languages: Object.keys(filesByLanguage),
      batchCount: allReviews.length
    });

  } catch (error) {
    console.error('프로젝트 코드리뷰 처리 중 오류:', error);
    return NextResponse.json(
      { error: '프로젝트 코드리뷰 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 파일 배치 분석 함수
async function analyzeFileBatch(language: string, files: any[], batchNumber: number, totalBatches: number): Promise<string> {
  let fileContent = '';
  
  files.forEach((file: any, index: number) => {
    const fileName = file.name || file.path || 'unknown.txt';
    fileContent += `\n### 파일 ${batchNumber}-${index + 1}: ${fileName}\n`;
    fileContent += `\`\`\`${getLanguageExtension(language)}\n${file.content || ''}\n\`\`\`\n`;
  });

  const prompt = `
다음 ${language} 파일들에 대한 코드리뷰를 수행해주세요 (배치 ${batchNumber}/${totalBatches}):

${fileContent}

다음 항목들을 포함하여 상세한 코드리뷰를 제공해주세요:

1. **코드 품질 평가**
   - 가독성 및 구조
   - 함수/클래스 설계
   - 변수명 및 네이밍 컨벤션

2. **개선 사항**
   - 잠재적 버그
   - 성능 최적화 기회
   - 코드 중복

3. **모범 사례 준수**
   - 언어별 컨벤션
   - 디자인 패턴
   - 에러 처리

4. **구체적인 개선 제안**
   - 리팩토링 제안
   - 코드 예시

한국어로 답변해주세요. 각 파일별로 구체적인 피드백을 제공해주세요.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자입니다. 코드를 분석하고 개선점을 제시하는 코드리뷰 전문가입니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || '분석 실패';
  } catch (error) {
    console.error(`배치 ${batchNumber} 분석 중 오류:`, error);
    return `배치 ${batchNumber} 분석 중 오류가 발생했습니다.`;
  }
}

// 전체 요약 리뷰 생성 함수
async function generateSummaryReview(batchReviews: string[], projectStructure?: string, context?: string): Promise<string> {
  const allReviewsText = batchReviews.join('\n\n---\n\n');
  
  let prompt = `
다음은 프로젝트의 각 부분에 대한 개별 코드리뷰 결과입니다:

${allReviewsText}

`;

  if (projectStructure) {
    prompt += `\n## 프로젝트 구조\n${projectStructure}\n`;
  }

  if (context) {
    prompt += `\n## 프로젝트 컨텍스트\n${context}\n`;
  }

  prompt += `
위의 개별 리뷰들을 종합하여 전체 프로젝트에 대한 종합적인 코드리뷰 요약을 제공해주세요:

1. **전체 아키텍처 평가**
   - 프로젝트 구조의 적절성
   - 모듈화 수준
   - 확장성

2. **주요 개선 우선순위**
   - 즉시 수정해야 할 중요 이슈
   - 중기 개선 사항
   - 장기적 개선 방향

3. **기술적 권장사항**
   - 성능 최적화
   - 보안 강화
   - 유지보수성 향상

4. **전체 프로젝트 점수**
   - 아키텍처: /100
   - 코드 품질: /100
   - 성능: /100
   - 보안: /100
   - 유지보수성: /100

5. **다음 단계 제안**
   - 구체적인 액션 플랜
   - 리팩토링 로드맵

한국어로 답변해주세요.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자이자 아키텍트입니다. 전체 프로젝트를 분석하고 종합적인 코드리뷰를 제공하는 전문가입니다."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || '요약 리뷰 생성 실패';
  } catch (error) {
    console.error('요약 리뷰 생성 중 오류:', error);
    return '요약 리뷰 생성 중 오류가 발생했습니다.';
  }
}

// 언어 감지 함수
function detectLanguage(filename: string): string {
  // filename이 undefined, null, 또는 빈 문자열인 경우 기본값 반환
  if (!filename || typeof filename !== 'string') {
    return 'Unknown';
  }
  
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const languageMap: { [key: string]: string } = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'React',
    'tsx': 'React TypeScript',
    'py': 'Python',
    'java': 'Java',
    'cpp': 'C++',
    'c': 'C',
    'cs': 'C#',
    'php': 'PHP',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'swift': 'Swift',
    'kt': 'Kotlin',
    'scala': 'Scala',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'vue': 'Vue',
    'json': 'JSON',
    'xml': 'XML',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown',
    'sql': 'SQL',
    'sh': 'Shell',
    'bat': 'Batch',
    'ps1': 'PowerShell'
  };

  return languageMap[ext || ''] || 'Unknown';
}

// 언어별 확장자 반환 함수
function getLanguageExtension(language: string): string {
  const extensionMap: { [key: string]: string } = {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'React': 'jsx',
    'React TypeScript': 'tsx',
    'Python': 'python',
    'Java': 'java',
    'C++': 'cpp',
    'C': 'c',
    'C#': 'csharp',
    'PHP': 'php',
    'Ruby': 'ruby',
    'Go': 'go',
    'Rust': 'rust',
    'Swift': 'swift',
    'Kotlin': 'kotlin',
    'Scala': 'scala',
    'HTML': 'html',
    'CSS': 'css',
    'SCSS': 'scss',
    'Sass': 'sass',
    'Vue': 'vue',
    'JSON': 'json',
    'XML': 'xml',
    'YAML': 'yaml',
    'Markdown': 'markdown',
    'SQL': 'sql',
    'Shell': 'bash',
    'Batch': 'batch',
    'PowerShell': 'powershell'
  };

  return extensionMap[language] || 'text';
} 