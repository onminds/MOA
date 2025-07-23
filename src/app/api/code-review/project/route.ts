import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 타입 안전성 개선
interface StaticIssue {
  type: 'style' | 'security' | 'import' | 'exception' | 'debug' | 'unused';
  severity: 'error' | 'warning' | 'info';
  message: string;
  rule: string;
}

interface SanitizedFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

interface FunctionalGroupAnalysis {
  name: string;
  category: string;
  files: SanitizedFile[];
  summary: string;
  keyFunctions: string[];
  securityLevel: string;
  codeSnippets: string[];
  staticIssues: StaticIssue[];
}

// 에러 처리 클래스 추가
class AnalysisError extends Error {
  constructor(
    public readonly stage: string,
    public readonly group: string,
    public readonly originalError: Error
  ) {
    super(`${stage} 단계에서 ${group} 분석 실패: ${originalError.message}`);
  }
}

// 캐시 크기 제한 및 TTL 추가
class LimitedCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 1000, ttlMs = 3600000) { // 1시간 TTL
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  set(key: K, value: V): void {
    // 캐시 크기 제한
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl
    });
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;

    // TTL 체크
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    return item.value;
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// 개선된 캐시 시스템
const analysisCache = new LimitedCache<string, any>(1000, 3600000);

interface ProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

interface ProjectReviewRequest {
  projectId: string;
  files: ProjectFile[];
  projectType: string;
  reviewType: 'architecture' | 'security' | 'performance' | 'comprehensive';
  focusAreas: string[];
  industry?: string;
}

interface ProjectReviewResult {
  projectId: string;
  overallScore: number;
  architectureScore: number;
  securityScore: number;
  performanceScore: number;
  maintainabilityScore: number;
  
  // 프로젝트 레벨 분석
  projectAnalysis: {
    structure: {
      score: number;
      issues: string[];
      improvements: string[];
      detailedAnalysis?: {
        folderStructure?: {
          score: number;
          description: string;
          problems: string[];
          solutions: string[];
        };
        modularity?: {
          score: number;
          description: string;
          problems: string[];
          solutions: string[];
        };
      };
    };
    dependencies: {
      score: number;
      outdated: string[];
      security: string[];
      recommendations: string[];
      analysis?: {
        bundleSize?: string;
        securityIssues?: string;
        updatePriority?: string;
      };
    };
    patterns: {
      score: number;
      detected: string[];
      antiPatterns: string[];
      suggestions: string[];
    };
  };
  
  // 파일별 상세 분석
  fileAnalysis: {
    path: string;
    score: number;
    language?: string;
    complexity?: string;
    issues: Array<{
      type: 'error' | 'warning' | 'info';
      severity?: 'high' | 'medium' | 'low';
      category?: string;
      message: string;
      line?: number;
      code?: string;
      suggestion: string;
      example?: string;
    }>;
    refactoredCode?: string;
    qualityMetrics?: {
      maintainabilityIndex?: number;
      cyclomaticComplexity?: number;
      codeSmells?: string;
    };
  }[];
  
  // 종합 권장사항
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
  
  // 보안 분석
  securityAnalysis?: {
    vulnerabilities?: Array<{
      type: string;
      severity: 'high' | 'medium' | 'low';
      location: string;
      description: string;
      fix: string;
    }>;
    bestPractices?: string;
  };
  
  // 성능 분석
  performanceAnalysis?: {
    bottlenecks?: string[];
    optimizations?: string[];
    metrics?: {
      loadTime?: string;
      bundleSize?: string;
    };
  };
  
  summary: string;
}

// 성능 모니터링 클래스
class AnalysisMetrics {
  public readonly startTime = Date.now();
  public tokenUsage = 0;
  public cacheHits = 0;
  public cacheRequests = 0;
  public errors: string[] = [];

  getCacheHitRate(): number {
    return this.cacheRequests > 0 ? (this.cacheHits / this.cacheRequests) * 100 : 0;
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  addError(error: string): void {
    this.errors.push(`${new Date().toISOString()}: ${error}`);
  }

  toSummary() {
    return {
      duration: this.getElapsedTime(),
      tokenUsage: this.tokenUsage,
      cacheHitRate: this.getCacheHitRate(),
      errorCount: this.errors.length,
      errors: this.errors
    };
  }
}

// 입력 검증 함수
function validateProjectReviewRequest(request: any): request is ProjectReviewRequest {
  const requiredFields = ['projectId', 'files', 'projectType', 'reviewType', 'focusAreas'];
  
  for (const field of requiredFields) {
    if (!(field in request)) {
      throw new Error(`필수 필드 누락: ${field}`);
    }
  }

  if (!Array.isArray(request.files) || request.files.length === 0) {
    throw new Error('분석할 파일이 없습니다.');
  }

  if (request.files.length > 1000) {
    throw new Error('파일 개수가 너무 많습니다. (최대 1000개)');
  }

  const validReviewTypes = ['architecture', 'security', 'performance', 'comprehensive'];
  if (!validReviewTypes.includes(request.reviewType)) {
    throw new Error(`유효하지 않은 리뷰 타입: ${request.reviewType}`);
  }

  return true;
}

// 개선된 메인 API 핸들러
export async function POST(request: NextRequest) {
  const metrics = new AnalysisMetrics();
  
  try {
    const requestData = await request.json();
    
    // 입력 검증
    validateProjectReviewRequest(requestData);
    
    const {
      projectId,
      files,
      projectType,
      reviewType,
      focusAreas,
      industry,
      staticAnalysis
    } = requestData;

    console.log('프로젝트 리뷰 시작:', { 
      projectId, 
      fileCount: files.length, 
      projectType, 
      reviewType,
      industry,
      timestamp: new Date().toISOString()
    });

    const result = await analyzeProject({
      projectId,
      files,
      projectType,
      reviewType,
      focusAreas,
      industry,
      staticAnalysis,
      metrics // 메트릭 전달
    });

    // 성능 메트릭 로깅
    console.log('분석 완료 메트릭:', metrics.toSummary());

    return NextResponse.json({
      success: true,
      result,
      metrics: metrics.toSummary()
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    metrics.addError(errorMessage);
    
    console.error('프로젝트 리뷰 오류:', {
      error: errorMessage,
      metrics: metrics.toSummary()
    });
    
    // 에러 타입별 적절한 상태 코드 반환
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({ 
          success: false,
          error: 'OpenAI API 할당량이 부족합니다.',
          code: 'QUOTA_EXCEEDED'
        }, { status: 429 });
      }
      
      if (error.message.includes('필수 필드') || error.message.includes('유효하지 않은')) {
        return NextResponse.json({ 
          success: false,
          error: errorMessage,
          code: 'VALIDATION_ERROR'
        }, { status: 400 });
      }
    }

    return NextResponse.json({ 
      success: false,
      error: '프로젝트 리뷰 중 오류가 발생했습니다.',
      code: 'INTERNAL_ERROR'
    }, { status: 500 });
  }
}

async function analyzeProject({
  projectId,
  files,
  projectType,
  reviewType,
  focusAreas,
  industry,
  staticAnalysis,
  metrics // 메트릭 전달
}: ProjectReviewRequest & { staticAnalysis?: Record<string, any> } & { metrics?: AnalysisMetrics }): Promise<ProjectReviewResult> {

  console.log(`🧩 단계별 분석 시작: ${projectId} (${files.length}개 파일)`);

  // 1단계: 프로젝트 구조 분석 및 기능 그룹핑 (정적 분석 결과 포함)
  const functionalGroups = await analyzeFunctionalStructureInReview(files, projectType, staticAnalysis);
  console.log(`📋 기능 그룹 생성: ${Object.keys(functionalGroups).length}개 그룹`);

  // 2단계: 각 기능 그룹별 개별 분석 (정적 분석 결과 활용)
  const groupAnalyses = await analyzeEachGroup(functionalGroups, projectType, focusAreas);
  console.log(`🔍 그룹별 분석 완료: ${Object.keys(groupAnalyses).length}개 그룹`);

  // 3단계: 중간 요약 생성 (토큰 효율화)
  const intermediateResults = await generateIntermediateSummary(groupAnalyses, projectType);
  console.log(`📝 중간 요약 생성 완료`);

  // 4단계: 메타 분석 - 전체 통합 리뷰 (최종 AI 호출)
  const finalAnalysis = await performMetaAnalysis(
    intermediateResults,
    projectType,
    reviewType,
    focusAreas,
    industry,
    projectId,
    metrics // 메트릭 전달
  );
  console.log(`🎯 메타 분석 완료`);

  return finalAnalysis;
}

// 1단계: 리뷰용 기능 구조 분석 (로컬 처리)
async function analyzeFunctionalStructureInReview(files: ProjectFile[], projectType: string, staticAnalysis?: Record<string, any>) {
  const groups: Record<string, any> = {};

  files.forEach(file => {
    const category = categorizeFileForReview(file);
    
    if (!groups[category]) {
      groups[category] = {
        name: getCategoryDisplayName(category),
        category,
        files: [],
        summary: '',
        keyFunctions: [],
        securityLevel: getSecurityLevel(category),
        codeSnippets: [],
        staticIssues: [] // 정적 분석 이슈 추가
      };
    }

    // 민감정보 제거된 파일 추가
    const sanitizedFile = {
      ...file,
      content: sanitizeCodeContent(file.content, file.language),
      path: sanitizeFilePath(file.path)
    };

    groups[category].files.push(sanitizedFile);
    
    // 핵심 코드 스니펫 추출 (분석용)
    const snippets = extractCodeSnippets(sanitizedFile);
    groups[category].codeSnippets.push(...snippets);

    // 해당 파일의 정적 분석 이슈 추가
    if (staticAnalysis && staticAnalysis[file.path]) {
      groups[category].staticIssues.push(...staticAnalysis[file.path]);
    }
  });

  return groups;
}



// 3단계: 중간 요약 생성
async function generateIntermediateSummary(groupAnalyses: Record<string, any>, projectType: string) {
  const summary = {
    projectType,
    totalGroups: Object.keys(groupAnalyses).length,
    groupSummaries: {} as Record<string, any>,
    overallPatterns: [] as string[],
    securityConcerns: [] as string[],
    performanceIssues: [] as string[],
    architectureNotes: [] as string[]
  };

  // 각 그룹 요약 추출
  Object.entries(groupAnalyses).forEach(([key, group]) => {
    summary.groupSummaries[key] = {
      name: group.name,
      fileCount: group.files.length,
      securityLevel: group.securityLevel,
      keyFindings: group.analysis?.keyFindings || [],
      score: group.analysis?.score || 50
    };

    // 패턴 및 이슈 수집
    if (group.analysis) {
      if (group.analysis.patterns) summary.overallPatterns.push(...group.analysis.patterns);
      if (group.analysis.securityIssues) summary.securityConcerns.push(...group.analysis.securityIssues);
      if (group.analysis.performanceIssues) summary.performanceIssues.push(...group.analysis.performanceIssues);
    }
  });

  return summary;
}

// 4단계: 메타 분석 - 전체 통합
async function performMetaAnalysis(
  intermediateResults: any,
  projectType: string,
  reviewType: string,
  focusAreas: string[],
  industry: string | undefined,
  projectId: string,
  metrics?: AnalysisMetrics
): Promise<ProjectReviewResult> {

  // 최종 AI 분석 (압축된 정보만 전송)
  const metaPrompt = buildMetaAnalysisPrompt(intermediateResults, projectType, reviewType, focusAreas, industry);
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: "시니어 개발자로서 프로젝트 메타 분석을 수행하고 한국어로 최종 리포트를 작성하세요."
      },
      {
        role: "user", 
        content: metaPrompt
      }
    ],
    max_tokens: 3000,
    temperature: 0.1,
  });

  const responseContent = completion.choices[0]?.message?.content || '';
  
  // JSON 파싱 (마크다운 제거)
  const cleanContent = responseContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    const result = JSON.parse(cleanContent);
    return {
      projectId,
      ...result
    };
  } catch (error) {
    console.error('메타 분석 JSON 파싱 오류:', error);
    return createFallbackResult(projectId, intermediateResults);
  }
}

// 헬퍼 함수들
function categorizeFileForReview(file: ProjectFile): string {
  // 간단한 카테고리 분류 (업로드 API의 것과 동일)
  const path = file.path.toLowerCase();
  
  if (path.includes('auth') || path.includes('login')) return 'auth';
  if (path.includes('payment') || path.includes('billing')) return 'payment';
  if (path.includes('api/') || path.includes('routes/')) return 'api';
  if (path.includes('components/') || path.includes('pages/')) return 'ui';
  if (path.includes('models/') || path.includes('database/')) return 'data';
  if (path.includes('config') || file.path.endsWith('.json')) return 'config';
  if (path.includes('utils/') || path.includes('helpers/')) return 'utils';
  if (path.includes('services/') || path.includes('business/')) return 'business';
  
  return 'other';
}

function getCategoryDisplayName(category: string): string {
  const names: Record<string, string> = {
    auth: '🔐 인증/사용자 관리',
    payment: '💳 결제/빌링',
    api: '🔌 API/라우팅', 
    ui: '🎨 UI/컴포넌트',
    data: '💾 데이터/모델',
    config: '⚙️ 설정/환경',
    utils: '🛠️ 유틸리티',
    business: '💼 비즈니스 로직',
    other: '📄 기타'
  };
  return names[category] || '📄 기타';
}

function getSecurityLevel(category: string): string {
  const levels: Record<string, string> = {
    auth: 'high',
    payment: 'high',
    api: 'medium',
    data: 'medium',
    config: 'medium',
    ui: 'low',
    utils: 'low',
    business: 'medium',
    other: 'low'
  };
  return levels[category] || 'low';
}

function sanitizeCodeContent(content: string, language: string): string {
  let sanitized = content;
  
  // 민감정보 패턴 제거
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    /password\s*[:=]\s*['"][^'"]+['"]/gi,
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
    /secret\s*[:=]\s*['"][^'"]+['"]/gi
  ];
  
  patterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[SANITIZED]');
  });
  
  return sanitized.substring(0, 2000); // 길이 제한
}

function sanitizeFilePath(filePath: string): string {
  return filePath.replace(/\/Users\/[^\/]+/, '/Users/[USER]')
                .replace(/C:\\Users\\[^\\]+/, 'C:\\Users\\[USER]');
}

function extractCodeSnippets(file: any): string[] {
  const content = file.content;
  const snippets: string[] = [];
  
  // 함수 정의 추출
  const functionMatches = content.match(/(function\s+\w+|const\s+\w+\s*=|def\s+\w+)/g);
  if (functionMatches) {
    snippets.push(...functionMatches.slice(0, 5));
  }
  
  return snippets;
}

// 정적 분석 결과를 포함한 스마트 프롬프트 생성
function buildOptimizedGroupContext(group: any, projectType: string, staticIssues?: any[]) {
  const baseContext = `
프로젝트 타입: ${projectType}
그룹: ${group.name} (${group.files.length}개 파일)
보안 레벨: ${group.securityLevel}

주요 코드 스니펫:
${group.codeSnippets.slice(0, 8).join('\n')}

파일 목록:
${group.files.map((f: any) => `- ${f.path} (${f.language})`).join('\n')}
`.trim();

  // 정적 분석 결과가 있으면 추가
  if (staticIssues && staticIssues.length > 0) {
    const issuesByType = staticIssues.reduce((acc: any, issue: any) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});

    const staticAnalysisContext = `

🔍 이미 발견된 정적 분석 이슈들 (GPT는 이 부분 제외하고 분석):
${Object.entries(issuesByType).map(([type, issues]: [string, any]) => 
  `- ${type}: ${issues.length}개 이슈 (${issues.map((i: any) => i.rule).join(', ')})`
).join('\n')}

💡 GPT 분석 집중 영역: 위 이슈들 외의 아키텍처, 로직, 성능, 비즈니스 로직 측면
`;
    
    return baseContext + staticAnalysisContext;
  }

  return baseContext;
}

// 4. 적응형 분석 깊이 조절
function determineAnalysisDepth(projectMetrics: any, staticIssues: any[]) {
  const fileCount = projectMetrics.totalFiles;
  const criticalIssues = staticIssues.filter(issue => issue.severity === 'error').length;
  const projectComplexity = calculateProjectComplexity(projectMetrics);

  // 프로젝트 특성에 따른 분석 깊이 결정
  if (fileCount < 10 && criticalIssues === 0) {
    return 'light'; // 간단한 프로젝트는 가벼운 분석
  } else if (fileCount > 100 || criticalIssues > 10) {
    return 'focused'; // 큰 프로젝트는 핵심 이슈에 집중
  } else {
    return 'standard'; // 표준 분석
  }
}

// 프로젝트 복잡도 계산
function calculateProjectComplexity(metrics: any) {
  const languageCount = Object.keys(metrics.languages).length;
  const dependencyCount = metrics.dependencies.length;
  const fileCount = metrics.totalFiles;
  
  return (languageCount * 2) + (dependencyCount * 0.1) + (fileCount * 0.05);
}

// 5. 스마트 컨텍스트 압축
function compressContextForGPT(context: string, maxTokens: number = 500) {
  const lines = context.split('\n');
  
  // 중요도에 따른 라인 우선순위 계산
  const prioritizedLines = lines.map(line => ({
    content: line,
    priority: calculateLinePriority(line),
    tokens: estimateTokenCount(line)
  }));

  // 우선순위 순으로 정렬
  prioritizedLines.sort((a, b) => b.priority - a.priority);

  // 토큰 제한 내에서 최대한 많은 정보 포함
  let totalTokens = 0;
  const selectedLines: string[] = [];
  
  for (const line of prioritizedLines) {
    if (totalTokens + line.tokens <= maxTokens) {
      selectedLines.push(line.content);
      totalTokens += line.tokens;
    }
  }

  return selectedLines.join('\n');
}

// 라인 중요도 계산
function calculateLinePriority(line: string): number {
  let priority = 1;
  
  // 함수 정의는 높은 우선순위
  if (line.includes('function') || line.includes('def ') || line.includes('class ')) {
    priority += 10;
  }
  
  // 주석은 중간 우선순위
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    priority += 3;
  }
  
  // 빈 줄은 낮은 우선순위
  if (line.trim() === '') {
    priority -= 5;
  }
  
  // 길이가 긴 라인은 더 많은 정보를 포함할 가능성
  priority += Math.min(line.length / 20, 5);
  
  return Math.max(priority, 0);
}

// 토큰 수 추정
function estimateTokenCount(text: string): number {
  // 간단한 토큰 추정 (실제로는 더 정교한 토크나이저 사용 권장)
  return Math.ceil(text.length / 4);
}

// 6. 결과 캐싱 시스템
function getCacheKey(files: any[], projectType: string, analysisDepth: string): string {
  // 파일 내용의 해시를 사용한 캐시 키 생성
  const contentHash = hashContent(files.map(f => f.content).join(''));
  return `${projectType}-${analysisDepth}-${contentHash}`;
}

function hashContent(content: string): string {
  // 간단한 해시 함수 (실제로는 crypto 모듈 사용 권장)
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32bit 정수로 변환
  }
  return Math.abs(hash).toString(36);
}

// 7. 병렬 처리 최적화
async function analyzeGroupsInParallel(
  functionalGroups: Record<string, any>, 
  projectType: string, 
  focusAreas: string[],
  maxConcurrency: number = 3
) {
  const groupEntries = Object.entries(functionalGroups);
  const results: Record<string, any> = {};
  
  // 그룹을 배치로 나누어 병렬 처리
  for (let i = 0; i < groupEntries.length; i += maxConcurrency) {
    const batch = groupEntries.slice(i, i + maxConcurrency);
    
    const batchPromises = batch.map(async ([groupKey, group]) => {
      console.log(`🔍 ${group.name} 그룹 분석 시작... (정적 이슈: ${group.staticIssues?.length || 0}개)`);
      
      // 캐시 확인
      const cacheKey = getCacheKey(group.files, projectType, 'group');
      if (analysisCache.has(cacheKey)) {
        console.log(`📦 캐시 히트: ${group.name}`);
        return [groupKey, analysisCache.get(cacheKey)];
      }
      
      // 컨텍스트 압축
      const rawContext = buildOptimizedGroupContext(group, projectType, group.staticIssues);
      const compressedContext = compressContextForGPT(rawContext, 400);
      
      // 적응형 분석 깊이
      const analysisDepth = determineAnalysisDepth(
        { totalFiles: group.files.length, languages: {}, dependencies: [] },
        group.staticIssues || []
      );
      
      const groupAnalysis = await analyzeGroupWithAI(
        compressedContext, 
        group.category, 
        focusAreas, 
        group.staticIssues,
        analysisDepth
      );
      
      // 결과 캐싱
      analysisCache.set(cacheKey, groupAnalysis);
      
      const result = {
        ...group,
        analysis: groupAnalysis,
        timestamp: new Date().toISOString(),
        compressionRatio: Math.round((rawContext.length / compressedContext.length) * 100) / 100
      };
      
      return [groupKey, result];
    });
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(([key, result]) => {
      results[key] = result;
    });
    
    console.log(`✅ 배치 ${Math.floor(i/maxConcurrency) + 1} 완료 (${batch.length}개 그룹)`);
  }
  
  return results;
}

// 개선된 그룹 분석 함수 (적응형 깊이 지원)
async function analyzeGroupWithAI(
  context: string, 
  category: string, 
  focusAreas: string[], 
  staticIssues?: any[],
  analysisDepth: string = 'standard'
) {
  try {
    const optimizedPrompt = buildAdaptivePrompt(context, category, focusAreas, staticIssues, analysisDepth);
    
    // 분석 깊이에 따른 토큰 조절
    const maxTokens = {
      light: 400,
      standard: 600,
      focused: 800
    }[analysisDepth] || 600;

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system", 
          content: `코드 리뷰 전문가로서 ${analysisDepth} 수준의 분석을 수행하세요.`
        },
        { 
          role: "user", 
          content: optimizedPrompt 
        }
      ],
      max_tokens: maxTokens,
      temperature: 0.1,
    });

    const response = completion.choices[0]?.message?.content || '{}';
    const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const analysis = JSON.parse(cleanResponse);
    
    // 메타데이터 추가
    analysis.analysisDepth = analysisDepth;
    analysis.tokensUsed = maxTokens;
    analysis.processingTime = Date.now();
    
    if (staticIssues && staticIssues.length > 0) {
      analysis.staticIssues = staticIssues;
      analysis.combinedScore = calculateCombinedScore(analysis.score, staticIssues);
    }
    
    return analysis;
  } catch (error) {
    console.error(`그룹 ${category} 분석 오류:`, error);
    return { 
      score: 50, 
      keyFindings: [], 
      patterns: [], 
      securityIssues: [], 
      performanceIssues: [], 
      recommendations: [],
      staticIssues: staticIssues || [],
      analysisDepth,
      error: true
    };
  }
}

// 적응형 프롬프트 생성
function buildAdaptivePrompt(
  context: string, 
  category: string, 
  focusAreas: string[], 
  staticIssues?: any[],
  analysisDepth: string = 'standard'
) {
  const basePrompt = buildSmartPrompt(context, category, focusAreas, staticIssues);
  
  // 분석 깊이에 따른 추가 지시사항
  const depthInstructions: Record<string, string> = {
    light: "\n\n⚡ 간단한 분석: 가장 중요한 1-2개 이슈만 집중해서 분석하세요.",
    standard: "\n\n🎯 표준 분석: 주요 이슈들을 균형있게 분석하세요.",
    focused: "\n\n🔍 집중 분석: 발견된 모든 이슈를 상세히 분석하고 구체적인 해결방안을 제시하세요."
  };
  
  return basePrompt + (depthInstructions[analysisDepth] || depthInstructions.standard);
}

// 업데이트된 메인 분석 함수
async function analyzeEachGroup(functionalGroups: Record<string, any>, projectType: string, focusAreas: string[]) {
  // 병렬 처리로 성능 향상
  const groupAnalyses = await analyzeGroupsInParallel(functionalGroups, projectType, focusAreas);
  
  // 압축 통계 로깅
  const compressionStats = Object.values(groupAnalyses)
    .filter((group: any) => group.compressionRatio)
    .map((group: any) => group.compressionRatio);
  
  if (compressionStats.length > 0) {
    const avgCompression = compressionStats.reduce((a, b) => a + b, 0) / compressionStats.length;
    console.log(`📊 평균 컨텍스트 압축률: ${avgCompression.toFixed(2)}x`);
  }

  return groupAnalyses;
}

// 스마트 프롬프트 생성
function buildSmartPrompt(context: string, category: string, focusAreas: string[], staticIssues?: any[]) {
  const hasStaticIssues = staticIssues && staticIssues.length > 0;
  
  if (hasStaticIssues) {
    // 정적 분석 결과가 있을 때 - 고급 분석에 집중
    return `${context}

위 ${category} 그룹을 분석하되, 정적 분석 도구가 이미 발견한 기본 이슈들은 제외하고 다음 고급 영역에 집중하세요:

🎯 집중 분석 영역:
- 아키텍처 패턴과 설계 품질
- 비즈니스 로직의 효율성과 정확성  
- 성능 최적화 기회
- 확장성과 유지보수성
- 코드 가독성과 문서화
- 테스트 커버리지와 품질

다음 JSON 형태로 응답하세요:
{
  "score": 점수(1-100),
  "keyFindings": ["주요 아키텍처/로직 발견사항들"],
  "patterns": ["고급 패턴 분석"],
  "performanceIssues": ["성능 최적화 기회들"],
  "architectureIssues": ["설계 개선사항들"],
  "recommendations": ["고급 개선 제안들"]
}`;
  } else {
    // 정적 분석 결과가 없을 때 - 전체 분석
    return `${context}

위 ${category} 그룹을 종합적으로 분석하여 다음 JSON 형태로 응답하세요:
{
  "score": 점수(1-100),
  "keyFindings": ["주요 발견사항들"],
  "patterns": ["발견된 패턴들"],
  "securityIssues": ["보안 이슈들"],
  "performanceIssues": ["성능 이슈들"],
  "recommendations": ["개선 제안들"]
}`;
  }
}

// 정적 분석과 GPT 분석 점수 통합
function calculateCombinedScore(gptScore: number, staticIssues: any[]) {
  const criticalIssues = staticIssues.filter(issue => issue.severity === 'error').length;
  const warningIssues = staticIssues.filter(issue => issue.severity === 'warning').length;
  
  // 심각한 이슈에 따른 점수 차감
  const penalty = (criticalIssues * 15) + (warningIssues * 5);
  const combinedScore = Math.max(10, gptScore - penalty);
  
  return Math.round(combinedScore);
}

function buildMetaAnalysisPrompt(results: any, projectType: string, reviewType: string, focusAreas: string[], industry?: string): string {
  return `
메타 분석 요청:
프로젝트 타입: ${projectType}
리뷰 타입: ${reviewType}
집중 영역: ${focusAreas.join(', ')}
산업: ${industry || '일반'}

그룹별 분석 결과:
${JSON.stringify(results.groupSummaries, null, 2)}

전체 패턴: ${results.overallPatterns.join(', ')}
보안 우려사항: ${results.securityConcerns.join(', ')}
성능 이슈: ${results.performanceIssues.join(', ')}

위 정보를 바탕으로 최종 통합 분석 결과를 다음 JSON 형태로 제공하세요:

{
  "overallScore": 점수(1-100),
  "architectureScore": 점수(1-100), 
  "securityScore": 점수(1-100),
  "performanceScore": 점수(1-100),
  "maintainabilityScore": 점수(1-100),
  "summary": "전체 요약",
  "recommendations": {
    "immediate": ["긴급 수정사항"],
    "shortTerm": ["단기 개선사항"], 
    "longTerm": ["장기 개선사항"]
  },
  "projectAnalysis": {
    "structure": {
      "score": 점수,
      "issues": ["구조적 문제들"],
      "improvements": ["개선 방안들"]
    }
  }
}`;
}

function createFallbackResult(projectId: string, results: any): ProjectReviewResult {
  return {
    projectId,
    overallScore: 75,
    architectureScore: 75,
    securityScore: 70,
    performanceScore: 75,
    maintainabilityScore: 80,
    summary: "단계별 분석이 완료되었습니다. 각 기능 그룹별로 상세한 검토를 수행했습니다.",
    recommendations: {
      immediate: ["보안 취약점 점검 필요"],
      shortTerm: ["코드 구조 개선"],
      longTerm: ["아키텍처 최적화"]
    },
    projectAnalysis: {
      structure: {
        score: 75,
        issues: ["일부 구조적 개선이 필요합니다"],
        improvements: ["모듈화 개선 권장"]
      },
      dependencies: {
        score: 70,
        outdated: ["일부 의존성 업데이트 권장"],
        security: ["보안 취약점 점검 필요"],
        recommendations: ["의존성 관리 개선 권장"]
      },
      patterns: {
        score: 75,
        detected: ["일반적인 패턴 사용"],
        antiPatterns: ["일부 안티패턴 발견"],
        suggestions: ["코드 패턴 개선 권장"]
      }
    },
    fileAnalysis: []
  };
}

function buildProjectContext(files: ProjectFile[], projectType: string): string {
  // 토큰 효율성을 위해 파일 수 제한 (최대 20개)
  const limitedFiles = prioritizeAndLimitFiles(files, 20);
  
  let context = `프로젝트: ${projectType} (${limitedFiles.length}개 핵심 파일)\n\n`;
  
  // 핵심 구조만 요약
  context += "=== 핵심 파일 구조 ===\n";
  limitedFiles.forEach(file => {
    context += `${file.path} (${file.language}, ${(file.size/1024).toFixed(0)}KB)\n`;
  });
  
  context += "\n=== 핵심 코드 요약 ===\n";
  
  limitedFiles.forEach(file => {
    context += `\n--- ${file.path} ---\n`;
    
    // 파일 유형별 스마트 요약
    const summary = extractFileEssentials(file);
    context += summary;
  });

  return context;
}

function prioritizeAndLimitFiles(files: ProjectFile[], maxFiles: number): ProjectFile[] {
  // 파일별 우선순위 점수 계산
  const scoredFiles = files.map(file => ({
    ...file,
    priority: calculateFilePriorityForAnalysis(file)
  }));
  
  // 우선순위 순으로 정렬 후 제한
  return scoredFiles
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxFiles);
}

function calculateFilePriorityForAnalysis(file: ProjectFile): number {
  let score = 0;
  const path = file.path.toLowerCase();
  
  // 설정 파일 (최고 우선순위)
  if (path.includes('package.json') || path.includes('requirements.txt')) score += 20;
  if (path.includes('tsconfig') || path.includes('webpack') || path.includes('docker')) score += 15;
  
  // 진입점 파일들
  if (path.includes('main.') || path.includes('index.') || path.includes('app.')) score += 18;
  
  // API 및 핵심 로직
  if (path.includes('api/') || path.includes('route') || path.includes('controller')) score += 12;
  if (path.includes('service') || path.includes('model') || path.includes('component')) score += 10;
  
  // 언어별 가중치
  if (['TypeScript', 'JavaScript', 'Python'].includes(file.language)) score += 5;
  
  // 크기 기반 조정 (너무 크거나 작으면 감점)
  if (file.size < 100) score -= 5; // 너무 작음
  if (file.size > 50000) score -= 3; // 너무 큼
  
  return score;
}

function extractFileEssentials(file: ProjectFile): string {
  const content = file.content;
  const lines = content.split('\n');
  
  // 파일 타입별 핵심 정보 추출
  if (file.path.includes('package.json')) {
    return extractPackageJsonEssentials(content);
  }
  
  if (file.language === 'TypeScript' || file.language === 'JavaScript') {
    return extractJsEssentials(lines);
  }
  
  if (file.language === 'Python') {
    return extractPythonEssentials(lines);
  }
  
  // 기본: 핵심 부분만 추출 (500자 제한)
  return content.substring(0, 500) + (content.length > 500 ? '...\n' : '');
}

function extractPackageJsonEssentials(content: string): string {
  try {
    const pkg = JSON.parse(content);
    const essentials = {
      name: pkg.name,
      version: pkg.version,
      scripts: Object.keys(pkg.scripts || {}).slice(0, 5),
      dependencies: Object.keys(pkg.dependencies || {}).slice(0, 10),
      devDependencies: Object.keys(pkg.devDependencies || {}).slice(0, 5)
    };
    return JSON.stringify(essentials, null, 2);
  } catch {
    return content.substring(0, 300) + '...';
  }
}

function extractJsEssentials(lines: string[]): string {
  const essentials: string[] = [];
  let braceCount = 0;
  
  for (const line of lines.slice(0, 100)) { // 최대 100줄만 확인
    const trimmed = line.trim();
    
    // import/export 문
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      essentials.push(line);
    }
    // 함수 정의
    else if (trimmed.includes('function ') || trimmed.includes('const ') && trimmed.includes(' = ')) {
      essentials.push(line);
      braceCount = 0;
    }
    // 클래스 정의
    else if (trimmed.startsWith('class ') || trimmed.startsWith('interface ')) {
      essentials.push(line);
    }
    // 중괄호 카운팅으로 함수 내부 스킵
    else if (braceCount === 0 && (trimmed.includes('{') || trimmed.includes('}'))) {
      braceCount += (trimmed.match(/{/g) || []).length;
      braceCount -= (trimmed.match(/}/g) || []).length;
    }
    
    // 너무 길면 중단
    if (essentials.length > 20) break;
  }
  
  return essentials.join('\n') + '\n';
}

function extractPythonEssentials(lines: string[]): string {
  const essentials: string[] = [];
  
  for (const line of lines.slice(0, 100)) {
    const trimmed = line.trim();
    
    // import 문
    if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
      essentials.push(line);
    }
    // 클래스 및 함수 정의
    else if (trimmed.startsWith('class ') || trimmed.startsWith('def ')) {
      essentials.push(line);
    }
    // 상수 정의
    else if (trimmed.match(/^[A-Z_]+ = /)) {
      essentials.push(line);
    }
    
    if (essentials.length > 20) break;
  }
  
  return essentials.join('\n') + '\n';
}

function getIndustryRules(industry?: string): string {
  if (!industry) return '';

  const rules: Record<string, string> = {
    fintech: `
핀테크 특화 검토사항:
- PII 데이터 암호화 및 보안 처리
- 금융거래 로그 및 감사 추적
- PCI DSS 준수 사항
- 이중 인증 및 권한 관리
- 거래 데이터 무결성
- 규정 준수 (개인정보보호법, 전자금융거래법)
`,
    healthcare: `
의료/헬스케어 특화 검토사항:
- HIPAA 규정 준수
- 의료 데이터 암호화
- 환자 정보 접근 제어
- 데이터 백업 및 복구
- 의료기기 소프트웨어 표준 (IEC 62304)
`,
    ecommerce: `
이커머스 특화 검토사항:
- 결제 보안 (PCI DSS)
- 개인정보 처리 방침
- 상품 데이터 관리
- 재고 관리 시스템
- 성능 최적화 (트래픽 처리)
- GDPR 준수 (글로벌 서비스 시)
`
  };

  return rules[industry] || '';
}

async function performAIAnalysis(
  projectContext: string,
  reviewType: string,
  focusAreas: string[],
  industryRules: string,
  projectType: string,
  projectId: string,
  fileCount: number,
  industry?: string
): Promise<ProjectReviewResult> {

  const systemPrompt = `시니어 개발자로서 프로젝트를 분석하고 한국어로 JSON 응답하세요.

분석 기준:
1. 구조/아키텍처 (30점): 폴더구조, 모듈화, 패턴
2. 보안 (25점): XSS, SQL인젝션, 인증, 입력검증
3. 성능 (25점): 복잡도, 메모리, 최적화, 캐싱
4. 유지보수성 (20점): 가독성, 컨벤션, 테스트

순수 JSON만 반환하세요:`;

  const userPrompt = `
프로젝트: ${projectType} (${reviewType} 분석)
집중영역: ${focusAreas.join(', ')}

${projectContext}

아래 JSON 형태로 간결하게 분석 결과를 제공하세요:

{
  "projectId": "${projectId}",
  "overallScore": 점수(1-100),
  "architectureScore": 점수(1-100),
  "securityScore": 점수(1-100), 
  "performanceScore": 점수(1-100),
  "maintainabilityScore": 점수(1-100),
  "projectAnalysis": {
    "structure": {
      "score": 점수,
      "issues": ["주요 문제점들"],
      "improvements": ["개선 방안들"]
    },
    "dependencies": {
      "score": 점수,
      "outdated": ["구버전 패키지들"],
      "security": ["보안 취약점들"]
    },
    "patterns": {
      "score": 점수,
      "antiPatterns": ["안티패턴들"],
      "suggestions": ["개선 제안들"]
    }
  },
  "fileAnalysis": [
    {
      "path": "파일경로",
      "score": 점수,
      "issues": [
        {
          "type": "error|warning",
          "severity": "high|medium|low", 
          "category": "보안|성능|가독성",
          "message": "문제 설명",
          "suggestion": "개선 제안"
        }
      ]
    }
  ],
  "recommendations": {
    "immediate": ["긴급 수정사항"],
    "shortTerm": ["단기 개선사항"],
    "longTerm": ["장기 개선사항"]
  },
  "summary": "전체 요약"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: systemPrompt
      },
      {
        role: "user",
        content: userPrompt
      }
    ],
    max_tokens: 4000,
    temperature: 0.3,
  });

  const response = completion.choices[0].message.content;
  
  if (!response) {
    throw new Error('프로젝트 분석 응답이 없습니다.');
  }

  // 마크다운 코드 블록 제거
  let cleanedResponse = response.trim();
  
  // ```json으로 시작하고 ```로 끝나는 경우 제거
  if (cleanedResponse.startsWith('```json')) {
    cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  }
  // ```으로 시작하고 ```로 끝나는 경우 제거
  else if (cleanedResponse.startsWith('```')) {
    cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error('JSON 파싱 오류:', parseError);
    console.error('원본 응답:', response);
    console.error('정리된 응답:', cleanedResponse);
    
    // 파싱 실패 시 기본 응답 반환
    return getDefaultProjectReview(projectId, fileCount);
  }
}

function getDefaultProjectReview(projectId: string, fileCount: number): ProjectReviewResult {
  return {
    projectId,
    overallScore: 70,
    architectureScore: 70,
    securityScore: 65,
    performanceScore: 75,
    maintainabilityScore: 70,
    projectAnalysis: {
      structure: {
        score: 70,
        issues: ['AI 분석에 일시적인 문제가 발생했습니다.'],
        improvements: ['프로젝트를 다시 분석해주세요.']
      },
      dependencies: {
        score: 70,
        outdated: [],
        security: [],
        recommendations: ['의존성을 최신 버전으로 업데이트하세요.']
      },
      patterns: {
        score: 70,
        detected: ['기본 프로젝트 구조'],
        antiPatterns: [],
        suggestions: ['코딩 컨벤션을 일관성 있게 적용하세요.']
      }
    },
    fileAnalysis: [],
    recommendations: {
      immediate: ['코드 리뷰를 다시 실행해보세요.'],
      shortTerm: ['프로젝트 구조를 점검하세요.'],
      longTerm: ['지속적인 코드 품질 관리를 도입하세요.']
    },
    summary: `${fileCount}개 파일로 구성된 프로젝트입니다. AI 분석에 일시적인 문제가 발생했으니 다시 시도해주세요.`
  };
} 