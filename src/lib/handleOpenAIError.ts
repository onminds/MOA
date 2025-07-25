import { NextResponse } from 'next/server';

interface ErrorContext {
  topic?: string;
  audience?: string;
  purpose?: string;
  fileContentLength?: number;
  imageTextLength?: number;
}

export function handleOpenAIError(error: unknown, context?: ErrorContext): NextResponse {
  console.error('💥 OpenAI API 오류:', error);
  console.error('오류 타입:', typeof error);
  console.error('오류 메시지:', error instanceof Error ? error.message : '알 수 없는 오류');
  console.error('오류 스택:', error instanceof Error ? error.stack : '스택 없음');
  
  // 환경 정보 추가
  const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  console.error('🌐 환경:', isVercel ? 'Vercel' : '호스트');
  console.error('🔑 OpenAI API 키 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
  
  // 로컬 개발 환경에서만 API 키 미리보기 표시 (보안 강화)
  if (process.env.NODE_ENV !== 'production') {
    console.error('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : '없음');
  }
  
  // 요청 정보 로깅
  if (context) {
    console.error('📤 요청 정보:', {
      topic: context.topic || '없음',
      audience: context.audience || '없음',
      purpose: context.purpose || '없음',
      fileContentLength: context.fileContentLength || 0,
      imageTextLength: context.imageTextLength || 0
    });
  }
  
  // OpenAI API 오류인지 확인
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('insufficient_quota')) {
      console.error('💰 OpenAI API 할당량 부족');
      return NextResponse.json(
        { error: 'OpenAI API 할당량이 부족합니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('rate_limit')) {
      console.error('⏰ OpenAI API 속도 제한');
      return NextResponse.json(
        { error: 'API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('authentication') || errorMessage.includes('invalid api key')) {
      console.error('🔑 OpenAI API 인증 오류');
      return NextResponse.json(
        { error: 'OpenAI API 인증에 실패했습니다. API 키를 확인해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('maximum context length') || errorMessage.includes('8192 tokens') || errorMessage.includes('context length')) {
      console.error('📏 토큰 제한 초과');
      return NextResponse.json(
        { error: '참고 자료가 너무 깁니다. 더 짧은 내용으로 다시 시도해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('timeout') || errorMessage.includes('request timeout') || errorMessage.includes('호출 시간이 초과')) {
      console.error('⏱️ 요청 타임아웃');
      return NextResponse.json(
        { error: '요청 시간이 초과되었습니다. Vercel의 타임아웃 제한으로 인해 발생할 수 있습니다. 더 짧은 내용으로 다시 시도해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      console.error('🌐 네트워크 오류');
      return NextResponse.json(
        { error: '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('model') || errorMessage.includes('gpt-4')) {
      console.error('🤖 모델 오류');
      return NextResponse.json(
        { error: 'AI 모델에 문제가 있습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    } else if (errorMessage.includes('vercel') || errorMessage.includes('function timeout')) {
      console.error('🚀 Vercel 함수 타임아웃');
      return NextResponse.json(
        { error: 'Vercel 함수 실행 시간이 초과되었습니다. 더 짧은 내용으로 다시 시도해주세요.' },
        { status: 500 }
      );
    }
  }
  
  // 일반적인 오류 메시지
  console.error('❓ 알 수 없는 오류 유형');
  return NextResponse.json(
    { error: '발표 대본 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
    { status: 500 }
  );
} 