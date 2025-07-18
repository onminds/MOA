import { NextRequest, NextResponse } from 'next/server';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 제공되지 않았습니다.' },
        { status: 400 }
      );
    }

    const fileType = file.type;
    const buffer = Buffer.from(await file.arrayBuffer());
    
    let extractedText = '';

    try {
      if (fileType === 'text/plain') {
        // 텍스트 파일
        extractedText = buffer.toString('utf-8');
      } else if (fileType === 'application/pdf') {
        // PDF 파일
        const pdfData = await pdf(buffer);
        extractedText = pdfData.text;
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword'
      ) {
        // Word 문서
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else {
        return NextResponse.json(
          { error: '지원되지 않는 파일 형식입니다.' },
          { status: 400 }
        );
      }

      // 텍스트가 너무 길면 잘라내기 (API 토큰 제한 고려)
      if (extractedText.length > 10000) {
        extractedText = extractedText.substring(0, 10000) + '\n\n... (내용이 길어 일부만 표시됩니다)';
      }

      // 빈 텍스트 확인
      if (!extractedText.trim()) {
        return NextResponse.json(
          { error: '파일에서 텍스트를 추출할 수 없습니다.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ 
        content: extractedText.trim(),
        fileName: file.name,
        fileSize: file.size
      });

    } catch (parseError) {
      console.error('File parsing error:', parseError);
      return NextResponse.json(
        { error: '파일 처리 중 오류가 발생했습니다. 파일이 손상되었거나 지원되지 않는 형식일 수 있습니다.' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json(
      { error: '파일 업로드 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 