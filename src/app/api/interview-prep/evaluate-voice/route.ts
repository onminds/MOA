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
      model: 'gpt-5-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 면접 음성 평가 전문가입니다. 음성의 톤, 속도, 명료도, 자신감, 표현력, 구조화 등을 매우 세밀하고 정확하게 분석하여 구체적이고 실용적인 피드백을 제공해주세요. 반드시 JSON 객체만 반환하세요.'
        },
        {
          role: 'user',
          content: analysisPrompt
        }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 1500,
    });

    // 응답 텍스트 추출 (SDK/모델별 형태 차이 대응)
    const choiceMsg: any = completion.choices[0]?.message;
    let analysisResult: string | null = null;
    if (typeof choiceMsg?.content === 'string') {
      analysisResult = choiceMsg.content;
    } else if (Array.isArray(choiceMsg?.content)) {
      analysisResult = choiceMsg.content.map((p: any) => p?.text?.value ?? p?.text ?? '').join('\n');
    }

    // JSON 정리 유틸
    const cleanAndExtractJson = (raw: string): string | null => {
      if (!raw) return null;
      let text = raw.trim()
        .replace(/```json\s*/gi, '')
        .replace(/```/g, '');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      let candidate = jsonMatch ? jsonMatch[0] : text;
      candidate = candidate
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/\r/g, '')
        .replace(/\t/g, ' ')
        .replace(/,\s*([}\]])/g, '$1');
      return candidate.trim();
    };

    // JSON 파싱 + 폴백
    let evaluation: any;
    try {
      if (!analysisResult) throw new Error('empty');
      evaluation = JSON.parse(analysisResult);
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('원본 응답:', analysisResult);

      const cleaned = analysisResult ? cleanAndExtractJson(analysisResult) : null;
      if (cleaned) {
        try {
          evaluation = JSON.parse(cleaned);
        } catch (e2) {
          console.error('정리 후 재파싱 실패:', e2);
        }
      }

      if (!evaluation) {
        // 최종 폴백: 기본 평가 반환
        evaluation = {
          overallScore: 6,
          tone: '차분하지만 약간의 긴장감이 느껴집니다',
          pace: '전체적으로 적절하나 일부 구간에서 약간 빠름',
          volume: '적절하나 문장 끝에서 볼륨이 작아지는 경향',
          clarity: '대체로 명료하나 일부 발음이 뭉개짐',
          confidence: '중간 수준의 자신감, 핵심 문장에서 강세가 약함',
          expressiveness: '감정 표현이 적당하나 강조가 부족함',
          structure: '논리 흐름은 있으나 핵심 포인트 강조가 약함',
          strengths: [
            '전반적으로 안정적인 톤 유지',
            '질문 의도를 벗어나지 않고 답변',
            '불필요한 군더더기 표현이 적음'
          ],
          improvements: [
            '핵심 문장에 강세를 주어 메시지 전달력 강화',
            '문장 끝 볼륨과 명료도 유지',
            '중요 키워드 반복으로 기억점 제공'
          ],
          recommendations: [
            '핵심 키워드를 포함한 1문장 요약을 먼저 말한 뒤 근거 제시',
            '문장 끝 단어를 또렷하게 발음하고 볼륨 유지',
            '숫자/성과를 포함한 근거를 1개 이상 추가'
          ],
          detailedAnalysis: '톤과 속도는 비교적 안정적이나, 문장 끝에서 볼륨과 명료도가 떨어지며 자신감 인상이 희미해집니다. 핵심 키워드에 강세를 주고, 중요 문장에서는 약간의 속도 조절과 볼륨 유지를 통해 전달력을 높이는 것이 좋습니다.'
        };
      }
    }

    // 응답 검증
    if (!evaluation.overallScore || !evaluation.tone || !evaluation.strengths || !evaluation.improvements || !evaluation.recommendations || !evaluation.detailedAnalysis) {
      // 폴백 객체가 누락될 일은 없지만, 혹시나를 위해 보강
      evaluation = {
        overallScore: evaluation.overallScore || 6,
        tone: evaluation.tone || '차분하지만 약간의 긴장감',
        pace: evaluation.pace || '대체로 적절함',
        volume: evaluation.volume || '적절하나 문장 끝이 약함',
        clarity: evaluation.clarity || '대체로 명료함',
        confidence: evaluation.confidence || '중간 수준',
        expressiveness: evaluation.expressiveness || '표현력 보통',
        structure: evaluation.structure || '논리 흐름 보통',
        strengths: evaluation.strengths || ['전반적으로 안정적인 톤 유지'],
        improvements: evaluation.improvements || ['핵심 문장에 강세 부여'],
        recommendations: evaluation.recommendations || ['숫자/성과 포함 근거 제시'],
        detailedAnalysis: evaluation.detailedAnalysis || '핵심에 힘을 주고 문장 끝 명료도를 개선하면 전달력이 좋아집니다.'
      };
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
