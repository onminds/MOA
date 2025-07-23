"use client";
import { useState, useEffect } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Upload, FileArchive, Loader2, CheckCircle, AlertCircle, TrendingUp,
  Folder, File, Award, Shield, Zap, Target, Code, Package, Plus, X, Edit3,
  FileText, Files, Archive, Info, ExternalLink, ChevronRight, Bug, Clock, 
  Activity, Database, Globe, Lock
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const sideMenus = [
  { name: '홈', icon: <HomeIcon className="w-5 h-5 mr-2" />, href: '/' },
  { name: '검색', icon: <Search className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 목록', icon: <List className="w-5 h-5 mr-2" />, href: '#' },
  { name: '순위', icon: <BarChart className="w-5 h-5 mr-2" />, href: '#' },
  { name: '광고', icon: <Megaphone className="w-5 h-5 mr-2" />, href: '#' },
  { name: 'AI 뉴스', icon: <Newspaper className="w-5 h-5 mr-2" />, href: '#' },
  { name: '문의하기', icon: <MessageCircle className="w-5 h-5 mr-2" />, href: '#' },
  { name: '설정', icon: <Settings className="w-5 h-5 mr-2" />, href: '#' },
];

const projectTypes = [
  { value: 'react', label: 'React/Next.js', icon: '⚛️' },
  { value: 'vue', label: 'Vue.js', icon: '💚' },
  { value: 'angular', label: 'Angular', icon: '🔺' },
  { value: 'node', label: 'Node.js/Express', icon: '🟢' },
  { value: 'python', label: 'Python/Django', icon: '🐍' },
  { value: 'java', label: 'Java/Spring', icon: '☕' },
  { value: 'mobile', label: 'React Native/Flutter', icon: '📱' },
  { value: 'other', label: '기타', icon: '🔧' }
];

const industries = [
  { value: 'fintech', label: '핀테크/금융', icon: '💰' },
  { value: 'ecommerce', label: '이커머스', icon: '🛒' },
  { value: 'healthcare', label: '의료/헬스케어', icon: '🏥' },
  { value: 'education', label: '교육', icon: '📚' },
  { value: 'gaming', label: '게임', icon: '🎮' },
  { value: 'media', label: '미디어/엔터테인먼트', icon: '📺' },
  { value: 'enterprise', label: '기업용 솔루션', icon: '🏢' },
  { value: 'general', label: '일반', icon: '🌐' }
];

// 입력 모드 타입
type InputMode = 'zip' | 'text' | 'files';

// 직접 입력용 파일 인터페이스
interface TextFile {
  id: string;
  name: string;
  path: string;
  language: string;
  content: string;
}

// 개별 업로드용 파일 인터페이스  
interface UploadedFile {
  id: string;
  file: File;
  name: string;
  path: string;
  language: string;
  content?: string;
}

interface ProjectStructure {
  id: string;
  name: string;
  files: Array<{
    path: string;
    content: string;
    language: string;
    size: number;
  }>;
  metadata: {
    totalFiles: number;
    totalSize: number;
    languages: Record<string, number>;
    dependencies: string[];
  };
}

interface ProjectReviewResult {
  projectId: string;
  overallScore: number;
  architectureScore: number;
  securityScore: number;
  performanceScore: number;
  maintainabilityScore: number;
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
  fileAnalysis?: {
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
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
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

const languageOptions = [
  { value: 'JavaScript', label: 'JavaScript', ext: '.js' },
  { value: 'TypeScript', label: 'TypeScript', ext: '.ts' },
  { value: 'React JSX', label: 'React JSX', ext: '.jsx' },
  { value: 'React TSX', label: 'React TSX', ext: '.tsx' },
  { value: 'Vue.js', label: 'Vue.js', ext: '.vue' },
  { value: 'Python', label: 'Python', ext: '.py' },
  { value: 'Java', label: 'Java', ext: '.java' },
  { value: 'C++', label: 'C++', ext: '.cpp' },
  { value: 'C#', label: 'C#', ext: '.cs' },
  { value: 'PHP', label: 'PHP', ext: '.php' },
  { value: 'Go', label: 'Go', ext: '.go' },
  { value: 'Rust', label: 'Rust', ext: '.rs' },
  { value: 'JSON', label: 'JSON', ext: '.json' },
  { value: 'Markdown', label: 'Markdown', ext: '.md' }
];

export default function UnifiedProjectCodeReview() {
  const router = useRouter();
  
  // 기본 프로젝트 정보
  const [projectName, setProjectName] = useState('');
  const [projectType, setProjectType] = useState('auto'); // 감지 기본값
  const [detectedProjectType, setDetectedProjectType] = useState<string | null>(null); // 감지된 타입 저장
  const [industry, setIndustry] = useState('general');
  
  // 입력 모드
  const [inputMode, setInputMode] = useState<InputMode>('text');
  
  // ZIP 업로드 모드 상태
  const [selectedZipFile, setSelectedZipFile] = useState<File | null>(null);
  const [analysisDepth, setAnalysisDepth] = useState('deep');
  
  // 직접 입력 모드 상태
  const [textFiles, setTextFiles] = useState<TextFile[]>([
    {
      id: '1',
      name: 'App.tsx',
      path: 'src/App.tsx',
      language: 'React TSX',
      content: ''
    }
  ]);
  const [activeFileId, setActiveFileId] = useState('1');
  
  // 개별 파일 업로드 모드 상태
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  
  // 분석 상태
  const [loading, setLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState<ProjectReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'input' | 'analysis' | 'complete'>('input');
  
    // 상세 로딩 상태
  const [loadingProgress, setLoadingProgress] = useState({
    stage: '',
    progress: 0,
    message: '',
    timeElapsed: 0,
    estimatedTotal: 0
  });

  // 로딩 시간 실시간 업데이트
  const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);

  useEffect(() => {
    if (loading && !loadingStartTime) {
      setLoadingStartTime(Date.now());
    } else if (!loading) {
      setLoadingStartTime(null);
    }
  }, [loading, loadingStartTime]);

  useEffect(() => {
    if (loading && loadingStartTime) {
      const interval = setInterval(() => {
        const elapsed = Date.now() - loadingStartTime;
        setLoadingProgress(prev => ({
          ...prev,
          timeElapsed: elapsed
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [loading, loadingStartTime]);

  // 로딩 진행 시뮬레이션
  const updateProgress = (stage: string, progress: number, message: string, estimatedTotal?: number) => {
    setLoadingProgress(prev => ({
      ...prev,
      stage,
      progress,
      message,
      estimatedTotal: estimatedTotal || prev.estimatedTotal
    }));
  };

  const simulateProgress = async (
    initialStage: string, 
    initialMessage: string, 
    targetProgress: number, 
    duration: number,
    estimatedTotal: number
  ) => {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const startProgress = loadingProgress.progress;
      const progressDiff = targetProgress - startProgress;
      
      updateProgress(initialStage, startProgress, initialMessage, estimatedTotal);
      
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progressRatio = Math.min(elapsed / duration, 1);
        const currentProgress = startProgress + (progressDiff * progressRatio);
        
        setLoadingProgress(prev => ({
          ...prev,
          progress: currentProgress,
          timeElapsed: elapsed
        }));
        
        if (progressRatio >= 1) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  };

  // 프로젝트 타입 표시 함수
  const getProjectTypeDisplay = (projectType: string) => {
    const typeMap: Record<string, string> = {
      'react': '⚛️ React',
      'next': '▲ Next.js',
      'vue': '💚 Vue.js',
      'node': '🟢 Node.js',
      'python': '🐍 Python',
      'django': '🎸 Django',
      'flask': '🌶️ Flask',
      'java': '☕ Java',
      'spring': '🌱 Spring',
      'php': '🐘 PHP',
      'csharp': '🔷 C#',
      'cpp': '⚙️ C++',
      'go': '🐹 Go',
      'rust': '🦀 Rust',
      'flutter': '💙 Flutter',
      'typescript': '💙 TypeScript',
      'javascript': '💛 JavaScript',
      'unknown': '❓ 기타'
    };
    return typeMap[projectType] || `🛠️ ${projectType}`;
  };

  // 클라이언트 사이드 프로젝트 타입 감지
  const detectClientSideProjectType = (files: { language: string; content: string; path: string }[]) => {
    // 언어별 카운트
    const languageCount: Record<string, number> = {};
    let hasReact = false;
    let hasVue = false;
    let hasNext = false;
    
    files.forEach(file => {
      languageCount[file.language] = (languageCount[file.language] || 0) + 1;
      
      // 내용 분석
      if (file.content.includes('react') || file.content.includes('React') || file.path.includes('.jsx') || file.path.includes('.tsx')) {
        hasReact = true;
      }
      if (file.path.includes('.vue') || file.content.includes('vue')) {
        hasVue = true;
      }
      if (file.content.includes('next') || file.path.includes('next.config')) {
        hasNext = true;
      }
    });
    
    // 감지 로직
    if (hasNext) return 'next';
    if (hasReact) return 'react';
    if (hasVue) return 'vue';
    
    // 가장 많은 언어로 판단
    const mostUsedLanguage = Object.entries(languageCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0];
    
    switch (mostUsedLanguage) {
      case 'Python': return 'python';
      case 'Java': return 'java';
      case 'TypeScript': return 'typescript';
      case 'JavaScript': return 'javascript';
      case 'PHP': return 'php';
      case 'C++': return 'cpp';
      case 'C#': return 'csharp';
      case 'Go': return 'go';
      case 'Rust': return 'rust';
      default: return 'unknown';
    }
  };

  // 분석 깊이별 예상 시간 계산
  const getEstimatedTime = (depth: string, fileSize?: number) => {
    const baseTime = {
      'surface': 90000,      // 1.5분 (90초)
      'deep': 240000,        // 4분 (240초)  
      'comprehensive': 420000 // 7분 (420초)
    };
    
    let estimatedTime = baseTime[depth as keyof typeof baseTime] || baseTime.deep;
    
    // 파일 크기에 따른 조정 (100MB 이상시 시간 증가)
    if (fileSize && fileSize > 100 * 1024 * 1024) {
      const sizeMultiplier = Math.min(2, fileSize / (100 * 1024 * 1024));
      estimatedTime *= sizeMultiplier;
    }
    
    return estimatedTime;
  };

  // 모달 상태
  const [selectedModal, setSelectedModal] = useState<{
    type: 'structure' | 'security' | 'performance' | 'dependencies' | 'files' | 'patterns' | 'metadata' | 'maintainability' | null;
    data?: any;
  }>({ type: null });

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false);

  // 드래그 앤 드롭 핸들러 (개별 파일용)
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleIndividualFiles(files);
    }
  };

  // ZIP 파일 드래그 앤 드롭 핸들러
  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const zipFile = files.find(file => 
      file.name.toLowerCase().endsWith('.zip') || 
      file.name.toLowerCase().endsWith('.rar')
    );
    
    if (zipFile) {
      setSelectedZipFile(zipFile);
    }
  };

  // 언어 자동 감지 함수
  const detectLanguageFromPath = (filePath: string): string => {
    const ext = filePath.toLowerCase().split('.').pop();
    const found = languageOptions.find(lang => lang.ext === `.${ext}`);
    return found ? found.value : 'JavaScript';
  };

  // 직접 입력 모드 - 파일 추가
  const addTextFile = () => {
    const newFile: TextFile = {
      id: Date.now().toString(),
      name: 'newFile.js',
      path: 'src/newFile.js',
      language: 'JavaScript',
      content: ''
    };
    setTextFiles(prev => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  // 직접 입력 모드 - 파일 삭제
  const removeTextFile = (fileId: string) => {
    if (textFiles.length <= 1) return; // 최소 1개 파일 유지
    
    setTextFiles(prev => prev.filter(f => f.id !== fileId));
    
    // 활성 파일이 삭제된 경우 첫 번째 파일로 변경
    if (activeFileId === fileId) {
      const remaining = textFiles.filter(f => f.id !== fileId);
      setActiveFileId(remaining[0]?.id || '');
    }
  };

  // 직접 입력 모드 - 파일 업데이트
  const updateTextFile = (fileId: string, updates: Partial<TextFile>) => {
    setTextFiles(prev => prev.map(file => 
      file.id === fileId ? { ...file, ...updates } : file
    ));
  };

  // 개별 파일 업로드 처리
  const handleIndividualFiles = async (files: FileList | File[]) => {
    const newFiles: UploadedFile[] = [];
    
    // FileList 또는 File[] 배열을 일관되게 처리
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      
      // 텍스트 파일만 허용
      if (file.size > 50 * 1024 * 1024) continue; // 50MB 제한
      
      const content = await file.text();
      const language = detectLanguageFromPath(file.name);
      
      newFiles.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        file,
        name: file.name,
        path: file.webkitRelativePath || file.name,
        language,
        content
      });
    }
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  };

  // 통합 분석 실행
  const performAnalysis = async () => {
    setLoading(true);
    setError(null);
    setCurrentStep('analysis');

    try {
      let projectData;
      
      // 파일 크기 및 분석 깊이에 따른 예상 시간 계산
      let fileSize = 0;
      
      if (inputMode === 'zip' && selectedZipFile) {
        fileSize = selectedZipFile.size;
      } else if (inputMode === 'files') {
        fileSize = uploadedFiles.reduce((sum, file) => sum + (file.content?.length || 0), 0) * 1024; // 텍스트 길이를 바이트로 변환
      } else {
        fileSize = textFiles.reduce((sum, file) => sum + file.content.length, 0) * 1024; // 텍스트 길이를 바이트로 변환
      }
      
      // 분석 깊이와 파일 크기를 고려한 예상 시간
      const estimatedTime = getEstimatedTime(analysisDepth, fileSize);

      // 입력 모드에 따라 데이터 준비
      switch (inputMode) {
        case 'zip':
          // ZIP 업로드 처리 (안정적인 방식)
          if (!selectedZipFile) {
            throw new Error('ZIP 파일을 선택해주세요.');
          }
          
          console.log('ZIP 파일 처리 시작:', selectedZipFile.name);
          
          // 1단계: 업로드 시작
          await simulateProgress(
            '업로드', 
            `📁 ${selectedZipFile.name} (${(selectedZipFile.size / 1024 / 1024).toFixed(1)}MB) 업로드 중...`,
            15,
            estimatedTime * 0.25,
            estimatedTime
          );
          
          const formData = new FormData();
          formData.append('file', selectedZipFile);
          formData.append('projectType', 'auto'); // 감지 요청
          formData.append('analysisDepth', analysisDepth);

          // 2단계: 서버 처리 시뮬레이션
          const uploadPromise = fetch('/api/upload/project', {
            method: 'POST',
            body: formData,
          });
          
          await simulateProgress(
            '저장', 
            '💾 서버에 파일 저장 중...',
            30,
            estimatedTime * 0.15,
            estimatedTime
          );
          
          await simulateProgress(
            '추출', 
            '🔓 ZIP 파일 압축 해제 중...',
            50,
            estimatedTime * 0.25,
            estimatedTime
          );
          
          await simulateProgress(
            '구조분석', 
            '📋 프로젝트 구조 분석 중...',
            65,
            estimatedTime * 0.2,
            estimatedTime
          );

          const zipResponse = await uploadPromise;

          if (!zipResponse.ok) {
            const zipError = await zipResponse.json();
            throw new Error(zipError.error || 'ZIP 파일 업로드에 실패했습니다.');
          }

          const zipResult = await zipResponse.json();
          
          if (!zipResult.success) {
            throw new Error(zipResult.error || 'ZIP 파일 처리 중 오류가 발생했습니다.');
          }

          projectData = zipResult.project;
          
          // 감지된 프로젝트 타입 저장
          if (projectData.type) {
            setDetectedProjectType(projectData.type);
            console.log('감지된 프로젝트 타입:', projectData.type);
          }
          
          // 프로젝트 이름 자동 설정
          if (!projectName.trim()) {
            setProjectName(projectData.name || selectedZipFile.name.replace(/\.(zip|rar)$/i, ''));
          }
          
          console.log(`ZIP 파일 처리 완료: ${projectData.files.length}개 파일`);
          break;

        case 'text':
          // 직접 입력 데이터 변환
          await simulateProgress(
            '준비', 
            '📝 입력된 코드 분석 준비 중...',
            30,
            estimatedTime * 0.2,
            estimatedTime
          );
          
          projectData = {
            id: Date.now().toString(),
            name: projectName || 'Text Input Project',
            files: textFiles.map(file => ({
              path: file.path,
              content: file.content,
              language: file.language,
              size: file.content.length
            })),
            metadata: {
              totalFiles: textFiles.length,
              totalSize: textFiles.reduce((sum, file) => sum + file.content.length, 0),
              languages: textFiles.reduce((acc, file) => {
                acc[file.language] = (acc[file.language] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
              dependencies: []
            }
          };
          
          // 클라이언트 사이드에서 프로젝트 타입 감지
          const detectedType = detectClientSideProjectType(textFiles);
          setDetectedProjectType(detectedType);
          console.log('감지된 프로젝트 타입:', detectedType);
          
          await simulateProgress(
            '정리', 
            `📊 ${textFiles.length}개 파일 메타데이터 생성 중...`,
            60,
            estimatedTime * 0.3,
            estimatedTime
          );
          break;

        case 'files':
          // 개별 파일 데이터 변환
          await simulateProgress(
            '준비', 
            '📄 업로드된 파일들 분석 준비 중...',
            30,
            estimatedTime * 0.2,
            estimatedTime
          );
          
          projectData = {
            id: Date.now().toString(),
            name: projectName || 'File Upload Project',
            files: uploadedFiles.map(file => ({
              path: file.path,
              content: file.content || '',
              language: file.language,
              size: file.content?.length || 0
            })),
            metadata: {
              totalFiles: uploadedFiles.length,
              totalSize: uploadedFiles.reduce((sum, file) => sum + (file.content?.length || 0), 0),
              languages: uploadedFiles.reduce((acc, file) => {
                acc[file.language] = (acc[file.language] || 0) + 1;
                return acc;
              }, {} as Record<string, number>),
              dependencies: []
            }
          };
          
          // 클라이언트 사이드에서 프로젝트 타입 감지
          const detectedTypeFiles = detectClientSideProjectType(
            uploadedFiles.map(f => ({ language: f.language, content: f.content || '', path: f.path }))
          );
          setDetectedProjectType(detectedTypeFiles);
          console.log('감지된 프로젝트 타입:', detectedTypeFiles);
          
          await simulateProgress(
            '정리', 
            `📊 ${uploadedFiles.length}개 파일 메타데이터 생성 중...`,
            60,
            estimatedTime * 0.3,
            estimatedTime
          );
          break;
      }

            // 정적 분석 단계 (새로 추가)
      await simulateProgress(
        '정적분석', 
        '🔧 ESLint, Bandit, 보안 패턴 등 정적 분석 실행 중...',
        65,
        estimatedTime * 0.08,
        estimatedTime
      );

      // 기능별 그룹핑 단계
      await simulateProgress(
        '기능그룹핑', 
        '🧩 기능별 그룹핑 및 구조 분석 중...',
        72,
        estimatedTime * 0.1,
        estimatedTime
      );

      // 민감정보 제거 단계
      await simulateProgress(
        '민감정보제거', 
        '🛡️ 개인정보·API키·비밀번호 자동 익명화 처리 중...',
        77,
        estimatedTime * 0.05,
        estimatedTime
      );

      // 감지된 프로젝트 타입 사용
      const finalProjectType = detectedProjectType || projectType;
      console.log('분석에 사용할 프로젝트 타입:', finalProjectType);
      
      const analysisPromise = fetch('/api/code-review/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectData.id,
          files: projectData.files,
          projectType: finalProjectType, // 감지된 타입 사용
          reviewType: 'comprehensive',
          focusAreas: ['architecture', 'security', 'performance', 'maintainability'],
          industry: industry !== 'general' ? industry : undefined
        }),
      });

                            // 그룹별 개별 분석 단계
      await simulateProgress(
        '그룹분석', 
        '🔍 정적 분석 결과 기반 스마트 AI 분석 중 (기본 이슈 제외, 고급 분석 집중)...',
        87,
        estimatedTime * 0.2,
        estimatedTime
      );

                            // 중간 요약 생성 단계
      await simulateProgress(
        '중간요약', 
        '📝 보안 처리된 분석 결과를 요약하여 토큰 최적화 중...',
        90,
        estimatedTime * 0.1,
        estimatedTime
      );

      // 메타 분석 통합 단계
      await simulateProgress(
        '메타분석', 
        '🎯 익명화된 요약 정보로 최종 통합 분석 중...',
        95,
        estimatedTime * 0.15,
        estimatedTime
      );

      const response = await analysisPromise;

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '프로젝트 분석에 실패했습니다.');
      }

      const data = await response.json();
      
      if (data.success && data.result) {
        await simulateProgress(
          '완료', 
          '📊 분석 결과 정리 중...',
          100,
          estimatedTime * 0.02,
          estimatedTime
        );
        
        setReviewResult(data.result);
        setCurrentStep('complete');
      } else {
        throw new Error('프로젝트 분석 결과를 받지 못했습니다.');
      }
    } catch (error) {
      console.error('프로젝트 분석 오류:', error);
      setError(error instanceof Error ? error.message : '프로젝트 분석 중 오류가 발생했습니다.');
      setCurrentStep('input');
    } finally {
      setLoading(false);
      setLoadingProgress({
        stage: '',
        progress: 0,
        message: '',
        timeElapsed: 0,
        estimatedTotal: 0
      });
    }
  };

  // 점수 색상
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  const activeFile = textFiles.find(f => f.id === activeFileId);

  // 전체 화면 드래그 앤 드롭 방지
  useEffect(() => {
    const preventDefault = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      // 드롭 영역이 아닌 곳에서는 아무것도 하지 않음
    };

    document.addEventListener('dragover', preventDefault);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      document.removeEventListener('dragover', preventDefault);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, []);

  // 상세 분석 모달 컴포넌트
  const DetailModal = ({ type, data, onClose }: { type: string; data: any; onClose: () => void }) => {
    if (!type || !data) return null;

    const renderModalContent = () => {
      switch (type) {
        case 'structure':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">🏗️ 프로젝트 구조 상세 분석</h3>
                  <p className="text-gray-600">폴더 구조와 모듈화 분석 결과입니다</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {data.detailedAnalysis?.folderStructure && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      📁 폴더 구조 ({data.detailedAnalysis.folderStructure.score}점)
                    </h4>
                    <p className="text-blue-800 text-sm mb-3">{data.detailedAnalysis.folderStructure.description}</p>
                    
                    {data.detailedAnalysis.folderStructure.problems?.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-medium text-red-800 mb-2">⚠️ 문제점</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                          {data.detailedAnalysis.folderStructure.problems.map((problem: string, idx: number) => (
                            <li key={idx}>{problem}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {data.detailedAnalysis.folderStructure.solutions?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-green-800 mb-2">💡 해결 방안</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                          {data.detailedAnalysis.folderStructure.solutions.map((solution: string, idx: number) => (
                            <li key={idx}>{solution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {data.detailedAnalysis?.modularity && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      🧩 모듈화 ({data.detailedAnalysis.modularity.score}점)
                    </h4>
                    <p className="text-green-800 text-sm mb-3">{data.detailedAnalysis.modularity.description}</p>
                    
                    {data.detailedAnalysis.modularity.problems?.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-medium text-red-800 mb-2">⚠️ 문제점</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                          {data.detailedAnalysis.modularity.problems.map((problem: string, idx: number) => (
                            <li key={idx}>{problem}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {data.detailedAnalysis.modularity.solutions?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-green-800 mb-2">💡 해결 방안</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                          {data.detailedAnalysis.modularity.solutions.map((solution: string, idx: number) => (
                            <li key={idx}>{solution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">📋 전체 개선 사항</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-red-800 mb-2">❌ 발견된 문제점</h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      {data.issues?.map((issue: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-green-800 mb-2">✅ 개선 방향</h5>
                    <ul className="space-y-1 text-sm text-green-700">
                      {data.improvements?.map((improvement: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-500 mt-1">•</span>
                          {improvement}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );

        case 'security':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Shield className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">🔒 보안 상세 분석</h3>
                  <p className="text-gray-600">보안 취약점과 위험 요소 분석 결과입니다</p>
                </div>
              </div>

              {data.vulnerabilities && data.vulnerabilities.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    🚨 발견된 보안 취약점
                  </h4>
                  <div className="space-y-3">
                    {data.vulnerabilities.map((vuln: any, idx: number) => (
                      <div key={idx} className="border border-red-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-red-900">{vuln.type}</span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            vuln.severity === 'high' ? 'bg-red-100 text-red-800' :
                            vuln.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {vuln.severity === 'high' ? '높음' : vuln.severity === 'medium' ? '중간' : '낮음'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">📍 위치: {vuln.location}</p>
                        <p className="text-sm text-gray-800 mb-2">{vuln.description}</p>
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="text-sm text-green-800"><strong>해결 방법:</strong> {vuln.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.bestPractices && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    ✅ 보안 모범 사례 점검
                  </h4>
                  <p className="text-green-800 text-sm">{data.bestPractices}</p>
                </div>
              )}
            </div>
          );

        case 'performance':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">⚡ 성능 상세 분석</h3>
                  <p className="text-gray-600">성능 병목점과 최적화 방안 분석 결과입니다</p>
                </div>
              </div>

              {data.bottlenecks && data.bottlenecks.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    🐌 성능 병목점
                  </h4>
                  <ul className="space-y-2">
                    {data.bottlenecks.map((bottleneck: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-yellow-800">
                        <span className="text-yellow-600 mt-1">⚠️</span>
                        {bottleneck}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.optimizations && data.optimizations.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    🚀 최적화 방안
                  </h4>
                  <ul className="space-y-2">
                    {data.optimizations.map((optimization: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-green-800">
                        <span className="text-green-600 mt-1">💡</span>
                        {optimization}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.metrics && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    📊 성능 지표
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.metrics.loadTime && (
                      <div className="bg-white rounded p-3">
                        <p className="text-sm text-blue-800"><strong>로딩 시간:</strong> {data.metrics.loadTime}</p>
                      </div>
                    )}
                    {data.metrics.bundleSize && (
                      <div className="bg-white rounded p-3">
                        <p className="text-sm text-blue-800"><strong>번들 크기:</strong> {data.metrics.bundleSize}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );

        case 'dependencies':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📦 의존성 상세 분석</h3>
                  <p className="text-gray-600">라이브러리 및 패키지 분석 결과입니다</p>
                </div>
              </div>

              {data?.outdated && data.outdated.length > 0 && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ⏰ 오래된 패키지
                  </h4>
                  <ul className="space-y-2">
                    {data.outdated.map((pkg: string, idx: number) => (
                      <li key={idx} className="text-sm text-orange-800 flex items-start gap-2">
                        <span className="text-orange-600 mt-1">📦</span>
                        {pkg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.security && data.security.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    🚨 보안 위험 패키지
                  </h4>
                  <ul className="space-y-2">
                    {data.security.map((pkg: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                        <span className="text-red-600 mt-1">⚠️</span>
                        {pkg}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.recommendations && data.recommendations.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    💡 권장 사항
                  </h4>
                  <ul className="space-y-2">
                    {data.recommendations.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-600 mt-1">✅</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.analysis && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    📊 분석 결과
                  </h4>
                  <div className="space-y-2 text-sm text-blue-800">
                    {data.analysis.bundleSize && <p><strong>번들 크기:</strong> {data.analysis.bundleSize}</p>}
                    {data.analysis.securityIssues && <p><strong>보안 이슈:</strong> {data.analysis.securityIssues}</p>}
                    {data.analysis.updatePriority && <p><strong>업데이트 우선순위:</strong> {data.analysis.updatePriority}</p>}
                  </div>
                </div>
              )}
            </div>
          );

        case 'patterns':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Code className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">🎨 패턴 상세 분석</h3>
                  <p className="text-gray-600">코딩 패턴 및 아키텍처 분석 결과입니다</p>
                </div>
              </div>

              {data?.detected && data.detected.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    ✅ 발견된 좋은 패턴
                  </h4>
                  <ul className="space-y-2">
                    {data.detected.map((pattern: string, idx: number) => (
                      <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                        <span className="text-green-600 mt-1">🎯</span>
                        {pattern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.antiPatterns && data.antiPatterns.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                    <Bug className="w-4 h-4" />
                    ❌ 안티패턴 발견
                  </h4>
                  <ul className="space-y-2">
                    {data.antiPatterns.map((antiPattern: string, idx: number) => (
                      <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                        <span className="text-red-600 mt-1">⚠️</span>
                        {antiPattern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data?.suggestions && data.suggestions.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    💡 개선 제안
                  </h4>
                  <ul className="space-y-2">
                    {data.suggestions.map((suggestion: string, idx: number) => (
                      <li key={idx} className="text-sm text-blue-800 flex items-start gap-2">
                        <span className="text-blue-600 mt-1">💡</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );

        case 'metadata':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg">
                  <Info className="w-6 h-6 text-yellow-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📊 종합 평가 분석</h3>
                  <p className="text-gray-600">프로젝트의 전체적인 품질 평가입니다</p>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Award className="w-5 h-5 text-yellow-500" />
                  🏆 종합 점수: {data.overallScore}/100
                </h4>
                <div className={`w-full h-4 rounded-full ${getScoreBgColor(data.overallScore)} mb-4`}>
                  <div 
                    className={`h-full rounded-full ${data.overallScore >= 80 ? 'bg-green-500' : data.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data.overallScore}%` }}
                  ></div>
                </div>
                <p className="text-gray-700">{data.summary}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">📈 점수 해석</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-green-100 rounded p-3">
                    <div className="text-green-800 font-medium">80-100점</div>
                    <div className="text-green-700">우수한 코드 품질</div>
                  </div>
                  <div className="bg-yellow-100 rounded p-3">
                    <div className="text-yellow-800 font-medium">60-79점</div>
                    <div className="text-yellow-700">양호한 코드 품질</div>
                  </div>
                  <div className="bg-red-100 rounded p-3">
                    <div className="text-red-800 font-medium">0-59점</div>
                    <div className="text-red-700">개선이 필요한 품질</div>
                  </div>
                </div>
              </div>
            </div>
          );

        case 'maintainability':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-lg">
                  <Target className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">🛠️ 유지보수성 분석</h3>
                  <p className="text-gray-600">코드의 유지보수성 및 확장성 분석입니다</p>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  유지보수성 점수: {data.score}/100
                </h4>
                <div className={`w-full h-3 rounded-full ${getScoreBgColor(data.score)} mb-4`}>
                  <div 
                    className={`h-full rounded-full ${data.score >= 80 ? 'bg-green-500' : data.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data.score}%` }}
                  ></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-4">
                    <h5 className="font-medium text-gray-900 mb-2">📝 코드 가독성</h5>
                    <p className="text-sm text-gray-700">변수명, 함수명의 명확성과 코드 구조의 이해하기 쉬움</p>
                  </div>
                  <div className="bg-white rounded p-4">
                    <h5 className="font-medium text-gray-900 mb-2">🔄 확장성</h5>
                    <p className="text-sm text-gray-700">새로운 기능 추가 시의 용이성과 기존 코드의 영향도</p>
                  </div>
                  <div className="bg-white rounded p-4">
                    <h5 className="font-medium text-gray-900 mb-2">🧪 테스트 용이성</h5>
                    <p className="text-sm text-gray-700">단위 테스트 작성의 용이성과 디버깅 편의성</p>
                  </div>
                  <div className="bg-white rounded p-4">
                    <h5 className="font-medium text-gray-900 mb-2">📚 문서화</h5>
                    <p className="text-sm text-gray-700">주석의 적절성과 코드 자체 문서화 수준</p>
                  </div>
                </div>
              </div>
            </div>
          );

        case 'files':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📄 파일별 상세 분석</h3>
                  <p className="text-gray-600">각 파일의 상세 분석 결과와 개선점입니다</p>
                </div>
              </div>

              <div className="space-y-4 max-h-96 overflow-y-auto">
                {data?.map((file: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="font-medium text-gray-900">{file.path}</span>
                        {file.language && (
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {file.language}
                          </span>
                        )}
                      </div>
                      <span className={`font-bold ${getScoreColor(file.score)}`}>
                        {file.score}/100
                      </span>
                    </div>

                    {file.complexity && (
                      <p className="text-sm text-gray-600 mb-2">복잡도: {file.complexity}</p>
                    )}

                    {file.issues && file.issues.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium text-red-800">🔍 발견된 문제점</h5>
                        {file.issues.map((issue: any, issueIdx: number) => (
                          <div key={issueIdx} className={`p-3 rounded border ${
                            issue.severity === 'high' ? 'bg-red-50 border-red-200' :
                            issue.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-blue-50 border-blue-200'
                          }`}>
                            <div className="flex items-start gap-2 mb-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                issue.severity === 'high' ? 'bg-red-100 text-red-800' :
                                issue.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {issue.category || issue.type}
                              </span>
                              {issue.line && (
                                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
                                  {issue.line}줄
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-800 mb-2">{issue.message}</p>
                            {issue.code && (
                              <pre className="bg-gray-900 text-green-400 p-2 rounded text-xs mb-2 overflow-x-auto">
                                <code>{issue.code}</code>
                              </pre>
                            )}
                            <div className="bg-white border border-gray-200 rounded p-2">
                              <p className="text-sm text-green-800"><strong>개선 제안:</strong> {issue.suggestion}</p>
                              {issue.example && (
                                <pre className="bg-green-50 text-green-800 p-2 rounded text-xs mt-2 overflow-x-auto">
                                  <code>{issue.example}</code>
                                </pre>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {file.qualityMetrics && (
                      <div className="mt-3 p-3 bg-gray-50 rounded">
                        <h5 className="font-medium text-gray-800 mb-2">📊 품질 지표</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                          {file.qualityMetrics.maintainabilityIndex && (
                            <div>
                              <span className="text-gray-600">유지보수성:</span>
                              <span className="font-medium ml-1">{file.qualityMetrics.maintainabilityIndex}</span>
                            </div>
                          )}
                          {file.qualityMetrics.cyclomaticComplexity && (
                            <div>
                              <span className="text-gray-600">복잡도:</span>
                              <span className="font-medium ml-1">{file.qualityMetrics.cyclomaticComplexity}</span>
                            </div>
                          )}
                          {file.qualityMetrics.codeSmells && (
                            <div>
                              <span className="text-gray-600">코드 스멜:</span>
                              <span className="font-medium ml-1">{file.qualityMetrics.codeSmells}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );

        default:
          return <div>알 수 없는 분석 유형입니다.</div>;
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">상세 분석 결과</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {renderModalContent()}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Header />
      <div className="flex min-h-screen bg-gray-50">
        {/* 사이드바 */}
        <div className="w-64 bg-white shadow-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">메뉴</h2>
            <nav>
              {sideMenus.map((menu, index) => (
                <a
                  key={index}
                  href={menu.href}
                  className="flex items-center py-2 px-3 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors mb-1"
                >
                  {menu.icon}
                  {menu.name}
                </a>
              ))}
            </nav>
          </div>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            {/* 헤더 */}
            <div className="mb-8">
              <button
                onClick={() => router.push('/productivity/code-review')}
                className="flex items-center text-gray-600 hover:text-gray-800 transition-colors mb-4"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                단일 파일 리뷰로 돌아가기
              </button>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-blue-500 p-2 rounded-xl">
                  <Package className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">통합 프로젝트 AI 코드리뷰</h1>
                  <p className="text-gray-700 mt-1">ZIP 업로드, 직접 입력, 개별 파일 - 원하는 방식으로 코드를 분석받아보세요</p>
                </div>
              </div>

              {/* 보안 및 개인정보 보호 고지사항 */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-lg">🛡️</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      🔒 보안 및 개인정보 보호 안내
                    </h3>
                    <div className="space-y-3 text-sm text-blue-800">
                      <div className="flex items-start gap-3">
                        <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span><strong>민감정보 자동 제거:</strong> 이메일, 전화번호, 주민등록번호, API 키, 비밀번호 등이 <code className="bg-blue-100 px-1 py-0.5 rounded text-xs">[SANITIZED]</code>로 자동 익명화됩니다.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span><strong>개인정보보호법 준수:</strong> GDPR 및 한국 개인정보보호법에 따라 모든 개인식별정보가 보호됩니다.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span><strong>구조적 분석:</strong> 코드를 기능별(🔐인증, 💳결제, 🔌API, 🎨UI)로 그룹화하여 최소한의 정보만 AI 분석에 사용됩니다.</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-green-600 font-bold flex-shrink-0 mt-0.5">✓</span>
                        <span><strong>데이터 최소화:</strong> 정적 분석으로 기본 이슈 사전 해결, 익명화된 요약만 AI 전송하여 <strong className="text-blue-900">최대 85% 토큰 절약</strong>과 함께 보안을 강화합니다.</span>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-blue-100 rounded-lg">
                      <p className="text-xs text-blue-700 leading-relaxed">
                        <strong className="text-blue-900">🔧 처리 예시:</strong><br/>
                        • <code className="bg-white px-1 py-0.5 rounded">const userEmail = 'john@company.com'</code> → <code className="bg-white px-1 py-0.5 rounded">const userEmail = '[SANITIZED]'</code><br/>
                        • <code className="bg-white px-1 py-0.5 rounded">/Users/username/project</code> → <code className="bg-white px-1 py-0.5 rounded">/Users/[USER]/project</code><br/>
                        • <code className="bg-white px-1 py-0.5 rounded">getUserSSN()</code> → <code className="bg-white px-1 py-0.5 rounded">fn_getSensitiveData()</code>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700">{error}</span>
              </div>
            )}

            {/* 프로젝트 기본 정보 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Target className="w-6 h-6 text-purple-500" />
                📊 프로젝트 정보
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📝 프로젝트 이름
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="예: 쇼핑몰 프론트엔드"
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                  />
                  <p className="text-xs text-gray-500 mt-1">분석 결과에 표시될 프로젝트명입니다</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🏢 산업 분야
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full p-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-black"
                  >
                    {industries.map(ind => (
                      <option key={ind.value} value={ind.value}>
                        {ind.icon} {ind.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">업계 특화 분석을 위한 분야 선택</p>
                </div>
              </div>
            </div>

            {/* 입력 모드 선택 */}
            <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                <Code className="w-6 h-6 text-blue-500" />
                🔧 분석 방식 선택
              </h2>
              
              {/* 입력 모드 탭 */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setInputMode('text')}
                  className={`flex-1 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                    inputMode === 'text' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  📝 직접 입력
                </button>
                <button
                  onClick={() => setInputMode('files')}
                  className={`flex-1 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                    inputMode === 'files' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Files className="w-4 h-4" />
                  📄 개별 파일
                </button>
                <button
                  onClick={() => setInputMode('zip')}
                  className={`flex-1 py-3 px-4 rounded-md font-medium transition-all flex items-center justify-center gap-2 ${
                    inputMode === 'zip' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Archive className="w-4 h-4" />
                  📁 ZIP 업로드
                </button>
              </div>

              {/* 직접 입력 모드 */}
              {inputMode === 'text' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">📝 파일별 코드 입력</h3>
                    <button
                      onClick={addTextFile}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      파일 추가
                    </button>
                  </div>
                  
                  {/* 파일 탭 */}
                  <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4 overflow-x-auto">
                    {textFiles.map(file => (
                      <div key={file.id} className="flex items-center">
                        <button
                          onClick={() => setActiveFileId(file.id)}
                          className={`py-2 px-4 rounded-md font-medium transition-all whitespace-nowrap ${
                            activeFileId === file.id 
                              ? 'bg-white text-blue-600 shadow-sm' 
                              : 'text-gray-600 hover:text-gray-800'
                          }`}
                        >
                          {file.name}
                        </button>
                        {textFiles.length > 1 && (
                          <button
                            onClick={() => removeTextFile(file.id)}
                            className="ml-1 p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  
                  {/* 활성 파일 편집 */}
                  {activeFile && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            파일명
                          </label>
                          <input
                            type="text"
                            value={activeFile.name}
                            onChange={(e) => updateTextFile(activeFile.id, { name: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            파일 경로
                          </label>
                          <input
                            type="text"
                            value={activeFile.path}
                            onChange={(e) => updateTextFile(activeFile.id, { path: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            언어
                          </label>
                          <select
                            value={activeFile.language}
                            onChange={(e) => updateTextFile(activeFile.id, { language: e.target.value })}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                          >
                            {languageOptions.map(lang => (
                              <option key={lang.value} value={lang.value}>
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          코드 내용
                        </label>
                        <textarea
                          value={activeFile.content}
                          onChange={(e) => updateTextFile(activeFile.id, { content: e.target.value })}
                          placeholder="여기에 코드를 입력하세요..."
                          rows={15}
                          className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm text-black"
                        />
                        <p className="text-sm text-gray-600 mt-1">
                          {activeFile.content.length}자 • {activeFile.content.split('\n').length}줄
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 개별 파일 업로드 모드 */}
              {inputMode === 'files' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📄 개별 파일 업로드</h3>
                  
                  {/* 파일 드롭 영역 */}
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
                      isDragging 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-400'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <Files className={`w-12 h-12 mx-auto mb-4 ${
                      isDragging ? 'text-blue-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="file"
                      multiple
                      accept=".js,.jsx,.ts,.tsx,.vue,.py,.java,.cpp,.c,.cs,.php,.rb,.go,.rs,.json,.md,.txt"
                      onChange={(e) => e.target.files && handleIndividualFiles(e.target.files)}
                      className="hidden"
                      id="individual-files"
                    />
                    <label htmlFor="individual-files" className="cursor-pointer">
                      <span className={`text-lg font-medium ${
                        isDragging ? 'text-blue-700' : 'text-gray-900'
                      }`}>
                        {isDragging ? '파일을 여기에 놓으세요!' : '파일을 선택하거나 여기에 드래그하세요'}
                      </span>
                      <p className={`mt-2 ${
                        isDragging ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        여러 파일을 한 번에 선택할 수 있습니다 (최대 50MB/파일)
                      </p>
                    </label>
                  </div>
                  
                  {/* 업로드된 파일 목록 */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">업로드된 파일 ({uploadedFiles.length}개)</h4>
                      {uploadedFiles.map(file => (
                        <div key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <div>
                              <p className="font-medium text-gray-900">{file.name}</p>
                              <p className="text-sm text-gray-600">{file.language} • {file.content?.length || 0}자</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setUploadedFiles(prev => prev.filter(f => f.id !== file.id))}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ZIP 업로드 모드 */}
              {inputMode === 'zip' && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">📁 ZIP 파일 업로드</h3>
                  
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center mb-6 transition-colors ${
                      isDragging 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-300 hover:border-purple-400'
                    }`}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleZipDrop}
                  >
                    <Archive className={`w-12 h-12 mx-auto mb-4 ${
                      isDragging ? 'text-purple-500' : 'text-gray-400'
                    }`} />
                    <input
                      type="file"
                      accept=".zip,.rar"
                      onChange={(e) => setSelectedZipFile(e.target.files?.[0] || null)}
                      className="hidden"
                      id="zip-upload"
                    />
                    <label htmlFor="zip-upload" className="cursor-pointer">
                      <span className={`text-lg font-medium ${
                        isDragging ? 'text-purple-700' : 'text-gray-900'
                      }`}>
                        {isDragging ? 'ZIP 파일을 여기에 놓으세요!' : 'ZIP 파일을 선택하세요'}
                      </span>
                      <p className={`mt-2 ${
                        isDragging ? 'text-purple-600' : 'text-gray-600'
                      }`}>
                        전체 프로젝트를 압축해서 업로드 (최대 500MB)<br/>
                      💡 <span className="text-blue-600 font-medium">빠른 분석</span>: 핵심 파일을 선별하여 시간 단축
                      </p>
                    </label>
                    {selectedZipFile && (
                      <div className="mt-4 p-3 bg-green-50 rounded-lg">
                        <p className="text-green-800 font-medium">{selectedZipFile.name}</p>
                        <p className="text-green-600 text-sm">{(selectedZipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 text-sm">
                      ✅ ZIP 파일 업로드가 지원됩니다! 전체 프로젝트를 압축하여 한 번에 분석받아보세요.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 분석 깊이 설정 */}
            {currentStep === 'input' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  ⏱️ 분석 속도 선택
                </h2>
                <div className="space-y-4">
                  <div>
                                         <label className="block text-sm font-medium text-gray-700 mb-3">
                       ⏱️ 분석 소요 시간
                     </label>
                     <div className="grid md:grid-cols-3 gap-4">
                       <label className={`border rounded-lg p-4 cursor-pointer transition-all ${
                         analysisDepth === 'surface' 
                           ? 'border-purple-500 bg-purple-50' 
                           : 'border-gray-200 hover:border-gray-300'
                       }`}>
                         <input
                           type="radio"
                           name="analysisDepth"
                           value="surface"
                           checked={analysisDepth === 'surface'}
                           onChange={(e) => setAnalysisDepth(e.target.value)}
                           className="sr-only"
                         />
                         <div className="text-center">
                           <div className="text-2xl mb-2">⚡</div>
                           <div className="font-semibold text-gray-900">빠른 분석</div>
                           <div className="text-sm text-gray-600 mt-2">
                             📋 핵심 파일만 분석<br/>
                             ⏱️ <span className="font-medium text-green-600">1-2분 완료</span>
                           </div>
                         </div>
                       </label>
                       
                       <label className={`border rounded-lg p-4 cursor-pointer transition-all ${
                         analysisDepth === 'deep' 
                           ? 'border-purple-500 bg-purple-50' 
                           : 'border-gray-200 hover:border-gray-300'
                       }`}>
                         <input
                           type="radio"
                           name="analysisDepth"
                           value="deep"
                           checked={analysisDepth === 'deep'}
                           onChange={(e) => setAnalysisDepth(e.target.value)}
                           className="sr-only"
                         />
                         <div className="text-center">
                           <div className="text-2xl mb-2">🎯</div>
                           <div className="font-semibold text-gray-900">표준 분석</div>
                           <div className="text-sm text-gray-600 mt-2">
                             📚 주요 파일 포함 분석<br/>
                             ⏱️ <span className="font-medium text-blue-600">3-5분 완료</span> <span className="text-blue-600">추천</span>
                           </div>
                         </div>
                       </label>
                       
                       <label className={`border rounded-lg p-4 cursor-pointer transition-all ${
                         analysisDepth === 'comprehensive' 
                           ? 'border-purple-500 bg-purple-50' 
                           : 'border-gray-200 hover:border-gray-300'
                       }`}>
                         <input
                           type="radio"
                           name="analysisDepth"
                           value="comprehensive"
                           checked={analysisDepth === 'comprehensive'}
                           onChange={(e) => setAnalysisDepth(e.target.value)}
                           className="sr-only"
                         />
                         <div className="text-center">
                           <div className="text-2xl mb-2">🔍</div>
                           <div className="font-semibold text-gray-900">상세 분석</div>
                           <div className="text-sm text-gray-600 mt-2">
                             📖 모든 파일 꼼꼼히 분석<br/>
                             ⏱️ <span className="font-medium text-orange-600">5-8분 완료</span>
                           </div>
                         </div>
                       </label>
                     </div>
                     
                     <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                       <p className="text-blue-800 text-sm">
                         💡 <strong>스마트 최적화</strong>: 프로젝트 규모에 맞춰 분석 시간을 조절합니다.
                         대형 프로젝트는 핵심 파일을 우선 선별하여 효율적으로 분석해드려요! 
                       </p>
                     </div>
                  </div>
                </div>
              </div>
            )}

            {/* 분석 실행 버튼 */}
            {currentStep === 'input' && (
              <div className="text-center mb-8">
                <button
                  onClick={performAnalysis}
                  disabled={loading || (inputMode === 'text' && textFiles.every(f => !f.content.trim())) || 
                           (inputMode === 'files' && uploadedFiles.length === 0) ||
                           (inputMode === 'zip' && !selectedZipFile)}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-4 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all font-bold text-lg disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-3 shadow-lg mx-auto"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      🤖 AI가 프로젝트를 분석하고 있어요...
                    </>
                  ) : (
                    <>
                      <Zap className="w-6 h-6" />
                      🚀 AI 프로젝트 분석 시작!
                    </>
                  )}
                </button>
              </div>
            )}

            {/* 상세 로딩 화면 */}
            {currentStep === 'analysis' && loading && (
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                <div className="text-center mb-8">
                  <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-4 rounded-xl mb-6">
                    <Loader2 className="w-12 h-12 animate-spin mx-auto text-purple-600 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">🛡️ 보안 강화 AI 분석 진행 중</h2>
                    <div className="text-gray-600 space-y-2">
                      <p>민감정보 보호와 함께 프로젝트를 단계별로 분석하고 있습니다.</p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                        <p className="text-sm text-blue-800">
                          <strong>🔒 진행 중인 스마트 처리:</strong> 정적 분석 → 개인정보 제거 → 스마트 GPT 분석 → 결과 통합 (최대 85% 토큰 절약)
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* 현재 단계 표시 */}
                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-lg font-semibold text-gray-900">
                        📊 {loadingProgress.stage} 단계
                      </span>
                      <span className="text-lg font-bold text-purple-600">
                        {Math.round(loadingProgress.progress)}%
                      </span>
                    </div>
                    
                    {/* 진행률 바 */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-blue-500 h-4 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${loadingProgress.progress}%` }}
                      ></div>
                    </div>
                    
                    {/* 현재 작업 메시지 */}
                    <p className="text-gray-700 text-center mb-4">
                      {loadingProgress.message}
                    </p>
                    
                    {/* 시간 정보 */}
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>
                        경과 시간: {(() => {
                          const elapsed = Math.round(loadingProgress.timeElapsed / 1000);
                          const minutes = Math.floor(elapsed / 60);
                          const seconds = elapsed % 60;
                          return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
                        })()}
                      </span>
                      <span>
                        남은 시간: {(() => {
                          const remaining = Math.max(0, Math.round((loadingProgress.estimatedTotal - loadingProgress.timeElapsed) / 1000));
                          const minutes = Math.floor(remaining / 60);
                          const seconds = remaining % 60;
                          if (remaining <= 0) return '곧 완료';
                          return minutes > 0 ? `약 ${minutes}분 ${seconds}초` : `약 ${seconds}초`;
                        })()}
                      </span>
                    </div>
                  </div>
                  
                  {/* 분석 단계별 체크리스트 */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">🔍 분석 진행 상황</h3>
                    <div className="space-y-3">
                      {[
                        { stage: '업로드', icon: '📁', name: '파일 업로드' },
                        { stage: '추출', icon: '🔓', name: 'ZIP 압축 해제' },
                        { stage: '구조분석', icon: '📋', name: '프로젝트 구조 분석' },
                        { stage: '정적분석', icon: '🔧', name: '정적 분석 (ESLint, Bandit)' },
                        { stage: '기능그룹핑', icon: '🧩', name: '기능별 그룹핑' },
                        { stage: '민감정보제거', icon: '🛡️', name: '민감정보 제거 & 익명화' },
                        { stage: '그룹분석', icon: '🔍', name: '스마트 AI 분석' },
                        { stage: '중간요약', icon: '📝', name: '중간 요약 생성' },
                        { stage: '메타분석', icon: '🎯', name: '메타 분석 통합' },
                        { stage: '완료', icon: '📊', name: '최종 결과 생성' }
                      ].map((step, index) => (
                        <div key={step.stage} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            loadingProgress.stage === step.stage 
                              ? 'bg-purple-100 text-purple-700 ring-2 ring-purple-300' 
                              : ['업로드', '추출', '구조분석', '정적분석', '기능그룹핑', '민감정보제거', '그룹분석', '중간요약', '메타분석'].indexOf(loadingProgress.stage) > 
                                ['업로드', '추출', '구조분석', '정적분석', '기능그룹핑', '민감정보제거', '그룹분석', '중간요약', '메타분석'].indexOf(step.stage)
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {['업로드', '추출', '구조분석', '정적분석', '기능그룹핑', '민감정보제거', '그룹분석', '중간요약', '메타분석'].indexOf(loadingProgress.stage) > 
                             ['업로드', '추출', '구조분석', '정적분석', '기능그룹핑', '민감정보제거', '그룹분석', '중간요약', '메타분석'].indexOf(step.stage) 
                              ? '✓' 
                              : loadingProgress.stage === step.stage 
                              ? step.icon 
                              : index + 1}
                          </div>
                          <span className={`${
                            loadingProgress.stage === step.stage 
                              ? 'text-purple-700 font-medium' 
                              : ['업로드', '추출', '구조분석', 'AI분석', '구조검토', '보안검사', '성능분석', '유지보수'].indexOf(loadingProgress.stage) > 
                                ['업로드', '추출', '구조분석', 'AI분석', '구조검토', '보안검사', '성능분석', '유지보수'].indexOf(step.stage)
                              ? 'text-green-700' 
                              : 'text-gray-500'
                          }`}>
                            {step.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 상세 분석 결과 */}
            {currentStep === 'complete' && reviewResult && (
              <div className="space-y-8">
                {/* 종합 점수 */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Award className="w-6 h-6 text-yellow-500" />
                      🏆 종합 분석 결과
                    </h2>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">분석 모드</div>
                      <div className="text-sm font-medium text-purple-600">
                        {analysisDepth === 'surface' ? '⚡ 빠른 분석' : 
                         analysisDepth === 'deep' ? '🎯 표준 분석' : 
                         '🔍 상세 분석'}
                      </div>
                    </div>
                  </div>

                  {/* 보안 처리 완료 배지 */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-3 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 text-sm">✓</span>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-green-900">🛡️ 보안 처리 완료</span>
                          <p className="text-xs text-green-700">모든 민감정보가 안전하게 익명화되어 분석되었습니다</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-green-700 ml-auto">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          GDPR 준수
                        </span>
                                                 <span className="flex items-center gap-1">
                           <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                           85% 토큰 절약
                         </span>
                         <span className="flex items-center gap-1">
                           <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                           스마트 분석
                         </span>
                         <span className="flex items-center gap-1">
                           <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                           정적 분석 연동
                         </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                    <div className="text-center">
                      <div className={`text-4xl font-bold mb-2 ${getScoreColor(reviewResult.overallScore)}`}>
                        {reviewResult.overallScore}
                      </div>
                      <div className="text-sm text-gray-600">종합 점수</div>
                      <div className={`mt-2 w-full h-2 rounded-full ${getScoreBgColor(reviewResult.overallScore)}`}>
                        <div 
                          className={`h-full rounded-full ${reviewResult.overallScore >= 80 ? 'bg-green-500' : reviewResult.overallScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${reviewResult.overallScore}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {[
                      { 
                        label: '🏗️ 구조', 
                        score: reviewResult.architectureScore, 
                        icon: <Package className="w-4 h-4" />,
                        type: 'structure',
                        data: reviewResult.projectAnalysis.structure
                      },
                      { 
                        label: '🔒 보안', 
                        score: reviewResult.securityScore, 
                        icon: <Shield className="w-4 h-4" />,
                        type: 'security',
                        data: reviewResult.securityAnalysis
                      },
                      { 
                        label: '⚡ 성능', 
                        score: reviewResult.performanceScore, 
                        icon: <Zap className="w-4 h-4" />,
                        type: 'performance',
                        data: reviewResult.performanceAnalysis
                      },
                      { 
                        label: '🛠️ 유지보수성', 
                        score: reviewResult.maintainabilityScore, 
                        icon: <Target className="w-4 h-4" />,
                        type: 'maintainability',
                        data: { score: reviewResult.maintainabilityScore }
                      },
                    ].map((item, index) => (
                      <div 
                        key={index} 
                        className="text-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors group"
                        onClick={() => setSelectedModal({ type: item.type as any, data: item.data })}
                      >
                        <div className={`text-2xl font-bold mb-2 ${getScoreColor(item.score)}`}>
                          {item.score}
                        </div>
                        <div className="text-sm text-gray-600 flex items-center justify-center gap-1">
                          {item.icon}
                          {item.label}
                          <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className={`mt-2 w-full h-1.5 rounded-full ${getScoreBgColor(item.score)}`}>
                          <div 
                            className={`h-full rounded-full ${item.score >= 80 ? 'bg-green-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          클릭하여 상세 보기
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 의존성 및 패턴 분석 */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <Package className="w-6 h-6 text-blue-500" />
                    🔍 상세 분석 항목
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* 의존성 분석 */}
                    <div 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setSelectedModal({ type: 'dependencies', data: reviewResult.projectAnalysis.dependencies })}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-purple-100 p-2 rounded-lg">
                          <Database className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">📦 의존성 분석</h4>
                          <p className="text-sm text-gray-600">라이브러리 및 패키지 검토</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">전체 점수</span>
                          <span className={`font-bold ${getScoreColor(reviewResult.projectAnalysis.dependencies.score || 75)}`}>
                            {reviewResult.projectAnalysis.dependencies.score || 75}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>

                    {/* 패턴 분석 */}
                    <div 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setSelectedModal({ type: 'patterns', data: reviewResult.projectAnalysis.patterns })}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-green-100 p-2 rounded-lg">
                          <Code className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">🎨 패턴 분석</h4>
                          <p className="text-sm text-gray-600">코딩 패턴 및 아키텍처</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">전체 점수</span>
                          <span className={`font-bold ${getScoreColor(reviewResult.projectAnalysis.patterns.score || 80)}`}>
                            {reviewResult.projectAnalysis.patterns.score || 80}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>

                    {/* 메타데이터 분석 */}
                    <div 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setSelectedModal({ type: 'metadata', data: { summary: reviewResult.summary, overallScore: reviewResult.overallScore } })}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="bg-yellow-100 p-2 rounded-lg">
                          <Info className="w-5 h-5 text-yellow-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">📊 종합 평가</h4>
                          <p className="text-sm text-gray-600">전체적인 품질 평가</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">종합 점수</span>
                          <span className={`font-bold ${getScoreColor(reviewResult.overallScore)}`}>
                            {reviewResult.overallScore}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 파일별 분석 결과 */}
                {reviewResult.fileAnalysis && reviewResult.fileAnalysis.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-lg p-8">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-6 h-6 text-purple-500" />
                        📄 파일별 분석 ({reviewResult.fileAnalysis.length}개 파일)
                      </h3>
                      <button
                        onClick={() => setSelectedModal({ type: 'files', data: reviewResult.fileAnalysis })}
                        className="bg-purple-100 text-purple-700 px-4 py-2 rounded-lg hover:bg-purple-200 transition-colors flex items-center gap-2"
                      >
                        <ExternalLink className="w-4 h-4" />
                        전체 보기
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {reviewResult.fileAnalysis.slice(0, 6).map((file, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-gray-900 text-sm truncate">{file.path}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`font-bold ${getScoreColor(file.score)}`}>
                              {file.score}/100
                            </span>
                            <span className="text-xs text-gray-600">
                              {file.issues?.length || 0}개 이슈
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 개선 권장사항 */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-green-500" />
                    💡 개선 권장사항
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-red-50 rounded-lg p-6">
                      <h4 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        🚨 즉시 수정 필요
                      </h4>
                      <ul className="space-y-2">
                        {reviewResult.recommendations.immediate.map((item, index) => (
                          <li key={index} className="text-sm text-red-800 flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-yellow-50 rounded-lg p-6">
                      <h4 className="font-semibold text-yellow-900 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        📋 단기 개선사항
                      </h4>
                      <ul className="space-y-2">
                        {reviewResult.recommendations.shortTerm.map((item, index) => (
                          <li key={index} className="text-sm text-yellow-800 flex items-start gap-2">
                            <span className="text-yellow-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-6">
                      <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        🎯 장기 개선사항
                      </h4>
                      <ul className="space-y-2">
                        {reviewResult.recommendations.longTerm.map((item, index) => (
                          <li key={index} className="text-sm text-green-800 flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 요약 */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    📋 분석 요약
                  </h3>
                  <p className="text-gray-700 leading-relaxed">{reviewResult.summary}</p>
                </div>

                {/* 새 분석 버튼 */}
                <div className="text-center">
                  <button
                    onClick={() => {
                      setCurrentStep('input');
                      setReviewResult(null);
                      setError(null);
                    }}
                    className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-8 py-3 rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all font-medium shadow-lg"
                  >
                    🔄 새 프로젝트 분석하기
                  </button>
                </div>
              </div>
            )}

            {/* 상세 분석 모달 */}
            {selectedModal.type && (
              <DetailModal
                type={selectedModal.type}
                data={selectedModal.data}
                onClose={() => setSelectedModal({ type: null })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
} 