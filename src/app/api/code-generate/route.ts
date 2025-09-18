import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAuth, checkUsageLimit, incrementUsage } from '@/lib/auth';
import { getConnection } from '@/lib/db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface CodeGenerateRequest {
  request: string;
  language: string;
  codeType: string;
  complexity: 'simple' | 'intermediate' | 'advanced';
  requirements?: string;
}

// 언어별 코딩 컨벤션 및 특성
const languageConfigs = {
  javascript: {
    name: 'JavaScript',
    conventions: 'ES6+, camelCase, 함수형 프로그래밍 활용',
    commonLibraries: 'lodash, axios, moment',
    bestPractices: 'async/await 사용, 에러 처리, 모듈화'
  },
  typescript: {
    name: 'TypeScript',
    conventions: 'strict 타입 정의, interface 활용, 제네릭 사용',
    commonLibraries: 'type definitions, utility types',
    bestPractices: '타입 안정성, 인터페이스 분리, 유틸리티 타입'
  },
  python: {
    name: 'Python',
    conventions: 'PEP 8, snake_case, type hints',
    commonLibraries: 'requests, pandas, numpy, fastapi',
    bestPractices: 'docstring, exception handling, list comprehension'
  },
  java: {
    name: 'Java',
    conventions: 'PascalCase 클래스명, camelCase 메소드명, SOLID 원칙',
    commonLibraries: 'Spring, Jackson, JUnit',
    bestPractices: 'OOP 설계, 예외 처리, 인터페이스 활용'
  },
  cpp: {
    name: 'C++',
    conventions: 'RAII, smart pointers, const correctness',
    commonLibraries: 'STL, Boost',
    bestPractices: '메모리 관리, 템플릿 활용, 최적화'
  },
  csharp: {
    name: 'C#',
    conventions: 'PascalCase, LINQ 활용, async/await',
    commonLibraries: '.NET Core, Entity Framework, Newtonsoft.Json',
    bestPractices: 'nullable reference types, disposal pattern, async programming'
  },
  go: {
    name: 'Go',
    conventions: 'gofmt, 간결성, 에러 반환',
    commonLibraries: 'gorilla/mux, gin, gorm',
    bestPractices: 'goroutine 활용, 채널 사용, 인터페이스 최소화'
  },
  rust: {
    name: 'Rust',
    conventions: 'ownership, borrowing, snake_case',
    commonLibraries: 'serde, tokio, clap',
    bestPractices: '메모리 안전성, 패턴 매칭, 에러 핸들링'
  },
  php: {
    name: 'PHP',
    conventions: 'PSR 표준, camelCase, namespace 활용',
    commonLibraries: 'Composer, Laravel, Symfony',
    bestPractices: '타입 힌팅, 예외 처리, 의존성 주입'
  },
  ruby: {
    name: 'Ruby',
    conventions: 'snake_case, 메타프로그래밍, 블록 활용',
    commonLibraries: 'Rails, Sinatra, RSpec',
    bestPractices: 'DRY 원칙, 테스트 주도 개발, 메소드 체이닝'
  },
  swift: {
    name: 'Swift',
    conventions: 'camelCase, optional 활용, protocol 지향',
    commonLibraries: 'Foundation, UIKit, Combine',
    bestPractices: 'optional 안전성, 프로토콜 활용, 함수형 프로그래밍'
  },
  kotlin: {
    name: 'Kotlin',
    conventions: 'null safety, 확장 함수, 코루틴',
    commonLibraries: 'Retrofit, Room, Ktor',
    bestPractices: 'null 안전성, 불변성, 함수형 프로그래밍'
  },
  html: {
    name: 'HTML',
    conventions: '시맨틱 마크업, 접근성, 반응형 디자인',
    commonLibraries: 'CSS, JavaScript, Bootstrap',
    bestPractices: '시맨틱 태그 사용, 접근성 고려, SEO 최적화'
  },
  css: {
    name: 'CSS',
    conventions: 'BEM 방법론, CSS Grid, Flexbox',
    commonLibraries: 'Sass, Less, PostCSS',
    bestPractices: '모듈화, 성능 최적화, 브라우저 호환성'
  }
};

// 코드 타입별 특성
const codeTypeConfigs = {
  function: {
    focus: '단일 책임 원칙, 순수 함수, 재사용성',
    structure: '매개변수 검증, 핵심 로직, 반환값'
  },
  class: {
    focus: '캡슐화, 상속, 다형성, 인터페이스',
    structure: '생성자, 속성, 메소드, 정적 멤버'
  },
  api: {
    focus: 'RESTful 설계, 상태 코드, 에러 처리',
    structure: '라우팅, 미들웨어, 컨트롤러, 응답'
  },
  component: {
    focus: '재사용성, props 설계, 상태 관리',
    structure: '인터페이스, 렌더링, 이벤트 핸들링'
  },
  algorithm: {
    focus: '시간 복잡도, 공간 복잡도, 최적화',
    structure: '입력 검증, 알고리즘 구현, 결과 반환'
  },
  database: {
    focus: '성능, 인덱스, 정규화, 보안',
    structure: '쿼리 최적화, 조인, 트랜잭션'
  },
  script: {
    focus: '자동화, 에러 처리, 로깅',
    structure: '설정, 실행 로직, 결과 보고'
  },
  test: {
    focus: '커버리지, 모킹, 단위 테스트',
    structure: 'setup, 실행, 검증, cleanup'
  }
};

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    
    // 사용량 체크
    const usageCheck = await checkUsageLimit(user.id, 'code-generate');
    if (!usageCheck.allowed) {
      return NextResponse.json({ 
        error: '코드 생성 사용량 한도에 도달했습니다.',
        currentUsage: usageCheck.limit - usageCheck.remaining,
        maxLimit: usageCheck.limit,
        resetDate: usageCheck.resetDate
      }, { status: 429 });
    }

    const {
      request: userRequest,
      language,
      codeType,
      complexity,
      requirements
    }: CodeGenerateRequest = await request.json();

    if (!userRequest || !language) {
      return NextResponse.json(
        { success: false, error: '요청사항과 프로그래밍 언어를 입력해주세요.' },
        { status: 400 }
      );
    }

    console.log('코드 생성 시작:', { userRequest, language, codeType, complexity });

    const result = await generateCode({
      request: userRequest,
      language,
      codeType,
      complexity,
      requirements
    });

    // 사용량 증가
    await incrementUsage(user.id, 'code-generate');

    // 증가된 사용량 정보 가져오기
    const updatedUsageCheck = await checkUsageLimit(user.id, 'code-generate');

    return NextResponse.json({
      success: true,
      result,
      // 사용량 정보 추가
      usage: {
        current: updatedUsageCheck.limit - updatedUsageCheck.remaining,
        limit: updatedUsageCheck.limit,
        remaining: updatedUsageCheck.remaining
      }
    });

  } catch (error) {
    console.error('코드 생성 오류:', error);
    
    // OpenAI API 관련 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota') || error.message.includes('quota_exceeded')) {
        return NextResponse.json({ 
          success: false,
          error: 'OpenAI API 할당량이 부족합니다. 잠시 후 다시 시도해주세요.' 
        }, { status: 500 });
      }
      
      if (error.message.includes('billing_not_active') || error.message.includes('account_not_active')) {
        return NextResponse.json({ 
          success: false,
          error: 'OpenAI API 계정이 비활성화되었습니다. 결제 정보를 확인해주세요.' 
        }, { status: 500 });
      }
      
      if (error.message.includes('rate_limit') || error.message.includes('429')) {
        return NextResponse.json({ 
          success: false,
          error: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' 
        }, { status: 500 });
      }
    }
    
    return NextResponse.json({ 
      success: false,
      error: '코드 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
    }, { status: 500 });
  }
}

async function generateCode({
  request: userRequest,
  language,
  codeType,
  complexity,
  requirements
}: CodeGenerateRequest) {
  const resolvedCodeType = codeType || 'function';
  const langConfig = languageConfigs[language as keyof typeof languageConfigs] || {
    name: language || 'Unknown',
    conventions: '일반적인 코딩 컨벤션',
    commonLibraries: '표준 라이브러리',
    bestPractices: '코드 가독성과 유지보수성'
  };
  
  const typeConfig = codeTypeConfigs[resolvedCodeType as keyof typeof codeTypeConfigs] || {
    focus: '기본적인 구현',
    structure: '표준 구조'
  };
  
  const complexityDescriptions = {
    simple: '기본적인 구현에 집중하고, 핵심 기능만 포함합니다.',
    intermediate: '에러 처리, 입력 검증, 적절한 최적화를 포함합니다.',
    advanced: '확장성, 보안, 성능 최적화, 디자인 패턴을 고려한 고급 구현을 합니다.'
  };

  const systemPrompt = `당신은 숙련된 소프트웨어 개발자입니다. 사용자의 요청에 따라 고품질의 코드를 생성해주세요.

**언어 정보: ${langConfig.name}**
- 컨벤션: ${langConfig.conventions}
- 권장 라이브러리: ${langConfig.commonLibraries}
- 모범 사례: ${langConfig.bestPractices}

**코드 유형: ${resolvedCodeType}**
- 중점사항: ${typeConfig.focus}
- 구조: ${typeConfig.structure}

**복잡도: ${complexity}**
- ${complexityDescriptions[complexity]}

${requirements ? `**추가 요구사항**: ${requirements}` : ''}

생성 규칙:
1. 코드는 실행 가능하고 실용적이어야 합니다
2. 적절한 주석을 포함하세요
3. 에러 처리를 고려하세요
4. 언어별 모범 사례를 따르세요
5. 가독성과 유지보수성을 중시하세요

[출력 언어 규칙]
- JSON의 텍스트 필드(explanation, usage, improvements, relatedConcepts)는 반드시 한국어로 작성합니다.
- code 필드는 선택한 프로그래밍 언어 문법으로 작성하되, 주석과 사용자 메시지는 가능하면 한국어를 사용합니다.
- 불필요한 영어 문장이나 안내문을 포함하지 않습니다.

응답 형식은 반드시 다음 JSON 형태로만 제공하세요:
{
  "code": "실제 코드 (문자열, 줄바꿈은 \\n 사용)",
  "explanation": "코드가 무엇을 하는지 설명 (200-300자)",
  "usage": "코드 사용 방법 및 예시 (150-250자)",
  "improvements": ["개선 제안1", "개선 제안2", "개선 제안3"],
  "relatedConcepts": ["관련개념1", "관련개념2", "관련개념3", "관련개념4"]
}

JSON만 응답하고 다른 텍스트는 포함하지 마세요.`;

  const userPrompt = `
요청사항: ${userRequest}

${langConfig.name}로 ${resolvedCodeType} 유형의 코드를 ${complexity} 수준으로 생성해주세요.
`;

  const completion = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    reasoning: { effort: "medium" },
  });

  const response = completion.output_text;
  
  if (!response) {
    throw new Error('코드 생성 응답이 없습니다.');
  }

  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('응답 내용:', response);
    
    // 파싱 실패 시 기본 응답 반환
    return getDefaultResponse(userRequest, language, resolvedCodeType);
  }
}

// 기본 응답 (API 실패 시 백업용)
function getDefaultResponse(userRequest: string, language: string, codeType: string) {
  const simpleExamples: { [key: string]: { [key: string]: string } } = {
    javascript: {
      function: `function processData(data) {
  if (!data) {
    throw new Error('데이터가 필요합니다');
  }
  
  // 데이터 처리 로직
  const result = data.map(item => {
    return {
      ...item,
      processed: true,
      timestamp: new Date().toISOString()
    };
  });
  
  return result;
}`,
      class: `class DataProcessor {
  constructor(options = {}) {
    this.options = options;
    this.processed = [];
  }
  
  process(data) {
    if (!Array.isArray(data)) {
      throw new Error('배열 데이터가 필요합니다');
    }
    
    const result = data.map(item => this.processItem(item));
    this.processed.push(...result);
    return result;
  }
  
  processItem(item) {
    return {
      ...item,
      id: Math.random().toString(36),
      processedAt: Date.now()
    };
  }
}`
    },
    python: {
      function: `def process_data(data):
    """데이터를 처리하는 함수"""
    if not data:
        raise ValueError("데이터가 필요합니다")
    
    result = []
    for item in data:
        processed_item = {
            **item,
            'processed': True,
            'timestamp': datetime.now().isoformat()
        }
        result.append(processed_item)
    
    return result`,
      class: `class DataProcessor:
    def __init__(self, options=None):
        self.options = options or {}
        self.processed = []
    
    def process(self, data):
        if not isinstance(data, list):
            raise TypeError("리스트 데이터가 필요합니다")
        
        result = [self.process_item(item) for item in data]
        self.processed.extend(result)
        return result
    
    def process_item(self, item):
        return {
            **item,
            'id': str(uuid.uuid4()),
            'processed_at': time.time()
        }`
    }
  };

  const defaultCode = simpleExamples[language]?.[codeType] || 
    `// ${language}로 작성된 ${codeType} 코드
// TODO: ${userRequest}에 대한 구현
console.log('코드 생성을 위해 더 구체적인 요청이 필요합니다');`;

  return {
    code: defaultCode,
    explanation: `${userRequest}에 대한 기본적인 ${language} ${codeType} 코드입니다. 더 구체적인 요청사항을 입력하시면 정확한 코드를 생성해드립니다.`,
    usage: `생성된 코드를 복사하여 프로젝트에서 사용하세요. 필요에 따라 수정하여 사용할 수 있습니다.`,
    improvements: [
      '더 구체적인 요구사항 명시',
      '에러 처리 로직 추가',
      '성능 최적화 고려',
      '테스트 케이스 작성'
    ],
    relatedConcepts: [
      '코드 품질',
      '디자인 패턴',
      '에러 처리',
      '성능 최적화'
    ]
  };
} 