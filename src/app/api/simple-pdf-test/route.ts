import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('간단한 PDF 테스트 API 호출됨');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('파일이 없음');
      return NextResponse.json(
        { error: '파일이 없습니다.' },
        { status: 400 }
      );
    }

    console.log(`파일명: ${file.name}`);
    console.log(`파일 크기: ${file.size} bytes`);
    console.log(`파일 타입: ${file.type}`);

    // 파일을 버퍼로 변환
    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`버퍼 크기: ${buffer.length} bytes`);
    
    // PDF 헤더 확인
    const header = buffer.toString('utf8', 0, 100);
    console.log('파일 헤더:', header);
    
    // PDF 시그니처 확인
    const isPdf = buffer.toString('hex', 0, 4) === '25504446';
    console.log('PDF 시그니처 확인:', isPdf);
    
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      bufferSize: buffer.length,
      isPdf: isPdf,
      header: header.substring(0, 50) + '...'
    });

  } catch (error) {
    console.error('간단한 PDF 테스트 오류:', error);
    return NextResponse.json(
      { error: '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 