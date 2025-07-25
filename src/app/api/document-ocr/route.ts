import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPPT, isValidPPTFile } from '@/lib/pptParser';

// Azure Document Intelligence 설정
const AZURE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY;

interface DocumentAnalysisResult {
  content: string;
  pages: any[];
  tables: any[];
  keyValuePairs: any[];
}

// 간단한 PDF 텍스트 추출 함수
async function extractSimpleTextFromPDF(buffer: Buffer): Promise<string> {
  try {
    console.log('📄 간단한 PDF 텍스트 추출 시도...');
    
    // PDF 파일의 기본 구조에서 텍스트 추출 시도
    const pdfContent = buffer.toString('utf8', 0, Math.min(buffer.length, 10000)); // 처음 10KB만 읽기
    
    // PDF 텍스트 패턴 찾기
    const textPatterns = [
      /\(([^)]{10,})\)/g, // 괄호 안의 긴 텍스트
      /\[([^\]]{10,})\]/g, // 대괄호 안의 긴 텍스트
      /BT\s*([^E]{10,})\s*ET/g, // PDF 텍스트 블록
      /Tj\s*\(([^)]{10,})\)/g, // PDF 텍스트 객체
    ];
    
    let extractedText = '';
    
    for (const pattern of textPatterns) {
      const matches = pdfContent.match(pattern);
      if (matches) {
        for (const match of matches) {
          // 특수 문자 제거 및 텍스트 정리
          const cleanText = match
            .replace(/[^\w\s가-힣]/g, ' ') // 특수 문자 제거
            .replace(/\s+/g, ' ') // 연속 공백 제거
            .trim();
          
          if (cleanText.length > 10) {
            extractedText += cleanText + ' ';
          }
        }
      }
    }
    
    // 한글 텍스트 패턴 추가 검색
    const koreanPattern = /[가-힣\s]{10,}/g;
    const koreanMatches = pdfContent.match(koreanPattern);
    if (koreanMatches) {
      for (const match of koreanMatches) {
        const cleanText = match.trim();
        if (cleanText.length > 5) {
          extractedText += cleanText + ' ';
        }
      }
    }
    
    // 영문 텍스트 패턴 추가 검색
    const englishPattern = /[A-Za-z\s]{20,}/g;
    const englishMatches = pdfContent.match(englishPattern);
    if (englishMatches) {
      for (const match of englishMatches) {
        const cleanText = match.trim();
        if (cleanText.length > 10) {
          extractedText += cleanText + ' ';
        }
      }
    }
    
    const finalText = extractedText.trim();
    console.log('📝 간단한 텍스트 추출 결과 길이:', finalText.length);
    
    if (finalText.length > 0) {
      console.log('📝 추출된 텍스트 미리보기:', finalText.substring(0, 200) + '...');
      return finalText;
    }
    
    throw new Error('PDF에서 텍스트를 추출할 수 없습니다.');
  } catch (error) {
    console.error('❌ 간단한 PDF 텍스트 추출 실패:', error);
    throw error;
  }
}

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
    const isPPT = isValidPPTFile(fileName);

    console.log('PDF 여부:', isPDF, 'PPT 여부:', isPPT);

    if (!isPDF && !isPPT) {
      return NextResponse.json({ error: 'PDF 또는 PPT 파일만 지원됩니다.' }, { status: 400 });
    }

    console.log('파일 처리 시작:', file.name);
    console.log('버퍼 크기:', buffer.length, 'bytes');

    // PPT 파일 처리
    if (isPPT) {
      console.log('📊 PPT 파일 처리 시작...');
      try {
        const pptText = await extractTextFromPPT(buffer);
        console.log('✅ PPT 텍스트 추출 성공!');
        console.log('📝 추출된 텍스트 길이:', pptText.length);
        console.log('📝 텍스트 미리보기:', pptText.substring(0, 200) + '...');
        
        return NextResponse.json({
          success: true,
          totalPages: 1,
          results: [{
            page: 1,
            text: pptText,
            success: true,
            error: undefined,
            extractionMethod: 'PPT Parser',
            slideType: 'ppt-parser',
            environment: isVercel ? 'Vercel' : '호스트'
          }],
          successCount: 1,
          errorCount: 0,
          environment: isVercel ? 'Vercel' : '호스트'
        });
      } catch (pptError) {
        console.error('❌ PPT 텍스트 추출 실패:', pptError);
        return NextResponse.json({
          success: false,
          totalPages: 0,
          results: [{
            page: 1,
            text: 'PPT 파일에서 텍스트를 추출할 수 없습니다.',
            success: false,
            error: pptError instanceof Error ? pptError.message : 'PPT 파싱 오류',
            extractionMethod: 'PPT Parser (실패)',
            slideType: 'failed',
            environment: isVercel ? 'Vercel' : '호스트'
          }],
          successCount: 0,
          errorCount: 1,
          environment: isVercel ? 'Vercel' : '호스트'
        });
      }
    }

    // Azure Document Intelligence로 문서 분석 시도 (PDF만)
    let analysisResult;
    try {
      analysisResult = await analyzeDocumentWithAzure(buffer, fileName);
    } catch (azureError) {
      console.error('❌ Azure Document Intelligence 실패:', azureError);
      
      // Azure 실패 시 대안 방법 시도
      console.log('🔄 대안 방법 시도 중...');
      console.log('📄 PDF 파일 여부:', isPDF);
      
      if (isPDF) {
        // PDF 파일인 경우 간단한 텍스트 추출 시도
        console.log('📄 간단한 PDF 텍스트 추출 시작...');
        try {
          const simpleText = await extractSimpleTextFromPDF(buffer);
          console.log('📝 간단한 텍스트 추출 결과 길이:', simpleText.length);
          
          if (simpleText && simpleText.trim().length > 0) {
            console.log('✅ 간단한 PDF 텍스트 추출 성공');
            console.log('📝 추출된 텍스트 미리보기:', simpleText.substring(0, 200) + '...');
            
            return NextResponse.json({
              success: true,
              totalPages: 1,
              results: [{
                page: 1,
                text: simpleText,
                success: true,
                error: undefined,
                extractionMethod: 'Simple PDF Text Extraction',
                slideType: 'simple-pdf',
                environment: isVercel ? 'Vercel' : '호스트'
              }],
              successCount: 1,
              errorCount: 0,
              environment: isVercel ? 'Vercel' : '호스트'
            });
          } else {
            console.log('❌ 간단한 텍스트 추출 결과가 비어있음');
          }
        } catch (simpleError) {
          console.error('❌ 간단한 PDF 텍스트 추출도 실패:', simpleError);
        }
      } else {
        console.log('❌ PDF 파일이 아니므로 간단한 텍스트 추출을 시도하지 않음');
      }
      
      // 모든 방법 실패 시 오류 반환
      console.log('❌ 모든 방법 실패 - 오류 반환');
      return NextResponse.json({
        success: false,
        totalPages: 0,
        results: [{
          page: 1,
          text: '문서에서 텍스트를 추출할 수 없습니다. Azure API 설정을 확인하거나 다른 PDF 파일을 시도해주세요.',
          success: false,
          error: azureError instanceof Error ? azureError.message : 'Azure API 오류',
          extractionMethod: 'Azure Document Intelligence (실패)',
          slideType: 'failed',
          environment: isVercel ? 'Vercel' : '호스트'
        }],
        successCount: 0,
        errorCount: 1,
        environment: isVercel ? 'Vercel' : '호스트'
      });
    }
    
    if (analysisResult.success) {
      console.log('✅ Azure Document Intelligence 성공!');
      console.log('📝 추출된 텍스트 길이:', analysisResult.content.length);
      console.log('📝 텍스트 미리보기:', analysisResult.content.substring(0, 200) + '...');
      console.log('📊 분석 상세 정보:', {
        페이지수: analysisResult.pages.length,
        표개수: analysisResult.tables.length,
        키값쌍개수: analysisResult.keyValuePairs.length,
        텍스트길이: analysisResult.content.length,
        환경: isVercel ? 'Vercel' : '호스트'
      });
      
      return NextResponse.json({
        success: true,
        totalPages: analysisResult.pages.length,
        results: [{
          page: 1,
          text: analysisResult.content,
          success: true,
          error: undefined,
          extractionMethod: 'Azure Document Intelligence',
          slideType: 'azure-ai',
          environment: isVercel ? 'Vercel' : '호스트',
          tables: analysisResult.tables,
          keyValuePairs: analysisResult.keyValuePairs
        }],
        successCount: 1,
        errorCount: 0,
        environment: isVercel ? 'Vercel' : '호스트'
      });
    } else {
      console.error('❌ Azure Document Intelligence 실패:', analysisResult.error);
      
      return NextResponse.json({
        success: false,
        totalPages: 0,
        results: [{
          page: 1,
          text: '문서에서 텍스트를 추출할 수 없습니다.',
          success: false,
          error: analysisResult.error,
          extractionMethod: 'Azure Document Intelligence (실패)',
          slideType: 'failed',
          environment: isVercel ? 'Vercel' : '호스트'
        }],
        successCount: 0,
        errorCount: 1,
        environment: isVercel ? 'Vercel' : '호스트'
      });
    }

  } catch (error) {
    console.error('API 처리 중 오류:', error);
    return NextResponse.json(
      { error: '문서 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// Azure Document Intelligence로 문서 분석
async function analyzeDocumentWithAzure(buffer: Buffer, fileName: string): Promise<{
  success: boolean;
  content: string;
  pages: any[];
  tables: any[];
  keyValuePairs: any[];
  error?: string;
}> {
  try {
    console.log('🔍 Azure Document Intelligence로 문서 분석 시작...');
    
    if (!AZURE_ENDPOINT || !AZURE_API_KEY) {
      const missingSettings = [];
      if (!AZURE_ENDPOINT) missingSettings.push('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
      if (!AZURE_API_KEY) missingSettings.push('AZURE_DOCUMENT_INTELLIGENCE_API_KEY');
      
      throw new Error(`Azure Document Intelligence 설정이 누락되었습니다. 누락된 설정: ${missingSettings.join(', ')}`);
    }
    
    // 엔드포인트 URL 정리 (끝에 슬래시 제거)
    const cleanEndpoint = AZURE_ENDPOINT.replace(/\/$/, '');
    console.log('🔗 Azure 엔드포인트:', cleanEndpoint);
    
    // 1. 문서 업로드 및 분석 시작 (prebuilt-read 모델 사용)
    const apiPaths = [
      '/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2024-02-29-preview',
      '/documentintelligence/documentModels/prebuilt-read:analyze?api-version=2023-10-31',
      '/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-10-31',
      '/formrecognizer/documentModels/prebuilt-read:analyze?api-version=2022-08-31'
    ];
    
    let uploadResponse: Response | null = null;
    let lastError: string = '';
    
    console.log('🔧 Azure 설정 확인:');
    console.log('  - 엔드포인트:', cleanEndpoint);
    console.log('  - API 키 존재:', !!AZURE_API_KEY);
    console.log('  - 파일 크기:', buffer.length, 'bytes');
    
    for (const apiPath of apiPaths) {
      try {
        const fullUrl = `${cleanEndpoint}${apiPath}`;
        console.log(`🔗 API 경로 시도: ${fullUrl}`);
        
        uploadResponse = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
            'Content-Type': 'application/octet-stream'
          },
          body: buffer
        });
        
        console.log('📡 API 응답 상태:', uploadResponse.status, uploadResponse.statusText);
        
        if (uploadResponse.ok) {
          console.log(`✅ 성공한 API 경로: ${apiPath}`);
          break;
        } else {
          const errorText = await uploadResponse.text();
          lastError = `${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`;
          console.log(`❌ 실패한 API 경로: ${apiPath} - ${lastError}`);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : '알 수 없는 오류';
        console.log(`❌ API 경로 오류: ${apiPath} - ${lastError}`);
      }
    }
    
    if (!uploadResponse || !uploadResponse.ok) {
      throw new Error(`모든 Azure API 경로 실패. 마지막 오류: ${lastError}`);
    }
    
    const operationLocation = uploadResponse.headers.get('Operation-Location');
    if (!operationLocation) {
      throw new Error('Operation-Location 헤더를 찾을 수 없습니다.');
    }
    
    console.log('📄 문서 분석 작업 시작됨');
    console.log('📍 작업 위치:', operationLocation);
    
    // 2. 분석 완료 대기
    let analysisComplete = false;
    let result: any = null;
    let retryCount = 0;
    const maxRetries = 30; // 최대 30초 대기
    
    while (!analysisComplete && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
      retryCount++;
      
      console.log(`⏳ 분석 상태 확인 중... (${retryCount}/${maxRetries})`);
      
      const statusResponse = await fetch(operationLocation, {
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_API_KEY
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`상태 확인 실패: ${statusResponse.status}`);
      }
      
      result = await statusResponse.json();
      
      if (result.status === 'succeeded') {
        analysisComplete = true;
        console.log('✅ 문서 분석 완료');
      } else if (result.status === 'failed') {
        throw new Error('문서 분석 실패');
      } else {
        console.log(`⏳ 분석 진행 중... (${result.status})`);
      }
    }
    
    if (!analysisComplete) {
      throw new Error('분석 시간 초과');
    }
    
    // 3. 결과 파싱
    const content = extractContentFromAzureResult(result);
    const pages = result.analyzeResult?.pages || [];
    const tables = result.analyzeResult?.tables || [];
    const keyValuePairs = result.analyzeResult?.keyValuePairs || [];
    
    console.log(`📊 분석 결과: ${pages.length}페이지, ${tables.length}개 표, ${keyValuePairs.length}개 키-값 쌍`);
    
    return {
      success: true,
      content,
      pages,
      tables,
      keyValuePairs
    };
    
  } catch (error) {
    console.error('Azure Document Intelligence 오류:', error);
    return {
      success: false,
      content: '',
      pages: [],
      tables: [],
      keyValuePairs: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

// Azure 결과에서 텍스트 내용 추출 (prebuilt-read 모델용)
function extractContentFromAzureResult(result: any): string {
  try {
    console.log('📄 prebuilt-read 결과 파싱 시작...');
    
    // prebuilt-read 분석 후 라인 콘텐츠 중심으로 파싱
    // layout과 달리 read 모델은 pages[].lines[].content가 실제 OCR 텍스트입니다
    const rawLines: string[] = result.analyzeResult?.pages?.flatMap((page: any) =>
      page.lines?.map((line: any) => line.content) || []
    ) || [];
    
    console.log('📄 추출된 라인 수:', rawLines.length);
    console.log('📄 라인 미리보기:', rawLines.slice(0, 10));
    
    const rawText = rawLines.join('\n');
    console.log('📄 전체 텍스트 길이:', rawText.length);
    console.log('📄 텍스트 미리보기:', rawText.substring(0, 300) + '...');
    
    return rawText;
    
  } catch (error) {
    console.error('Azure 결과 파싱 오류:', error);
    return '';
  }
} 