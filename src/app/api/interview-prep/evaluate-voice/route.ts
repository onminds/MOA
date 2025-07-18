import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const question = formData.get('question') as string;
    const category = formData.get('category') as string;

    if (!audioFile) {
      return NextResponse.json(
        { success: false, error: '음성 파일이 필요합니다.' },
        { status: 400 }
      );
    }

    if (!question) {
      return NextResponse.json(
        { success: false, error: '질문 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    // 음성을 텍스트로 변환 (Whisper)
    const transcriptionResponse = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ko',
    });

    const transcribedText = transcriptionResponse.text;

    if (!transcribedText || transcribedText.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: '음성을 인식할 수 없습니다. 더 명확하게 말씀해주세요.' },
        { status: 400 }
      );
    }

    // GPT로 음성 특성 분석
    const analysisPrompt = `
면접 질문에 대한 음성 답변을 분석해주세요.

**질문 카테고리**: ${category}
**면접 질문**: ${question}
**답변 내용**: ${transcribedText}

다음 기준으로 음성 특성을 평가하고 JSON 형태로 응답해주세요:

1. 전체적인 음성 점수 (1-10점)
2. 음성 톤 평가 (차분함/자신감/긴장/흥분 등의 상태)
3. 말하기 속도 평가 (너무 빠름/적절함/너무 느림)
4. 음량 평가 (너무 작음/적절함/너무 큼)
5. 명료도 평가 (발음이 명확한지, 듣기 쉬운지)
6. 자신감 평가 (확신에 찬 말투인지, 주저하는지)
7. 강점 3가지
8. 개선점 3가지
9. 추천사항 3가지

응답 형식:
{
  "overallScore": 숫자,
  "tone": "음성 톤에 대한 평가",
  "pace": "말하기 속도에 대한 평가", 
  "volume": "음량에 대한 평가",
  "clarity": "명료도에 대한 평가",
  "confidence": "자신감에 대한 평가",
  "strengths": ["강점1", "강점2", "강점3"],
  "improvements": ["개선점1", "개선점2", "개선점3"],
  "recommendations": ["추천사항1", "추천사항2", "추천사항3"]
}
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 면접 음성 평가 전문가입니다. 음성의 톤, 속도, 명료도, 자신감 등을 종합적으로 분석하여 구체적이고 실용적인 피드백을 제공해주세요.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const analysisResult = completion.choices[0]?.message?.content;
    
    if (!analysisResult) {
      throw new Error('음성 분석 결과를 생성할 수 없습니다.');
    }

    // JSON 파싱
    let evaluation;
    try {
      evaluation = JSON.parse(analysisResult);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      throw new Error('분석 결과 형식이 올바르지 않습니다.');
    }

    // 응답 검증
    if (!evaluation.overallScore || !evaluation.tone || !evaluation.strengths || !evaluation.improvements || !evaluation.recommendations) {
      throw new Error('불완전한 분석 결과입니다.');
    }

    return NextResponse.json({
      success: true,
      evaluation: evaluation,
      transcribedText: transcribedText
    });

  } catch (error) {
    console.error('음성 평가 오류:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: '음성 평가 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 