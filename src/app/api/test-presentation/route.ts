import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== 발표 대본 테스트 API 호출됨 ===');
    console.log('🕐 호출 시간:', new Date().toISOString());
    console.log('🌐 환경:', process.env.VERCEL === '1' ? 'Vercel' : '로컬/호스트');
    
    // OpenAI API 키 검증
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API 키가 설정되지 않음');
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.' },
        { status: 500 }
      );
    }
    
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('❌ OpenAI API 키 형식이 잘못됨');
      return NextResponse.json(
        { error: 'OpenAI API 키 형식이 잘못되었습니다. 올바른 API 키를 설정해주세요.' },
        { status: 500 }
      );
    }
    
    console.log('🔑 OpenAI API 키 상태: 설정됨');
    console.log('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');
    
    // 간단한 테스트 요청
    const testPrompt = "안녕하세요. 간단한 테스트입니다.";
    
    console.log('🚀 OpenAI API 호출 시작...');
    console.log('🤖 사용 모델: gpt-4');
    console.log('📏 최대 토큰: 100');
    console.log('🌡️ 온도: 0.7');
    
    const startTime = Date.now();
    
    // 타임아웃 설정 (10초)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI API 호출 시간이 초과되었습니다.')), 10000);
    });
    
    const completionPromise = openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "user",
          content: testPrompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    
    // 타임아웃과 API 호출을 경쟁시킴
    const completion = await Promise.race([completionPromise, timeoutPromise]) as any;

    const endTime = Date.now();
    console.log('✅ OpenAI API 응답 받음');
    console.log('⏱️ API 호출 시간:', endTime - startTime, 'ms');
    console.log('📊 응답 정보:', {
      model: completion.model,
      usage: completion.usage,
      finishReason: completion.choices[0]?.finish_reason
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      console.error('❌ OpenAI에서 응답을 받지 못함');
      throw new Error('OpenAI API 응답이 없습니다.');
    }

    console.log('🎉 테스트 성공, 응답:', response);
    
    return NextResponse.json({ 
      success: true, 
      message: 'OpenAI API 연결 성공',
      response: response,
      environment: process.env.VERCEL === '1' ? 'Vercel' : '로컬/호스트',
      apiKeyStatus: '설정됨',
      responseTime: endTime - startTime
    });

  } catch (error) {
    console.error('💥 테스트 중 오류:', error);
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error instanceof Error ? error.message : '알 수 없는 오류');
    
    // 환경 정보 추가
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    console.error('🌐 환경:', isVercel ? 'Vercel' : '호스트');
    console.error('🔑 OpenAI API 키 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    
    // 구체적인 오류 메시지
    if (error instanceof Error) {
      const errorMessage = error.message.toLowerCase();
      
      if (errorMessage.includes('insufficient_quota')) {
        return NextResponse.json(
          { error: 'OpenAI API 할당량이 부족합니다.' },
          { status: 500 }
        );
      } else if (errorMessage.includes('rate_limit')) {
        return NextResponse.json(
          { error: 'API 호출 한도를 초과했습니다.' },
          { status: 500 }
        );
      } else if (errorMessage.includes('authentication') || errorMessage.includes('invalid api key')) {
        return NextResponse.json(
          { error: 'OpenAI API 인증에 실패했습니다. API 키를 확인해주세요.' },
          { status: 500 }
        );
      } else if (errorMessage.includes('timeout') || errorMessage.includes('호출 시간이 초과')) {
        return NextResponse.json(
          { error: 'OpenAI API 호출 시간이 초과되었습니다.' },
          { status: 500 }
        );
      } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
        return NextResponse.json(
          { error: '네트워크 연결에 문제가 있습니다.' },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'OpenAI API 테스트 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 