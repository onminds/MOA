import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { getTimeSplit } from '@/lib/timeUtils';
import { summarizeText } from '@/lib/summarizeText';
import { extractStructure } from '@/lib/extractStructure';
import { buildPrompt } from '@/lib/promptBuilder';
import { handleOpenAIError } from '@/lib/handleOpenAIError';
import { audienceMap, purposeMap, toneMap } from '@/config/mappings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  let body: any = {};
  
  try {
    console.log('=== 발표 대본 생성 API 호출됨 ===');
    console.log('🕐 호출 시간:', new Date().toISOString());
    console.log('🌐 환경:', process.env.VERCEL === '1' ? 'Vercel' : '로컬/호스트');
    console.log('📝 버전: 모듈화 구조 v3.1 - 2024-07-23');
    console.log('🔧 업데이트: 설정 맵핑 분리 완료');
    
    // OpenAI API 키 검증 강화
    if (!process.env.OPENAI_API_KEY) {
      console.error('❌ OpenAI API 키가 설정되지 않음');
      return NextResponse.json(
        { error: 'OpenAI API 키가 설정되지 않았습니다. Vercel 환경 변수를 확인해주세요.' },
        { status: 500 }
      );
    }
    
    // API 키 형식 검증
    if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
      console.error('❌ OpenAI API 키 형식이 잘못됨');
      return NextResponse.json(
        { error: 'OpenAI API 키 형식이 잘못되었습니다. 올바른 API 키를 설정해주세요.' },
        { status: 500 }
      );
    }
    
    console.log('🔑 OpenAI API 키 상태: 설정됨');
    
    // 로컬 개발 환경에서만 API 키 미리보기 표시 (보안 강화)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY.substring(0, 20) + '...');
    }
    
    body = await request.json();
    const { topic, duration, audience, purpose, keyPoints, tone, additionalInfo, fileContent, imageText } = body;

    console.log('📥 요청 데이터:', {
      topic: topic || '없음',
      duration: duration || 0,
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

    // 참고 자료 필수 검증 추가
    const rawContent = (fileContent ?? imageText ?? '').trim();
    if (!rawContent) {
      console.error('❌ 참고 자료 누락:', { 
        fileContent: fileContent || '없음', 
        imageText: imageText || '없음' 
      });
      return NextResponse.json(
        { error: '참고 자료 이미지를 필수로 업로드해주세요. 발표 대본 생성을 위해 PDF나 이미지 파일을 제공해주세요.' },
        { status: 400 }
      );
    }

    console.log('✅ 입력 검증 통과');

    // 유효한 주요 포인트만 필터링
    const validKeyPoints = keyPoints?.filter((point: string) => point.trim() !== '') || [];
    console.log('유효한 주요 포인트:', validKeyPoints);

    // 참고 자료 처리 (모듈화된 구조)
    let referenceContent = '';
    let structureLines: string[] = [];
    
    if (rawContent) {
      console.log('📄 원본 참고 자료 길이:', rawContent.length);
      console.log('📄 참고 자료 미리보기:', rawContent.substring(0, 200) + (rawContent.length > 200 ? '...' : ''));
      
      // 1️⃣ 헤더 스킵 + 본문 감지 로직 결합
      const lines = rawContent.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
      console.log('📄 원본 라인 수:', lines.length);
      console.log('📄 앞 10줄 미리보기:', lines.slice(0, 10));
      
      // (1) 헤더 첫 5줄 제거
      const bodyLines = lines.slice(5).filter((l: string) => l.trim());
      const filteredText = bodyLines.join('\n');
      
      console.log('📄 필터링 후 라인 수:', bodyLines.length);
      console.log('📄 필터링 후 길이:', filteredText.length);
      console.log('📄 필터링 후 미리보기:', filteredText.substring(0, 300) + (filteredText.length > 300 ? '...' : ''));
      
      // (2) "충분한 본문" 여부 판단 (20자 이상 되는 줄이 하나라도 있으면 OK)
      const hasBody = bodyLines.some((l: string) => l.length > 20);
      console.log('📄 본문 감지 결과:', hasBody);
      
      // (3) referenceContent 결정
      if (hasBody) {
        console.log('✅ 실제 본문 내용 발견 - 필터링된 텍스트 사용');
        referenceContent = filteredText;
      } else {
        // OCR 자체가 실패했다면, rawText 전체라도 fallback
        console.log('⚠️ 본문 감지 실패 - 원본 텍스트 전체 사용');
        referenceContent = rawContent;
      }
      
      // 구조 추출
      if (referenceContent) {
        structureLines = extractStructure(referenceContent);
        console.log('📚 추출된 구조:', structureLines);
      }
    } else {
      console.log('❌ 참고 자료 없음 - rawContent가 비어있음');
      console.log('🔍 문제 분석: PDF 자체를 인식하지 못함');
    }

    // 프롬프트 생성 (모듈화된 구조)
    const prompt = buildPrompt({
      title: topic,
      audience: audienceMap[audience as keyof typeof audienceMap] || audience,
      purpose: purposeMap[purpose as keyof typeof purposeMap] || purpose,
      duration: Number(duration),
      keyPoints: validKeyPoints,
      referenceText: referenceContent,
      structureLines,
      tone: tone ? toneMap[tone as keyof typeof toneMap] || tone : undefined
    });

    console.log('📝 프롬프트 생성 완료, 길이:', prompt.length);
    console.log('🔑 OpenAI API 키 확인:', process.env.OPENAI_API_KEY ? '설정됨' : '❌ 설정되지 않음');
    
    // 로컬 개발 환경에서만 API 키 미리보기 표시 (보안 강화)
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔑 OpenAI API 키 미리보기:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : '없음');
    }

    // 프롬프트 길이 확인
    if (prompt.length > 4000) {
      console.warn('⚠️ 프롬프트가 너무 깁니다. 참고 자료를 더 줄입니다.');
      if (referenceContent) {
        referenceContent = await summarizeText(referenceContent, 1000);
        console.log('📝 수정된 프롬프트 길이:', prompt.length);
      }
    }

    console.log('🚀 OpenAI API 호출 시작...');
    console.log('🤖 사용 모델: gpt-3.5-turbo');
    console.log('📏 최대 토큰: 4000');
    console.log('🌡️ 온도: 0.7');
    console.log('⏱️ 타임아웃: 30초');
    console.log('📝 프롬프트 길이:', prompt.length);
    
    const startTime = Date.now();
    
    // 타임아웃 설정 (30초로 조정)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('OpenAI API 호출 시간이 초과되었습니다.')), 30000);
    });
    
    const completionPromise = openai.chat.completions.create({
      model: "gpt-3.5-turbo", // 더 빠른 모델로 변경
      messages: [
        {
          role: "system",
          content: "당신은 전문적인 발표 코치이자 스피치 라이터입니다. PDF 자료가 제공된 경우, PDF의 내용을 그대로 발표 주제로 사용하고, PDF에 나온 제목, 저자, 목표, 내용을 발표 대본에 정확히 반영해주세요. PDF의 구조와 정보를 그대로 활용하여 체계적인 발표 대본을 작성해주세요. PDF 내용을 바탕으로 한 실용적이고 자연스러운 발표 대본을 작성해주세요. 기본 지침을 준수하여 청중의 이해를 돕는 명확하고 자연스러운 발표 대본을 작성합니다."
        },
        {
          role: "user", 
          content: `제목: ${topic}\n청중: ${audience}\n시간: ${duration}분\n목적: ${purpose}\n키워드: ${validKeyPoints.join(', ')}\n\n${prompt}`
        }
      ],
      max_tokens: 4000, // 토큰 수 증가 (2000 → 4000)
      temperature: 0.7
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

    const script = completion.choices[0]?.message?.content;

    if (!script) {
      console.error('❌ OpenAI에서 대본을 생성하지 못함');
      console.error('❌ 응답 내용:', completion);
      throw new Error('발표 대본 생성에 실패했습니다.');
    }

    // 응답 검증 (GPT 제안 방식)
    console.log('🔍 응답 검증 시작...');
    
    // 1. 키워드 누락 검증
    if (validKeyPoints.length > 0) {
      const missingKeywords = validKeyPoints.filter((keyword: string) => 
        !script.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (missingKeywords.length > 0) {
        console.warn('⚠️ 누락된 키워드:', missingKeywords);
        console.warn('⚠️ 전체 키워드:', validKeyPoints);
        console.warn('⚠️ 포함된 키워드:', validKeyPoints.filter((keyword: string) => 
          script.toLowerCase().includes(keyword.toLowerCase())
        ));
      } else {
        console.log('✅ 모든 키워드가 포함됨');
      }
    }
    
    // 2. 섹션 구조 검증
    const hasIntro = script.includes('도입부') || script.includes('### 도입부');
    const hasBody = script.includes('본론') || script.includes('### 본론');
    const hasConclusion = script.includes('결론') || script.includes('### 결론');
    
    if (!hasIntro || !hasBody || !hasConclusion) {
      console.warn('⚠️ 섹션 구조 불완전:', { hasIntro, hasBody, hasConclusion });
    } else {
      console.log('✅ 섹션 구조 완전');
    }
    
    // 3. 내용 길이 검증
    const scriptLength = script.length;
    const expectedMinLength = Number(duration) * 100; // 1분당 최소 100자
    const expectedMaxLength = Number(duration) * 200; // 1분당 최대 200자
    
    if (scriptLength < expectedMinLength) {
      console.warn(`⚠️ 대본이 너무 짧음: ${scriptLength}자 (예상: ${expectedMinLength}자 이상)`);
    } else if (scriptLength > expectedMaxLength) {
      console.warn(`⚠️ 대본이 너무 김: ${scriptLength}자 (예상: ${expectedMaxLength}자 이하)`);
    } else {
      console.log(`✅ 대본 길이 적절: ${scriptLength}자`);
    }

    console.log('🎉 대본 생성 성공, 길이:', script.length);
    console.log('📄 대본 미리보기:', script.substring(0, 200) + '...');
    console.log('📄 대본 전체 내용:', script);
    
    return NextResponse.json({ script });

  } catch (error) {
    return handleOpenAIError(error, {
      topic: body?.topic,
      audience: body?.audience,
      purpose: body?.purpose,
      fileContentLength: body?.fileContent?.length,
      imageTextLength: body?.imageText?.length
    });
  }
}