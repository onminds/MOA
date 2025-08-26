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

    // 클라이언트에서 대용량은 청크로 분할되어 전송되므로 서버에서 크기 제한을 두지 않습니다.

    console.log('음성 변환 시작:', audioFile.name, audioFile.size, 'bytes');
    console.log('파일 타입:', audioFile.type);
    console.log('파일 마지막 수정일:', audioFile.lastModified);

    // 파일이 실제로 오디오 파일인지 확인
    if (!audioFile.type.startsWith('audio/')) {
      return NextResponse.json({ 
        error: `지원되지 않는 파일 형식입니다. 오디오 파일을 업로드해주세요. (현재: ${audioFile.type})` 
      }, { status: 400 });
    }

    // OpenAI Whisper API로 1차 STT
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko',
      response_format: 'text',
    });

    console.log('음성 변환 완료:', transcription.length, '문자');

    // gpt-5-mini로 문장부호 보정 및 문장 단위 정리
    const cleaned = await openai.responses.create({
      model: 'gpt-5-mini',
      input: `다음 한국어 음성 인식 결과를 문장부호와 띄어쓰기를 보정하고, 구어체를 자연스러운 서면체로 가볍게 정리하세요. 의미 왜곡은 금지합니다.\n\n원문:\n${transcription}`,
      reasoning: { effort: 'low' }
    });

    const transcript = cleaned.output_text || transcription;

    return NextResponse.json({
      success: true,
      transcription: transcript,
      transcript: transcript,
      length: transcript.length
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