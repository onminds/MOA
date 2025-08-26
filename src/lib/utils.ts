import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 파일 크기 포맷팅
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 언어 감지 함수
export function detectLanguage(filename: string): string {
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

// 점수에 따른 색상 반환
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

// 점수에 따른 배경색 반환
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-yellow-100';
  return 'bg-red-100';
}

// 점수에 따른 라벨 반환
export function getScoreLabel(score: number): string {
  if (score >= 90) return '우수';
  if (score >= 80) return '양호';
  if (score >= 70) return '보통';
  if (score >= 60) return '개선 필요';
  return '심각한 문제';
}

// 이슈 레벨에 따른 색상 반환
export function getIssueColor(level: string): string {
  switch (level) {
    case 'error':
      return 'text-red-600';
    case 'warning':
      return 'text-yellow-600';
    case 'info':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
}

// 이슈 레벨에 따른 아이콘 반환
export function getIssueIcon(level: string): string {
  switch (level) {
    case 'error':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '⚪';
  }
}

// 날짜 포맷팅
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

// 텍스트 길이 제한
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 안전한 JSON 파싱
export function safeJsonParse(str: string, fallback: any = null): any {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

// 배열에서 중복 제거
export function removeDuplicates<T>(array: T[], key?: keyof T): T[] {
  if (key) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }
  return [...new Set(array)];
}

// 딜레이 함수
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 프로그레스 시뮬레이션
export function simulateProgress(
  onProgress: (progress: number, message: string) => void,
  duration: number = 3000,
  steps: Array<{ progress: number; message: string; delay: number }> = []
): Promise<void> {
  return new Promise((resolve) => {
    if (steps.length === 0) {
      // 기본 단계들
      steps = [
        { progress: 10, message: '파일 분석 중...', delay: 500 },
        { progress: 30, message: '코드 구조 파악 중...', delay: 800 },
        { progress: 50, message: '품질 검사 중...', delay: 600 },
        { progress: 70, message: '개선사항 도출 중...', delay: 700 },
        { progress: 90, message: '리뷰 완성 중...', delay: 400 },
        { progress: 100, message: '완료!', delay: 0 }
      ];
    }

    let currentStep = 0;
    
    const processStep = () => {
      if (currentStep >= steps.length) {
        resolve();
        return;
      }

      const step = steps[currentStep];
      onProgress(step.progress, step.message);
      
      setTimeout(() => {
        currentStep++;
        processStep();
      }, step.delay);
    };

    processStep();
  });
}

// 파일 확장자 가져오기
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

// MIME 타입 감지
export function getMimeType(filename: string): string {
  const ext = getFileExtension(filename);
  
  const mimeTypes: { [key: string]: string } = {
    'js': 'application/javascript',
    'ts': 'application/typescript',
    'jsx': 'application/javascript',
    'tsx': 'application/typescript',
    'py': 'text/x-python',
    'java': 'text/x-java-source',
    'cpp': 'text/x-c++src',
    'c': 'text/x-csrc',
    'cs': 'text/x-csharp',
    'php': 'application/x-httpd-php',
    'rb': 'text/x-ruby',
    'go': 'text/x-go',
    'rs': 'text/x-rust',
    'swift': 'text/x-swift',
    'kt': 'text/x-kotlin',
    'html': 'text/html',
    'css': 'text/css',
    'scss': 'text/x-scss',
    'json': 'application/json',
    'xml': 'application/xml',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
    'md': 'text/markdown',
    'sql': 'text/x-sql',
    'sh': 'application/x-sh',
    'bat': 'application/x-msdos-program',
    'ps1': 'application/x-powershell'
  };

  return mimeTypes[ext] || 'text/plain';
}

// 코드 하이라이팅을 위한 언어 태그
export function getLanguageTag(language: string): string {
  const languageMap: { [key: string]: string } = {
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

  return languageMap[language] || 'text';
} 

/**
 * 월 초기화를 위한 다음 달 1일 계산 함수
 * @param baseDate 기준 날짜 (기본값: 현재 날짜)
 * @returns 다음 달 1일 00:00:00
 */
export function getNextMonthFirstDay(baseDate: Date = new Date()): Date {
  const nextMonth = new Date(baseDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);
  nextMonth.setHours(0, 0, 0, 0);
  return nextMonth;
}

/**
 * 한국 시간 기준으로 정확히 한 달 후 초기화 날짜 계산
 * @param baseDate 기준 날짜 (기본값: 현재 날짜)
 * @returns 한국 시간 기준 한 달 후 동일한 시간
 */
export function getNextMonthSameTime(baseDate: Date = new Date()): Date {
  // 한국 시간대 오프셋 (UTC+9)
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  
  // UTC 시간을 한국 시간으로 변환
  const koreanTime = new Date(baseDate.getTime() + KOREAN_OFFSET);
  
  // 한 달 후로 설정
  const nextMonth = new Date(koreanTime);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  
  // 한국 시간을 다시 UTC로 변환하여 반환
  return new Date(nextMonth.getTime() - KOREAN_OFFSET);
}

/**
 * 계정 생성일 기준으로 첫 번째 초기화 날짜 계산 (한국 시간 기준)
 * @param userCreatedAt 사용자 계정 생성일
 * @returns 한국 시간 기준 정확히 한 달 후 동일한 시간
 */
export function getInitialResetDate(userCreatedAt: Date): Date {
  // 한국 시간대 오프셋 (UTC+9)
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  
  // UTC 시간을 한국 시간으로 변환
  const koreanTime = new Date(userCreatedAt.getTime() + KOREAN_OFFSET);
  
  // 한 달 후로 설정
  const resetDate = new Date(koreanTime);
  resetDate.setMonth(resetDate.getMonth() + 1);
  
  // 한국 시간을 다시 UTC로 변환하여 반환
  return new Date(resetDate.getTime() - KOREAN_OFFSET);
}

/**
 * 현재 날짜가 초기화 날짜를 지났는지 확인 (한국 시간 기준)
 * @param resetDate 초기화 날짜
 * @returns 초기화 여부
 */
export function shouldResetUsage(resetDate: Date): boolean {
  const now = new Date();
  
  // 한국 시간대 오프셋 (UTC+9)
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  
  // 현재 시간과 초기화 시간을 모두 한국 시간으로 변환하여 비교
  const koreanNow = new Date(now.getTime() + KOREAN_OFFSET);
  const koreanReset = new Date(resetDate.getTime() + KOREAN_OFFSET);
  
  return koreanNow > koreanReset;
} 

/**
 * 한국 시간 기준으로 현재 시간 가져오기
 * @returns 한국 시간 기준 현재 시간
 */
export function getKoreanTimeNow(): Date {
  const now = new Date();
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  return new Date(now.getTime() + KOREAN_OFFSET);
}

/**
 * UTC 시간을 한국 시간으로 변환
 * @param utcDate UTC 시간
 * @returns 한국 시간
 */
export function convertUTCToKorean(utcDate: Date): Date {
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  return new Date(utcDate.getTime() + KOREAN_OFFSET);
}

/**
 * 한국 시간을 UTC로 변환
 * @param koreanDate 한국 시간
 * @returns UTC 시간
 */
export function convertKoreanToUTC(koreanDate: Date): Date {
  const KOREAN_OFFSET = 9 * 60 * 60 * 1000; // 9시간을 밀리초로
  return new Date(koreanDate.getTime() - KOREAN_OFFSET);
} 