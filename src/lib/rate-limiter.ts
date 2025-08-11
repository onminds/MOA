import { NextRequest } from 'next/server';

// Rate Limiting 설정
interface RateLimitConfig {
  windowMs: number;        // 시간 윈도우 (밀리초)
  maxRequests: number;     // 최대 요청 수
  message: string;         // 제한 초과 시 메시지
}

// 기본 설정
const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15분
  maxRequests: 100,          // 100개 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
};

// 사용자별 요청 기록
const userRequests = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate Limiting 체크 함수
 */
export function checkRateLimit(
  request: NextRequest,
  config: Partial<RateLimitConfig> = {}
): { allowed: boolean; message?: string; remaining: number; resetTime: number } {
  const finalConfig = { ...defaultConfig, ...config };
  
  // 사용자 식별 (IP 또는 사용자 ID)
  const identifier = getIdentifier(request);
  const now = Date.now();
  
  // 기존 기록 확인
  const userRecord = userRequests.get(identifier);
  
  if (!userRecord || now > userRecord.resetTime) {
    // 새로운 윈도우 시작
    userRequests.set(identifier, {
      count: 1,
      resetTime: now + finalConfig.windowMs
    });
    
    return {
      allowed: true,
      remaining: finalConfig.maxRequests - 1,
      resetTime: now + finalConfig.windowMs
    };
  }
  
  // 요청 수 증가
  userRecord.count++;
  
  if (userRecord.count > finalConfig.maxRequests) {
    return {
      allowed: false,
      message: finalConfig.message,
      remaining: 0,
      resetTime: userRecord.resetTime
    };
  }
  
  return {
    allowed: true,
    remaining: finalConfig.maxRequests - userRecord.count,
    resetTime: userRecord.resetTime
  };
}

/**
 * 사용자 식별자 생성
 */
function getIdentifier(request: NextRequest): string {
  // 사용자 ID가 있으면 사용, 없으면 IP 주소 사용
  const userId = request.headers.get('x-user-id') || 
                 request.headers.get('authorization')?.split(' ')[1];
  
  if (userId) {
    return `user:${userId}`;
  }
  
  // IP 주소 (프록시 고려)
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 
             request.headers.get('x-real-ip') || 
             'unknown';
  
  return `ip:${ip}`;
}

/**
 * 특정 서비스별 Rate Limiting 설정
 */
export const rateLimitConfigs = {
  // AI 서비스 (비용이 많이 드는 작업)
  aiChat: {
    windowMs: 60 * 1000,    // 1분
    maxRequests: 30,         // 10 → 30으로 증가 (더 관대하게)
    message: 'AI 채팅 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  
  imageGenerate: {
    windowMs: 60 * 1000,    // 1분
    maxRequests: 20,         // 5 → 20으로 증가 (너무 제한적이었음)
    message: '이미지 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  
  videoGenerate: {
    windowMs: 5 * 60 * 1000, // 5분
    maxRequests: 5,           // 2 → 5로 증가 (비용이 많이 드는 작업이지만 적당히)
    message: '영상 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  
  // 일반 API
  api: {
    windowMs: 15 * 60 * 1000, // 15분
    maxRequests: 200,          // 100 → 200으로 증가 (더 관대하게)
    message: 'API 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  
  // 파일 업로드
  upload: {
    windowMs: 60 * 1000,     // 1분
    maxRequests: 20,          // 10 → 20으로 증가 (일반적인 사용 패턴)
    message: '파일 업로드가 너무 많습니다. 잠시 후 다시 시도해주세요.'
  },
  
  // 인증 관련
  auth: {
    windowMs: 15 * 60 * 1000, // 15분
    maxRequests: 30,           // 20 → 30으로 증가 (로그인 시도 등)
    message: '인증 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.'
  }
};

/**
 * Rate Limiting 미들웨어 함수
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  return function rateLimitMiddleware(request: NextRequest) {
    const result = checkRateLimit(request, config);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({ 
          error: result.message,
          remaining: result.remaining,
          resetTime: result.resetTime
        }), 
        { 
          status: 429, // Too Many Requests
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests?.toString() || '100',
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': result.resetTime.toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
          }
        }
      );
    }
    
    return null; // 계속 진행
  };
}

/**
 * 정기적인 정리 작업 (메모리 누수 방지)
 */
export function cleanupExpiredRecords() {
  const now = Date.now();
  
  for (const [key, record] of userRequests.entries()) {
    if (now > record.resetTime) {
      userRequests.delete(key);
    }
  }
}

// 1시간마다 정리 작업 실행
setInterval(cleanupExpiredRecords, 60 * 60 * 1000);
