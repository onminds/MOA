import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    console.log('문서 OCR API 호출됨');
    console.log('파일명:', file.name, '크기:', file.size, 'bytes');
    
    // Vercel 환경 감지
    const isVercel = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
    console.log('🌐 환경:', isVercel ? 'Vercel' : '로컬/호스트');
    console.log('📦 사용 가능한 라이브러리:', {
      pdfParse: '✅ 사용 가능',
      canvas: isVercel ? '❌ Vercel에서 제한' : '✅ 사용 가능',
      puppeteer: isVercel ? '❌ Vercel에서 제한' : '✅ 사용 가능'
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf');
    const isPPT = fileName.endsWith('.ppt') || fileName.endsWith('.pptx');

    console.log('PDF 여부:', isPDF, 'PPT 여부:', isPPT);

    if (!isPDF && !isPPT) {
      return NextResponse.json({ error: 'PDF 또는 PPT 파일만 지원됩니다.' }, { status: 400 });
    }

    console.log('파일 처리 시작:', file.name);
    console.log('버퍼 크기:', buffer.length, 'bytes');

    const results: any[] = [];

    if (isPDF) {
      console.log('PDF 파일 처리 중...');
      
      // PDF 시그니처 확인
      const pdfSignature = buffer.toString('hex', 0, 4);
      console.log('PDF 시그니처:', pdfSignature);
      
      if (pdfSignature !== '25504446') {
        return NextResponse.json({ error: '유효하지 않은 PDF 파일입니다.' }, { status: 400 });
      }
      
      console.log('PDF 파일 크기:', buffer.length, 'bytes');
      console.log('✅ 유효한 PDF 파일입니다.');

      try {
        // pdf-parse 라이브러리를 동적 import로 사용하여 빌드 시 오류 방지
        console.log('📄 pdf-parse 라이브러리로 PDF 처리 시도...');
        
        // Vercel 환경에서도 안정적으로 작동하도록 최적화
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = pdfParseModule.default || pdfParseModule;
        
        // Vercel 환경에 맞는 옵션 설정
        const pdfOptions = isVercel ? {
          max: 0, // 페이지 제한 없음
          // Vercel에서 안정성을 위한 추가 옵션
          normalizeWhitespace: true,
          disableCombineTextItems: false
        } : {
          max: 0
        };
        
        console.log('📦 pdf-parse 옵션:', pdfOptions);
        
        // PDF 버퍼를 직접 전달 (파일 시스템 접근 없이)
        const data = await pdfParse(buffer, pdfOptions);
        
        if (data.text && data.text.trim().length > 0) {
          console.log('✅ pdf-parse로 텍스트 추출 성공!');
          console.log('📝 텍스트 길이:', data.text.length);
          console.log('📝 텍스트 미리보기:', data.text.substring(0, 200) + '...');
          console.log('📊 PDF 정보:', {
            페이지수: data.numpages,
            메타데이터: data.info,
            환경: isVercel ? 'Vercel' : '호스트'
          });
          
          // 텍스트 품질 검사
          const hasKoreanText = /[가-힣]/.test(data.text);
          const hasEnglishText = /[a-zA-Z]/.test(data.text);
          const hasNumbers = /[0-9]/.test(data.text);
          const hasPunctuation = /[.!?]/.test(data.text);
          
          // 더 관대한 품질 검사: 텍스트 길이가 10자 이상이고, 한글/영어/숫자 중 하나라도 있으면 유효
          const hasMeaningfulContent = data.text.length >= 10 && (hasKoreanText || hasEnglishText || hasNumbers);
          
          console.log('📊 텍스트 품질 검사:', {
            length: data.text.length,
            hasKorean: hasKoreanText,
            hasEnglish: hasEnglishText,
            hasNumbers: hasNumbers,
            hasPunctuation: hasPunctuation,
            hasMeaningfulContent: hasMeaningfulContent
          });
          
          if (hasMeaningfulContent) {
            results.push({
              page: 1,
              text: data.text.trim(),
              success: true,
              error: undefined,
              extractionMethod: `pdf-parse 라이브러리 (${isVercel ? 'Vercel' : '호스트'} 최적화)`,
              numPages: data.numpages,
              environment: isVercel ? 'Vercel' : '호스트'
            });
          } else {
            throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
          }
          
        } else {
          throw new Error('pdf-parse에서 텍스트를 추출할 수 없습니다.');
        }
        
      } catch (pdfParseError) {
        console.log('❌ pdf-parse 실패:', pdfParseError);
        console.log('📄 실패 원인:', pdfParseError instanceof Error ? pdfParseError.message : '알 수 없는 오류');
        
        // pdf-parse가 실패한 경우 OpenAI Vision API를 대안으로 사용
        try {
          console.log('📄 대안: OpenAI Vision API로 PDF 처리 시도...');
          
          // PDF를 base64로 인코딩
          const base64PDF = buffer.toString('base64');
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4-vision-preview",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "이 PDF 파일의 모든 텍스트를 추출해주세요. 이미지나 그래프는 무시하고 텍스트만 추출해주세요. 원본 텍스트를 그대로 유지해주세요. 한국어와 영어 모두 포함되어 있다면 모두 추출해주세요."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${base64PDF}`
                    }
                  }
                ]
              }
            ],
            max_tokens: 4000,
          });

          const extractedText = completion.choices[0]?.message?.content;
          
          if (extractedText && extractedText.trim().length > 0) {
            console.log('✅ OpenAI Vision API로 텍스트 추출 성공!');
            console.log('📝 텍스트 길이:', extractedText.length);
            console.log('📝 텍스트 미리보기:', extractedText.substring(0, 200) + '...');
            
            // 텍스트 품질 검사
            const hasKoreanText = /[가-힣]/.test(extractedText);
            const hasEnglishText = /[a-zA-Z]/.test(extractedText);
            const hasNumbers = /[0-9]/.test(extractedText);
            const hasPunctuation = /[.!?]/.test(extractedText);
            
            // 더 관대한 품질 검사: 텍스트 길이가 10자 이상이고, 한글/영어/숫자 중 하나라도 있으면 유효
            const hasMeaningfulContent = extractedText.length >= 10 && (hasKoreanText || hasEnglishText || hasNumbers);
            
            console.log('📊 텍스트 품질 검사:', {
              length: extractedText.length,
              hasKorean: hasKoreanText,
              hasEnglish: hasEnglishText,
              hasNumbers: hasNumbers,
              hasPunctuation: hasPunctuation,
              hasMeaningfulContent: hasMeaningfulContent
            });
            
            if (hasMeaningfulContent) {
              results.push({
                page: 1,
                text: extractedText.trim(),
                success: true,
                error: undefined,
                extractionMethod: 'OpenAI Vision API (대안)'
              });
            } else {
              throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
            }
            
          } else {
            throw new Error('OpenAI Vision API에서 텍스트를 추출할 수 없습니다.');
          }
          
        } catch (visionError) {
          console.log('❌ OpenAI Vision API 실패:', visionError);
          
          // 최후의 대안: 패턴 매칭
          console.log('📄 최후 대안: 패턴 매칭 시도...');
          
          const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 1000000));
          
          // 실제 텍스트를 찾기 위한 다양한 패턴
          const patterns = [
            // 영어 문장 패턴
            /[A-Z][a-z\s]{20,}[.!?]/g,
            // 한국어 문장 패턴  
            /[가-힣][가-힣\s]{10,}[.!?]/g,
            // 일반적인 텍스트 블록
            /[A-Za-z가-힣][A-Za-z가-힣0-9\s]{30,}[A-Za-z가-힣0-9]/g,
            // 특수 문자 제거 후 텍스트
            /[A-Za-z가-힣][A-Za-z가-힣0-9\s\.\,\!\?]{20,}[A-Za-z가-힣0-9]/g,
            // 더 넓은 범위의 텍스트 패턴
            /[A-Za-z가-힣][A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{10,}[A-Za-z가-힣0-9]/g
          ];
          
          let bestText = '';
          let bestLength = 0;
          let extractionMethod = '';
          
          for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const matches = bufferString.match(pattern);
            
            if (matches && matches.length > 0) {
              const potentialText = matches
                .join(' ')
                .replace(/[^\w\s가-힣\.\,\!\?\-\(\)]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              if (potentialText.length > bestLength && potentialText.length > 100) {
                bestText = potentialText;
                bestLength = potentialText.length;
                extractionMethod = `패턴 매칭 ${i + 1}`;
              }
            }
          }
          
          if (bestText.length > 0) {
            console.log('✅ 패턴 매칭으로 텍스트 추출 성공!');
            console.log('📝 추출 방법:', extractionMethod);
            console.log('📝 텍스트 길이:', bestText.length);
            console.log('📝 텍스트 미리보기:', bestText.substring(0, 200) + '...');
            
            // 텍스트 품질 검사
            const hasKoreanText = /[가-힣]/.test(bestText);
            const hasEnglishText = /[a-zA-Z]/.test(bestText);
            const hasNumbers = /[0-9]/.test(bestText);
            const hasPunctuation = /[.!?]/.test(bestText);
            
            // 더 관대한 품질 검사: 텍스트 길이가 50자 이상이고, 한글/영어/숫자 중 하나라도 있으면 유효
            const hasMeaningfulContent = bestText.length >= 50 && (hasKoreanText || hasEnglishText || hasNumbers);
            
            console.log('📊 텍스트 품질 검사:', {
              length: bestText.length,
              hasKorean: hasKoreanText,
              hasEnglish: hasEnglishText,
              hasNumbers: hasNumbers,
              hasPunctuation: hasPunctuation,
              hasMeaningfulContent: hasMeaningfulContent
            });
            
            if (hasMeaningfulContent) {
              results.push({
                page: 1,
                text: bestText,
                success: true,
                error: undefined,
                extractionMethod: extractionMethod
              });
            } else {
              throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
            }
            
          } else {
            throw new Error('모든 텍스트 추출 방법이 실패했습니다.');
          }
        }
      }
    }

    console.log('문서 OCR 처리 완료');
    
    const successCount = results.filter(r => r.success).length;
    const totalPages = results.length;
    
    console.log('📊 최종 처리 결과:', {
      총페이지: totalPages,
      성공페이지: successCount,
      실패페이지: totalPages - successCount,
      성공률: `${((successCount / totalPages) * 100).toFixed(1)}%`,
      환경: isVercel ? 'Vercel' : '호스트'
    });
    
    if (successCount === 0) {
      console.log('❌ 모든 페이지에서 텍스트 추출 실패');
      console.log('🔍 문제 분석: PDF 자체를 인식하지 못함');
    } else if (successCount < totalPages) {
      console.log('⚠️ 일부 페이지에서만 텍스트 추출 성공');
      console.log('🔍 문제 분석: PDF 인식은 되었지만 일부 품질이 낮음');
    } else {
      console.log('✅ 모든 페이지에서 텍스트 추출 성공');
      console.log('🔍 문제 분석: PDF 인식 및 품질 모두 양호');
    }
    
    return NextResponse.json({
      success: successCount > 0,
      totalPages: totalPages,
      results: results,
      successCount: successCount,
      errorCount: totalPages - successCount,
      environment: isVercel ? 'Vercel' : '호스트'
    });

  } catch (error) {
    console.error('문서 OCR 처리 중 오류:', error);
    return NextResponse.json(
      { error: '문서 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 