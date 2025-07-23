import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    console.log('=== PDF 테스트 API 호출됨 ===');
    
    // 업로드된 PDF 파일 확인
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'presentation-script');
    
    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ error: '업로드 디렉토리가 없습니다.' });
    }
    
    const files = fs.readdirSync(uploadDir);
    const pdfFiles = files.filter(file => file.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length === 0) {
      return NextResponse.json({ error: 'PDF 파일이 없습니다.' });
    }
    
    const testFile = path.join(uploadDir, pdfFiles[0]);
    console.log('테스트 파일:', testFile);
    
    // 파일 읽기
    const buffer = fs.readFileSync(testFile);
    console.log('파일 크기:', buffer.length, 'bytes');
    
    // PDF 시그니처 확인
    const signature = buffer.toString('hex', 0, 4);
    console.log('PDF 시그니처:', signature);
    
    if (signature !== '25504446') {
      return NextResponse.json({ error: '유효하지 않은 PDF 파일입니다.' });
    }
    
    // Base64 인코딩 테스트
    const base64Data = buffer.toString('base64');
    console.log('Base64 길이:', base64Data.length);
    
    // 간단한 텍스트 추출 테스트
    const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    const textPattern = /[가-힣a-zA-Z0-9\s]{10,}/g;
    const matches = bufferString.match(textPattern);
    
    let extractedText = '';
    if (matches && matches.length > 0) {
      extractedText = matches.join(' ').substring(0, 500);
      console.log('기본 텍스트 추출 성공');
    } else {
      console.log('기본 텍스트 추출 실패');
    }
    
    return NextResponse.json({
      success: true,
      fileSize: buffer.length,
      signature: signature,
      base64Length: base64Data.length,
      extractedText: extractedText,
      hasText: extractedText.length > 0
    });
    
  } catch (error) {
    console.error('PDF 테스트 오류:', error);
    return NextResponse.json({ 
      error: 'PDF 테스트 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    });
  }
} 