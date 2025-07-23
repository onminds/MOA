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
면접 질문에 대한 음성 답변을 매우 세밀하고 정확하게 분석해주세요.

**질문 카테고리**: ${category}
**면접 질문**: ${question}
**답변 내용**: ${transcribedText}

다음 기준으로 음성 특성을 상세히 평가하고 JSON 형태로 응답해주세요:

**평가 항목**:
1. 전체적인 음성 점수 (1-10점, 소수점 포함 가능)
2. 음성 톤 평가 (차분함/자신감/긴장/흥분/단조로움/자연스러움 등)
3. 말하기 속도 평가 (너무 빠름/적절함/너무 느림/일정함/변화있음)
4. 음량 평가 (너무 작음/적절함/너무 큼/일정함/변화있음)
5. 명료도 평가 (발음이 명확한지, 듣기 쉬운지, 말끝 처리는 어떤지)
6. 자신감 평가 (확신에 찬 말투인지, 주저하는지, 자연스러운지)
7. 표현력 평가 (감정 표현, 강약 조절, 자연스러운 말투)
8. 구조화 평가 (논리적 흐름, 핵심 포인트 강조)

**세부 분석 요구사항**:
- 강점: 구체적인 예시와 함께 설명
- 개선점: 정확한 문제점 지적 (예: "국어책 읽듯이 단조롭게 말함", "끝말이 흐려짐", "너무 빠르게 말해서 핵심이 안들림" 등)
- 추천사항: 실용적이고 구체적인 개선 방법

응답 형식:
{
  "overallScore": 숫자,
  "tone": "음성 톤에 대한 상세 평가",
  "pace": "말하기 속도에 대한 상세 평가", 
  "volume": "음량에 대한 상세 평가",
  "clarity": "명료도에 대한 상세 평가",
  "confidence": "자신감에 대한 상세 평가",
  "expressiveness": "표현력에 대한 상세 평가",
  "structure": "구조화에 대한 상세 평가",
  "strengths": ["구체적인 강점1", "구체적인 강점2", "구체적인 강점3"],
  "improvements": ["정확한 문제점1", "정확한 문제점2", "정확한 문제점3"],
  "recommendations": ["구체적인 개선방법1", "구체적인 개선방법2", "구체적인 개선방법3"],
  "detailedAnalysis": "전체적인 음성 특성에 대한 종합적이고 세밀한 분석"
}
    `;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 면접 음성 평가 전문가입니다. 음성의 톤, 속도, 명료도, 자신감, 표현력, 구조화 등을 매우 세밀하고 정확하게 분석하여 구체적이고 실용적인 피드백을 제공해주세요. 특히 문제점과 개선점을 정확하게 지적하고, "국어책 읽듯이 단조롭게 말함", "끝말이 흐려짐", "너무 빠르게 말해서 핵심이 안들림" 등과 같이 구체적인 문제점을 명확히 지적해주세요. 강점도 구체적인 예시와 함께 설명해주세요.'
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
      console.error('원본 응답:', analysisResult);
      
      // 의미없는 내용이나 오류가 발생한 경우
      if (analysisResult.includes('제가') || analysisResult.includes('직접') || analysisResult.includes('들어보지')) {
        throw new Error('음성 내용이 부적절하거나 의미없는 내용입니다. 다시 녹음해주세요.');
      }
      
      throw new Error('분석 결과 형식이 올바르지 않습니다. 다시 녹음해주세요.');
    }

    // 응답 검증
    if (!evaluation.overallScore || !evaluation.tone || !evaluation.strengths || !evaluation.improvements || !evaluation.recommendations || !evaluation.detailedAnalysis) {
      throw new Error('불완전한 분석 결과입니다. 다시 녹음해주세요.');
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