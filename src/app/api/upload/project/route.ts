import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import yauzl from 'yauzl';
import { promisify } from 'util';
// TODO: 향후 실제 ESLint 연동 예정
// import { ESLint } from 'eslint';

// API Route 설정
export const maxDuration = 60; // 60초

// 허용되는 파일 확장자
const ALLOWED_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx', '.vue', '.py', '.java', '.cpp', '.c', '.h',
  '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.dart',
  '.json', '.yaml', '.yml', '.xml', '.sql', '.md', '.txt'
];

// 무시할 디렉토리/파일
const IGNORE_PATTERNS = [
  'node_modules', '.git', '.next', 'dist', 'build', '.vscode', '.idea',
  'coverage', '.nyc_output', 'logs', '*.log', '.DS_Store', 'Thumbs.db'
];

interface ProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

interface FunctionalGroup {
  name: string;
  category: 'auth' | 'api' | 'ui' | 'data' | 'config' | 'utils' | 'business' | 'payment' | 'other';
  files: ProjectFile[];
  summary: string;
  keyFunctions: string[];
  securityLevel: 'low' | 'medium' | 'high';
}

interface ProjectStructure {
  id: string;
  name: string;
  type: string; // 감지된 프로젝트 타입
  originalType?: string; // 사용자가 선택한 원래 타입
  files: ProjectFile[];
  structure: any;
  functionalGroups?: Record<string, FunctionalGroup>; // 기능별 그룹
  staticAnalysis?: Record<string, any>; // 정적 분석 결과
  metadata: {
    totalFiles: number;
    totalSize: number;
    languages: Record<string, number>;
    dependencies: string[];
    groupCount?: number;
    staticIssueCount?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectType = formData.get('projectType') as string;
    const analysisDepth = formData.get('analysisDepth') as string || 'surface';

    if (!file) {
      return NextResponse.json(
        { success: false, error: '파일을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (500MB)
    if (file.size > 500 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '파일 크기는 500MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 세션 ID 생성 및 WebSocket 진행률 관리 시작
    const sessionId = Math.random().toString(36).substring(2, 15);
    const { progressManager } = await import('@/lib/websocket-manager');
    
    console.log('프로젝트 업로드 시작:', { 
      sessionId,
      name: file.name, 
      size: file.size, 
      type: file.type,
      projectType,
      analysisDepth 
    });

    const projectId = randomUUID();
    const tempDir = path.join(process.cwd(), 'temp', projectId);
    
    // 진행률 세션 시작 (예상 파일 수는 나중에 업데이트)
    progressManager.startSession(sessionId, projectId, 100);
    
    // 임시 디렉토리 생성
    await fs.promises.mkdir(tempDir, { recursive: true });

    try {
      // 🔄 1단계: 파일 저장
      progressManager.startStage(sessionId, 'extract', { 
        fileName: file.name, 
        fileSize: file.size 
      });
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const zipPath = path.join(tempDir, file.name);
      await fs.promises.writeFile(zipPath, buffer);
      
      progressManager.updateStageProgress(sessionId, 'extract', 50, '파일 업로드 완료');

      // ZIP 파일 추출
      const extractPath = path.join(tempDir, 'extracted');
      await fs.promises.mkdir(extractPath, { recursive: true });
      
      progressManager.updateStageProgress(sessionId, 'extract', 75, 'ZIP 파일 추출 중...');
      await extractZipFile(zipPath, extractPath);
      progressManager.completeStage(sessionId, 'extract', { extractPath });

      // 🔄 2단계: 프로젝트 구조 분석
      progressManager.startStage(sessionId, 'structure_analysis', { extractPath });
      const projectStructure = await analyzeProject(extractPath, projectId, projectType, analysisDepth, sessionId);
      progressManager.completeStage(sessionId, 'structure_analysis', { 
        totalFiles: projectStructure.metadata.totalFiles,
        languages: Object.keys(projectStructure.metadata.languages)
      });

      // 임시 파일 정리
      await cleanupTempFiles(tempDir);

      // 🎉 분석 완료 알림
      progressManager.completeSession(sessionId, {
        totalFiles: projectStructure.metadata.totalFiles,
        totalGroups: projectStructure.metadata.groupCount,
        totalIssues: projectStructure.metadata.staticIssueCount,
        projectType: projectStructure.type
      });

      return NextResponse.json({
        success: true,
        sessionId, // 실시간 진행률을 위한 세션 ID
        project: projectStructure
      });

    } catch (extractError) {
      // 정리
      await cleanupTempFiles(tempDir);
      throw extractError;
    }

  } catch (error) {
    console.error('프로젝트 업로드 오류:', error);
    
    return NextResponse.json({ 
      success: false,
      error: '프로젝트 업로드 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

async function extractZipFile(zipPath: string, extractPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      if (!zipfile) {
        reject(new Error('ZIP 파일을 열 수 없습니다.'));
        return;
      }

      zipfile.readEntry();

      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName)) {
          // 디렉토리인 경우
          const dirPath = path.join(extractPath, entry.fileName);
          fs.promises.mkdir(dirPath, { recursive: true }).then(() => {
            zipfile.readEntry();
          }).catch(reject);
        } else {
          // 파일인 경우
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }

            if (!readStream) {
              zipfile.readEntry();
              return;
            }

            const filePath = path.join(extractPath, entry.fileName);
            const fileDir = path.dirname(filePath);
            
            fs.promises.mkdir(fileDir, { recursive: true }).then(() => {
              const writeStream = fs.createWriteStream(filePath);
              readStream.pipe(writeStream);
              
              writeStream.on('close', () => {
                zipfile.readEntry();
              });
              
              writeStream.on('error', reject);
            }).catch(reject);
          });
        }
      });

      zipfile.on('end', () => {
        resolve();
      });

      zipfile.on('error', reject);
    });
  });
}

async function analyzeProject(
  extractPath: string, 
  projectId: string,
  projectType: string,
  analysisDepth: string,
  sessionId?: string
): Promise<ProjectStructure> {
  const files: ProjectFile[] = [];
  const languages: Record<string, number> = {};
  let totalSize = 0;

  // 재귀적으로 파일 탐색
  async function scanDirectory(dirPath: string, relativePath = '') {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativeFilePath = path.join(relativePath, entry.name).replace(/\\/g, '/');

      // 무시할 패턴 체크
      if (shouldIgnore(entry.name, relativeFilePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        // 디렉토리인 경우 재귀 탐색
        await scanDirectory(fullPath, relativeFilePath);
      } else if (entry.isFile()) {
        // 파일인 경우 분석
        const ext = path.extname(entry.name).toLowerCase();
        
        if (ALLOWED_EXTENSIONS.includes(ext)) {
          try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const language = detectLanguage(ext, content);
            const size = content.length;

            // 분석 깊이에 따라 파일 포함 여부 결정
            if (shouldIncludeFile(relativeFilePath, language, size, analysisDepth)) {
              files.push({
                path: relativeFilePath,
                content,
                language,
                size
              });

              languages[language] = (languages[language] || 0) + 1;
              totalSize += size;
            }
          } catch (error) {
            console.warn(`파일 읽기 실패: ${relativeFilePath}`, error);
          }
        }
      }
    }
  }

  await scanDirectory(extractPath);

  // 프로젝트 타입 감지
  const detectedProjectType = detectProjectType(files);
  console.log(`감지된 프로젝트 타입: ${detectedProjectType} (${files.length}개 파일 분석)`);

  // 프로젝트 구조 생성
  const structure = buildProjectStructure(files);
  
  // 의존성 분석 (감지된 타입 사용)
  const dependencies = extractDependencies(files, detectedProjectType);

  // 🔍 정적 분석 수행 (GPT 분석 전 사전 필터링)
  // 🔄 3단계: 정적 분석 (sessionId가 있을 때만)
  if (sessionId) {
    const { progressManager } = await import('@/lib/websocket-manager');
    progressManager.startStage(sessionId, 'static_analysis', { totalFiles: files.length });
  }
  
  const staticAnalysisResults = await performStaticAnalysis(files, detectedProjectType);
  console.log(`🔍 정적 분석 완료: ${Object.keys(staticAnalysisResults).length}개 파일에서 이슈 발견`);

  if (sessionId) {
    const { progressManager } = await import('@/lib/websocket-manager');
    progressManager.completeStage(sessionId, 'static_analysis', { 
      issueCount: Object.values(staticAnalysisResults).flat().length 
    });
  }

  // 🔄 4단계: 기능별 그룹핑 수행
  if (sessionId) {
    const { progressManager } = await import('@/lib/websocket-manager');
    progressManager.startStage(sessionId, 'grouping', {});
  }
  
  const functionalGroups = analyzeFunctionalStructure(files, detectedProjectType);
  
  // 🔄 5단계: 민감정보 제거 및 익명화
  if (sessionId) {
    const { progressManager } = await import('@/lib/websocket-manager');
    progressManager.startStage(sessionId, 'sanitization', { 
      groupCount: Object.keys(functionalGroups).length 
    });
  }
  
  const sanitizedGroups = sanitizeCodeGroups(functionalGroups);

  if (sessionId) {
    const { progressManager } = await import('@/lib/websocket-manager');
    progressManager.completeStage(sessionId, 'sanitization', { 
      sanitizedGroups: Object.keys(sanitizedGroups).length 
    });
  }

  return {
    id: projectId,
    name: path.basename(extractPath),
    type: detectedProjectType, // 감지된 프로젝트 타입
    originalType: projectType, // 사용자가 원래 선택한 타입 보존
    files,
    structure,
    functionalGroups: sanitizedGroups, // 기능별 그룹
    staticAnalysis: staticAnalysisResults, // 🔍 정적 분석 결과 추가
    metadata: {
      totalFiles: files.length,
      totalSize,
      languages,
      dependencies,
      groupCount: Object.keys(functionalGroups).length,
      staticIssueCount: Object.values(staticAnalysisResults).flat().length
    }
  };
}

function shouldIgnore(name: string, relativePath: string): boolean {
  return IGNORE_PATTERNS.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(name);
    }
    return name === pattern || relativePath.includes(pattern);
  });
}

function detectLanguage(extension: string, content: string): string {
  const langMap: Record<string, string> = {
    '.js': 'JavaScript',
    '.jsx': 'React JSX',
    '.ts': 'TypeScript',
    '.tsx': 'React TSX',
    '.vue': 'Vue.js',
    '.py': 'Python',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.h': 'C Header',
    '.cs': 'C#',
    '.php': 'PHP',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
    '.scala': 'Scala',
    '.dart': 'Dart',
    '.json': 'JSON',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.xml': 'XML',
    '.sql': 'SQL',
    '.md': 'Markdown'
  };

  return langMap[extension] || 'Unknown';
}

function detectProjectType(files: ProjectFile[]): string {
  // 파일 확장자별 카운트
  const extensionCount: Record<string, number> = {};
  const configFiles: string[] = [];
  
  files.forEach(file => {
    const ext = path.extname(file.path).toLowerCase();
    extensionCount[ext] = (extensionCount[ext] || 0) + 1;
    
    // 설정 파일 수집
    const fileName = path.basename(file.path).toLowerCase();
    if (['package.json', 'requirements.txt', 'pom.xml', 'build.gradle', 
         'composer.json', 'cargo.toml', 'go.mod', 'pubspec.yaml'].includes(fileName)) {
      configFiles.push(fileName);
    }
  });
  
  // 설정 파일 기반 우선 판단
  if (configFiles.includes('package.json')) {
    // React/Vue 프로젝트 세부 구분
    const hasReactFiles = files.some(f => 
      f.path.includes('.jsx') || f.path.includes('.tsx') || 
      f.content.includes('react') || f.content.includes('React')
    );
    const hasVueFiles = files.some(f => f.path.includes('.vue'));
    const hasNextFiles = files.some(f => 
      f.path.includes('next.config') || f.content.includes('next')
    );
    
    if (hasNextFiles) return 'next';
    if (hasReactFiles) return 'react';
    if (hasVueFiles) return 'vue';
    return 'node';
  }
  
  if (configFiles.includes('requirements.txt') || configFiles.includes('setup.py')) {
    // Django/Flask 등 세부 구분
    const hasDjangoFiles = files.some(f => 
      f.content.includes('django') || f.path.includes('settings.py')
    );
    const hasFlaskFiles = files.some(f => 
      f.content.includes('flask') || f.content.includes('Flask')
    );
    
    if (hasDjangoFiles) return 'django';
    if (hasFlaskFiles) return 'flask';
    return 'python';
  }
  
  if (configFiles.includes('pom.xml') || configFiles.includes('build.gradle')) {
    const hasSpringFiles = files.some(f => 
      f.content.includes('springframework') || f.path.includes('Application.java')
    );
    return hasSpringFiles ? 'spring' : 'java';
  }
  
  if (configFiles.includes('composer.json')) return 'php';
  if (configFiles.includes('cargo.toml')) return 'rust';
  if (configFiles.includes('go.mod')) return 'go';
  if (configFiles.includes('pubspec.yaml')) return 'flutter';
  
  // 파일 확장자 기반 판단
  const jsCount = (extensionCount['.js'] || 0) + (extensionCount['.jsx'] || 0);
  const tsCount = (extensionCount['.ts'] || 0) + (extensionCount['.tsx'] || 0);
  const pyCount = extensionCount['.py'] || 0;
  const javaCount = extensionCount['.java'] || 0;
  const phpCount = extensionCount['.php'] || 0;
  const cppCount = (extensionCount['.cpp'] || 0) + (extensionCount['.cc'] || 0);
  const cCount = extensionCount['.c'] || 0;
  const csCount = extensionCount['.cs'] || 0;
  
  // 가장 많은 파일 확장자로 판단
  const counts = [
    { type: 'typescript', count: tsCount },
    { type: 'javascript', count: jsCount },
    { type: 'python', count: pyCount },
    { type: 'java', count: javaCount },
    { type: 'php', count: phpCount },
    { type: 'cpp', count: cppCount },
    { type: 'c', count: cCount },
    { type: 'csharp', count: csCount }
  ];
  
  const maxCount = counts.reduce((max, current) => 
    current.count > max.count ? current : max
  );
  
  return maxCount.count > 0 ? maxCount.type : 'unknown';
}

function shouldIncludeFile(
  filePath: string, 
  language: string, 
  size: number, 
  analysisDepth: string
): boolean {
  // 너무 큰 파일 제외 (2MB 이상)
  if (size > 2 * 1024 * 1024) return false;

  // 파일 우선순위 점수 계산
  const priority = calculateFilePriority(filePath, language, size);
  
  // 분석 깊이에 따른 필터링 (더 엄격하게)
  switch (analysisDepth) {
    case 'surface':
      // 핵심 파일만 (최대 15개, 고우선순위)
      return priority >= 8 && size < 20000;
    case 'deep':
      // 중요 파일들 (최대 25개, 중간우선순위 이상)
      return priority >= 6 && size < 50000;
    case 'comprehensive':
      // 전체 파일 (최대 40개, 기본우선순위 이상)
      return priority >= 4 && size < 100000;
    default:
      return priority >= 6;
  }
}

function calculateFilePriority(filePath: string, language: string, size: number): number {
  let priority = 0;
  const fileName = filePath.toLowerCase();
  
  // 핵심 설정 파일들 (최고 우선순위)
  if (fileName.includes('package.json') || fileName.includes('requirements.txt') ||
      fileName.includes('pom.xml') || fileName.includes('build.gradle') ||
      fileName.includes('composer.json') || fileName.includes('cargo.toml')) {
    priority += 10;
  }
  
  // 메인 진입점 파일들 (높은 우선순위)
  if (fileName.includes('main.') || fileName.includes('index.') || 
      fileName.includes('app.') || fileName.includes('server.') ||
      fileName.includes('__init__.py') || fileName.endsWith('app.py')) {
    priority += 8;
  }
  
  // 설정 파일들 (높은 우선순위)
  if (fileName.includes('config') || fileName.includes('.env') ||
      fileName.includes('docker') || fileName.includes('webpack') ||
      fileName.includes('tsconfig') || fileName.includes('babel')) {
    priority += 7;
  }
  
  // API/라우터 파일들 (중간-높은 우선순위)
  if (fileName.includes('api/') || fileName.includes('routes/') ||
      fileName.includes('controller') || fileName.includes('handler')) {
    priority += 6;
  }
  
  // 핵심 비즈니스 로직 (중간 우선순위)
  if (fileName.includes('service') || fileName.includes('model') ||
      fileName.includes('util') || fileName.includes('component')) {
    priority += 5;
  }
  
  // 언어별 보너스
  if (['JavaScript', 'TypeScript', 'Python', 'Java', 'React JSX', 'React TSX'].includes(language)) {
    priority += 2;
  }
  
  // 크기 패널티 (큰 파일일수록 우선순위 감소)
  if (size > 50000) priority -= 2;
  if (size > 20000) priority -= 1;
  
  // 테스트 파일은 낮은 우선순위
  if (fileName.includes('test') || fileName.includes('spec') || 
      fileName.includes('__pycache__') || fileName.includes('.min.')) {
    priority -= 3;
  }
  
  return Math.max(0, priority);
}

function buildProjectStructure(files: ProjectFile[]) {
  const structure: any = {};

  files.forEach(file => {
    const parts = file.path.split('/');
    let current = structure;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        // 파일인 경우
        current[part] = {
          type: 'file',
          language: file.language,
          size: file.size
        };
      } else {
        // 디렉토리인 경우
        if (!current[part]) {
          current[part] = { type: 'directory', children: {} };
        }
        current = current[part].children;
      }
    });
  });

  return structure;
}

function extractDependencies(files: ProjectFile[], projectType: string): string[] {
  const dependencies: Set<string> = new Set();

  files.forEach(file => {
    if (file.path === 'package.json' && (projectType === 'react' || projectType === 'node')) {
      try {
        const packageJson = JSON.parse(file.content);
        if (packageJson.dependencies) {
          Object.keys(packageJson.dependencies).forEach(dep => dependencies.add(dep));
        }
        if (packageJson.devDependencies) {
          Object.keys(packageJson.devDependencies).forEach(dep => dependencies.add(dep));
        }
      } catch (error) {
        console.warn('package.json 파싱 실패:', error);
      }
    } else if (file.path === 'requirements.txt' && projectType === 'python') {
      const deps = file.content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('==')[0].split('>=')[0].split('<=')[0]);
      deps.forEach(dep => dependencies.add(dep));
    }
  });

  return Array.from(dependencies);
}

// 프로젝트를 기능별로 그룹핑하는 함수
function analyzeFunctionalStructure(files: ProjectFile[], projectType: string): Record<string, FunctionalGroup> {
  const groups: Record<string, FunctionalGroup> = {};

  files.forEach(file => {
    const category = categorizeFile(file);
    const groupKey = category;

    if (!groups[groupKey]) {
      groups[groupKey] = {
        name: getCategoryDisplayName(category),
        category,
        files: [],
        summary: '',
        keyFunctions: [],
        securityLevel: getSecurityLevel(category)
      };
    }

    groups[groupKey].files.push(file);
  });

  // 각 그룹별 요약 생성
  Object.keys(groups).forEach(key => {
    const group = groups[key];
    group.summary = generateGroupSummary(group);
    group.keyFunctions = extractKeyFunctions(group.files);
  });

  return groups;
}

// 파일을 카테고리별로 분류
function categorizeFile(file: ProjectFile): FunctionalGroup['category'] {
  const path = file.path.toLowerCase();
  const content = file.content.toLowerCase();

  // 인증 관련
  if (path.includes('auth') || path.includes('login') || path.includes('user') || 
      content.includes('authentication') || content.includes('passport') || content.includes('jwt')) {
    return 'auth';
  }

  // 결제 관련
  if (path.includes('payment') || path.includes('billing') || path.includes('stripe') ||
      content.includes('payment') || content.includes('checkout') || content.includes('billing')) {
    return 'payment';
  }

  // API 관련
  if (path.includes('api/') || path.includes('routes/') || path.includes('controllers/') ||
      path.includes('endpoints') || content.includes('router') || content.includes('express')) {
    return 'api';
  }

  // UI 관련
  if (path.includes('components/') || path.includes('pages/') || path.includes('views/') ||
      path.includes('.tsx') || path.includes('.jsx') || path.includes('.vue')) {
    return 'ui';
  }

  // 데이터 관련
  if (path.includes('models/') || path.includes('database/') || path.includes('migrations/') ||
      path.includes('schema') || content.includes('mongoose') || content.includes('sequelize')) {
    return 'data';
  }

  // 설정 관련
  if (path.includes('config') || path.includes('.env') || path.includes('settings') ||
      file.path.endsWith('.json') || file.path.endsWith('.yaml') || file.path.endsWith('.yml')) {
    return 'config';
  }

  // 유틸리티 관련
  if (path.includes('utils/') || path.includes('helpers/') || path.includes('lib/') ||
      path.includes('common/') || path.includes('shared/')) {
    return 'utils';
  }

  // 비즈니스 로직
  if (path.includes('services/') || path.includes('business/') || path.includes('core/') ||
      content.includes('business') || content.includes('logic')) {
    return 'business';
  }

  return 'other';
}

// 카테고리 표시명 반환
function getCategoryDisplayName(category: FunctionalGroup['category']): string {
  const names = {
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
  return names[category];
}

// 보안 레벨 결정
function getSecurityLevel(category: FunctionalGroup['category']): 'low' | 'medium' | 'high' {
  const securityLevels = {
    auth: 'high' as const,
    payment: 'high' as const,
    api: 'medium' as const,
    data: 'medium' as const,
    config: 'medium' as const,
    ui: 'low' as const,
    utils: 'low' as const,
    business: 'medium' as const,
    other: 'low' as const
  };
  return securityLevels[category];
}

// 그룹 요약 생성
function generateGroupSummary(group: FunctionalGroup): string {
  const fileCount = group.files.length;
  const totalSize = group.files.reduce((sum, file) => sum + file.size, 0);
  const languages = [...new Set(group.files.map(f => f.language))];

  return `${fileCount}개 파일, ${Math.round(totalSize/1024)}KB, 언어: ${languages.join(', ')}`;
}

// 핵심 함수 추출
function extractKeyFunctions(files: ProjectFile[]): string[] {
  const functions: Set<string> = new Set();

  files.forEach(file => {
    const content = file.content;
    
    // JavaScript/TypeScript 함수 추출
    const jsFunctions = content.match(/(?:function\s+|const\s+|let\s+|var\s+)(\w+)/g);
    if (jsFunctions) {
      jsFunctions.forEach(fn => {
        const match = fn.match(/(\w+)$/);
        if (match) functions.add(match[1]);
      });
    }

    // Python 함수 추출
    const pyFunctions = content.match(/def\s+(\w+)/g);
    if (pyFunctions) {
      pyFunctions.forEach(fn => {
        const match = fn.match(/def\s+(\w+)/);
        if (match) functions.add(match[1]);
      });
    }

    // Java 메소드 추출
    const javaMethods = content.match(/public\s+\w+\s+(\w+)\s*\(/g);
    if (javaMethods) {
      javaMethods.forEach(method => {
        const match = method.match(/public\s+\w+\s+(\w+)\s*\(/);
        if (match) functions.add(match[1]);
      });
    }
  });

  return Array.from(functions).slice(0, 10); // 최대 10개만
}

// 민감정보 제거 및 익명화
function sanitizeCodeGroups(groups: Record<string, FunctionalGroup>): Record<string, FunctionalGroup> {
  const sanitizedGroups: Record<string, FunctionalGroup> = {};

  Object.keys(groups).forEach(key => {
    const originalGroup = groups[key];
    sanitizedGroups[key] = {
      ...originalGroup,
      files: originalGroup.files.map(file => ({
        ...file,
        content: sanitizeFileContent(file.content, file.language),
        path: sanitizeFilePath(file.path)
      })),
      keyFunctions: originalGroup.keyFunctions.map(fn => sanitizeFunctionName(fn))
    };
  });

  return sanitizedGroups;
}

// 파일 내용 민감정보 제거
function sanitizeFileContent(content: string, language: string): string {
  let sanitized = content;

  // 개인정보 관련 패턴 제거
  const sensitivePatterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 이메일
    /\b\d{3}-\d{3,4}-\d{4}\b/g, // 전화번호
    /\b\d{6}-\d{7}\b/g, // 주민등록번호 패턴
    /password\s*[:=]\s*['"][^'"]+['"]/gi, // 패스워드
    /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, // API 키
    /secret\s*[:=]\s*['"][^'"]+['"]/gi, // 시크릿
    /token\s*[:=]\s*['"][^'"]+['"]/gi, // 토큰
  ];

  sensitivePatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '[SANITIZED]');
  });

  // 긴 문자열 (50자 이상) 축약
  sanitized = sanitized.replace(/(['"])[^'"]{50,}\1/g, '$1[LONG_STRING]$1');

  // 주석에서 민감정보 제거
  if (language === 'JavaScript' || language === 'TypeScript') {
    sanitized = sanitized.replace(/\/\/.*(?:password|secret|key|token|credential).*/gi, '// [SANITIZED COMMENT]');
    sanitized = sanitized.replace(/\/\*[\s\S]*?(?:password|secret|key|token|credential)[\s\S]*?\*\//gi, '/* [SANITIZED COMMENT] */');
  } else if (language === 'Python') {
    sanitized = sanitized.replace(/#.*(?:password|secret|key|token|credential).*/gi, '# [SANITIZED COMMENT]');
  }

  return sanitized;
}

// 파일 경로 민감정보 제거
function sanitizeFilePath(filePath: string): string {
  // 사용자명이나 민감한 폴더명 제거
  return filePath.replace(/\/Users\/[^\/]+/, '/Users/[USER]')
                .replace(/\/home\/[^\/]+/, '/home/[USER]')
                .replace(/C:\\Users\\[^\\]+/, 'C:\\Users\\[USER]')
                .replace(/\b(password|secret|key|credential|private)\b/gi, '[SANITIZED]');
}

// 함수명 익명화
function sanitizeFunctionName(functionName: string): string {
  // 민감한 함수명 패턴 익명화
  const sensitivePatterns = [
    /password/gi,
    /secret/gi,
    /key/gi,
    /token/gi,
    /credential/gi,
    /auth/gi,
    /login/gi,
    /ssn/gi,
    /social/gi
  ];

  let sanitized = functionName;
  sensitivePatterns.forEach(pattern => {
    if (pattern.test(sanitized)) {
      sanitized = `fn_${sanitized.replace(pattern, 'SENSITIVE').toLowerCase()}`;
    }
  });

  return sanitized;
}

// 정적 분석 도구 사전 필터링 추가
async function performStaticAnalysis(files: ProjectFile[], projectType: string) {
  const staticIssues: Record<string, any> = {};
  
  files.forEach(file => {
    const issues = runStaticAnalyzers(file, projectType);
    if (issues.length > 0) {
      staticIssues[file.path] = issues;
    }
  });
  
  return staticIssues;
}

// TODO: 향후 ESLint 설정 추가 예정

// 언어별 정적 분석 실행 (실제 도구 사용)
function runStaticAnalyzers(file: ProjectFile, projectType: string) {
  const issues: any[] = [];
  const content = file.content;
  const language = file.language;

  // JavaScript/TypeScript 정적 분석 (실제 ESLint 사용)
  if (language === 'JavaScript' || language === 'TypeScript') {
    try {
      // ESLint 분석 실행
      const eslintResults = runESLintAnalysis(content, file.path);
      issues.push(...eslintResults);
    } catch (error) {
      console.error(`ESLint 분석 오류 (${file.path}):`, error);
      // ESLint 실패 시 기본 패턴 매칭 사용
      const fallbackIssues = analyzeJavaScriptFallback(content);
      issues.push(...fallbackIssues);
    }
  }
  
  // Python 정적 분석 (실제 패턴 + 향후 Bandit 연동)
  if (language === 'Python') {
    const pyIssues = analyzePythonAdvanced(content);
    issues.push(...pyIssues);
  }
  
  // Java 정적 분석
  if (language === 'Java') {
    const javaIssues = analyzeJavaAdvanced(content);
    issues.push(...javaIssues);
  }

  // 공통 보안 패턴 검사 (강화된 버전)
  const securityIssues = analyzeSecurityPatternsAdvanced(content, language);
  issues.push(...securityIssues);

  return issues;
}

// 강화된 JavaScript/TypeScript 분석 (향후 실제 ESLint로 교체 예정)
function runESLintAnalysis(code: string, filePath: string): any[] {
  console.log(`🔧 강화된 정적 분석 실행: ${filePath}`);
  
  // 현재는 강화된 패턴 매칭 사용, 향후 실제 ESLint API 연동 예정
  return analyzeJavaScriptFallback(code);
}

// 향상된 JavaScript 분석 (ESLint 실패 시 대체)
function analyzeJavaScriptFallback(content: string) {
  const issues: any[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // var 사용 감지
    if (line.includes('var ')) {
      issues.push({
        type: 'style',
        severity: 'warning',
        message: 'var 대신 let/const 사용 권장',
        rule: 'no-var',
        line: lineNumber
      });
    }
    
    // == 사용 감지
    if (line.includes('==') && !line.includes('===')) {
      issues.push({
        type: 'style', 
        severity: 'warning',
        message: '=== 또는 !== 사용 권장',
        rule: 'eqeqeq',
        line: lineNumber
      });
    }
    
    // console.log 사용 감지
    if (line.includes('console.log')) {
      issues.push({
        type: 'debug',
        severity: 'info',
        message: '프로덕션 환경에서 console.log 제거 권장',
        rule: 'no-console',
        line: lineNumber
      });
    }

    // 함수 길이 체크 (20줄 이상)
    if (line.includes('function ') || line.includes('const ') && line.includes('=>')) {
      const functionLines = extractFunctionLength(lines, index);
      if (functionLines > 20) {
        issues.push({
          type: 'maintainability',
          severity: 'warning',
          message: `함수가 너무 깁니다 (${functionLines}줄). 20줄 이하로 분할 권장`,
          rule: 'max-function-length',
          line: lineNumber
        });
      }
    }

    // 중첩 깊이 체크
    const nestingLevel = (line.match(/\s*/)?.[0].length || 0) / 2;
    if (nestingLevel > 4) {
      issues.push({
        type: 'complexity',
        severity: 'warning', 
        message: `중첩 깊이가 너무 깊습니다 (${nestingLevel}단계). 4단계 이하 권장`,
        rule: 'max-nesting-depth',
        line: lineNumber
      });
    }
  });

  return issues;
}

// 향상된 Python 분석
function analyzePythonAdvanced(content: string) {
  const issues: any[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // PEP8 스타일 체크들
    if (line.includes('import *')) {
      issues.push({
        type: 'import',
        severity: 'warning',
        message: 'import * 사용 지양, 명시적 import 권장 (PEP8)',
        rule: 'wildcard-import',
        line: lineNumber
      });
    }
    
    // SQL 인젝션 위험 패턴 (향상된)
    if ((line.includes('execute(') || line.includes('query(')) && line.includes('%s')) {
      issues.push({
        type: 'security',
        severity: 'error',
        message: 'SQL 인젝션 위험, 파라미터화된 쿼리 사용 권장',
        rule: 'sql-injection-risk',
        line: lineNumber
      });
    }
    
    // Try-except bare
    if (line.trim() === 'except:') {
      issues.push({
        type: 'exception',
        severity: 'warning',
        message: '구체적인 예외 타입 지정 권장 (PEP8)',
        rule: 'bare-except',
        line: lineNumber
      });
    }

    // 함수명 컨벤션 체크
    const functionMatch = line.match(/def\s+([A-Z][a-zA-Z0-9_]*)\s*\(/);
    if (functionMatch) {
      issues.push({
        type: 'style',
        severity: 'warning',
        message: `함수명은 snake_case 사용 권장: ${functionMatch[1]} → ${camelToSnake(functionMatch[1])}`,
        rule: 'function-naming-convention',
        line: lineNumber
      });
    }

    // print 문 사용 (Python 3에서는 logging 권장)
    if (line.includes('print(') && !line.includes('#')) {
      issues.push({
        type: 'debug',
        severity: 'info',
        message: 'logging 모듈 사용 권장 (print 대신)',
        rule: 'use-logging',
        line: lineNumber
      });
    }
  });

  return issues;
}

// 향상된 Java 분석
function analyzeJavaAdvanced(content: string) {
  const issues: any[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    // System.out.println 사용
    if (line.includes('System.out.println')) {
      issues.push({
        type: 'debug',
        severity: 'info',
        message: 'Logger 사용 권장 (System.out.println 대신)',
        rule: 'use-logger',
        line: lineNumber
      });
    }
    
    // 제네릭 예외 처리
    if (line.includes('throws Exception')) {
      issues.push({
        type: 'exception',
        severity: 'warning',
        message: '구체적인 예외 타입 사용 권장',
        rule: 'specific-exception',
        line: lineNumber
      });
    }

    // 매직 넘버 감지
    const magicNumbers = line.match(/\b\d{2,}\b/g);
    if (magicNumbers && !line.includes('//') && !line.includes('final')) {
      issues.push({
        type: 'maintainability',
        severity: 'warning',
        message: '매직 넘버를 상수로 정의 권장',
        rule: 'no-magic-numbers',
        line: lineNumber
      });
    }

    // 클래스명 컨벤션 체크
    const classMatch = line.match(/class\s+([a-z][a-zA-Z0-9]*)/);
    if (classMatch) {
      issues.push({
        type: 'style',
        severity: 'warning',
        message: `클래스명은 PascalCase 사용: ${classMatch[1]} → ${toPascalCase(classMatch[1])}`,
        rule: 'class-naming-convention',
        line: lineNumber
      });
    }
  });

  return issues;
}

// 강화된 보안 패턴 분석
function analyzeSecurityPatternsAdvanced(content: string, language: string) {
  const issues: any[] = [];
  const lines = content.split('\n');
  
  // 하드코딩된 비밀번호/키 패턴 (강화된)
  const secretPatterns = [
    { pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/gi, message: '하드코딩된 비밀번호 발견' },
    { pattern: /api[_-]?key\s*[:=]\s*['"][^'"]{16,}['"]/gi, message: '하드코딩된 API 키 발견' },
    { pattern: /secret\s*[:=]\s*['"][^'"]{8,}['"]/gi, message: '하드코딩된 시크릿 발견' },
    { pattern: /token\s*[:=]\s*['"][^'"]{20,}['"]/gi, message: '하드코딩된 토큰 발견' },
    { pattern: /private[_-]?key\s*[:=]/gi, message: '하드코딩된 개인키 위험' },
  ];
  
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    secretPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(line)) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: `${message}, 환경변수 사용 권장`,
          rule: 'hardcoded-secrets',
          line: lineNumber
        });
      }
    });
    
    // 언어별 특화 보안 체크
    if (language === 'JavaScript' || language === 'TypeScript') {
      // XSS 위험 패턴
      if (line.includes('innerHTML') || line.includes('document.write')) {
        issues.push({
          type: 'security',
          severity: 'warning',
          message: 'XSS 위험, textContent 또는 안전한 DOM 조작 사용 권장',
          rule: 'xss-risk',
          line: lineNumber
        });
      }

      // eval 사용
      if (line.includes('eval(')) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: 'eval() 사용 금지 - 코드 인젝션 위험',
          rule: 'no-eval',
          line: lineNumber
        });
      }
    }

    if (language === 'Python') {
      // pickle 사용 위험
      if (line.includes('pickle.load') || line.includes('cPickle.load')) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: 'pickle.load() 사용 위험 - 임의 코드 실행 가능',
          rule: 'pickle-load-risk',
          line: lineNumber
        });
      }

      // subprocess shell=True
      if (line.includes('subprocess') && line.includes('shell=True')) {
        issues.push({
          type: 'security',
          severity: 'error',
          message: 'shell=True 사용 위험 - 명령어 인젝션 가능',
          rule: 'subprocess-shell-risk',
          line: lineNumber
        });
      }
    }
  });

  return issues;
}

// 헬퍼 함수들
function extractFunctionLength(lines: string[], startIndex: number): number {
  let braceCount = 0;
  let lineCount = 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    lineCount++;
    
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceCount += openBraces - closeBraces;
    
    if (braceCount <= 0 && i > startIndex) {
      break;
    }
  }
  
  return lineCount;
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

async function cleanupTempFiles(tempDir: string) {
  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('임시 파일 정리 실패:', error);
  }
} 