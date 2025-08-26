import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';
import { extractYouTubeContent } from '@/lib/youtube-extractor';
import { extractDocumentContent, extractWebsiteContent } from '@/lib/content-extractor';
import { generateSummary } from '@/lib/text-processor';
import { getSummaryCostInfo } from '@/lib/summary-cost-calculator';

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const formData = await request.formData();
    const type = formData.get('type') as string;

    console.log('🎯 AI 요약 요청:', { type, userId: user.id });

    let content = '';
    let extractionMethod = '';

    try {
      switch (type) {
        case 'youtube':
          const youtubeUrl = formData.get('youtubeUrl') as string;
          console.log('📹 YouTube URL 처리 시작:', youtubeUrl);
          content = await extractYouTubeContent(youtubeUrl);
          extractionMethod = 'YouTube 제목/설명(oEmbed)';
          break;
        
        case 'document':
          const document = formData.get('document') as File;
          console.log('📄 문서 처리 시작:', document.name, document.size, 'bytes');
          // 파일 확장자 확인
          {
            const fileNameLower = document.name.toLowerCase();
            const isPDF = fileNameLower.endsWith('.pdf');
            const isPPT = fileNameLower.endsWith('.ppt') || fileNameLower.endsWith('.pptx');

            if (isPDF || isPPT) {
              try {
                // 내부 문서 OCR API 프록시 호출
                const proto = (request.headers.get('x-forwarded-proto') || 'http');
                const host = (request.headers.get('host') || 'localhost:3000');
                const baseUrl = `${proto}://${host}`;
                const fd = new FormData();
                fd.append('file', document);

                console.log('🔎 내부 OCR 호출 시작 →', `${baseUrl}/api/document-ocr`);
                const ocrResp = await fetch(`${baseUrl}/api/document-ocr`, {
                  method: 'POST',
                  body: fd
                });
                console.log('📡 OCR 응답 상태:', ocrResp.status, ocrResp.statusText);

                if (ocrResp.ok) {
                  const ocrData: any = await ocrResp.json();
                  const results = Array.isArray(ocrData?.results) ? ocrData.results : [];
                  const texts = results.map((r: any) => (r?.text || '').trim()).filter((t: string) => t.length > 0);
                  const combined = texts.join('\n\n').trim();

                  if (combined.length > 0) {
                    content = combined;
                    extractionMethod = results[0]?.extractionMethod || 'Document OCR';
                    break;
                  }
                } else {
                  // 비정상 응답 본문 로깅 시도
                  const errText = await ocrResp.text().catch(() => '');
                  console.log('❌ OCR 호출 실패:', errText);
                }
              } catch (ocrErr) {
                console.error('❌ 내부 OCR 호출 오류:', ocrErr);
              }
            }

            // OCR 미사용 또는 실패 시 기존 파싱으로 폴백
            content = await extractDocumentContent(document);
            extractionMethod = '문서 파싱';
          }
          break;
        
        case 'website':
          const websiteUrl = formData.get('websiteUrl') as string;
          console.log('🌐 웹사이트 처리 시작:', websiteUrl);
          content = await extractWebsiteContent(websiteUrl);
          extractionMethod = '웹 크롤링';
          break;
        
        case 'text':
          content = formData.get('textContent') as string;
          extractionMethod = '직접 입력';
          break;
        
        default:
          return NextResponse.json({ error: '지원하지 않는 타입입니다.' }, { status: 400 });
      }

      console.log('✅ 콘텐츠 추출 완료:', {
        type,
        method: extractionMethod,
        contentLength: content.length,
        preview: content.substring(0, 100) + '...'
      });

    } catch (extractionError) {
      console.error('❌ 콘텐츠 추출 실패:', extractionError);
      
      // 구체적인 에러 메시지 제공
      let errorMessage = '콘텐츠를 추출할 수 없습니다.';
      
      if (extractionError instanceof Error) {
        if (extractionError.message.includes('자막')) {
          errorMessage = '자막을 찾을 수 없습니다. 자막이 있는 영상을 사용하거나, 더 명확한 음성의 영상을 선택해주세요.';
        } else if (extractionError.message.includes('음성')) {
          errorMessage = '음성을 인식할 수 없습니다. 더 명확한 발음의 영상이나 자막이 있는 영상을 사용해주세요.';
        } else if (extractionError.message.includes('네트워크')) {
          errorMessage = '네트워크 연결을 확인해주세요. 잠시 후 다시 시도해주세요.';
        } else if (extractionError.message.includes('파일')) {
          errorMessage = '파일을 읽을 수 없습니다. 지원되는 형식(PDF, DOC, DOCX, TXT)인지 확인해주세요.';
        } else {
          errorMessage = extractionError.message;
        }
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: extractionError instanceof Error ? extractionError.message : '알 수 없는 오류'
      }, { status: 400 });
    }

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ 
        error: '추출된 콘텐츠가 비어있습니다. 다른 콘텐츠로 시도해주세요.' 
      }, { status: 400 });
    }

    // 비용 계산 및 요약 생성
    try {
      const costInfo = getSummaryCostInfo(content, 'gpt-3.5-turbo', 2000);
      console.log('💰 요약 비용 정보:', {
        cost: costInfo.cost.toFixed(2) + '원',
        isExpensive: costInfo.isExpensive,
        inputTokens: costInfo.inputTokens,
        estimatedOutputTokens: costInfo.estimatedOutputTokens,
        contentLength: content.length
      });

      console.log('🤖 OpenAI 요약 생성 시작...');
      const summary = await generateSummary(content, type);
      
      console.log('✅ 요약 생성 완료:', summary.length, '문자');

      return NextResponse.json({ 
        summary,
        costInfo: {
          cost: costInfo.cost,
          isExpensive: costInfo.isExpensive,
          method: 'openai',
          inputTokens: costInfo.inputTokens,
          estimatedOutputTokens: costInfo.estimatedOutputTokens
        },
        extractionInfo: {
          method: extractionMethod,
          contentLength: content.length
        }
      });
      
    } catch (summaryError) {
      console.error('❌ 요약 생성 실패:', summaryError);
      
      let errorMessage = '요약 생성 중 오류가 발생했습니다.';
      
      if (summaryError instanceof Error) {
        if (summaryError.message.includes('API')) {
          errorMessage = 'AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
        } else if (summaryError.message.includes('토큰')) {
          errorMessage = '콘텐츠가 너무 깁니다. 더 짧은 콘텐츠로 시도해주세요.';
        } else {
          errorMessage = summaryError.message;
        }
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        details: summaryError instanceof Error ? summaryError.message : '알 수 없는 오류'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ AI 요약 API 전체 오류:', error);
    
    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
} 