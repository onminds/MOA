import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{
    filename: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { filename } = await params;
    const decodedFilename = decodeURIComponent(filename);
    
    console.log('PPT 파일 다운로드 요청:', decodedFilename);

    // 실제로는 외부 서비스에서 생성된 파일을 다운로드하거나
    // 서버에 저장된 파일을 반환
    
    // 현재는 시뮬레이션으로 더미 PPT 파일 생성
    const pptContent = generateDummyPPTContent(decodedFilename);

    return new NextResponse(pptContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${decodedFilename}"`,
        'Content-Length': pptContent.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('PPT 파일 다운로드 오류:', error);
    
    return NextResponse.json({ 
      success: false,
      error: 'PPT 파일 다운로드 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}

// 더미 PPT 파일 내용 생성 (실제로는 외부 API에서 받은 파일 사용)
function generateDummyPPTContent(filename: string): ArrayBuffer {
  // 실제로는 외부 PPT 생성 API에서 받은 바이너리 데이터를 사용
  // 여기서는 시뮬레이션을 위해 기본 PPT 구조 생성
  
  const pptHeader = new Uint8Array([
    // PPT 파일 시그니처 (ZIP 기반)
    0x50, 0x4B, 0x03, 0x04, // ZIP 파일 헤더
    0x14, 0x00, 0x00, 0x00, 0x08, 0x00,
    // 더미 데이터 (실제 PPT는 복잡한 XML 구조)
  ]);

  // 실제 구현에서는:
  // 1. 외부 API에서 받은 PPT 파일 바이너리
  // 2. 서버에 저장된 PPT 파일
  // 3. 실시간 생성된 PPT 파일을 반환

  // 현재는 시뮬레이션을 위한 기본 내용
  const dummyContent = new TextEncoder().encode(`
    이것은 ${filename}의 시뮬레이션 파일입니다.
    
    실제 구현에서는:
    - Microsoft Graph API로 생성된 PowerPoint 파일
    - Google Slides API로 생성된 프레젠테이션
    - Canva API로 생성된 디자인 파일
    - 기타 PPT 생성 서비스 파일
    
    이 위치에 실제 PPT 바이너리 데이터가 들어갑니다.
  `);

  // 헤더와 내용을 합쳐서 반환
  const combined = new Uint8Array(pptHeader.length + dummyContent.length);
  combined.set(pptHeader);
  combined.set(dummyContent, pptHeader.length);

  return combined.buffer;
} 