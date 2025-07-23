import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log('=== 발표 대본 테스트 API 호출됨 ===');
    
    // 환경 정보 확인
    console.log('🔑 OpenAI API 키 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    console.log('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : '없음');
    
    // 간단한 테스트 요청
    const testPrompt = "안녕하세요. 간단한 테스트입니다.";
    
    console.log('🚀 OpenAI API 호출 시작...');
    console.log('🤖 사용 모델: gpt-4');
    console.log('📏 최대 토큰: 100');
    console.log('🌡️ 온도: 0.7');
    
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
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
      response: response,
      testInfo: {
        apiKeyStatus: process.env.OPENAI_API_KEY ? '설정됨' : '설정되지 않음',
        callTime: endTime - startTime,
        model: completion.model,
        usage: completion.usage
      }
    });

  } catch (error) {
    console.error('💥 테스트 API 오류:', error);
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error instanceof Error ? error.message : '알 수 없는 오류');
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류',
        errorType: typeof error
      },
      { status: 500 }
    );
  }
} 