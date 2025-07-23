import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 텍스트를 요약하는 함수
async function summarizeText(text: string, maxLength: number = 2000): Promise<string> {
  if (text.length <= maxLength) {
    return text;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "주어진 텍스트를 핵심 내용만 남기고 요약해주세요. 발표 대본 작성에 필요한 중요한 정보는 유지하되, 불필요한 세부사항은 제거해주세요."
        },
        {
          role: "user",
          content: `다음 텍스트를 ${maxLength}자 이내로 요약해주세요:\n\n${text}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    return completion.choices[0]?.message?.content || text.substring(0, maxLength);
  } catch (error) {
    console.log('요약 실패, 원본 텍스트 자르기:', error);
    return text.substring(0, maxLength) + '...';
  }
}

export async function POST(request: NextRequest) {
  let body: any = {};
  
  try {
    console.log('=== 발표 대본 생성 API 호출됨 ===');
    console.log('🕐 호출 시간:', new Date().toISOString());
    console.log('🌐 환경:', process.env.VERCEL === '1' ? 'Vercel' : '로컬/호스트');
    console.log('🔑 OpenAI API 키 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    
    body = await request.json();
    const { topic, duration, audience, purpose, keyPoints, tone, additionalInfo, fileContent, imageText } = body;

    console.log('📥 요청 데이터:', {
      topic: topic || '없음',
      duration: duration || '없음',
      audience: audience || '없음',
      purpose: purpose || '없음',
      keyPointsCount: keyPoints?.length || 0,
      tone: tone || '없음',
      additionalInfoLength: additionalInfo?.length || 0,
      fileContentLength: fileContent?.length || 0,
      imageTextLength: imageText?.length || 0
    });

    // 입력 검증
    if (!topic || !audience || !purpose) {
      console.error('❌ 필수 입력 항목 누락:', { 
        topic: topic || '없음', 
        audience: audience || '없음', 
        purpose: purpose || '없음' 
      });
      return NextResponse.json(
        { error: '발표 주제, 대상 청중, 발표 목적은 필수 입력 항목입니다.' },
        { status: 400 }
      );
    }

    console.log('✅ 입력 검증 통과');

    // 청중에 따른 설명
    const audienceMap: { [key: string]: string } = {
      'colleagues': '동료/팀원',
      'executives': '경영진/상급자',
      'clients': '고객/클라이언트', 
      'students': '학생/수강생',
      'general': '일반 대중',
      'professionals': '전문가/업계 관계자',
      'investors': '투자자/파트너'
    };

    // 목적에 따른 설명
    const purposeMap: { [key: string]: string } = {
      'inform': '정보 전달',
      'persuade': '설득/제안',
      'educate': '교육/지식 공유',
      'sell': '판매/마케팅',
      'report': '보고/업데이트',
      'inspire': '동기 부여/영감',
      'entertain': '오락/흥미'
    };

    // 톤에 따른 설명
    const toneMap: { [key: string]: string } = {
      'formal': '공식적이고 전문적인',
      'friendly': '친근하고 캐주얼한',
      'enthusiastic': '열정적이고 역동적인',
      'calm': '차분하고 신중한',
      'confident': '자신감 있는',
      'conversational': '대화형이고 상호작용하는'
    };

    // 유효한 주요 포인트만 필터링
    const validKeyPoints = keyPoints?.filter((point: string) => point.trim() !== '') || [];
    console.log('유효한 주요 포인트:', validKeyPoints);

    // 참고 자료 처리 (길이 제한)
    let referenceContent = '';
    if (imageText || fileContent) {
      const rawContent = (imageText || fileContent).trim();
      console.log('📄 원본 참고 자료 길이:', rawContent.length);
      console.log('📄 참고 자료 미리보기:', rawContent.substring(0, 200) + (rawContent.length > 200 ? '...' : ''));
      console.log('📄 참고 자료 전체 내용:', rawContent);
      
      // PDF 메타데이터 감지
      const isPDFMetadata = /StructTreeRoot|obj\s+\d+|endobj|R\s+\d+\s+\d+|PDF|Creator|Producer|CreationDate|ModDate/.test(rawContent);
      const hasObjectRefs = /\d+\s+\d+\s+R/g.test(rawContent);
      const hasRealContent = /[A-Za-z가-힣]{10,}/.test(rawContent);
      
      console.log('🔍 PDF 내용 분석:', {
        isPDFMetadata,
        hasObjectRefs,
        hasRealContent,
        metadataPatterns: rawContent.match(/StructTreeRoot|obj\s+\d+|endobj|R\s+\d+\s+\d+/g)?.length || 0
      });
      
      if (isPDFMetadata || hasObjectRefs) {
        console.warn('⚠️ PDF 메타데이터가 감지되었습니다.');
        console.warn('📄 실제 문서 내용이 아닌 PDF 내부 구조 정보입니다.');
        
        // 메타데이터에서 실제 내용 추출 시도
        const realContentPatterns = [
          /Chapter\s+\d+\.\s*([^\n]+)/gi,
          /([A-Za-z가-힣][A-Za-z가-힣0-9\s\.\,\!\?]{30,}[A-Za-z가-힣0-9])/g,
          /\(([A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{30,})\)/g
        ];
        
        let extractedRealContent = '';
        for (const pattern of realContentPatterns) {
          const matches = rawContent.match(pattern);
          if (matches && matches.length > 0) {
            const potentialContent = matches
              .map((match: string) => pattern.source.includes('\\(') ? match.replace(/\(([^)]+)\)/, '$1') : match)
              .filter((text: string) => {
                const hasRealWords = /[A-Za-z가-힣]{8,}/.test(text);
                const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot)/);
                const hasMeaningfulLength = text.trim().length > 20;
                const hasPunctuation = /[.!?,]/.test(text);
                
                return hasRealWords && notMetadata && hasMeaningfulLength && hasPunctuation;
              })
              .join(' ');
            
            if (potentialContent.length > extractedRealContent.length) {
              extractedRealContent = potentialContent;
            }
          }
        }
        
        if (extractedRealContent.length > 50) {
          console.log('✅ 메타데이터에서 실제 내용 추출 성공:', extractedRealContent.length, '자');
          referenceContent = extractedRealContent;
        } else {
          console.error('❌ PDF에서 실제 문서 내용을 추출할 수 없습니다.');
          throw new Error('PDF에서 실제 문서 내용을 추출할 수 없습니다. PDF 파일이 텍스트 기반이 아니거나 이미지로 변환된 PDF일 수 있습니다. 다른 PDF 파일을 시도해주세요.');
        }
      } else {
        // 기존 품질 검사
        const hasKoreanText = /[가-힣]/.test(rawContent);
        const hasEnglishText = /[a-zA-Z]/.test(rawContent);
        const hasNumbers = /[0-9]/.test(rawContent);
        const hasPunctuation = /[.!?]/.test(rawContent);
        
        // 더 관대한 품질 검사: 텍스트 길이가 20자 이상이고, 한글/영어/숫자 중 하나라도 있으면 유효
        const hasMeaningfulContent = rawContent.length >= 20 && (hasKoreanText || hasEnglishText || hasNumbers);
        
        console.log('📊 참고 자료 품질 검사:', {
          length: rawContent.length,
          hasKorean: hasKoreanText,
          hasEnglish: hasEnglishText,
          hasNumbers: hasNumbers,
          hasPunctuation: hasPunctuation,
          hasMeaningfulContent: hasMeaningfulContent
        });
        
        if (!hasMeaningfulContent) {
          console.warn('⚠️ 참고 자료에 의미 있는 텍스트가 없습니다.');
          console.log('ℹ️ 참고 자료 없음 - 기본 정보만으로 대본 생성');
          console.log('🔍 문제 분석: PDF 인식은 되었지만 텍스트 품질이 낮음');
        } else {
          console.log('✅ PDF 인식 성공 - 텍스트 품질 양호');
          if (rawContent.length > 3000) {
            console.log('📝 참고 자료 요약 중...');
            referenceContent = await summarizeText(rawContent, 3000);
            console.log('📝 요약된 참고 자료 길이:', referenceContent.length);
            console.log('📝 요약된 참고 자료 미리보기:', referenceContent.substring(0, 200) + (referenceContent.length > 200 ? '...' : ''));
            console.log('📝 요약된 참고 자료 전체 내용:', referenceContent);
          } else {
            referenceContent = rawContent;
            console.log('✅ 참고 자료 그대로 사용 (요약 불필요)');
            console.log('✅ 사용될 참고 자료 전체 내용:', referenceContent);
          }
        }
      }
    } else {
      console.log('❌ 참고 자료 없음 - imageText와 fileContent 모두 비어있음');
      console.log('imageText 길이:', imageText?.length || 0);
      console.log('fileContent 길이:', fileContent?.length || 0);
      console.log('🔍 문제 분석: PDF 자체를 인식하지 못함');
    }

    // 프롬프트 생성
    let prompt = `다음 조건에 맞는 발표 대본을 작성해주세요:

**발표 정보:**
- 주제: ${topic}
- 발표 시간: ${duration}분
- 대상 청중: ${audienceMap[audience] || audience}
- 발표 목적: ${purposeMap[purpose] || purpose}`;

    // 참고 자료가 있는 경우 추가
    if (referenceContent && referenceContent.trim()) {
      console.log('✅ 참고 자료 포함됨, 길이:', referenceContent.length);
      console.log('✅ 참고 자료가 대본 생성에 사용됩니다');
      prompt += `

**📄 참고 자료 (PDF 내용):**
${referenceContent}

**📋 발표 대본 작성 지침:**
위의 PDF 내용을 바탕으로 발표 대본을 작성해주세요. PDF에 나온 내용을 그대로 발표 주제로 사용하고, PDF의 구조와 정보를 그대로 활용하여 체계적인 발표 대본을 작성해주세요.

**중요한 점:**
1. PDF의 제목과 주제를 그대로 발표 주제로 사용
2. PDF에 나온 저자, 소속, 목표 등을 발표에 포함
3. PDF의 핵심 내용을 발표의 주요 포인트로 구성
4. PDF의 구조를 따라 발표 대본을 구성`;
    } else {
      console.log('ℹ️ 참고 자료 없음 - 기본 정보만으로 대본 생성');
    }

    if (tone) {
      prompt += `\n- 발표 톤/스타일: ${toneMap[tone] || tone}`;
    }

    if (validKeyPoints.length > 0) {
      prompt += `\n- 주요 포인트: ${validKeyPoints.map((point: string, index: number) => `${index + 1}. ${point}`).join('\n  ')}`;
    }

    if (additionalInfo) {
      // 추가 정보도 길이 제한
      const limitedAdditionalInfo = additionalInfo.length > 500 
        ? additionalInfo.substring(0, 500) + '...' 
        : additionalInfo;
      prompt += `\n- 추가 정보: ${limitedAdditionalInfo}`;
    }

    prompt += `

**대본 작성 요구사항:**
1. ${duration}분 발표에 적합한 분량으로 작성
2. 명확한 구조 (도입-본론-결론)
3. 시간별 섹션 구분 표시
4. 청중과의 상호작용 포인트 포함
5. 발표자가 실제로 말할 수 있는 자연스러운 문체
6. 적절한 강조점과 전환 구문 포함
7. 마지막에 발표 팁 제공

**출력 형식:**
[발표 대본]

📝 **발표 제목:** [제목]

⏰ **예상 발표 시간:** ${duration}분

---

## 🎯 발표 개요
- **목적:** [발표 목적]
- **핵심 메시지:** [핵심 메시지 요약]

---

## 📋 발표 대본

### 1️⃣ 도입부 (0-${Math.ceil(parseInt(duration) * 0.15)}분)
[도입부 대본]

### 2️⃣ 본론 (${Math.ceil(parseInt(duration) * 0.15)}-${Math.ceil(parseInt(duration) * 0.85)}분)
[본론 대본 - 주요 포인트별로 섹션 구분]

### 3️⃣ 결론 (${Math.ceil(parseInt(duration) * 0.85)}-${duration}분)
[결론 대본]

---

## 💡 발표 팁
[발표자를 위한 실용적인 팁 3-5개]

---

대본을 자연스럽고 실용적으로 작성해주세요. 청중에게 맞는 언어와 예시를 사용하고, 발표자가 실제로 말하기 쉬운 형태로 구성해주세요.`;

    console.log('📝 프롬프트 생성 완료, 길이:', prompt.length);
    console.log('🔑 OpenAI API 키 확인:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    console.log('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : '없음');

    // 프롬프트 길이 확인
    if (prompt.length > 6000) {
      console.warn('⚠️ 프롬프트가 너무 깁니다. 참고 자료를 더 줄입니다.');
      if (referenceContent) {
        referenceContent = await summarizeText(referenceContent, 1500);
        prompt = prompt.replace(/참고 자료:\n[\s\S]*?(?=\n\n위의 참고 자료)/, `참고 자료:\n${referenceContent}`);
        console.log('📝 수정된 프롬프트 길이:', prompt.length);
      }
    }

    console.log('🚀 OpenAI API 호출 시작...');
    console.log('🤖 사용 모델: gpt-4');
    console.log('📏 최대 토큰: 3000');
    console.log('🌡️ 온도: 0.7');
    
    const startTime = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 발표 코치이자 스피치 라이터입니다. PDF 자료가 제공된 경우, PDF의 내용을 그대로 발표 주제로 사용하고, PDF에 나온 제목, 저자, 목표, 내용을 발표 대본에 정확히 반영해주세요. PDF의 구조와 정보를 그대로 활용하여 체계적인 발표 대본을 작성해주세요. PDF 내용을 바탕으로 한 실용적이고 자연스러운 발표 대본을 작성해주세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 3000,
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

    const script = completion.choices[0]?.message?.content;

    if (!script) {
      console.error('❌ OpenAI에서 대본을 생성하지 못함');
      console.error('❌ 응답 내용:', completion);
      throw new Error('발표 대본 생성에 실패했습니다.');
    }

    console.log('🎉 대본 생성 성공, 길이:', script.length);
    console.log('📄 대본 미리보기:', script.substring(0, 200) + '...');
    console.log('📄 대본 전체 내용:', script);
    
    return NextResponse.json({ script });

  } catch (error) {
    console.error('💥 발표 대본 생성 오류:', error);
    console.error('오류 타입:', typeof error);
    console.error('오류 메시지:', error instanceof Error ? error.message : '알 수 없는 오류');
    console.error('오류 스택:', error instanceof Error ? error.stack : '스택 없음');
    
    // 환경 정보 추가
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    console.error('🌐 환경:', isVercel ? 'Vercel' : '호스트');
    console.error('🔑 OpenAI API 키 상태:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    console.error('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : '없음');
    
    // 요청 정보 로깅
    console.error('📤 요청 정보:', {
      topic: body?.topic || '없음',
      audience: body?.audience || '없음',
      purpose: body?.purpose || '없음',
      fileContentLength: body?.fileContent?.length || 0,
      imageTextLength: body?.imageText?.length || 0
    });
    
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
      } else if (errorMessage.includes('timeout') || errorMessage.includes('request timeout')) {
        console.error('⏱️ 요청 타임아웃');
        return NextResponse.json(
          { error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' },
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
      }
    }
    
    // 일반적인 오류 메시지
    console.error('❓ 알 수 없는 오류 유형');
    return NextResponse.json(
      { error: '발표 대본 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
} 