import { NextRequest, NextResponse } from 'next/server';

// Azure Document Intelligence 설정
const AZURE_ENDPOINT = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const AZURE_API_KEY = process.env.AZURE_DOCUMENT_INTELLIGENCE_API_KEY;

interface DocumentAnalysisResult {
  content: string;
  pages: any[];
  tables: any[];
  keyValuePairs: any[];
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
    const isPPT = fileName.endsWith('.ppt') || fileName.endsWith('.pptx');

    console.log('PDF 여부:', isPDF, 'PPT 여부:', isPPT);

    if (!isPDF && !isPPT) {
      return NextResponse.json({ error: 'PDF 또는 PPT 파일만 지원됩니다.' }, { status: 400 });
    }

    console.log('파일 처리 시작:', file.name);
    console.log('버퍼 크기:', buffer.length, 'bytes');

    // Azure Document Intelligence로 문서 분석
    const analysisResult = await analyzeDocumentWithAzure(buffer, fileName);
    
    if (analysisResult.success) {
      console.log('✅ Azure Document Intelligence 성공!');
      console.log('📝 추출된 텍스트 길이:', analysisResult.content.length);
      console.log('📝 텍스트 미리보기:', analysisResult.content.substring(0, 200) + '...');
      
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
      { error: '서버 오류가 발생했습니다.' },
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
      throw new Error('Azure Document Intelligence 설정이 누락되었습니다.');
    }
    
    // 엔드포인트 URL 정리 (끝에 슬래시 제거)
    const cleanEndpoint = AZURE_ENDPOINT.replace(/\/$/, '');
    console.log('🔗 Azure 엔드포인트:', cleanEndpoint);
    
    // 1. 문서 업로드 및 분석 시작 (여러 API 경로 시도)
    const apiPaths = [
      '/formrecognizer/documentModels/prebuilt-document:analyze?api-version=2022-08-31',
      '/formrecognizer/documentModels/prebuilt-document:analyze?api-version=2023-10-31',
      '/documentintelligence/documentModels/prebuilt-document:analyze?api-version=2022-08-31',
      '/documentintelligence/documentModels/prebuilt-document:analyze?api-version=2023-10-31'
    ];
    
    let uploadResponse: Response | null = null;
    let lastError: string = '';
    
    for (const apiPath of apiPaths) {
      try {
        console.log(`🔗 API 경로 시도: ${apiPath}`);
        uploadResponse = await fetch(`${cleanEndpoint}${apiPath}`, {
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

// Azure 결과에서 텍스트 내용 추출
function extractContentFromAzureResult(result: any): string {
  try {
    let content = '';
    
    // 페이지별 텍스트 추출
    if (result.analyzeResult?.pages) {
      for (const page of result.analyzeResult.pages) {
        if (page.lines) {
          for (const line of page.lines) {
            if (line.content) {
              content += line.content + '\n';
            }
          }
        }
      }
    }
    
    // 표 내용 추출
    if (result.analyzeResult?.tables) {
      for (const table of result.analyzeResult.tables) {
        content += '\n\n--- 표 ---\n';
        if (table.cells) {
          for (const cell of table.cells) {
            if (cell.content) {
              content += cell.content + '\t';
            }
          }
          content += '\n';
        }
      }
    }
    
    return content.trim();
    
  } catch (error) {
    console.error('Azure 결과 파싱 오류:', error);
    return '';
  }
} 