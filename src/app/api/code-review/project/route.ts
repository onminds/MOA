import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 토큰 제한 설정
const MAX_TOKENS_PER_REQUEST = 2000; // 더 안전한 토큰 제한
const MAX_FILES_PER_BATCH = 2; // 배치당 파일 수를 더 줄여서 토큰 제한 방지

// 산업별 상세 분석 요구사항
const getIndustrySecurityRequirements = (industry: string) => {
  const requirements = {
    fintech: {
      critical: ['encryption', 'authentication', 'authorization', 'audit_log', 'pci_dss'],
      patterns: ['password', 'credit_card', 'bank_account', 'ssn', 'api_key', 'secret'],
      codeSmells: ['hardcoded_credentials', 'plaintext_logging', 'no_encryption', 'weak_validation'],
      suggestions: ['PCI DSS 준수', '암호화 필수', '감사 로그 필수', '강력한 인증 구현']
    },
    healthcare: {
      critical: ['hipaa', 'phi', 'encryption', 'access_control', 'audit_trail'],
      patterns: ['patient_data', 'medical_record', 'diagnosis', 'treatment', 'ssn', 'health_info'],
      codeSmells: ['plaintext_storage', 'no_access_control', 'weak_encryption', 'no_audit_log'],
      suggestions: ['HIPAA 준수', '환자 데이터 암호화', '접근 제어 강화', '감사 추적 필수']
    },
    ecommerce: {
      critical: ['payment_security', 'pci_dss', 'data_protection', 'ssl_required'],
      patterns: ['payment', 'order', 'customer_data', 'credit_card', 'shipping', 'billing'],
      codeSmells: ['plaintext_payment', 'no_ssl', 'weak_validation', 'insecure_storage'],
      suggestions: ['결제 보안 강화', '고객 데이터 보호', 'SSL 필수', 'PCI DSS 준수']
    },
    gaming: {
      critical: ['anti_cheat', 'performance', 'scalability', 'data_integrity'],
      patterns: ['score', 'level', 'achievement', 'leaderboard', 'inventory', 'currency'],
      codeSmells: ['client_side_validation', 'hardcoded_values', 'no_server_validation', 'insecure_storage'],
      suggestions: ['부정 행위 방지', '성능 최적화', '확장성 고려', '서버 검증 필수']
    },
    enterprise: {
      critical: ['compliance', 'audit', 'security', 'scalability', 'data_governance'],
      patterns: ['business_logic', 'workflow', 'approval', 'report', 'user_role', 'permission'],
      codeSmells: ['no_audit_trail', 'hardcoded_business_rules', 'weak_authorization', 'no_compliance_check'],
      suggestions: ['규정 준수', '감사 추적', '보안 강화', '데이터 거버넌스']
    },
    education: {
      critical: ['data_privacy', 'access_control', 'content_security', 'student_protection'],
      patterns: ['student_data', 'grade', 'assignment', 'course', 'enrollment'],
      codeSmells: ['weak_privacy', 'no_content_filter', 'insecure_storage', 'no_age_verification'],
      suggestions: ['학생 데이터 보호', '콘텐츠 필터링', '연령 검증', '접근 제어']
    },
    media: {
      critical: ['content_protection', 'drm', 'performance', 'scalability'],
      patterns: ['video', 'audio', 'stream', 'content', 'license'],
      codeSmells: ['no_drm', 'weak_content_protection', 'poor_performance', 'no_caching'],
      suggestions: ['콘텐츠 보호', 'DRM 구현', '성능 최적화', '캐싱 전략']
    },
    general: {
      critical: ['basic_security', 'data_protection', 'input_validation'],
      patterns: ['user_data', 'password', 'session', 'config'],
      codeSmells: ['weak_validation', 'no_encryption', 'hardcoded_values', 'poor_error_handling'],
      suggestions: ['기본 보안 강화', '데이터 보호', '입력 검증 강화']
    }
  };
  
  return requirements[industry as keyof typeof requirements] || requirements.general;
};

// 정적 분석 도구 시뮬레이션
const performStaticAnalysis = (files: any[], industry: string = 'general') => {
  const analysis: {
    codeSmells: Array<{
      type: string;
      severity: string;
      message: string;
      file: string;
      line?: number;
      suggestion: string;
    }>;
    complexity: Array<{
      type: string;
      severity: string;
      message: string;
      file: string;
      suggestion: string;
    }>;
    securityIssues: Array<{
      type: string;
      severity: string;
      message: string;
      file: string;
      line?: number;
      suggestion: string;
    }>;
    performanceIssues: Array<{
      type: string;
      severity: string;
      message: string;
      file: string;
      suggestion: string;
    }>;
    maintainabilityIssues: Array<{
      type: string;
      severity: string;
      message: string;
      file: string;
      suggestion: string;
    }>;
  } = {
    codeSmells: [],
    complexity: [],
    securityIssues: [],
    performanceIssues: [],
    maintainabilityIssues: []
  };

  files.forEach(file => {
    const content = file.content || '';
    
    // 코드 스멜 감지
    if (content.includes('console.log') && !content.includes('// TODO: Remove')) {
      analysis.codeSmells.push({
        type: 'debug_code',
        severity: 'low',
        message: '디버그 코드가 프로덕션에 남아있습니다',
        file: file.name,
        line: content.split('\n').findIndex((line: string) => line.includes('console.log')) + 1,
        suggestion: 'console.log를 제거하거나 로깅 라이브러리를 사용하세요'
      });
    }

    // 복잡도 분석
    const functions = content.match(/function\s+\w+\s*\(/g) || [];
    const arrowFunctions = content.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
    const totalFunctions = functions.length + arrowFunctions.length;
    
    if (totalFunctions > 10) {
      analysis.complexity.push({
        type: 'high_function_count',
        severity: 'medium',
        message: '함수가 너무 많습니다',
        file: file.name,
        suggestion: '함수를 모듈로 분리하거나 클래스로 리팩토링하세요'
      });
    }

    // 산업별 보안 요구사항 분석
    const industryRequirements = getIndustrySecurityRequirements(industry);
    
    // 기본 보안 이슈 감지
    if (content.includes('eval(') || content.includes('innerHTML')) {
      analysis.securityIssues.push({
        type: 'xss_vulnerability',
        severity: 'high',
        message: 'XSS 취약점이 발견되었습니다',
        file: file.name,
        line: content.split('\n').findIndex((line: string) => line.includes('eval(') || line.includes('innerHTML')) + 1,
        suggestion: 'eval() 대신 JSON.parse()를, innerHTML 대신 textContent를 사용하세요'
      });
    }

    // 1. 산업별 패턴 감지
    industryRequirements.patterns.forEach(pattern => {
      if (content.toLowerCase().includes(pattern.toLowerCase())) {
        const severity = industryRequirements.critical.includes(pattern) ? 'high' : 'medium';
        analysis.securityIssues.push({
          type: `industry_specific_${pattern}`,
          severity,
          message: `${industry} 산업에서 주의해야 할 ${pattern} 관련 코드가 발견되었습니다`,
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.toLowerCase().includes(pattern.toLowerCase())) + 1,
          suggestion: industryRequirements.suggestions.join(', ')
        });
      }
    });

    // 2. 산업별 코드 스멜 감지
    if (industry === 'gaming') {
      // 게임 산업 특화 분석
      if (content.includes('class') && content.includes('level') && content.includes('=')) {
        analysis.codeSmells.push({
          type: 'hardcoded_class_levels',
          severity: 'medium',
          message: '게임 클래스 레벨이 하드코딩되어 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('level') && line.includes('=')) + 1,
          suggestion: '클래스 레벨을 설정 파일이나 데이터베이스로 분리하세요'
        });
      }
      
      if (content.includes('score') && content.includes('=') && !content.includes('validate')) {
        analysis.codeSmells.push({
          type: 'client_side_score_manipulation',
          severity: 'high',
          message: '클라이언트 측에서 점수를 조작할 수 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('score') && line.includes('=')) + 1,
          suggestion: '서버 측에서 점수 검증을 구현하세요'
        });
      }

      if (content.includes('inventory') && content.includes('localStorage')) {
        analysis.codeSmells.push({
          type: 'insecure_inventory_storage',
          severity: 'medium',
          message: '인벤토리가 안전하지 않은 저장소에 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('inventory')) + 1,
          suggestion: '서버 측 인벤토리 시스템을 구현하세요'
        });
      }
    }

    if (industry === 'fintech') {
      // 핀테크 산업 특화 분석
      if (content.includes('password') && content.includes('=') && content.includes('"')) {
        analysis.codeSmells.push({
          type: 'hardcoded_password',
          severity: 'critical',
          message: '비밀번호가 하드코딩되어 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('password') && line.includes('=')) + 1,
          suggestion: '환경 변수나 보안 저장소를 사용하세요'
        });
      }

      if (content.includes('credit_card') && content.includes('console.log')) {
        analysis.codeSmells.push({
          type: 'sensitive_data_logging',
          severity: 'critical',
          message: '민감한 카드 정보가 로그에 출력됩니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('credit_card') && line.includes('console.log')) + 1,
          suggestion: '민감한 정보 로깅을 금지하세요'
        });
      }
    }

    if (industry === 'healthcare') {
      // 의료 산업 특화 분석
      if (content.includes('patient') && content.includes('console.log')) {
        analysis.codeSmells.push({
          type: 'hipaa_violation_logging',
          severity: 'critical',
          message: '환자 정보가 로그에 출력되어 HIPAA 위반 가능성이 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('patient') && line.includes('console.log')) + 1,
          suggestion: '환자 정보 로깅을 금지하고 암호화를 적용하세요'
        });
      }

      if (content.includes('diagnosis') && !content.includes('encrypt')) {
        analysis.codeSmells.push({
          type: 'unencrypted_medical_data',
          severity: 'high',
          message: '진단 정보가 암호화되지 않았습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('diagnosis')) + 1,
          suggestion: '의료 데이터를 암호화하여 저장하세요'
        });
      }
    }

    if (industry === 'ecommerce') {
      // 이커머스 산업 특화 분석
      if (content.includes('payment') && content.includes('http://')) {
        analysis.codeSmells.push({
          type: 'insecure_payment_transmission',
          severity: 'critical',
          message: '결제 정보가 HTTP로 전송됩니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('payment') && line.includes('http://')) + 1,
          suggestion: 'HTTPS를 사용하여 결제 정보를 전송하세요'
        });
      }

      if (content.includes('order') && content.includes('localStorage')) {
        analysis.codeSmells.push({
          type: 'insecure_order_storage',
          severity: 'medium',
          message: '주문 정보가 안전하지 않은 저장소에 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('order') && line.includes('localStorage')) + 1,
          suggestion: '주문 정보를 서버에 안전하게 저장하세요'
        });
      }
    }

    if (industry === 'enterprise') {
      // 기업용 솔루션 특화 분석
      if (content.includes('role') && content.includes('=') && content.includes('"admin"')) {
        analysis.codeSmells.push({
          type: 'hardcoded_admin_role',
          severity: 'high',
          message: '관리자 권한이 하드코딩되어 있습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('role') && line.includes('admin')) + 1,
          suggestion: '권한 시스템을 데이터베이스로 관리하세요'
        });
      }

      if (content.includes('workflow') && !content.includes('audit')) {
        analysis.codeSmells.push({
          type: 'no_workflow_audit',
          severity: 'medium',
          message: '워크플로우에 감사 추적이 없습니다',
          file: file.name,
          line: content.split('\n').findIndex((line: string) => line.includes('workflow')) + 1,
          suggestion: '워크플로우 변경사항을 감사 로그에 기록하세요'
        });
      }
    }

    // 성능 이슈 감지
    if (content.includes('.forEach(') && content.includes('DOM')) {
      analysis.performanceIssues.push({
        type: 'dom_manipulation_in_loop',
        severity: 'medium',
        message: '루프 내에서 DOM 조작이 발생합니다',
        file: file.name,
        suggestion: 'DocumentFragment를 사용하여 배치 업데이트하세요'
      });
    }

    // 유지보수성 이슈
    if (content.length > 500) {
      analysis.maintainabilityIssues.push({
        type: 'large_file',
        severity: 'medium',
        message: '파일이 너무 큽니다',
        file: file.name,
        suggestion: '파일을 더 작은 모듈로 분리하세요'
      });
    }
  });

  return analysis;
};

// 코드 품질 메트릭 계산
const calculateCodeMetrics = (files: any[]) => {
  let totalLines = 0;
  let totalFunctions = 0;
  let totalClasses = 0;
  let totalComments = 0;
  let cyclomaticComplexity = 0;

  files.forEach(file => {
    const content = file.content || '';
    const lines = content.split('\n');
    
    totalLines += lines.length;
    
    // 함수 수 계산
    const functions = content.match(/function\s+\w+\s*\(/g) || [];
    const arrowFunctions = content.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>/g) || [];
    totalFunctions += functions.length + arrowFunctions.length;
    
    // 클래스 수 계산
    const classes = content.match(/class\s+\w+/g) || [];
    totalClasses += classes.length;
    
    // 주석 수 계산
    const comments = content.match(/\/\/.*$/gm) || [];
    const blockComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
    totalComments += comments.length + blockComments.length;
    
    // 순환 복잡도 계산 (간단한 버전)
    const ifStatements = content.match(/if\s*\(/g) || [];
    const forLoops = content.match(/for\s*\(/g) || [];
    const whileLoops = content.match(/while\s*\(/g) || [];
    const switchStatements = content.match(/switch\s*\(/g) || [];
    cyclomaticComplexity += ifStatements.length + forLoops.length + whileLoops.length + switchStatements.length;
  });

  return {
    totalLines,
    totalFunctions,
    totalClasses,
    totalComments,
    cyclomaticComplexity,
    commentRatio: totalLines > 0 ? (totalComments / totalLines) * 100 : 0,
    averageComplexity: totalFunctions > 0 ? cyclomaticComplexity / totalFunctions : 0
  };
};

export async function POST(request: NextRequest) {
  try {
    const { files, projectStructure, context, sessionId, industry } = await request.json();

    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('프로젝트 코드리뷰 API 호출됨');
    console.log('파일 수:', files.length);
    console.log('프로젝트 구조:', projectStructure);
    console.log('산업 분야:', industry);

    // 정적 분석 수행 (산업별 분석 포함)
    const staticAnalysis = performStaticAnalysis(files, industry);
    const codeMetrics = calculateCodeMetrics(files);

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
    
    // 전체 배치 수 계산
    let totalBatches = 0;
    let completedBatches = 0;
    
    // 언어별로 배치 처리
    for (const [language, languageFiles] of Object.entries(filesByLanguage)) {
      console.log(`${language} 파일 처리 시작: ${languageFiles.length}개 파일`);
      
      // 파일들을 배치로 나누기
      const batches = [];
      for (let i = 0; i < languageFiles.length; i += MAX_FILES_PER_BATCH) {
        batches.push(languageFiles.slice(i, i + MAX_FILES_PER_BATCH));
      }
      
      totalBatches += batches.length;
      
      // 각 배치별로 리뷰 수행
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`${language} 배치 ${batchIndex + 1}/${batches.length} 처리 중...`);
        
        const batchReview = await analyzeFileBatch(language, batch, batchIndex + 1, batches.length, staticAnalysis, industry);
        allReviews.push(batchReview);
        
        completedBatches++;
        
        // 전체 진행률 계산 (배치 완료 기준)
        if (sessionId) {
          const overallProgress = Math.round((completedBatches / totalBatches) * 80); // 80%까지만
          console.log(`전체 배치 진행률: ${completedBatches}/${totalBatches} (${overallProgress}%)`);
        }
        
        // API 호출 간격을 두어 rate limit 방지
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // 전체 요약 리뷰 생성
    const summaryReview = await generateSummaryReview(allReviews, projectStructure, context, staticAnalysis, codeMetrics);
    
    console.log('프로젝트 코드리뷰 생성 완료');

    return NextResponse.json({
      success: true,
      review: summaryReview,
      projectId: `project_${Date.now()}`,
      model: 'gpt-4',
      timestamp: new Date().toISOString(),
      fileCount: files.length,
      languages: Object.keys(filesByLanguage),
      batchCount: allReviews.length,
      staticAnalysis,
      codeMetrics
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
async function analyzeFileBatch(language: string, files: any[], batchNumber: number, totalBatches: number, staticAnalysis: any, industry: string = 'general'): Promise<string> {
  let fileContent = '';
  const MAX_FILE_SIZE = 3000; // 파일당 최대 문자 수를 더 줄임
  
  files.forEach((file: any, index: number) => {
    const fileName = file.name || file.path || 'unknown.txt';
    let content = file.content || '';
    
    // 파일 내용이 너무 길면 잘라내기
    if (content.length > MAX_FILE_SIZE) {
      content = content.substring(0, MAX_FILE_SIZE) + '\n\n... (파일이 너무 길어 일부만 분석됩니다)';
    }
    
    fileContent += `\n### 파일 ${batchNumber}-${index + 1}: ${fileName}\n`;
    fileContent += `\`\`\`${getLanguageExtension(language)}\n${content}\n\`\`\`\n`;
  });

  // 정적 분석 결과를 파일별로 필터링
  const batchFileNames = files.map(f => f.name || f.path || 'unknown.txt');
  const batchStaticAnalysis = {
    codeSmells: staticAnalysis.codeSmells.filter((issue: any) => batchFileNames.includes(issue.file)),
    complexity: staticAnalysis.complexity.filter((issue: any) => batchFileNames.includes(issue.file)),
    securityIssues: staticAnalysis.securityIssues.filter((issue: any) => batchFileNames.includes(issue.file)),
    performanceIssues: staticAnalysis.performanceIssues.filter((issue: any) => batchFileNames.includes(issue.file)),
    maintainabilityIssues: staticAnalysis.maintainabilityIssues.filter((issue: any) => batchFileNames.includes(issue.file))
  };

  // 산업별 분석 정보 추가
  const industryInfo = industry && industry !== 'general' ? `
**산업별 분석 요구사항:**
- 산업 분야: ${industry}
- 산업별 보안 요구사항: ${getIndustrySecurityRequirements(industry).suggestions.join(', ')}
- 산업별 주의 패턴: ${getIndustrySecurityRequirements(industry).patterns.join(', ')}
` : '';

  const prompt = `
다음 ${language} 파일들을 전문적으로 분석하여 문제 코드를 추출하고 개선 방안을 제시해주세요 (배치 ${batchNumber}/${totalBatches}):

${fileContent}

**정적 분석 결과:**
${JSON.stringify(batchStaticAnalysis, null, 2)}

${industryInfo}

**다음 JSON 형식으로 정확히 응답해주세요:**

{
  "issues": [
    {
      "type": "하드코딩",
      "severity": "medium",
      "description": "하드코딩된 값이 발견되었습니다",
      "currentCode": "const timeout = 5000;",
      "improvedCode": "const TIMEOUT_CONSTANTS = { default: 5000 };",
      "file": "파일명",
      "line": "대략적인 라인 번호"
    },
    {
      "type": "에러 처리 미흡",
      "severity": "high", 
      "description": "try-catch 블록이 없어 예외 처리가 부족합니다",
      "currentCode": "const result = await fetch(url);",
      "improvedCode": "try { const result = await fetch(url); } catch (error) { console.error('Error:', error); }",
      "file": "파일명",
      "line": "대략적인 라인 번호"
    }
  ],
  "summary": "전체적인 문제점과 개선 방향 요약"
}

**문제 유형 예시:**
- 하드코딩된 값 (숫자, 문자열)
- 에러 처리 부족 (try-catch 없음)
- 주석 부족 (함수 설명 없음)
- 비효율적인 코드 (중복, 복잡한 로직)
- 보안 취약점 (SQL 인젝션, XSS 등)
- 성능 이슈 (불필요한 루프, 메모리 누수 등)
- 코드 스멜 (디버그 코드, 중복 등)
- 복잡도 문제 (함수 수, 순환 복잡도)
${industry && industry !== 'general' ? `- ${industry} 산업별 특화 보안 요구사항` : ''}

정적 분석 결과와 산업별 요구사항을 참고하여 실제 코드에서 발견된 문제만 추출하고, 구체적인 개선 코드를 제시해주세요.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자입니다. 코드를 분석하고 구체적인 문제 코드를 추출하여 개선 방안을 제시하는 코드리뷰 전문가입니다. JSON 형식으로 정확히 응답해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content || '분석 실패';
    
    // JSON 파싱 시도
    try {
      const parsedResponse = JSON.parse(response);
      return JSON.stringify(parsedResponse, null, 2);
    } catch (parseError) {
      // JSON 파싱 실패시 기존 텍스트 형식으로 반환
      console.log('JSON 파싱 실패, 텍스트 형식으로 반환:', parseError);
      return response;
    }
  } catch (error: any) {
    console.error(`배치 ${batchNumber} 분석 중 오류:`, error);
    
    // 토큰 제한 오류인 경우 특별 처리
    if (error.code === 'context_length_exceeded') {
      return `배치 ${batchNumber} 분석 중 토큰 제한 초과: 파일이 너무 큽니다. 더 작은 배치로 나누어 분석합니다.`;
    }
    
    return `배치 ${batchNumber} 분석 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`;
  }
}

// 전체 요약 리뷰 생성 함수
async function generateSummaryReview(batchReviews: string[], projectStructure?: string, context?: string, staticAnalysis?: any, codeMetrics?: any): Promise<string> {
  // 배치 리뷰가 너무 길면 요약
  let allReviewsText = batchReviews.join('\n\n---\n\n');
  const MAX_REVIEWS_LENGTH = 5000; // 최대 리뷰 길이를 더 줄임
  
  if (allReviewsText.length > MAX_REVIEWS_LENGTH) {
    // 가장 중요한 배치들만 선택 (처음과 마지막)
    const importantReviews = [
      batchReviews[0], // 첫 번째 배치
      ...batchReviews.slice(1, Math.min(3, batchReviews.length - 1)), // 중간 배치들
      batchReviews[batchReviews.length - 1] // 마지막 배치
    ];
    allReviewsText = importantReviews.join('\n\n---\n\n') + '\n\n... (일부 배치만 요약에 포함됩니다)';
  }
  
  // 구조화된 데이터 추출 시도
  let structuredIssues: any[] = [];
  let textSummaries: string[] = [];
  
  batchReviews.forEach((review, index) => {
    try {
      const parsed = JSON.parse(review);
      if (parsed.issues && Array.isArray(parsed.issues)) {
        structuredIssues.push(...parsed.issues);
      }
      if (parsed.summary) {
        textSummaries.push(parsed.summary);
      }
    } catch (e) {
      // JSON 파싱 실패시 텍스트로 처리
      textSummaries.push(review);
    }
  });
  
  let prompt = `
다음은 프로젝트의 각 부분에 대한 개별 코드리뷰 결과입니다:

${allReviewsText}

`;

  if (projectStructure) {
    const limitedStructure = projectStructure.length > 2000 
      ? projectStructure.substring(0, 2000) + '\n\n... (프로젝트 구조가 너무 길어 일부만 표시됩니다)'
      : projectStructure;
    prompt += `\n## 프로젝트 구조\n${limitedStructure}\n`;
  }

  if (context) {
    const limitedContext = context.length > 1000 
      ? context.substring(0, 1000) + '\n\n... (컨텍스트가 너무 길어 일부만 표시됩니다)'
      : context;
    prompt += `\n## 프로젝트 컨텍스트\n${limitedContext}\n`;
  }

  // 정적 분석과 코드 메트릭 정보 추가
  if (staticAnalysis) {
    prompt += `\n**정적 분석 결과:**\n`;
    prompt += `- 코드 스멜: ${staticAnalysis.codeSmells.length}개\n`;
    prompt += `- 복잡도 이슈: ${staticAnalysis.complexity.length}개\n`;
    prompt += `- 보안 이슈: ${staticAnalysis.securityIssues.length}개\n`;
    prompt += `- 성능 이슈: ${staticAnalysis.performanceIssues.length}개\n`;
    prompt += `- 유지보수성 이슈: ${staticAnalysis.maintainabilityIssues.length}개\n`;
  }

  if (codeMetrics) {
    prompt += `\n**코드 품질 메트릭:**\n`;
    prompt += `- 총 라인 수: ${codeMetrics.totalLines}\n`;
    prompt += `- 함수 수: ${codeMetrics.totalFunctions}\n`;
    prompt += `- 클래스 수: ${codeMetrics.totalClasses}\n`;
    prompt += `- 주석 비율: ${codeMetrics.commentRatio.toFixed(1)}%\n`;
    prompt += `- 평균 순환 복잡도: ${codeMetrics.averageComplexity.toFixed(1)}\n`;
  }

  prompt += `
위의 개별 리뷰들을 종합하여 전체 프로젝트 요약을 제공해주세요.

**다음 JSON 형식으로 정확히 응답해주세요:**

{
  "overallScore": 75,
  "architectureScore": 80,
  "securityScore": 70,
  "performanceScore": 75,
  "maintainabilityScore": 80,
  "summary": {
    "keyEvaluation": "전체적인 코드 품질과 아키텍처 평가",
    "keyIssues": ["주요 문제점 1", "주요 문제점 2", "주요 문제점 3"],
    "improvementPriority": ["우선순위 1", "우선순위 2", "우선순위 3"]
  },
  "recommendations": {
    "immediate": [
      {
        "title": "하드코딩된 값들을 상수로 분리",
        "description": "코드 내 하드코딩된 값들을 상수로 분리하여 유지보수성을 향상시킵니다",
        "currentCode": "const timeout = 5000;",
        "improvedCode": "const TIMEOUT_CONSTANTS = { default: 5000 };"
      }
    ],
    "shortTerm": [
      {
        "title": "에러 처리 개선",
        "description": "try-catch 블록을 추가하여 예외 처리를 강화합니다",
        "currentCode": "const result = await fetch(url);",
        "improvedCode": "try { const result = await fetch(url); } catch (error) { console.error('Error:', error); }"
      }
    ],
    "longTerm": [
      {
        "title": "전체 아키텍처 재설계",
        "description": "모듈화와 의존성 주입을 통한 아키텍처 개선"
      }
    ]
  },
  "staticAnalysis": {
    "codeSmells": ${staticAnalysis ? staticAnalysis.codeSmells.length : 0},
    "securityIssues": ${staticAnalysis ? staticAnalysis.securityIssues.length : 0},
    "performanceIssues": ${staticAnalysis ? staticAnalysis.performanceIssues.length : 0},
    "maintainabilityIssues": ${staticAnalysis ? staticAnalysis.maintainabilityIssues.length : 0}
  },
  "codeMetrics": {
    "totalLines": ${codeMetrics ? codeMetrics.totalLines : 0},
    "totalFunctions": ${codeMetrics ? codeMetrics.totalFunctions : 0},
    "commentRatio": ${codeMetrics ? codeMetrics.commentRatio.toFixed(1) : 0},
    "averageComplexity": ${codeMetrics ? codeMetrics.averageComplexity.toFixed(1) : 0}
  }
}

점수는 0-100 사이의 정수로, 정적 분석 결과와 코드 메트릭을 반영하여 평가해주세요.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 경험 많은 시니어 개발자이자 아키텍트입니다. 전체 프로젝트를 분석하고 종합적인 코드리뷰를 제공하는 전문가입니다. JSON 형식으로 정확히 응답해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: MAX_TOKENS_PER_REQUEST,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content || '요약 리뷰 생성 실패';
    
    // JSON 파싱 시도
    try {
      const parsedResponse = JSON.parse(response);
      return JSON.stringify(parsedResponse, null, 2);
    } catch (parseError) {
      // JSON 파싱 실패시 기존 텍스트 형식으로 반환
      console.log('요약 JSON 파싱 실패, 텍스트 형식으로 반환:', parseError);
      return response;
    }
  } catch (error: any) {
    console.error('요약 리뷰 생성 중 오류:', error);
    
    // 토큰 제한 오류인 경우 특별 처리
    if (error.code === 'context_length_exceeded') {
      return '요약 리뷰 생성 중 토큰 제한 초과: 프로젝트가 너무 큽니다. 더 작은 배치로 나누어 분석합니다.';
    }
    
    return `요약 리뷰 생성 중 오류가 발생했습니다: ${error.message || '알 수 없는 오류'}`;
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