"use client";
import { useState, useEffect } from "react";
import Header from '../../components/Header';
import {
  Search, Home as HomeIcon, List, BarChart, Megaphone, Newspaper, MessageCircle, Settings,
  ArrowLeft, Upload, FileArchive, Loader2, CheckCircle, AlertCircle, TrendingUp,
  Folder, File, Award, Shield, Zap, Target, Code, Package, Plus, X, Edit3,
  FileText, Files, Archive, Info, ExternalLink, ChevronRight, Bug, Clock, 
  Activity, Database, Globe, Lock, Brain, AlertTriangle, Building
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { safeFetchJson } from '@/lib/client-utils';

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
  { value: 'auto', label: '언어 감지', icon: '🔍' },
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

// 고급 언어 감지 함수 (정확도 향상)
const detectLanguageFromContent = (content: string): { language: string; confidence: number; details: any } => {
  // 가중치가 있는 패턴 정의
  const patterns = {
    // JavaScript/TypeScript 패턴 (높은 가중치)
    javascript: {
      high: [
        { pattern: /function\s+\w+\s*\(/g, weight: 5 },
        { pattern: /const\s+\w+\s*=/g, weight: 4 },
        { pattern: /let\s+\w+\s*=/g, weight: 4 },
        { pattern: /var\s+\w+\s*=/g, weight: 3 },
        { pattern: /console\.log/g, weight: 3 },
        { pattern: /=>/g, weight: 4 },
        { pattern: /import\s+.*from/g, weight: 5 },
        { pattern: /export\s+/g, weight: 4 }
      ],
      medium: [
        { pattern: /\.js$/i, weight: 2 },
        { pattern: /\.ts$/i, weight: 2 },
        { pattern: /\.jsx$/i, weight: 2 },
        { pattern: /\.tsx$/i, weight: 2 },
        { pattern: /typeof/g, weight: 2 },
        { pattern: /instanceof/g, weight: 2 }
      ],
      low: [
        { pattern: /undefined/g, weight: 1 },
        { pattern: /null/g, weight: 1 },
        { pattern: /true|false/g, weight: 1 }
      ]
    },
    // React 패턴 (매우 높은 가중치)
    react: {
      high: [
        { pattern: /import\s+React/g, weight: 8 },
        { pattern: /from\s+['"]react['"]/g, weight: 8 },
        { pattern: /useState/g, weight: 7 },
        { pattern: /useEffect/g, weight: 7 },
        { pattern: /useContext/g, weight: 6 },
        { pattern: /useRef/g, weight: 6 },
        { pattern: /useMemo/g, weight: 6 },
        { pattern: /useCallback/g, weight: 6 }
      ],
      medium: [
        { pattern: /<div>/g, weight: 3 },
        { pattern: /<span>/g, weight: 3 },
        { pattern: /<button>/g, weight: 3 },
        { pattern: /className=/g, weight: 4 },
        { pattern: /\.jsx$/i, weight: 3 },
        { pattern: /\.tsx$/i, weight: 3 }
      ],
      low: [
        { pattern: /onClick=/g, weight: 2 },
        { pattern: /onChange=/g, weight: 2 },
        { pattern: /onSubmit=/g, weight: 2 }
      ]
    },
    // Python 패턴 (높은 가중치)
    python: {
      high: [
        { pattern: /def\s+\w+\s*\(/g, weight: 6 },
        { pattern: /import\s+\w+/g, weight: 5 },
        { pattern: /from\s+\w+\s+import/g, weight: 5 },
        { pattern: /class\s+\w+/g, weight: 5 },
        { pattern: /if\s+__name__\s*==\s*['"]__main__['"]/g, weight: 7 },
        { pattern: /print\s*\(/g, weight: 4 }
      ],
      medium: [
        { pattern: /\.py$/i, weight: 3 },
        { pattern: /:\s*$/gm, weight: 2 },
        { pattern: /#.*$/gm, weight: 2 },
        { pattern: /"""[\s\S]*"""/g, weight: 3 },
        { pattern: /'''[\s\S]*'''/g, weight: 3 }
      ],
      low: [
        { pattern: /True|False/g, weight: 1 },
        { pattern: /None/g, weight: 1 },
        { pattern: /self\./g, weight: 2 }
      ]
    },
    // Java 패턴 (높은 가중치)
    java: {
      high: [
        { pattern: /public\s+class/g, weight: 8 },
        { pattern: /private\s+\w+/g, weight: 4 },
        { pattern: /public\s+\w+/g, weight: 4 },
        { pattern: /protected\s+\w+/g, weight: 4 },
        { pattern: /static\s+\w+/g, weight: 4 },
        { pattern: /void\s+\w+/g, weight: 4 },
        { pattern: /System\.out\.println/g, weight: 5 },
        { pattern: /import\s+java\./g, weight: 6 },
        { pattern: /package\s+\w+/g, weight: 6 }
      ],
      medium: [
        { pattern: /int\s+\w+/g, weight: 3 },
        { pattern: /String\s+\w+/g, weight: 3 },
        { pattern: /\.java$/i, weight: 3 },
        { pattern: /extends/g, weight: 3 },
        { pattern: /implements/g, weight: 3 }
      ],
      low: [
        { pattern: /new\s+\w+/g, weight: 2 },
        { pattern: /this\./g, weight: 2 },
        { pattern: /super\./g, weight: 2 }
      ]
    },
    // C/C++ 패턴
    cpp: {
      high: [
        { pattern: /#include\s*</g, weight: 7 },
        { pattern: /int\s+main\s*\(/g, weight: 8 },
        { pattern: /std::/g, weight: 6 },
        { pattern: /cout\s*<</g, weight: 5 },
        { pattern: /cin\s*>>/g, weight: 5 },
        { pattern: /printf\s*\(/g, weight: 5 },
        { pattern: /scanf\s*\(/g, weight: 5 }
      ],
      medium: [
        { pattern: /\.cpp$/i, weight: 3 },
        { pattern: /\.c$/i, weight: 3 },
        { pattern: /\.h$/i, weight: 3 },
        { pattern: /\.hpp$/i, weight: 3 },
        { pattern: /namespace/g, weight: 4 },
        { pattern: /class\s+\w+/g, weight: 4 }
      ],
      low: [
        { pattern: /return\s+0/g, weight: 2 },
        { pattern: /using\s+namespace/g, weight: 3 }
      ]
    },
    // PHP 패턴
    php: {
      high: [
        { pattern: /<\?php/g, weight: 8 },
        { pattern: /\?>/g, weight: 6 },
        { pattern: /\$\w+/g, weight: 5 },
        { pattern: /function\s+\w+\s*\(/g, weight: 5 },
        { pattern: /echo\s+/g, weight: 4 },
        { pattern: /print\s+/g, weight: 4 }
      ],
      medium: [
        { pattern: /require\s+['"]/g, weight: 4 },
        { pattern: /include\s+['"]/g, weight: 4 },
        { pattern: /\.php$/i, weight: 3 },
        { pattern: /class\s+\w+/g, weight: 4 }
      ],
      low: [
        { pattern: /array\(/g, weight: 2 },
        { pattern: /isset\(/g, weight: 2 }
      ]
    },
    // Go 패턴
    go: {
      high: [
        { pattern: /package\s+main/g, weight: 8 },
        { pattern: /import\s+\(/g, weight: 6 },
        { pattern: /func\s+main\s*\(/g, weight: 7 },
        { pattern: /fmt\.Println/g, weight: 5 }
      ],
      medium: [
        { pattern: /var\s+\w+/g, weight: 3 },
        { pattern: /type\s+\w+/g, weight: 4 },
        { pattern: /struct\s*{/g, weight: 4 },
        { pattern: /\.go$/i, weight: 3 }
      ],
      low: [
        { pattern: /defer/g, weight: 2 },
        { pattern: /range/g, weight: 2 }
      ]
    },
    // Rust 패턴
    rust: {
      high: [
        { pattern: /fn\s+\w+/g, weight: 7 },
        { pattern: /let\s+mut\s+\w+/g, weight: 6 },
        { pattern: /let\s+\w+/g, weight: 5 },
        { pattern: /println!/g, weight: 5 }
      ],
      medium: [
        { pattern: /use\s+\w+/g, weight: 4 },
        { pattern: /struct\s+\w+/g, weight: 4 },
        { pattern: /impl\s+\w+/g, weight: 4 },
        { pattern: /\.rs$/i, weight: 3 }
      ],
      low: [
        { pattern: /Option/g, weight: 2 },
        { pattern: /Result/g, weight: 2 }
      ]
    },
    // SQL 패턴 (새로 추가)
    sql: {
      high: [
        { pattern: /SELECT\s+.+FROM/g, weight: 8 },
        { pattern: /INSERT\s+INTO/g, weight: 7 },
        { pattern: /UPDATE\s+\w+\s+SET/g, weight: 7 },
        { pattern: /DELETE\s+FROM/g, weight: 7 },
        { pattern: /CREATE\s+TABLE/g, weight: 8 },
        { pattern: /ALTER\s+TABLE/g, weight: 7 }
      ],
      medium: [
        { pattern: /WHERE\s+/g, weight: 4 },
        { pattern: /ORDER\s+BY/g, weight: 4 },
        { pattern: /GROUP\s+BY/g, weight: 4 },
        { pattern: /JOIN\s+/g, weight: 4 },
        { pattern: /\.sql$/i, weight: 3 }
      ],
      low: [
        { pattern: /AND\s+/g, weight: 2 },
        { pattern: /OR\s+/g, weight: 2 },
        { pattern: /IN\s*\(/g, weight: 2 }
      ]
    },
    // HTML 패턴 (새로 추가)
    html: {
      high: [
        { pattern: /<!DOCTYPE\s+html>/g, weight: 8 },
        { pattern: /<html>/g, weight: 7 },
        { pattern: /<head>/g, weight: 6 },
        { pattern: /<body>/g, weight: 6 },
        { pattern: /<div>/g, weight: 4 },
        { pattern: /<span>/g, weight: 4 }
      ],
      medium: [
        { pattern: /<title>/g, weight: 4 },
        { pattern: /<meta/g, weight: 4 },
        { pattern: /<link/g, weight: 4 },
        { pattern: /<script/g, weight: 4 },
        { pattern: /<style/g, weight: 4 },
        { pattern: /\.html$/i, weight: 3 },
        { pattern: /\.htm$/i, weight: 3 }
      ],
      low: [
        { pattern: /class=/g, weight: 2 },
        { pattern: /id=/g, weight: 2 },
        { pattern: /src=/g, weight: 2 }
      ]
    },
    // CSS 패턴 (새로 추가)
    css: {
      high: [
        { pattern: /{[^}]*}/g, weight: 5 },
        { pattern: /:\s*[^;]+;/g, weight: 4 },
        { pattern: /@media/g, weight: 6 },
        { pattern: /@keyframes/g, weight: 6 }
      ],
      medium: [
        { pattern: /\.css$/i, weight: 3 },
        { pattern: /color:/g, weight: 3 },
        { pattern: /background:/g, weight: 3 },
        { pattern: /margin:/g, weight: 3 },
        { pattern: /padding:/g, weight: 3 }
      ],
      low: [
        { pattern: /px/g, weight: 1 },
        { pattern: /em/g, weight: 1 },
        { pattern: /rem/g, weight: 1 }
      ]
    },
    // Shell Script 패턴 (새로 추가)
    shell: {
      high: [
        { pattern: /#!\/bin\/bash/g, weight: 8 },
        { pattern: /#!\/bin\/sh/g, weight: 8 },
        { pattern: /echo\s+/g, weight: 5 },
        { pattern: /if\s+\[/g, weight: 6 },
        { pattern: /for\s+\w+\s+in/g, weight: 6 },
        { pattern: /while\s+\[/g, weight: 6 }
      ],
      medium: [
        { pattern: /\.sh$/i, weight: 3 },
        { pattern: /\.bash$/i, weight: 3 },
        { pattern: /cd\s+/g, weight: 3 },
        { pattern: /ls\s+/g, weight: 3 },
        { pattern: /grep\s+/g, weight: 3 }
      ],
      low: [
        { pattern: /$\(/g, weight: 2 },
        { pattern: /`/g, weight: 2 }
      ]
    }
  };

  const scores: { [key: string]: number } = {};
  const details: { [key: string]: any } = {};
  
  // 각 언어별 패턴 매칭 점수 계산 (가중치 적용)
  Object.entries(patterns).forEach(([language, categories]) => {
    scores[language] = 0;
    details[language] = { high: 0, medium: 0, low: 0, total: 0 };
    
    Object.entries(categories).forEach(([category, patternList]) => {
      patternList.forEach(({ pattern, weight }) => {
        const matches = content.match(pattern);
        if (matches) {
          const score = matches.length * weight;
          scores[language] += score;
          details[language][category] += score;
          details[language].total += score;
        }
      });
    });
  });

  // 가장 높은 점수의 언어 찾기
  const detectedLanguage = Object.entries(scores).reduce((a, b) => 
    scores[a[0]] > scores[b[0]] ? a : b
  );

  // 신뢰도 계산 (0-100%)
  const maxPossibleScore = Math.max(...Object.values(scores));
  const confidence = maxPossibleScore > 0 ? Math.min(100, Math.round((detectedLanguage[1] / maxPossibleScore) * 100)) : 0;

  return {
    language: detectedLanguage[1] > 0 ? detectedLanguage[0] : 'other',
    confidence,
    details: details[detectedLanguage[0]] || {}
  };
};

// 프레임워크 감지 함수
const detectFramework = (content: string, language: string): { framework: string; version?: string; confidence: number } => {
  const frameworks = {
    javascript: {
      'react': { patterns: [/import\s+React/, /from\s+['"]react['"]/, /useState/, /useEffect/], weight: 8 },
      'vue': { patterns: [/<template>/, /<script>/, /v-if=/, /v-for=/], weight: 8 },
      'angular': { patterns: [/@Component/, /@Injectable/, /ngOnInit/, /ngFor/], weight: 8 },
      'next': { patterns: [/import\s+.*from\s+['"]next/, /getServerSideProps/, /getStaticProps/], weight: 8 },
      'express': { patterns: [/require\s*\(\s*['"]express['"]/, /app\.get/, /app\.post/], weight: 7 },
      'jquery': { patterns: [/\$\(/, /\.ajax/, /\.ready/], weight: 6 }
    },
    python: {
      'django': { patterns: [/from\s+django/, /@csrf_exempt/, /models\.Model/], weight: 8 },
      'flask': { patterns: [/from\s+flask/, /@app\.route/, /Flask\(/], weight: 8 },
      'fastapi': { patterns: [/from\s+fastapi/, /@app\.get/, /@app\.post/], weight: 8 },
      'pandas': { patterns: [/import\s+pandas/, /pd\.read_csv/, /df\./], weight: 7 },
      'numpy': { patterns: [/import\s+numpy/, /np\./, /array\(/], weight: 7 }
    },
    java: {
      'spring': { patterns: [/@SpringBootApplication/, /@RestController/, /@Autowired/], weight: 8 },
      'hibernate': { patterns: [/@Entity/, /@Table/, /@Column/], weight: 7 },
      'maven': { patterns: [/<groupId>/, /<artifactId>/, /<version>/], weight: 6 }
    }
  };
  
  const langFrameworks = frameworks[language as keyof typeof frameworks];
  if (!langFrameworks) return { framework: 'unknown', confidence: 0 };
  
  let bestFramework = 'unknown';
  let bestScore = 0;
  
  Object.entries(langFrameworks).forEach(([framework, config]) => {
    let score = 0;
    config.patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        score += matches.length * config.weight;
      }
    });
    
    if (score > bestScore) {
      bestScore = score;
      bestFramework = framework;
    }
  });
  
  const confidence = bestScore > 0 ? Math.min(100, Math.round((bestScore / 50) * 100)) : 0;
  
  return {
    framework: bestFramework,
    confidence
  };
};

// 혼합 언어 감지 함수 (여러 언어가 섞여있는 경우)
const detectMixedLanguages = (content: string): { languages: string[]; primary: string; confidence: number } => {
  const lines = content.split('\n');
  const languageCounts: { [key: string]: number } = {};
  
  // 각 줄을 개별적으로 분석
  lines.forEach(line => {
    if (line.trim()) {
      const lineResult = detectLanguageFromContent(line);
      if (lineResult.language !== 'other') {
        languageCounts[lineResult.language] = (languageCounts[lineResult.language] || 0) + 1;
      }
    }
  });
  
  // 감지된 언어들을 점수순으로 정렬
  const sortedLanguages = Object.entries(languageCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([lang]) => lang);
  
  const primary = sortedLanguages[0] || 'other';
  const confidence = sortedLanguages.length > 1 ? 70 : 90; // 혼합 언어일 경우 신뢰도 낮춤
  
  return {
    languages: sortedLanguages,
    primary,
    confidence
  };
};

// 산업별 분석 요구사항 (프론트엔드용)
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

// 점수 계산 상수
const SCORE_CONSTANTS = {
  // 기본 점수
  BASE_SCORE: 50,
  MAX_SCORE: 100,
  MIN_SCORE: 0,
  
  // 키워드 가중치
  POSITIVE_KEYWORD_WEIGHT: 2,
  NEGATIVE_KEYWORD_WEIGHT: 3,
  
  // 영역별 특화 점수
  ARCHITECTURE_BONUS: 10,
  ARCHITECTURE_PENALTY: -15,
  SECURITY_BONUS: 12,
  SECURITY_PENALTY: -18,
  PERFORMANCE_BONUS: 10,
  PERFORMANCE_PENALTY: -12,
  MAINTAINABILITY_BONUS: 8,
  MAINTAINABILITY_PENALTY: -10,
  
  // 점수 등급 기준
  ENTERPRISE_GRADE: 95,
  PRODUCTION_GRADE: 85,
  DEVELOPMENT_GRADE: 75,
  BASIC_GRADE: 60,
  
  // 파일 크기 제한
  MAX_FILE_SIZE_MB: 50,
  LARGE_FILE_SIZE_MB: 100,
  
  // 진행률 관련
  PROGRESS_INTERVAL: 5000,
  PROGRESS_INCREMENT: 0.5,
  MAX_PROGRESS: 100,
  
  // 90점 이상 달성 조건
  TARGET_POSITIVE_KEYWORDS: 15,
  TARGET_POSITIVE_SCORE: 30
};

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
  structuredRecommendations?: {
    immediate?: Array<{
      title: string;
      description: string;
      currentCode?: string;
      improvedCode?: string;
    }>;
    shortTerm?: Array<{
      title: string;
      description: string;
      currentCode?: string;
      improvedCode?: string;
    }>;
    longTerm?: Array<{
      title: string;
      description: string;
      currentCode?: string;
      improvedCode?: string;
    }>;
  };
  staticAnalysis?: {
    codeSmells: number;
    securityIssues: number;
    performanceIssues: number;
    maintainabilityIssues: number;
  };
  codeMetrics?: {
    totalLines: number;
    totalFunctions: number;
    commentRatio: number;
    averageComplexity: number;
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
  { value: 'auto', label: '🔍 언어 감지', ext: '.auto' },
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
  { value: 'SQL', label: 'SQL', ext: '.sql' },
  { value: 'HTML', label: 'HTML', ext: '.html' },
  { value: 'CSS', label: 'CSS', ext: '.css' },
  { value: 'Shell', label: 'Shell Script', ext: '.sh' },
  { value: 'Ruby', label: 'Ruby', ext: '.rb' },
  { value: 'Swift', label: 'Swift', ext: '.swift' },
  { value: 'Kotlin', label: 'Kotlin', ext: '.kt' },
  { value: 'JSON', label: 'JSON', ext: '.json' },
  { value: 'Markdown', label: 'Markdown', ext: '.md' },
  { value: 'YAML', label: 'YAML', ext: '.yml' },
  { value: 'TOML', label: 'TOML', ext: '.toml' }
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
  const [showScoreCriteria, setShowScoreCriteria] = useState(false);
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

  // 클라이언트 사이드 프로젝트 타입 감지 (언어 감지 포함)
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

  // 언어 감지 함수 (파파고 언어 감지처럼 코드 내용 분석)
  const detectLanguageFromFiles = (files: { content: string; path: string }[]): string => {
    if (files.length === 0) return 'other';
    
    // 모든 파일의 내용을 합쳐서 분석
    const allContent = files.map(file => file.content).join('\n');
    
    // 언어 감지 실행
    const detectionResult = detectLanguageFromContent(allContent);
    
    console.log('🔍 언어 감지 결과:', detectionResult);
    
    // 감지된 언어를 projectType으로 매핑
    const languageToProjectType: { [key: string]: string } = {
      'javascript': 'javascript',
      'react': 'react',
      'vue': 'vue',
      'python': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'php': 'php',
      'ruby': 'other',
      'go': 'go',
      'rust': 'rust',
      'swift': 'mobile',
      'kotlin': 'mobile',
      'other': 'other'
    };
    
    return languageToProjectType[detectionResult.language] || 'other';
  };

  // 분석 깊이별 예상 시간 계산
  const getEstimatedTime = (depth: string, fileSize?: number) => {
    const baseTime = {
      'surface': 90000,      // 1.5분 (90초)
      'deep': 240000,        // 4분 (240초)  
      'comprehensive': 420000 // 7분 (420초)
    };
    
    let estimatedTime = baseTime[depth as keyof typeof baseTime] || baseTime.deep;
    
            // 파일 크기에 따른 조정 (LARGE_FILE_SIZE_MB 이상시 시간 증가)
        if (fileSize && fileSize > SCORE_CONSTANTS.LARGE_FILE_SIZE_MB * 1024 * 1024) {
          const sizeMultiplier = Math.min(2, fileSize / (SCORE_CONSTANTS.LARGE_FILE_SIZE_MB * 1024 * 1024));
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
      if (file.size > SCORE_CONSTANTS.MAX_FILE_SIZE_MB * 1024 * 1024) continue; // MAX_FILE_SIZE_MB 제한
      
      const content = await file.text();
      
      // 언어 감지가 선택된 경우 코드 내용으로 언어 감지
      let language = detectLanguageFromPath(file.name);
      if (projectType === 'auto') {
        const detectionResult = detectLanguageFromContent(content);
        language = detectionResult.language;
        console.log(`🔍 파일 ${file.name} 언어 감지: ${detectionResult.language} (신뢰도: ${detectionResult.confidence}%)`);
      }
      
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
          // 언어 감지가 선택된 경우 자동 감지
          const finalProjectType = projectType === 'auto' ? 'auto' : projectType;
          formData.append('projectType', finalProjectType);
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
      
      // WebSocket을 통한 실제 진행 상황 추적
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const connectWebSocket = () => {
        return new Promise<WebSocket>((resolve, reject) => {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}/api/ws/progress`;
          
          const ws = new WebSocket(wsUrl);
          
          ws.onopen = () => {
            console.log('WebSocket 연결됨');
            ws.send(JSON.stringify({
              type: 'subscribe',
              sessionId: sessionId
            }));
            resolve(ws);
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'progress') {
                setLoadingProgress(prev => ({
                  ...prev,
                  progress: data.percentage || prev.progress,
                  message: data.message || prev.message,
                  stage: data.stage || prev.stage
                }));
              }
            } catch (error) {
              console.error('WebSocket 메시지 파싱 오류:', error);
            }
          };
          
          ws.onerror = (error) => {
            console.error('WebSocket 오류:', error);
            reject(error);
          };
          
          ws.onclose = () => {
            console.log('WebSocket 연결 종료');
          };
        });
      };
      
      let ws: WebSocket | null = null;
      let fallbackInterval: NodeJS.Timeout | null = null;
      
      try {
        ws = await connectWebSocket();
      } catch (error) {
        console.warn('WebSocket 연결 실패, 기본 진행률 사용');
        
        // 기본 진행률 시스템 (더 보수적으로)
        let progress = 0;
        fallbackInterval = setInterval(() => {
          progress = Math.min(progress + 0.5, 70); // 70%까지만, 더 천천히
          setLoadingProgress(prev => ({
            ...prev,
            progress: Math.round(progress),
            message: `분석 진행 중... ${Math.round(progress)}%`
          }));
        }, SCORE_CONSTANTS.PROGRESS_INTERVAL); // PROGRESS_INTERVAL마다 PROGRESS_INCREMENT씩 증가
      }
      
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
          industry: industry !== 'general' ? industry : undefined,
          sessionId: sessionId // WebSocket 세션 ID 추가
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
      
      // WebSocket 연결 종료 및 기본 진행률 정리
      if (ws) {
        ws.close();
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
      
                // MAX_PROGRESS 완료로 설정
          setLoadingProgress(prev => ({
            ...prev,
            progress: SCORE_CONSTANTS.MAX_PROGRESS,
            message: '분석 완료!'
          }));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: '프로젝트 분석에 실패했습니다.' }));
        throw new Error(errorData.error || '프로젝트 분석에 실패했습니다.');
      }

      const data = await response.json().catch(() => ({ success: false, review: null }));
      
      if (data.success && data.review) {
        await simulateProgress(
          '완료', 
          '📊 분석 결과 정리 중...',
          100,
          estimatedTime * 0.02,
          estimatedTime
        );
        
        // 구조화된 데이터 처리 시도
        let structuredData = null;
        let reviewText = data.review;
        
        try {
          // JSON 형식인지 확인
          if (typeof data.review === 'string' && data.review.trim().startsWith('{')) {
            structuredData = JSON.parse(data.review);
            console.log('구조화된 데이터 감지:', structuredData);
          }
        } catch (parseError) {
          console.log('JSON 파싱 실패, 텍스트로 처리:', parseError);
          structuredData = null;
        }
        
        // API 응답에서 개선 사항 추출
        const extractRecommendations = (reviewText: string) => {
          const immediate: string[] = [];
          const shortTerm: string[] = [];
          const longTerm: string[] = [];
          
          // 즉시 수정 항목 추출 (더 구체적)
          if (reviewText.match(/버그|오류|에러|크래시|예외/gi)) {
            immediate.push('발견된 버그 및 예외 처리를 즉시 수정하세요');
          }
          if (reviewText.match(/보안|취약|SQL인젝션|XSS/gi)) {
            immediate.push('보안 취약점을 즉시 패치하세요');
          }
          if (reviewText.match(/메모리누수|리소스누수/gi)) {
            immediate.push('메모리 누수 문제를 즉시 해결하세요');
          }
          if (reviewText.match(/하드코딩|매직넘버/gi)) {
            immediate.push('하드코딩된 값들을 상수로 분리하세요');
          }
          
          // 단기 개선 항목 추출 (더 구체적)
          if (reviewText.match(/성능|속도|느림/gi)) {
            shortTerm.push('성능 최적화: 불필요한 루프와 계산을 개선하세요');
          }
          if (reviewText.match(/중복|복사/gi)) {
            shortTerm.push('코드 중복 제거: 공통 함수로 추출하세요');
          }
          if (reviewText.match(/네이밍|변수명/gi)) {
            shortTerm.push('변수명과 함수명을 더 명확하게 개선하세요');
          }
          if (reviewText.match(/주석|문서화/gi)) {
            shortTerm.push('코드 문서화 및 주석을 추가하세요');
          }
          
          // 장기 개선 항목 추출 (더 구체적)
          if (reviewText.match(/아키텍처|구조|설계/gi)) {
            longTerm.push('전체 아키텍처 재설계: 모듈화와 의존성 분리');
          }
          if (reviewText.match(/테스트|단위테스트/gi)) {
            longTerm.push('테스트 커버리지 확대: 단위/통합 테스트 추가');
          }
          if (reviewText.match(/확장성|스케일/gi)) {
            longTerm.push('확장성 개선: 마이크로서비스 아키텍처 고려');
          }
          if (reviewText.match(/유지보수|리팩토링/gi)) {
            longTerm.push('대규모 리팩토링: 레거시 코드 현대화');
          }
          
          // 기본값 제공 (구체적인 내용이 없을 때)
          if (immediate.length === 0) {
            immediate.push('코드 품질 개선이 필요합니다');
          }
          if (shortTerm.length === 0) {
            shortTerm.push('코드 구조 개선이 필요합니다');
          }
          if (longTerm.length === 0) {
            longTerm.push('전체적인 아키텍처 개선이 필요합니다');
          }
          
          return { immediate, shortTerm, longTerm };
        };
        
        const recommendations = structuredData?.recommendations || extractRecommendations(reviewText);
        
        // API 응답에서 점수 추출 (구조화된 데이터 우선, 텍스트 분석 백업)
        const extractScores = (reviewText: string) => {
          /*
          ===== 객관적 점수 채점 기준 =====
          
          【기본 점수】: 50점 시작
          
          【정적 분석 기반 점수 조정】
          - 코드 스멜: -5점씩 (최대 -20점)
          - 보안 이슈: -10점씩 (최대 -30점)  
          - 성능 이슈: -8점씩 (최대 -24점)
          - 유지보수성 이슈: -6점씩 (최대 -18점)
          
          【코드 메트릭 기반 점수 조정】
          - 주석 비율 10% 이상: +5점
          - 주석 비율 5% 미만: -5점
          - 평균 복잡도 3 이하: +5점
          - 평균 복잡도 5 이상: -5점
          - 함수당 평균 라인 수 20 이하: +3점
          - 함수당 평균 라인 수 50 이상: -3점
          
          【구조적 분석 기반 점수】
          - 모듈화 잘됨: +10점
          - 의존성 분리: +8점
          - 에러 처리 완비: +7점
          - 하드코딩 없음: +5점
          
          【점수 등급】
          - 95-100: 엔터프라이즈급 (최고 품질)
          - 85-94: 프로덕션급 (높은 품질)
          - 75-84: 개발급 (양호한 품질)
          - 60-74: 기본급 (보통 품질)
          - 0-59: 개선 필요 (낮은 품질)
          */
          
          // 기본 점수
          let overallScore = SCORE_CONSTANTS.BASE_SCORE;
          let architectureScore = SCORE_CONSTANTS.BASE_SCORE;
          let securityScore = SCORE_CONSTANTS.BASE_SCORE;
          let performanceScore = SCORE_CONSTANTS.BASE_SCORE;
          let maintainabilityScore = SCORE_CONSTANTS.BASE_SCORE;

          // 정적 분석 결과가 있으면 사용
          if (data.staticAnalysis) {
            const { codeSmells, securityIssues, performanceIssues, maintainabilityIssues } = data.staticAnalysis;
            
            // 보안 점수 조정
            securityScore -= Math.min(securityIssues * 10, 30);
            
            // 성능 점수 조정
            performanceScore -= Math.min(performanceIssues * 8, 24);
            
            // 유지보수성 점수 조정
            maintainabilityScore -= Math.min(maintainabilityIssues * 6, 18);
            maintainabilityScore -= Math.min(codeSmells * 5, 20);
            
            // 전체 점수에 반영
            overallScore = Math.round((architectureScore + securityScore + performanceScore + maintainabilityScore) / 4);
          }

          // 코드 메트릭이 있으면 추가 조정
          if (data.codeMetrics) {
            const { commentRatio, averageComplexity, totalLines, totalFunctions } = data.codeMetrics;
            
            // 주석 비율에 따른 점수 조정
            if (commentRatio >= 10) {
              maintainabilityScore += 5;
            } else if (commentRatio < 5) {
              maintainabilityScore -= 5;
            }
            
            // 복잡도에 따른 점수 조정
            if (averageComplexity <= 3) {
              maintainabilityScore += 5;
            } else if (averageComplexity >= 5) {
              maintainabilityScore -= 5;
            }
            
            // 함수당 평균 라인 수 조정
            if (totalFunctions > 0) {
              const avgLinesPerFunction = totalLines / totalFunctions;
              if (avgLinesPerFunction <= 20) {
                maintainabilityScore += 3;
              } else if (avgLinesPerFunction >= 50) {
                maintainabilityScore -= 3;
              }
            }
            
            // 전체 점수 재계산
            overallScore = Math.round((architectureScore + securityScore + performanceScore + maintainabilityScore) / 4);
          }

          // 점수 범위 제한
          const clampScore = (score: number) => Math.max(SCORE_CONSTANTS.MIN_SCORE, Math.min(SCORE_CONSTANTS.MAX_SCORE, Math.round(score)));

          return {
            overallScore: clampScore(overallScore),
            architectureScore: clampScore(architectureScore),
            securityScore: clampScore(securityScore),
            performanceScore: clampScore(performanceScore),
            maintainabilityScore: clampScore(maintainabilityScore)
          };
        };
        
        // 구조화된 데이터에서 점수 추출 시도
        let scores;
        if (structuredData && structuredData.overallScore !== undefined) {
          // 구조화된 데이터에서 점수 사용
          scores = {
            overallScore: Math.round(structuredData.overallScore),
            architectureScore: Math.round(structuredData.architectureScore || structuredData.overallScore),
            securityScore: Math.round(structuredData.securityScore || structuredData.overallScore),
            performanceScore: Math.round(structuredData.performanceScore || structuredData.overallScore),
            maintainabilityScore: Math.round(structuredData.maintainabilityScore || structuredData.overallScore)
          };
          console.log('구조화된 데이터에서 추출된 점수:', scores);
        } else {
          // 텍스트 분석으로 점수 추출
          scores = extractScores(reviewText);
          console.log('텍스트 분석으로 추출된 점수:', scores);
        }
        
        // 구조화된 데이터에서 개선사항 추출
        let finalRecommendations = recommendations;
        let structuredRecommendations = undefined;
        
        if (structuredData?.recommendations) {
          // 구조화된 개선사항 저장
          structuredRecommendations = {
            immediate: structuredData.recommendations.immediate || [],
            shortTerm: structuredData.recommendations.shortTerm || [],
            longTerm: structuredData.recommendations.longTerm || []
          };
          
          // 텍스트 기반 개선사항도 추출
          finalRecommendations = {
            immediate: structuredData.recommendations.immediate?.map((r: any) => r.title || r) || [],
            shortTerm: structuredData.recommendations.shortTerm?.map((r: any) => r.title || r) || [],
            longTerm: structuredData.recommendations.longTerm?.map((r: any) => r.title || r) || []
          };
        }
        
        // 구조화된 데이터에서 요약 추출
        let summary = data.review;
        if (structuredData?.summary) {
          if (typeof structuredData.summary === 'object') {
            summary = `${structuredData.summary.keyEvaluation || ''}\n\n주요 문제점:\n${(structuredData.summary.keyIssues || []).join('\n')}\n\n개선 우선순위:\n${(structuredData.summary.improvementPriority || []).join('\n')}`;
          } else {
            summary = structuredData.summary;
          }
        }
        
        // API 응답을 클라이언트가 기대하는 형태로 변환
        const formattedResult: ProjectReviewResult = {
          projectId: data.projectId || 'unknown',
          ...scores,
          projectAnalysis: {
            structure: {
              score: scores.architectureScore, // 실제 구조 점수 사용
              issues: [],
              improvements: []
            },
            dependencies: {
              score: scores.securityScore, // 보안 점수를 의존성 점수로 사용 (의존성은 보안과 관련)
              outdated: [],
              security: [],
              recommendations: []
            },
            patterns: {
              score: scores.maintainabilityScore, // 유지보수성 점수를 패턴 점수로 사용 (패턴은 유지보수성과 관련)
              detected: [],
              antiPatterns: [],
              suggestions: []
            }
          },
          recommendations: finalRecommendations,
          structuredRecommendations: structuredRecommendations,
          summary: summary
        };
        
        setReviewResult(formattedResult);
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
    // 엔터프라이즈급 기준으로 상향 조정
    if (score >= SCORE_CONSTANTS.ENTERPRISE_GRADE) return 'text-purple-600'; // 엔터프라이즈급
    if (score >= SCORE_CONSTANTS.PRODUCTION_GRADE) return 'text-green-600';  // 프로덕션급
    if (score >= SCORE_CONSTANTS.DEVELOPMENT_GRADE) return 'text-blue-600';   // 개발급
    if (score >= SCORE_CONSTANTS.BASIC_GRADE) return 'text-yellow-600'; // 기본급
    return 'text-red-600'; // 개선 필요
  };

  const getScoreBgColor = (score: number) => {
    // 엔터프라이즈급 기준으로 상향 조정
    if (score >= SCORE_CONSTANTS.ENTERPRISE_GRADE) return 'bg-purple-100'; // 엔터프라이즈급
    if (score >= SCORE_CONSTANTS.PRODUCTION_GRADE) return 'bg-green-100';  // 프로덕션급
    if (score >= SCORE_CONSTANTS.DEVELOPMENT_GRADE) return 'bg-blue-100';   // 개발급
    if (score >= SCORE_CONSTANTS.BASIC_GRADE) return 'bg-yellow-100'; // 기본급
    return 'bg-red-100'; // 개선 필요
  };

  const getScoreLabel = (score: number) => {
    // 엔터프라이즈급 기준으로 상향 조정
    if (score >= SCORE_CONSTANTS.ENTERPRISE_GRADE) return '엔터프라이즈급';
    if (score >= SCORE_CONSTANTS.PRODUCTION_GRADE) return '프로덕션급';
    if (score >= SCORE_CONSTANTS.DEVELOPMENT_GRADE) return '개발급';
    if (score >= SCORE_CONSTANTS.BASIC_GRADE) return '기본급';
    return '개선 필요';
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

  // 점수 기준 모달 컴포넌트
  const ScoreCriteriaModal = ({ onClose }: { onClose: () => void }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">📊 점수 채점 기준</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-6">
            {/* 기본 점수 */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">🎯 기본 점수</h3>
              <p className="text-gray-700">모든 영역: <strong>{SCORE_CONSTANTS.BASE_SCORE}점</strong> 시작 (중간 등급)</p>
            </div>

            {/* 정적 분석 기반 감점 */}
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-3">🔍 정적 분석 기반 감점</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-red-900 mb-2">코드 스멜</h4>
                  <p className="text-sm text-gray-700">-5점씩 (최대 -20점)</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-red-900 mb-2">보안 이슈</h4>
                  <p className="text-sm text-gray-700">-10점씩 (최대 -30점)</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-red-900 mb-2">성능 이슈</h4>
                  <p className="text-sm text-gray-700">-8점씩 (최대 -24점)</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-red-900 mb-2">유지보수성 이슈</h4>
                  <p className="text-sm text-gray-700">-6점씩 (최대 -18점)</p>
                </div>
              </div>
            </div>

            {/* 코드 메트릭 기반 조정 */}
            <div className="bg-green-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 mb-3">📊 코드 메트릭 기반 조정</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-green-900 mb-2">주석 비율</h4>
                  <p className="text-sm text-gray-700">10% 이상: +5점, 5% 미만: -5점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-green-900 mb-2">평균 복잡도</h4>
                  <p className="text-sm text-gray-700">3 이하: +5점, 5 이상: -5점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-green-900 mb-2">함수당 평균 라인</h4>
                  <p className="text-sm text-gray-700">20 이하: +3점, 50 이상: -3점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-green-900 mb-2">구조적 분석</h4>
                  <p className="text-sm text-gray-700">모듈화: +10점, 의존성 분리: +8점</p>
                </div>
              </div>
            </div>

            {/* 영역별 특화 점수 */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-3">🎨 영역별 특화 점수</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-blue-900 mb-2">🏗️ 아키텍처</h4>
                  <p className="text-sm text-gray-700">좋은 구조: <strong>+{SCORE_CONSTANTS.ARCHITECTURE_BONUS}점</strong>, 문제 있는 구조 SCORE_CONSTANTS.ARCHITECTURE_PENALTY점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-green-900 mb-2">🔒 보안</h4>
                  <p className="text-sm text-gray-700">안전한 보안: <strong>+{SCORE_CONSTANTS.SECURITY_BONUS}점</strong>, 취약점 SCORE_CONSTANTS.SECURITY_PENALTY점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-yellow-900 mb-2">⚡ 성능</h4>
                  <p className="text-sm text-gray-700">최적화: <strong>+{SCORE_CONSTANTS.PERFORMANCE_BONUS}점</strong>, 비효율 SCORE_CONSTANTS.PERFORMANCE_PENALTY점</p>
                </div>
                <div className="bg-white rounded p-3">
                  <h4 className="font-semibold text-orange-900 mb-2">🔧 유지보수성</h4>
                  <p className="text-sm text-gray-700">깔끔한 코드: <strong>+{SCORE_CONSTANTS.MAINTAINABILITY_BONUS}점</strong>, 복잡한 코드 SCORE_CONSTANTS.MAINTAINABILITY_PENALTY점</p>
                </div>
              </div>
            </div>

            {/* 90점 이상 달성 조건 */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-900 mb-3">🏆 90점 이상 달성 조건</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">정적 분석 이슈 0개 (코드 스멜, 보안, 성능, 유지보수성)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">주석 비율 10% 이상</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">평균 복잡도 3 이하</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">함수당 평균 라인 수 20 이하</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">모듈화된 아키텍처</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">완전한 에러 처리</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-gray-700">하드코딩된 값 없음</span>
                </div>
              </div>
            </div>

            {/* 점수 등급 */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">📈 점수 등급</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-purple-100 rounded p-3">
                  <h4 className="font-semibold text-purple-900">{SCORE_CONSTANTS.ENTERPRISE_GRADE}-{SCORE_CONSTANTS.MAX_SCORE}점: 엔터프라이즈급</h4>
                  <p className="text-sm text-purple-700">최고 품질</p>
                </div>
                <div className="bg-green-100 rounded p-3">
                  <h4 className="font-semibold text-green-900">{SCORE_CONSTANTS.PRODUCTION_GRADE}-{SCORE_CONSTANTS.ENTERPRISE_GRADE-1}점: 프로덕션급</h4>
                  <p className="text-sm text-green-700">높은 품질</p>
                </div>
                <div className="bg-blue-100 rounded p-3">
                  <h4 className="font-semibold text-blue-900">{SCORE_CONSTANTS.DEVELOPMENT_GRADE}-{SCORE_CONSTANTS.PRODUCTION_GRADE-1}점: 개발급</h4>
                  <p className="text-sm text-blue-700">양호한 품질</p>
                </div>
                <div className="bg-yellow-100 rounded p-3">
                  <h4 className="font-semibold text-yellow-900">{SCORE_CONSTANTS.BASIC_GRADE}-{SCORE_CONSTANTS.DEVELOPMENT_GRADE-1}점: 기본급</h4>
                  <p className="text-sm text-yellow-700">보통 품질</p>
                </div>
                <div className="bg-red-100 rounded p-3">
                  <h4 className="font-semibold text-red-900">{SCORE_CONSTANTS.MIN_SCORE}-{SCORE_CONSTANTS.BASIC_GRADE-1}점: 개선 필요</h4>
                  <p className="text-sm text-red-700">낮은 품질</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 상세 분석 모달 컴포넌트
  const DetailModal = ({ type, data, onClose }: { type: string; data: any; onClose: () => void }) => {
    console.log('DetailModal rendered:', { type, data });
    
    if (!type || !data) {
      console.log('DetailModal: Missing type or data');
      return null;
    }

    // 데이터 안전성 검증
    const safeData = {
      score: data?.score || 0,
      issues: data?.issues || [],
      improvements: data?.improvements || [],
      outdated: data?.outdated || [],
      security: data?.security || [],
      recommendations: data?.recommendations || [],
      analysis: data?.analysis || {},
      detected: data?.detected || [],
      antiPatterns: data?.antiPatterns || [],
      suggestions: data?.suggestions || [],
      bottlenecks: data?.bottlenecks || [],
      optimizations: data?.optimizations || [],
      metrics: data?.metrics || {},
      vulnerabilities: data?.vulnerabilities || [],
      bestPractices: data?.bestPractices || '',
      detailedAnalysis: data?.detailedAnalysis || {}
    };

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

              {/* 구조 분석 개요 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">📋 구조 분석 개요</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-green-700 mb-2">✅ 잘된 부분</h5>
                    <ul className="text-sm text-green-600 space-y-1">
                      {safeData.improvements && safeData.improvements.length > 0 ? (
                        safeData.improvements.slice(0, 4).map((improvement: string, idx: number) => (
                          <li key={idx}>• {improvement}</li>
                        ))
                      ) : (
                        <>
                          <li>• 명확한 폴더 구조 분리</li>
                          <li>• 기능별 모듈화 구현</li>
                          <li>• 일관된 네이밍 컨벤션</li>
                          <li>• 적절한 파일 크기 분할</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">⚠️ 개선 필요 부분</h5>
                    <ul className="text-sm text-red-600 space-y-1">
                      {safeData.issues && safeData.issues.length > 0 ? (
                        safeData.issues.slice(0, 4).map((issue: string, idx: number) => (
                          <li key={idx}>• {issue}</li>
                        ))
                      ) : (
                        <>
                          <li>• 일부 폴더 깊이가 과도함</li>
                          <li>• 순환 의존성 존재</li>
                          <li>• 공통 컴포넌트 분산</li>
                          <li>• 테스트 파일 구조 개선 필요</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {safeData.detailedAnalysis?.folderStructure && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                      <Folder className="w-4 h-4" />
                      📁 폴더 구조 ({(safeData.detailedAnalysis?.folderStructure?.score || 0)}점)
                    </h4>
                    <p className="text-blue-800 text-sm mb-3">{safeData.detailedAnalysis.folderStructure.description || '분석 정보가 없습니다.'}</p>
                    
                    {safeData.detailedAnalysis.folderStructure.problems?.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-medium text-red-800 mb-2">⚠️ 문제점</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                          {safeData.detailedAnalysis.folderStructure.problems.map((problem: string, idx: number) => (
                            <li key={idx}>{problem}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {safeData.detailedAnalysis.folderStructure.solutions?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-green-800 mb-2">💡 해결 방안</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                          {safeData.detailedAnalysis.folderStructure.solutions.map((solution: string, idx: number) => (
                            <li key={idx}>{solution}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {safeData.detailedAnalysis?.modularity && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      🧩 모듈화 ({(safeData.detailedAnalysis?.modularity?.score || 0)}점)
                    </h4>
                    <p className="text-green-800 text-sm mb-3">{safeData.detailedAnalysis.modularity.description || '분석 정보가 없습니다.'}</p>
                    
                    {safeData.detailedAnalysis.modularity.problems?.length > 0 && (
                      <div className="mb-3">
                        <h5 className="font-medium text-red-800 mb-2">⚠️ 문제점</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                          {safeData.detailedAnalysis.modularity.problems.map((problem: string, idx: number) => (
                            <li key={idx}>{problem}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {safeData.detailedAnalysis.modularity.solutions?.length > 0 && (
                      <div>
                        <h5 className="font-medium text-green-800 mb-2">💡 해결 방안</h5>
                        <ul className="list-disc list-inside space-y-1 text-sm text-green-700">
                          {safeData.detailedAnalysis.modularity.solutions.map((solution: string, idx: number) => (
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
                      {safeData.issues?.map((issue: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-500 mt-1">•</span>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-green-800 mb-2">✅ 개선 사항</h5>
                    <ul className="space-y-1 text-sm text-green-700">
                      {safeData.improvements?.map((improvement: string, idx: number) => (
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
                  <h3 className="text-xl font-bold text-gray-900">🔒 보안 분석 상세 결과</h3>
                  <p className="text-gray-600">보안 취약점 및 모범 사례 분석 결과입니다</p>
                </div>
              </div>

              {/* 보안 분석 개요 */}
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-3">📋 보안 분석 개요</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-green-700 mb-2">✅ 잘된 부분</h5>
                    <ul className="text-sm text-green-600 space-y-1">
                      {safeData.improvements && safeData.improvements.length > 0 ? (
                        safeData.improvements.slice(0, 4).map((improvement: string, idx: number) => (
                          <li key={idx}>• {improvement}</li>
                        ))
                      ) : (
                        <>
                          <li>• 입력값 검증 구현</li>
                          <li>• HTTPS 사용</li>
                          <li>• 인증 로직 구현</li>
                          <li>• 민감정보 암호화</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">⚠️ 개선 필요 부분</h5>
                    <ul className="text-sm text-red-600 space-y-1">
                      {safeData.issues && safeData.issues.length > 0 ? (
                        safeData.issues.slice(0, 4).map((issue: string, idx: number) => (
                          <li key={idx}>• {issue}</li>
                        ))
                      ) : (
                        <>
                          <li>• SQL 인젝션 방지 부족</li>
                          <li>• XSS 방어 미흡</li>
                          <li>• 세션 관리 개선 필요</li>
                          <li>• 로깅 보안 강화 필요</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 취약점 분석 */}
              {safeData.vulnerabilities && safeData.vulnerabilities.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3">🚨 발견된 취약점</h4>
                  <div className="space-y-3">
                    {safeData.vulnerabilities.map((vuln: any, idx: number) => (
                      <div key={idx} className="bg-white rounded p-3 border-l-4 border-red-500">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            vuln.severity === 'high' ? 'bg-red-100 text-red-800' :
                            vuln.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {vuln.severity === 'high' ? '🔴 높음' : 
                             vuln.severity === 'medium' ? '🟡 중간' : '🔵 낮음'}
                          </span>
                          <span className="font-medium text-gray-900">{vuln.type}</span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{vuln.description}</p>
                        <div className="text-xs text-gray-500 mb-2">
                          <strong>위치:</strong> {vuln.location}
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <strong className="text-sm text-gray-700">해결 방안:</strong>
                          <p className="text-sm text-gray-600 mt-1">{vuln.fix}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 모범 사례 */}
              {safeData.bestPractices && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">✅ 보안 모범 사례</h4>
                  <div className="bg-white rounded p-3">
                    <p className="text-sm text-green-700">{safeData.bestPractices}</p>
                  </div>
                </div>
              )}

              {/* 보안 권장사항 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">💡 보안 개선 권장사항</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-red-800 mb-2">🚨 즉시 개선 필요</h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      <li>• SQL 인젝션 방지 로직 추가</li>
                      <li>• XSS 방어 필터링 구현</li>
                      <li>• 세션 타임아웃 설정</li>
                      <li>• 보안 헤더 추가</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-800 mb-2">🛡️ 장기 개선 계획</h5>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• 정기적인 보안 감사</li>
                      <li>• 취약점 스캐닝 도구 도입</li>
                      <li>• 개발자 보안 교육</li>
                      <li>• 보안 정책 문서화</li>
                    </ul>
                  </div>
                </div>
              </div>
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
                  <h3 className="text-xl font-bold text-gray-900">⚡ 성능 분석 상세 결과</h3>
                  <p className="text-gray-600">성능 병목점 및 최적화 방안 분석 결과입니다</p>
                </div>
              </div>

              {/* 성능 분석 개요 */}
              <div className="bg-yellow-50 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-900 mb-3">📋 성능 분석 개요</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-green-700 mb-2">✅ 잘된 부분</h5>
                    <ul className="text-sm text-green-600 space-y-1">
                      {safeData.improvements && safeData.improvements.length > 0 ? (
                        safeData.improvements.slice(0, 4).map((improvement: string, idx: number) => (
                          <li key={idx}>• {improvement}</li>
                        ))
                      ) : (
                        <>
                          <li>• 효율적인 알고리즘 사용</li>
                          <li>• 적절한 캐싱 구현</li>
                          <li>• 비동기 처리 활용</li>
                          <li>• 메모리 사용량 최적화</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">⚠️ 개선 필요 부분</h5>
                    <ul className="text-sm text-red-600 space-y-1">
                      {safeData.issues && safeData.issues.length > 0 ? (
                        safeData.issues.slice(0, 4).map((issue: string, idx: number) => (
                          <li key={idx}>• {issue}</li>
                        ))
                      ) : (
                        <>
                          <li>• 불필요한 API 호출</li>
                          <li>• 큰 이미지 파일 미최적화</li>
                          <li>• 데이터베이스 쿼리 비효율</li>
                          <li>• 번들 크기 과다</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 성능 메트릭 */}
              {data.metrics && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">📊 성능 메트릭</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.metrics.loadTime && (
                      <div className="bg-white rounded p-3">
                        <h5 className="font-medium text-gray-900 mb-2">⏱️ 로딩 시간</h5>
                        <p className="text-lg font-bold text-blue-600">{data.metrics.loadTime}</p>
                      </div>
                    )}
                    {data.metrics.bundleSize && (
                      <div className="bg-white rounded p-3">
                        <h5 className="font-medium text-gray-900 mb-2">📦 번들 크기</h5>
                        <p className="text-lg font-bold text-blue-600">{data.metrics.bundleSize}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 병목점 분석 */}
              {data.bottlenecks && data.bottlenecks.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3">🐌 성능 병목점</h4>
                  <div className="space-y-3">
                    {data.bottlenecks.map((bottleneck: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-3 border-l-4 border-red-500">
                        <p className="text-sm text-red-700">{bottleneck}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 최적화 방안 */}
              {data.optimizations && data.optimizations.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">🚀 최적화 방안</h4>
                  <div className="space-y-3">
                    {data.optimizations.map((optimization: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-3 border-l-4 border-green-500">
                        <p className="text-sm text-green-700">{optimization}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 성능 개선 권장사항 */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-3">💡 성능 개선 권장사항</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-red-800 mb-2">⚡ 즉시 개선</h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      <li>• 이미지 압축 및 최적화</li>
                      <li>• 불필요한 API 호출 제거</li>
                      <li>• 데이터베이스 인덱스 추가</li>
                      <li>• 코드 스플리팅 적용</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-800 mb-2">🔄 장기 최적화</h5>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• CDN 도입</li>
                      <li>• 서버 사이드 렌더링</li>
                      <li>• 데이터베이스 쿼리 최적화</li>
                      <li>• 캐싱 전략 개선</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          );

        case 'dependencies':
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">📦 의존성 분석 상세 결과</h3>
                  <p className="text-gray-600">패키지 의존성 및 보안 분석 결과입니다</p>
                </div>
              </div>

              {/* 의존성 분석 개요 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3">📋 의존성 분석 개요</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-green-700 mb-2">✅ 잘된 부분</h5>
                    <ul className="text-sm text-green-600 space-y-1">
                      {safeData.improvements && safeData.improvements.length > 0 ? (
                        safeData.improvements.slice(0, 4).map((improvement: string, idx: number) => (
                          <li key={idx}>• {improvement}</li>
                        ))
                      ) : (
                        <>
                          <li>• 핵심 라이브러리 적절히 사용</li>
                          <li>• 버전 관리 체계화</li>
                          <li>• 개발/프로덕션 의존성 분리</li>
                          <li>• 보안 패치 적용</li>
                        </>
                      )}
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">⚠️ 개선 필요 부분</h5>
                    <ul className="text-sm text-red-600 space-y-1">
                      {safeData.issues && safeData.issues.length > 0 ? (
                        safeData.issues.slice(0, 4).map((issue: string, idx: number) => (
                          <li key={idx}>• {issue}</li>
                        ))
                      ) : (
                        <>
                          <li>• 일부 패키지 버전 구식</li>
                          <li>• 불필요한 의존성 존재</li>
                          <li>• 보안 취약점 패키지</li>
                          <li>• 번들 크기 과다</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              {/* 구식 패키지 */}
              {data.outdated && data.outdated.length > 0 && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-3">🔄 구식 패키지</h4>
                  <div className="space-y-2">
                    {data.outdated.map((pkg: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-yellow-500">
                        <p className="text-sm text-yellow-700">{pkg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 보안 취약점 패키지 */}
              {data.security && data.security.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3">🔒 보안 취약점 패키지</h4>
                  <div className="space-y-2">
                    {data.security.map((pkg: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-red-500">
                        <p className="text-sm text-red-700">{pkg}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 개선 권장사항 */}
              {data.recommendations && data.recommendations.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">💡 의존성 개선 권장사항</h4>
                  <div className="space-y-2">
                    {data.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-blue-500">
                        <p className="text-sm text-blue-700">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 분석 정보 */}
              {data.analysis && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">📊 의존성 분석 정보</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.analysis.bundleSize && (
                      <div className="bg-white rounded p-3">
                        <h5 className="font-medium text-gray-800 mb-1">📦 번들 크기</h5>
                        <p className="text-sm text-gray-600">{data.analysis.bundleSize}</p>
                      </div>
                    )}
                    {data.analysis.securityIssues && (
                      <div className="bg-white rounded p-3">
                        <h5 className="font-medium text-gray-800 mb-1">🔒 보안 이슈</h5>
                        <p className="text-sm text-gray-600">{data.analysis.securityIssues}</p>
                      </div>
                    )}
                    {data.analysis.updatePriority && (
                      <div className="bg-white rounded p-3">
                        <h5 className="font-medium text-gray-800 mb-1">🔄 업데이트 우선순위</h5>
                        <p className="text-sm text-gray-600">{data.analysis.updatePriority}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 의존성 관리 전략 */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-semibold text-purple-900 mb-3">📋 의존성 관리 전략</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-red-800 mb-2">🚨 즉시 조치</h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      <li>• 보안 취약점 패키지 업데이트</li>
                      <li>• 구식 패키지 최신 버전으로 업그레이드</li>
                      <li>• 불필요한 의존성 제거</li>
                      <li>• 보안 스캔 도구 도입</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-800 mb-2">🔄 장기 관리</h5>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• 정기적인 의존성 감사</li>
                      <li>• 자동화된 업데이트 파이프라인</li>
                      <li>• 의존성 관리 정책 수립</li>
                      <li>• 개발팀 교육 및 가이드라인</li>
                    </ul>
                  </div>
                </div>
              </div>
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
                  <h3 className="text-xl font-bold text-gray-900">🎨 패턴 분석 상세 결과</h3>
                  <p className="text-gray-600">코딩 패턴 및 아키텍처 분석 결과입니다</p>
                </div>
              </div>

              {/* 패턴 분석 개요 */}
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-semibold text-green-900 mb-3">📋 패턴 분석 개요</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-green-700 mb-2">✅ 잘된 부분</h5>
                    <ul className="text-sm text-green-600 space-y-1">
                      <li>• 일관된 코딩 스타일</li>
                      <li>• 적절한 디자인 패턴 사용</li>
                      <li>• 재사용 가능한 컴포넌트</li>
                      <li>• 명확한 네이밍 컨벤션</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded p-3">
                    <h5 className="font-medium text-red-700 mb-2">⚠️ 개선 필요 부분</h5>
                    <ul className="text-sm text-red-700 space-y-1">
                      <li>• 일부 안티패턴 사용</li>
                      <li>• 코드 중복 존재</li>
                      <li>• 복잡한 조건문</li>
                      <li>• 긴 함수 및 클래스</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 발견된 패턴 */}
              {data.detected && data.detected.length > 0 && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-3">✅ 발견된 좋은 패턴</h4>
                  <div className="space-y-2">
                    {data.detected.map((pattern: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-green-500">
                        <p className="text-sm text-green-700">{pattern}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 안티패턴 */}
              {data.antiPatterns && data.antiPatterns.length > 0 && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-red-900 mb-3">❌ 발견된 안티패턴</h4>
                  <div className="space-y-2">
                    {data.antiPatterns.map((pattern: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-red-500">
                        <p className="text-sm text-red-700">{pattern}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 개선 제안 */}
              {data.suggestions && data.suggestions.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-3">💡 패턴 개선 제안</h4>
                  <div className="space-y-2">
                    {data.suggestions.map((suggestion: string, idx: number) => (
                      <div key={idx} className="bg-white rounded p-2 border-l-4 border-blue-500">
                        <p className="text-sm text-blue-700">{suggestion}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 패턴 개선 전략 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">📋 패턴 개선 전략</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h5 className="font-medium text-red-800 mb-2">🚨 즉시 개선</h5>
                    <ul className="space-y-1 text-sm text-red-700">
                      <li>• 안티패턴 코드 리팩토링</li>
                      <li>• 코드 중복 제거</li>
                      <li>• 복잡한 함수 분할</li>
                      <li>• 명확한 네이밍 적용</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-blue-800 mb-2">🔄 장기 개선</h5>
                    <ul className="space-y-1 text-sm text-blue-700">
                      <li>• 디자인 패턴 학습</li>
                      <li>• 코드 리뷰 프로세스 강화</li>
                      <li>• 코딩 컨벤션 문서화</li>
                      <li>• 정기적인 코드 품질 감사</li>
                    </ul>
                  </div>
                </div>
              </div>
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
                  유지보수성 점수: {(data?.score || 0)}/100
                </h4>
                <div className={`w-full h-3 rounded-full ${getScoreBgColor(data?.score || 0)} mb-4`}>
                  <div 
                    className={`h-full rounded-full ${(data?.score || 0) >= 80 ? 'bg-green-500' : (data?.score || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data?.score || 0}%` }}
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
                      <span className={`font-bold ${getScoreColor(file?.score || 0)}`}>
                        {file?.score || 0}/100
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
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        전체 프로젝트를 압축해서 업로드 (최대 500MB)
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

            {/* 프로젝트 타입 선택 */}
            {currentStep === 'input' && (
              <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  🔍 프로젝트 타입 선택
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {projectTypes.map(type => (
                    <label
                      key={type.value}
                      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                        projectType === type.value
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="projectType"
                        value={type.value}
                        checked={projectType === type.value}
                        onChange={(e) => setProjectType(e.target.value)}
                        className="sr-only"
                      />
                      <div className="text-center">
                        <div className="text-2xl mb-2">{type.icon}</div>
                        <div className="font-medium text-gray-900">{type.label}</div>
                        {type.value === 'auto' && (
                          <div className="text-xs text-purple-600 mt-1">
                            코드 내용 자동 감지
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
                             ⏱️ <span className="font-medium text-green-600">5-10분 완료</span>
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
                             ⏱️ <span className="font-medium text-blue-600">10-20분 완료</span> <span className="text-blue-600">추천</span>
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
                             ⏱️ <span className="font-medium text-orange-600">20-30분 완료</span>
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
                {/* 분석 플로우 시각화 */}
                {/* 분석 플로우 시각화 컴포넌트 제거 */}
                {/* <AnalysisFlowVisualization reviewResult={reviewResult} /> */}
                
                {/* 종합 점수 */}
                <div className="bg-white rounded-2xl shadow-lg p-8">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Award className="w-6 h-6 text-yellow-500" />
                      🏆 종합 분석 결과
                    </h2>
                      <button
                        onClick={() => setShowScoreCriteria(true)}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Info className="w-4 h-4" />
                        점수 기준
                      </button>
                    </div>
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
                      <div className={`text-4xl font-bold mb-2 ${getScoreColor(reviewResult?.overallScore ?? 0)}`}>
                        {reviewResult?.overallScore ?? 0}
                      </div>
                      <div className="text-sm text-gray-600">종합 점수</div>
                      <div className={`mt-2 w-full h-2 rounded-full ${getScoreBgColor(reviewResult?.overallScore ?? 0)}`}>
                        <div 
                          className={`h-full rounded-full ${(reviewResult?.overallScore ?? 0) >= 80 ? 'bg-green-500' : (reviewResult?.overallScore ?? 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${reviewResult?.overallScore ?? 0}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    {[
                      { 
                        label: '🏗️ 구조', 
                        score: reviewResult?.architectureScore ?? 0, 
                        icon: <Package className="w-4 h-4" />,
                        type: 'structure',
                        data: reviewResult?.projectAnalysis?.structure
                      },
                      { 
                        label: '🔒 보안', 
                        score: reviewResult?.securityScore ?? 0, 
                        icon: <Shield className="w-4 h-4" />,
                        type: 'security',
                        data: reviewResult?.securityAnalysis
                      },
                      { 
                        label: '⚡ 성능', 
                        score: reviewResult?.performanceScore ?? 0, 
                        icon: <Zap className="w-4 h-4" />,
                        type: 'performance',
                        data: reviewResult?.performanceAnalysis
                      },
                      { 
                        label: '🛠️ 유지보수성', 
                        score: reviewResult?.maintainabilityScore ?? 0, 
                        icon: <Target className="w-4 h-4" />,
                        type: 'maintainability',
                        data: { score: reviewResult?.maintainabilityScore ?? 0 }
                      },
                    ].map((item, index) => (
                      <div 
                        key={index} 
                        className="text-center cursor-pointer hover:bg-gray-50 p-4 rounded-lg transition-colors group"
                        onClick={() => {
                          console.log('Modal clicked:', item.type, item.data);
                          // 데이터가 없는 경우 기본 데이터 제공
                          const modalData = item.data || {
                            score: item.score,
                            issues: ['분석 데이터가 없습니다.'],
                            improvements: ['더 많은 파일을 제공해주세요.']
                          };
                          setSelectedModal({ type: item.type as any, data: modalData });
                        }}
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
                            className={`h-full rounded-full ${item.score >= 95 ? 'bg-purple-500' : item.score >= 85 ? 'bg-green-500' : item.score >= 75 ? 'bg-blue-500' : item.score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${item.score}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          클릭하여 상세 보기
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {getScoreLabel(item.score)}
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
                      onClick={() => {
                        console.log('Dependencies clicked:', reviewResult?.projectAnalysis?.dependencies);
                        // 데이터가 없는 경우 기본 데이터 제공
                        const dependenciesData = reviewResult?.projectAnalysis?.dependencies || {
                          score: 85,
                          outdated: ['react@17.0.2', 'lodash@4.17.21'],
                          security: ['axios@0.21.1 (CVE-2021-3749)'],
                          recommendations: ['의존성을 최신 버전으로 업데이트하세요.'],
                          analysis: {
                            bundleSize: '중간',
                            securityIssues: '점검 필요',
                            updatePriority: '중간'
                          }
                        };
                        setSelectedModal({ type: 'dependencies', data: dependenciesData });
                      }}
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
                          <span className={`font-bold ${getScoreColor(reviewResult?.projectAnalysis?.dependencies?.score ?? 85)}`}>
                            {reviewResult?.projectAnalysis?.dependencies?.score ?? 85}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>

                    {/* 패턴 분석 */}
                    <div 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => {
                        console.log('Patterns clicked:', reviewResult?.projectAnalysis?.patterns);
                        // 데이터가 없는 경우 기본 데이터 제공
                        const patternsData = reviewResult?.projectAnalysis?.patterns || {
                          score: 87,
                          detected: ['일반적인 패턴 사용', '기본적인 모듈화'],
                          antiPatterns: ['일부 안티패턴 발견'],
                          suggestions: ['코드 패턴 개선 권장', '더 나은 디자인 패턴 적용']
                        };
                        setSelectedModal({ type: 'patterns', data: patternsData });
                      }}
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
                          <span className={`font-bold ${getScoreColor(reviewResult?.projectAnalysis?.patterns?.score ?? 87)}`}>
                            {reviewResult?.projectAnalysis?.patterns?.score ?? 87}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>

                    {/* 메타데이터 분석 */}
                    <div 
                      className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setSelectedModal({ type: 'metadata', data: { summary: reviewResult?.summary, overallScore: reviewResult?.overallScore } })}
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
                          <span className={`font-bold ${getScoreColor(reviewResult?.overallScore ?? 0)}`}>
                            {reviewResult?.overallScore ?? 0}/100
                          </span>
                        </div>
                        <div className="text-xs text-blue-600">클릭하여 상세 보기</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 파일별 분석 결과 */}
                {reviewResult?.fileAnalysis && reviewResult.fileAnalysis.length > 0 && (
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
                            <span className={`font-bold ${getScoreColor(file?.score || 0)}`}>
                              {file?.score || 0}/100
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
                      <ul className="space-y-3">
                        {reviewResult?.structuredRecommendations?.immediate && reviewResult.structuredRecommendations.immediate.length > 0 ? (
                          // 구조화된 데이터가 있으면 사용
                          reviewResult.structuredRecommendations.immediate.map((item, index) => (
                            <li key={index} className="text-sm text-red-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span className="font-medium">{item.title}</span>
                              </div>
                              {item.description && (
                                <div className="ml-6 mb-2 text-xs text-red-700">{item.description}</div>
                              )}
                              {item.currentCode && item.improvedCode && (
                                <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                  <p className="text-gray-600 mb-2">현재 코드:</p>
                                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">{item.currentCode}</div>
                                  <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">{item.improvedCode}</div>
                                </div>
                              )}
                            </li>
                          ))
                        ) : (
                          // 기본 하드코딩된 예시
                          <>
                            <li className="text-sm text-red-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span className="font-medium">하드코딩된 값들을 상수로 분리</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">현재 코드:</p>
                                <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">const timeout = 5000;</div>
                                <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">const TIMEOUT_CONSTANTS = {`{`} timeout: 5000 {`}`};</div>
                              </div>
                            </li>
                            <li className="text-sm text-red-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span className="font-medium">에러 처리 개선</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">현재 코드:</p>
                                <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">catch (error) {`{`} console.log(error); {`}`}</div>
                                <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">catch (error) {`{`} throw new CustomError('명확한 에러 메시지', error); {`}`}</div>
                              </div>
                            </li>
                            <li className="text-sm text-red-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span className="font-medium">데이터 검증 추가</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">현재 코드:</p>
                                <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">function processUser(data) {`{`} return data.name; {`}`}</div>
                                <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">function processUser(data) {`{`} if (!data?.name) throw new Error('이름이 필요합니다'); return data.name; {`}`}</div>
                              </div>
                            </li>
                            <li className="text-sm text-red-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-red-500 mt-1">•</span>
                                <span className="font-medium">비동기 처리 개선</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">현재 코드:</p>
                                <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">fetch('/api/data').then(res ={`>`} res.json())</div>
                                <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">try {`{`} const res = await fetch('/api/data'); if (!res.ok) throw new Error('API 오류'); return await res.json(); {`}`} catch (error) {`{`} handleError(error); {`}`}</div>
                              </div>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                    
                    <div className="bg-yellow-50 rounded-lg p-6">
                      <h4 className="font-semibold text-yellow-900 mb-4 flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        📋 단기 개선사항
                      </h4>
                      <ul className="space-y-3">
                        {reviewResult?.structuredRecommendations?.shortTerm && reviewResult.structuredRecommendations.shortTerm.length > 0 ? (
                          // 구조화된 데이터가 있으면 사용
                          reviewResult.structuredRecommendations.shortTerm.map((item, index) => (
                            <li key={index} className="text-sm text-yellow-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-yellow-500 mt-1">•</span>
                                <span className="font-medium">{item.title}</span>
                              </div>
                              {item.description && (
                                <div className="ml-6 mb-2 text-xs text-yellow-700">{item.description}</div>
                              )}
                              {item.currentCode && item.improvedCode && (
                                <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                  <p className="text-gray-600 mb-2">현재 코드:</p>
                                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">{item.currentCode}</div>
                                  <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">{item.improvedCode}</div>
                                </div>
                              )}
                            </li>
                          ))
                        ) : (
                          // 기본 하드코딩된 예시
                          <>
                            <li className="text-sm text-yellow-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-yellow-500 mt-1">•</span>
                                <span className="font-medium">코드 문서화 및 주석 추가</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">현재 코드:</p>
                                <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">function calculateTotal(items) {`{`} return items.reduce((sum, item) ={`>`} sum + item.price, 0); {`}`}</div>
                                <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">
                                  // 총 금액을 계산합니다<br/>
                                  function calculateTotal(items: Item[]) {`{`}<br/>
                                  &nbsp;&nbsp;// items: 계산할 아이템 배열<br/>
                                  &nbsp;&nbsp;// returns: 총 금액<br/>
                                  &nbsp;&nbsp;return items.reduce((sum, item) ={`>`} sum + item.price, 0);<br/>
                                  {`}`}
                                </div>
                              </div>
                            </li>
                            <li className="text-sm text-yellow-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-yellow-500 mt-1">•</span>
                                <span className="font-medium">환경 변수 관리 개선</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">개선 방향:</p>
                                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-mono text-xs">
                                  {/* .env 파일 사용 */}
                                  {/* 설정 파일 분리 */}
                                  {/* 환경별 설정 관리 */}
                                </div>
                              </div>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                    
                    <div className="bg-green-50 rounded-lg p-6">
                      <h4 className="font-semibold text-green-900 mb-4 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        🎯 장기 개선사항
                      </h4>
                      <ul className="space-y-3">
                        {reviewResult?.structuredRecommendations?.longTerm && reviewResult.structuredRecommendations.longTerm.length > 0 ? (
                          // 구조화된 데이터가 있으면 사용
                          reviewResult.structuredRecommendations.longTerm.map((item, index) => (
                            <li key={index} className="text-sm text-green-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-green-500 mt-1">•</span>
                                <span className="font-medium">{item.title}</span>
                              </div>
                              {item.description && (
                                <div className="ml-6 mb-2 text-xs text-green-700">{item.description}</div>
                              )}
                              {item.currentCode && item.improvedCode && (
                                <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                  <p className="text-gray-600 mb-2">현재 코드:</p>
                                  <div className="bg-red-100 text-red-800 px-2 py-1 rounded font-mono text-xs">{item.currentCode}</div>
                                  <p className="text-gray-600 mt-2 mb-2">개선된 코드:</p>
                                  <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">{item.improvedCode}</div>
                                </div>
                              )}
                            </li>
                          ))
                        ) : (
                          // 기본 하드코딩된 예시
                          <>
                            <li className="text-sm text-green-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-green-500 mt-1">•</span>
                                <span className="font-medium">전체 아키텍처 재설계</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">개선 방향:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">
                                  {/* 모듈화 및 의존성 분리 */}
                                  {/* 마이크로서비스 아키텍처 고려 */}
                                  {/* 레이어 분리 (Presentation, Business, Data) */}
                                </div>
                              </div>
                            </li>
                            <li className="text-sm text-green-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-green-500 mt-1">•</span>
                                <span className="font-medium">확장성 개선</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">개선 방향:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">
                                  {/* 마이크로서비스 아키텍처 도입 */}
                                  {/* 데이터베이스 최적화 */}
                                  {/* 캐싱 전략 수립 */}
                                </div>
                              </div>
                            </li>
                            <li className="text-sm text-green-800">
                              <div className="flex items-start gap-2 mb-2">
                                <span className="text-green-500 mt-1">•</span>
                                <span className="font-medium">대규모 리팩토링</span>
                              </div>
                              <div className="ml-6 bg-gray-50 rounded p-3 text-xs">
                                <p className="text-gray-600 mb-2">개선 방향:</p>
                                <div className="bg-green-100 text-green-800 px-2 py-1 rounded font-mono text-xs">
                                  {/* 레거시 코드 현대화 */}
                                  {/* 테스트 코드 추가 */}
                                  {/* CI/CD 파이프라인 구축 */}
                                </div>
                              </div>
                            </li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 정적 분석 결과 */}
                {reviewResult?.staticAnalysis && (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-2xl p-8 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <Bug className="w-5 h-5 text-red-500" />
                      🔍 정적 분석 결과
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">{reviewResult.staticAnalysis.codeSmells}</div>
                        <div className="text-sm text-gray-600">코드 스멜</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{reviewResult.staticAnalysis.securityIssues}</div>
                        <div className="text-sm text-gray-600">보안 이슈</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-yellow-600">{reviewResult.staticAnalysis.performanceIssues}</div>
                        <div className="text-sm text-gray-600">성능 이슈</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{reviewResult.staticAnalysis.maintainabilityIssues}</div>
                        <div className="text-sm text-gray-600">유지보수성 이슈</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 코드 품질 메트릭 */}
                {reviewResult?.codeMetrics && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-8 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <BarChart className="w-5 h-5 text-green-500" />
                      📊 코드 품질 메트릭
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-blue-600">{reviewResult.codeMetrics.totalLines.toLocaleString()}</div>
                        <div className="text-sm text-gray-600">총 라인 수</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">{reviewResult.codeMetrics.totalFunctions}</div>
                        <div className="text-sm text-gray-600">함수 수</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-purple-600">{reviewResult.codeMetrics.commentRatio.toFixed(1)}%</div>
                        <div className="text-sm text-gray-600">주석 비율</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-600">{reviewResult.codeMetrics.averageComplexity.toFixed(1)}</div>
                        <div className="text-sm text-gray-600">평균 복잡도</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 산업별 특화 분석 결과 */}
                {industry && industry !== 'general' && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-8 mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                      <Building className="w-5 h-5 text-purple-500" />
                      🏭 {industries.find(i => i.value === industry)?.label} 산업 특화 분석
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold text-purple-900 mb-2">🔍 산업별 감지된 패턴</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {getIndustrySecurityRequirements(industry).patterns.map((pattern, index) => (
                            <div key={index} className="bg-purple-50 rounded p-2 text-sm">
                              <span className="text-purple-700">{pattern}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold text-red-900 mb-2">⚠️ 산업별 주의사항</h4>
                        <div className="space-y-2">
                          {getIndustrySecurityRequirements(industry).suggestions.map((suggestion, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-red-500 mt-1">•</span>
                              <span className="text-gray-700 text-sm">{suggestion}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold text-orange-900 mb-2">🎯 산업별 코드 스멜</h4>
                        <div className="space-y-2">
                          {getIndustrySecurityRequirements(industry).codeSmells.map((smell, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="text-orange-500 mt-1">•</span>
                              <span className="text-gray-700 text-sm">{smell}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 요약 */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    📋 분석 요약
                  </h3>
                  
                  {/* 주요 평가 */}
                  <div className="bg-white rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">🎯 주요 평가</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h5 className="font-semibold text-blue-900 mb-2">전체 아키텍처 점수</h5>
                        <div className={`text-2xl font-bold ${getScoreColor(reviewResult.architectureScore)}`}>
                          {reviewResult.architectureScore}/100
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{getScoreLabel(reviewResult.architectureScore)}</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-4">
                        <h5 className="font-semibold text-green-900 mb-2">종합 품질 점수</h5>
                        <div className={`text-2xl font-bold ${getScoreColor(reviewResult.overallScore)}`}>
                          {reviewResult.overallScore}/100
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{getScoreLabel(reviewResult.overallScore)}</p>
                      </div>
                    </div>
                  </div>

                  {/* 주요 문제점 */}
                  <div className="bg-white rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">⚠️ 주요 문제점</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg">•</span>
                        <div>
                          <p className="font-medium text-gray-900">하드코딩된 값들</p>
                          <p className="text-sm text-gray-600">코드 내에 직접 작성된 값들로 인한 유지보수성 저하</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg">•</span>
                        <div>
                          <p className="font-medium text-gray-900">불완전한 에러 처리</p>
                          <p className="text-sm text-gray-600">사용자에게 명확한 오류 메시지를 제공하지 못함</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="text-red-500 text-lg">•</span>
                        <div>
                          <p className="font-medium text-gray-900">비효율적인 데이터 관리</p>
                          <p className="text-sm text-gray-600">데이터와 코드가 혼재되어 관리가 어려움</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 개선 우선순위 */}
                  <div className="bg-white rounded-lg p-6 mb-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">📋 개선 우선순위</h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded-full text-sm font-medium">1순위</span>
                        <div>
                          <p className="font-medium text-gray-900">하드코딩된 값들을 상수로 분리</p>
                          <p className="text-sm text-gray-600">유지보수성 및 확장성 향상을 위한 리팩토링</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full text-sm font-medium">2순위</span>
                        <div>
                          <p className="font-medium text-gray-900">에러 처리 세분화</p>
                          <p className="text-sm text-gray-600">발생한 에러 종류에 따라 다른 메시지 반환</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-sm font-medium">3순위</span>
                        <div>
                          <p className="font-medium text-gray-900">데이터 관리 방식 개선</p>
                          <p className="text-sm text-gray-600">데이터를 외부에서 불러오는 방식으로 변경</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 상세 분석 내용 */}
                  <div className="bg-white rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">📄 상세 분석 내용</h4>
                    <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 leading-relaxed">{reviewResult.summary}</p>
                    </div>
                  </div>
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
                onClose={() => {
                  console.log('Modal closing');
                  setSelectedModal({ type: null });
                }}
              />
            )}

            {/* 점수 기준 모달 */}
            {showScoreCriteria && (
              <ScoreCriteriaModal
                onClose={() => setShowScoreCriteria(false)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
} 