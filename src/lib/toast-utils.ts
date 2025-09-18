// 사용량 증가 시 Toast 알림을 위한 유틸리티 함수들

export interface UsageToastData {
  serviceName: string;
  currentUsage: number;
  maxLimit: number;
  remainingCount: number;
}

// 서비스 타입별 한글 이름 매핑
export const getServiceKoreanName = (serviceType: string): string => {
  const serviceNames: { [key: string]: string } = {
    'ai-summary': 'AI 완벽요약',
    'cover-letter': '자기소개서',
    'interview-prep': '면접 준비',
    'code-generate': '코드 생성',
    'lecture-notes': '강의 노트',
    'report-writers': 'AI 레포트',
    'presentation-script': '발표 대본',
    'code-review': '코드 리뷰',
    'image-generate': '이미지 생성',
    'video-generate': '영상 생성',
  };
  
  return serviceNames[serviceType] || serviceType;
};

// 사용량 증가 Toast 메시지 생성
export const createUsageToastMessage = (data: UsageToastData): string => {
  // 사용량 표시는 숨기고, 완료 메시지만 표시
  return '생성이 완료되었습니다.';
};

// 사용량 증가 Toast 데이터 생성
export const createUsageToastData = (
  serviceType: string, 
  currentUsage: number, 
  maxLimit: number
): UsageToastData => {
  return {
    serviceName: getServiceKoreanName(serviceType),
    currentUsage,
    maxLimit,
    remainingCount: Math.max(0, maxLimit - currentUsage)
  };
};
