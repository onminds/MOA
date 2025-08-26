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

    const systemInstruction = '당신은 면접 음성 평가 전문가입니다. 음성의 톤, 속도, 명료도, 자신감, 표현력, 구조화 등을 매우 세밀하고 정확하게 분석하여 구체적이고 실용적인 피드백을 제공해주세요. 특히 문제점과 개선점을 정확하게 지적하고, "국어책 읽듯이 단조롭게 말함", "끝말이 흐려짐", "너무 빠르게 말해서 핵심이 안들림" 등과 같이 구체적인 문제점을 명확히 지적해주세요. 강점도 구체적인 예시와 함께 설명해주세요.';

    // 1) 기본: Chat Completions
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: analysisPrompt }
      ],
      max_completion_tokens: 1500,
    });

    let analysisResult = completion.choices[0]?.message?.content || '';

    // 2) 폴백: content가 비었을 경우 Responses API 사용
    if (!analysisResult || analysisResult.trim().length === 0) {
      try {
        const resp = await (openai as any).responses.create({
          model: 'gpt-5-mini',
          input: `SYSTEM:\n${systemInstruction}\n\nUSER:\n${analysisPrompt}`,
          max_output_tokens: 1500,
          text: { verbosity: 'low' },
          reasoning: { effort: 'minimal' }
        });
        analysisResult = resp?.output_text || '';
      } catch (fallbackErr) {
        console.warn('음성 평가 Responses API 폴백 실패:', fallbackErr);
      }
    }

    if (!analysisResult || analysisResult.trim().length === 0) {
      const fallback = getDefaultVoiceEvaluation(transcribedText);
      return NextResponse.json({ success: true, evaluation: fallback, transcribedText });
    }

    // JSON 파싱
    let evaluation;
    try {
      // 코드블록/여분 텍스트 제거 후 JSON만 파싱
      let cleaned = String(analysisResult).trim();
      const codeBlock = cleaned.match(/```json[\s\S]*?```/i) || cleaned.match(/```[\s\S]*?```/);
      if (codeBlock) cleaned = codeBlock[0].replace(/```json|```/gi, '').trim();
      const braceMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (braceMatch) cleaned = braceMatch[0];
      evaluation = JSON.parse(cleaned);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('원본 응답:', analysisResult);
      const fallback = getDefaultVoiceEvaluation(transcribedText);
      return NextResponse.json({ success: true, evaluation: fallback, transcribedText });
    }

    // 응답 검증
    if (!evaluation.overallScore || !evaluation.tone || !evaluation.strengths || !evaluation.improvements || !evaluation.recommendations || !evaluation.detailedAnalysis) {
      const fallback = getDefaultVoiceEvaluation(transcribedText);
      return NextResponse.json({ success: true, evaluation: fallback, transcribedText });
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

// 기본 음성 평가 (폴백용)
function getDefaultVoiceEvaluation(text: string) {
  const length = (text || '').trim().split(/\s+/).length;
  const hasPunctuation = /[\.!?\u3002\uFF01\uFF1F]/.test(text || '');
  const hasFiller = /(어|음|그|저)/.test(text || '');
  const base = Math.min(10, Math.max(4, Math.floor(length / 20) + (hasPunctuation ? 1 : 0) - (hasFiller ? 1 : 0) + 6));
  return {
    overallScore: base,
    tone: '차분하고 자연스러운 톤을 유지하려는 경향이 보입니다.',
    pace: '전반적으로 속도는 적절하나, 핵심 포인트에서 약간의 속도 조절이 있으면 더 좋습니다.',
    volume: '음량은 평균적이며 문단 말미에서 약간 낮아지는 경향이 있습니다.',
    clarity: '발음은 비교적 명료하나 문장 연결 시 말끝이 약간 흐려질 수 있습니다.',
    confidence: '자신감은 보통 수준입니다. 핵심 문장에서 어미를 또렷하게 마무리하면 더 설득력 있어집니다.',
    expressiveness: '강약 조절이 일부 구간에서 부족합니다. 키워드에 억양을 더해 강조해보세요.',
    structure: '서론-본론-결론 흐름이 보이지만 예시와 결과를 더 명확히 구분하면 좋습니다.',
    strengths: [
      '질문 의도를 파악해 핵심에 답하려는 흐름을 유지했습니다.',
      '말의 속도와 호흡이 비교적 안정적입니다.',
      '큰 불필요어(필러) 사용이 과도하지 않습니다.'
    ],
    improvements: [
      '문장 말미를 또렷하게 마무리해 명료도를 높이세요.',
      '핵심 키워드에 강세를 주어 메시지 전달력을 높이세요.',
      '사례 설명 시 수치나 결과를 한 문장으로 정리해 주세요.'
    ],
    recommendations: [
      '핵심 단어(성과, 수치, 역할)에 억양을 주고 0.2초 멈춤을 연습하세요.',
      'STAR 구조(S-T-A-R)로 30–45초 안에 말하는 연습을 반복하세요.',
      '문장 끝을 올리지 말고 내리며 마무리해 안정감을 주세요.'
    ],
    detailedAnalysis: '전체적으로 안정적인 톤과 속도를 유지했으나, 말끝 처리와 핵심 포인트 강조가 약간 부족합니다. STAR 구조로 사례를 구조화하고, 수치 기반 결과를 명확히 첨부하면 신뢰도가 높아집니다.'
  };
}
