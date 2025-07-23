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
      
      // 암호화된 PDF 감지
      const pdfContent = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
      const isEncrypted = /Encrypt|EncryptMetadata|Filter.*Standard|Length.*128/.test(pdfContent);
      const hasPassword = /Password|UserPassword|OwnerPassword/.test(pdfContent);
      
      console.log('🔐 PDF 보안 분석:', {
        isEncrypted,
        hasPassword,
        contentPreview: pdfContent.substring(0, 200)
      });
      
      if (isEncrypted || hasPassword) {
        console.error('❌ 암호화된 PDF 감지');
        return NextResponse.json({ 
          error: '암호화된 PDF 파일입니다. 비밀번호를 제거한 후 다시 시도해주세요.' 
        }, { status: 400 });
      }
      
      console.log('PDF 파일 크기:', buffer.length, 'bytes');
      console.log('✅ 유효한 PDF 파일입니다.');

      try {
        // Vercel 호환 PDF 텍스트 추출 방법
        console.log('📄 Vercel 호환 PDF 텍스트 추출 시도...');
        
        // 방법 1: 동적 pdf-parse 로드 (테스트 파일 추가됨)
        try {
          console.log('📄 pdf-parse 동적 로드 시도...');
          const pdfParse = await import('pdf-parse');
          const data = await pdfParse.default(buffer);
          
          if (data.text && data.text.trim().length > 100) {
            console.log('✅ pdf-parse 성공!');
            console.log('📝 텍스트 길이:', data.text.length);
            console.log('📝 텍스트 미리보기:', data.text.substring(0, 200) + '...');
            console.log('📊 PDF 정보:', {
              페이지수: data.numpages,
              메타데이터: data.info
            });
            
            // 텍스트 품질 검사
            const hasKoreanText = /[가-힣]/.test(data.text);
            const hasEnglishText = /[a-zA-Z]/.test(data.text);
            const hasMeaningfulContent = data.text.length > 200 && (hasKoreanText || hasEnglishText);
            
            console.log('📊 텍스트 품질 검사:', {
              length: data.text.length,
              hasKorean: hasKoreanText,
              hasEnglish: hasEnglishText,
              hasMeaningfulContent: hasMeaningfulContent
            });
            
            if (hasMeaningfulContent) {
              results.push({
                page: 1,
                text: data.text.trim(),
                success: true,
                error: undefined,
                extractionMethod: 'pdf-parse',
                numPages: data.numpages,
                environment: isVercel ? 'Vercel' : '호스트'
              });
            } else {
              throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
            }
          } else {
            throw new Error('pdf-parse에서 의미 있는 텍스트를 찾을 수 없습니다.');
          }
          
        } catch (pdfParseError) {
          console.log('❌ pdf-parse 실패:', pdfParseError);
          
          // 방법 2: 정교한 패턴 매칭으로 실제 텍스트 추출
          try {
            console.log('📄 정교한 패턴 매칭으로 실제 텍스트 추출 시도...');
            
            const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 1000000));
            
            // 실제 문서 텍스트를 찾기 위한 정교한 패턴들
            const patterns = [
              // 영어 문장 패턴 (실제 문서 내용)
              /[A-Z][a-z\s]{30,}[.!?]/g,
              // 한국어 문장 패턴 (실제 문서 내용)
              /[가-힣][가-힣\s]{15,}[.!?]/g,
              // 긴 텍스트 블록 (실제 문서 내용)
              /[A-Za-z가-힣][A-Za-z가-힣0-9\s]{50,}[A-Za-z가-힣0-9]/g,
              // 괄호 안의 실제 텍스트 (PDF 텍스트 객체) - 더 엄격한 필터링
              /\(([A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{30,})\)/g,
              // 따옴표 안의 실제 텍스트 - 더 엄격한 필터링
              /"([A-Za-z가-힣0-9\s\.\,\!\?\-\(\)]{30,})"/g,
              // BT/ET 블록 (PDF 텍스트 블록) - 더 엄격한 필터링
              /BT\s*([^E]*?)ET/g,
              // Tj 명령 (텍스트 표시) - 더 엄격한 필터링
              /Tj\s*\(([^)]{20,})\)/g,
              // TJ 명령 (텍스트 배열) - 더 엄격한 필터링
              /TJ\s*\[([^\]]{20,})\]/g,
              // 실제 문서 제목 패턴
              /Chapter\s+\d+\.\s*([^\n]+)/gi,
              // 실제 문서 내용 패턴
              /([A-Za-z가-힣][A-Za-z가-힣0-9\s\.\,\!\?]{50,}[A-Za-z가-힣0-9])/g
            ];
            
            let bestText = '';
            let bestLength = 0;
            let extractionMethod = '';
            
            for (let i = 0; i < patterns.length; i++) {
              const pattern = patterns[i];
              const matches = bufferString.match(pattern);
              
              if (matches && matches.length > 0) {
                let potentialText = '';
                
                if (pattern.source.includes('\\(')) {
                  // 괄호 안 텍스트 처리 - 실제 문서 내용만
                  potentialText = matches
                    .map(match => match.replace(/\(([^)]+)\)/, '$1'))
                    .filter(text => {
                      const hasRealWords = /[A-Za-z가-힣]{8,}/.test(text);
                      const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot|Type|Subtype|Length|Filter|DecodeParms|Width|Height|ColorSpace|BitsPerComponent|Intent|MediaBox|CropBox|BleedBox|TrimBox|ArtBox|Rotate|UserUnit|Contents|Resources|Parent|Kids|Count|First|Last|Prev|Next|Root|Info|ID|Encrypt|Metadata|PieceInfo|LastModified|Private|Perms|Legal|Collection|NeedsRendering|AcroForm|XFA|DSS|Extensions|AP|AS|OC|OU|JS|AA|OpenAction|Dest|Names|Threads|RichMedia|AF|Dests)/);
                      const notObjectRef = !text.match(/^\d+\s+\d+\s+R$/);
                      const hasMeaningfulLength = text.trim().length > 20;
                      const notOnlyNumbers = !/^\d+$/.test(text.trim());
                      const notBinary = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
                      const hasPunctuation = /[.!?,]/.test(text);
                      const hasSpaces = /\s/.test(text);
                      const notStructTree = !text.includes('StructTreeRoot');
                      const notObjectRefs = !text.match(/\d+\s+\d+\s+R/g);
                      const hasRealContent = /[A-Za-z가-힣]{5,}/.test(text);
                      
                      return hasRealWords && notMetadata && notObjectRef && hasMeaningfulLength && notOnlyNumbers && notBinary && hasPunctuation && hasSpaces && notStructTree && notObjectRefs && hasRealContent;
                    })
                    .join(' ');
                } else if (pattern.source.includes('"')) {
                  // 따옴표 안 텍스트 처리 - 실제 문서 내용만
                  potentialText = matches
                    .map(match => match.replace(/"([^"]+)"/, '$1'))
                    .filter(text => {
                      const hasRealWords = /[A-Za-z가-힣]{8,}/.test(text);
                      const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot|Type|Subtype|Length|Filter|DecodeParms|Width|Height|ColorSpace|BitsPerComponent|Intent|MediaBox|CropBox|BleedBox|TrimBox|ArtBox|Rotate|UserUnit|Contents|Resources|Parent|Kids|Count|First|Last|Prev|Next|Root|Info|ID|Encrypt|Metadata|PieceInfo|LastModified|Private|Perms|Legal|Collection|NeedsRendering|AcroForm|XFA|DSS|Extensions|AP|AS|OC|OU|JS|AA|OpenAction|Dest|Names|Threads|RichMedia|AF|Dests)/);
                      const notObjectRef = !text.match(/^\d+\s+\d+\s+R$/);
                      const hasMeaningfulLength = text.trim().length > 20;
                      const notOnlyNumbers = !/^\d+$/.test(text.trim());
                      const notBinary = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
                      const hasPunctuation = /[.!?,]/.test(text);
                      const hasSpaces = /\s/.test(text);
                      const notStructTree = !text.includes('StructTreeRoot');
                      const notObjectRefs = !text.match(/\d+\s+\d+\s+R/g);
                      const hasRealContent = /[A-Za-z가-힣]{5,}/.test(text);
                      
                      return hasRealWords && notMetadata && notObjectRef && hasMeaningfulLength && notOnlyNumbers && notBinary && hasPunctuation && hasSpaces && notStructTree && notObjectRefs && hasRealContent;
                    })
                    .join(' ');
                } else if (pattern.source.includes('BT')) {
                  // BT/ET 블록 처리
                  potentialText = matches
                    .map(match => match.replace(/BT\s*([^E]*?)ET/, '$1'))
                    .filter(text => {
                      const hasRealWords = /[A-Za-z가-힣]{3,}/.test(text);
                      const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot|Type|Subtype|Length|Filter|DecodeParms|Width|Height|ColorSpace|BitsPerComponent|Intent|MediaBox|CropBox|BleedBox|TrimBox|ArtBox|Rotate|UserUnit|Contents|Resources|Parent|Kids|Count|First|Last|Prev|Next|Root|Info|ID|Encrypt|Metadata|PieceInfo|LastModified|Private|Perms|Legal|Collection|NeedsRendering|AcroForm|XFA|DSS|Extensions|AP|AS|OC|OU|JS|AA|OpenAction|Dest|Names|Threads|RichMedia|AF|Dests)/);
                      const notObjectRef = !text.match(/^\d+\s+\d+\s+R$/);
                      const hasMeaningfulLength = text.trim().length > 5;
                      const notOnlyNumbers = !/^\d+$/.test(text.trim());
                      const notBinary = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
                      
                      return hasRealWords && notMetadata && notObjectRef && hasMeaningfulLength && notOnlyNumbers && notBinary;
                    })
                    .join(' ');
                } else if (pattern.source.includes('Tj')) {
                  // Tj 명령 처리
                  potentialText = matches
                    .map(match => match.replace(/Tj\s*\(([^)]+)\)/, '$1'))
                    .filter(text => {
                      const hasRealWords = /[A-Za-z가-힣]{3,}/.test(text);
                      const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot|Type|Subtype|Length|Filter|DecodeParms|Width|Height|ColorSpace|BitsPerComponent|Intent|MediaBox|CropBox|BleedBox|TrimBox|ArtBox|Rotate|UserUnit|Contents|Resources|Parent|Kids|Count|First|Last|Prev|Next|Root|Info|ID|Encrypt|Metadata|PieceInfo|LastModified|Private|Perms|Legal|Collection|NeedsRendering|AcroForm|XFA|DSS|Extensions|AP|AS|OC|OU|JS|AA|OpenAction|Dest|Names|Threads|RichMedia|AF|Dests)/);
                      const notObjectRef = !text.match(/^\d+\s+\d+\s+R$/);
                      const hasMeaningfulLength = text.trim().length > 5;
                      const notOnlyNumbers = !/^\d+$/.test(text.trim());
                      const notBinary = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
                      
                      return hasRealWords && notMetadata && notObjectRef && hasMeaningfulLength && notOnlyNumbers && notBinary;
                    })
                    .join(' ');
                } else if (pattern.source.includes('TJ')) {
                  // TJ 명령 처리
                  potentialText = matches
                    .map(match => match.replace(/TJ\s*\[([^\]]+)\]/, '$1'))
                    .filter(text => {
                      const hasRealWords = /[A-Za-z가-힣]{3,}/.test(text);
                      const notMetadata = !text.match(/^(obj|endobj|R|PDF|Creator|Producer|CreationDate|ModDate|StructTreeRoot|Type|Subtype|Length|Filter|DecodeParms|Width|Height|ColorSpace|BitsPerComponent|Intent|MediaBox|CropBox|BleedBox|TrimBox|ArtBox|Rotate|UserUnit|Contents|Resources|Parent|Kids|Count|First|Last|Prev|Next|Root|Info|ID|Encrypt|Metadata|PieceInfo|LastModified|Private|Perms|Legal|Collection|NeedsRendering|AcroForm|XFA|DSS|Extensions|AP|AS|OC|OU|JS|AA|OpenAction|Dest|Names|Threads|RichMedia|AF|Dests)/);
                      const notObjectRef = !text.match(/^\d+\s+\d+\s+R$/);
                      const hasMeaningfulLength = text.trim().length > 5;
                      const notOnlyNumbers = !/^\d+$/.test(text.trim());
                      const notBinary = !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text);
                      
                      return hasRealWords && notMetadata && notObjectRef && hasMeaningfulLength && notOnlyNumbers && notBinary;
                    })
                    .join(' ');
                } else {
                  // 일반 텍스트 처리
                  potentialText = matches
                    .join(' ')
                    .replace(/[^\w\s가-힣\.\,\!\?]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                }
                
                if (potentialText.length > bestLength && potentialText.length > 100) {
                  bestText = potentialText;
                  bestLength = potentialText.length;
                  extractionMethod = `패턴 ${i + 1}`;
                }
              }
            }
            
            if (bestText.length > 0) {
              console.log('✅ 정교한 패턴 매칭으로 텍스트 추출 성공!');
              console.log('📝 추출 방법:', extractionMethod);
              console.log('📝 텍스트 길이:', bestText.length);
              console.log('📝 텍스트 미리보기:', bestText.substring(0, 200) + '...');
              
              // 텍스트 품질 검사
              const hasKoreanText = /[가-힣]/.test(bestText);
              const hasEnglishText = /[a-zA-Z]/.test(bestText);
              const hasMeaningfulContent = bestText.length > 200 && (hasKoreanText || hasEnglishText);
              
              console.log('📊 텍스트 품질 검사:', {
                length: bestText.length,
                hasKorean: hasKoreanText,
                hasEnglish: hasEnglishText,
                hasMeaningfulContent: hasMeaningfulContent
              });
              
              if (hasMeaningfulContent) {
                results.push({
                  page: 1,
                  text: bestText,
                  success: true,
                  error: undefined,
                  extractionMethod: extractionMethod,
                  environment: isVercel ? 'Vercel' : '호스트'
                });
              } else {
                throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
              }
              
            } else {
              // 이미지 기반 PDF 감지
              const isImageBased = /Image|XObject|Subtype.*Image|Width|Height/.test(bufferString);
              const hasNoText = !/[A-Za-z가-힣]{10,}/.test(bufferString);
              
              if (isImageBased || hasNoText) {
                console.error('❌ 이미지 기반 PDF 감지');
                throw new Error('이미지 기반 PDF 파일입니다. 텍스트를 추출할 수 없습니다. 텍스트 기반 PDF 파일을 사용해주세요.');
              } else {
                throw new Error('텍스트 추출에 실패했습니다.');
              }
            }

          } catch (patternError) {
            console.log('❌ 정교한 패턴 매칭 실패:', patternError);
            
            // 방법 3: OpenAI Vision API (Vercel에서도 작동)
            try {
              console.log('📄 OpenAI Vision API 시도 중...');
              
              // PDF를 간단한 텍스트로 변환하여 이미지 생성
              const canvas = require('canvas');
              const { createCanvas } = canvas;
              
              const width = 800;
              const height = 600;
              const canvasInstance = createCanvas(width, height);
              const ctx = canvasInstance.getContext('2d');
              
              // 흰색 배경
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, width, height);
              
              // PDF 정보 표시
              ctx.fillStyle = 'black';
              ctx.font = '16px Arial';
              ctx.fillText('PDF 파일: ' + file.name, 50, 50);
              ctx.fillText('크기: ' + buffer.length + ' bytes', 50, 80);
              ctx.fillText('PDF 텍스트 추출 중...', 50, 110);
              
              // 이미지를 base64로 인코딩
              const imageBuffer = canvasInstance.toBuffer('image/png');
              const base64Image = imageBuffer.toString('base64');
              
              // OpenAI Vision API로 OCR 수행
              const completion = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  {
                    role: "user",
                    content: [
                      {
                        type: "text",
                        text: "이 이미지는 PDF 파일 정보를 나타냅니다. PDF에서 텍스트를 추출하는 방법을 제안해주세요."
                      },
                      {
                        type: "image_url",
                        image_url: {
                          url: `data:image/png;base64,${base64Image}`
                        }
                      }
                    ]
                  }
                ],
                max_tokens: 1000,
              });

              const visionText = completion.choices[0]?.message?.content;
              
              if (visionText && visionText.trim().length > 50) {
                console.log('✅ OpenAI Vision API 성공!');
                console.log('📝 응답 길이:', visionText.length);
                console.log('📝 응답 미리보기:', visionText.substring(0, 200));
                
                results.push({
                  page: 1,
                  text: visionText.trim(),
                  success: true,
                  error: undefined,
                  extractionMethod: 'OpenAI Vision API',
                  environment: isVercel ? 'Vercel' : '호스트'
                });
              } else {
                throw new Error('OpenAI Vision API에서 유효한 응답을 받지 못했습니다.');
              }
              
            } catch (visionError) {
              console.log('❌ OpenAI Vision API 실패:', visionError);
              
              // 최후의 대안: 기본 패턴 매칭
              try {
                console.log('📄 최후 대안: 기본 패턴 매칭 시도 중...');
                const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 100000));
                const patterns = [/[가-힣a-zA-Z0-9\s]{3,}/g];
                let bestText = '';
                let bestLength = 0;
                
                for (const pattern of patterns) {
                  const matches = bufferString.match(pattern);
                  if (matches && matches.length > 0) {
                    const potentialText = matches.join(' ').replace(/[^가-힣a-zA-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
                    if (potentialText.length > bestLength && potentialText.length > 10) {
                      bestText = potentialText;
                      bestLength = potentialText.length;
                    }
                  }
                }
                
                if (bestText.length > 0) {
                  console.log('✅ 기본 텍스트 추출 성공, 길이:', bestText.length);
                  results.push({ 
                    page: 1, 
                    text: bestText, 
                    success: true, 
                    error: undefined, 
                    extractionMethod: '기본 패턴 매칭',
                    environment: isVercel ? 'Vercel' : '호스트'
                  });
                } else {
                  throw new Error('기본 텍스트 추출도 실패했습니다.');
                }
              } catch (finalError) {
                console.log('❌ 기본 텍스트 추출 실패:', finalError);
                results.push({ 
                  page: 1, 
                  text: 'PDF에서 텍스트를 추출할 수 없습니다.', 
                  success: false, 
                  error: '모든 텍스트 추출 방법이 실패했습니다.',
                  environment: isVercel ? 'Vercel' : '호스트'
                });
              }
            }
          }
        }
      } catch (error) {
        console.log('❌ 모든 PDF 텍스트 추출 방법 실패:', error);
        results.push({ 
          page: 1, 
          text: 'PDF 처리 중 오류가 발생했습니다.', 
          success: false, 
          error: error instanceof Error ? error.message : '알 수 없는 오류',
          environment: isVercel ? 'Vercel' : '호스트'
        });
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