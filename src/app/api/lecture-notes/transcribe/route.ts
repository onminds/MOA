import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json({ error: '오디오 파일이 필요합니다.' }, { status: 400 });
    }

    console.log('음성 변환 시작:', audioFile.name, audioFile.size, 'bytes');

    // OpenAI Whisper API를 사용하여 음성을 텍스트로 변환
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko', // 한국어로 설정
      response_format: 'text',
    });

    console.log('음성 변환 완료:', transcription.length, '문자');

    return NextResponse.json({
      success: true,
      transcript: transcription,
      length: transcription.length
    });

  } catch (error) {
    console.error('음성 변환 오류:', error);
    
    // OpenAI API 에러 처리
    if (error instanceof Error && error.message.includes('model_not_found')) {
      return NextResponse.json({ 
        error: 'Whisper 모델을 찾을 수 없습니다. API 키를 확인해주세요.' 
      }, { status: 500 });
    }
    
    if (error instanceof Error && error.message.includes('insufficient_quota')) {
      return NextResponse.json({ 
        error: 'OpenAI API 할당량이 부족합니다.' 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      error: '음성 변환 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
} 