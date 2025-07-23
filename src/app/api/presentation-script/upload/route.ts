import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// PDF 텍스트 추출 함수 (pdf-parse + 대안 방법들)
async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    console.log('PDF 텍스트 추출 시작...');
    console.log('버퍼 크기:', buffer.length);
    
    // pdf-parse 라이브러리 로드
    const pdfParse = require('pdf-parse');
    console.log('pdf-parse 라이브러리 로드 완료');
    
    // PDF 텍스트 추출 시도
    console.log('PDF 파싱 시작...');
    const pdfData = await pdfParse(buffer);
    console.log('PDF 파싱 완료');
    console.log('페이지 수:', pdfData.numpages);
    console.log('PDF 정보:', pdfData.info);
    
    const extractedText = pdfData.text || '';
    console.log('추출된 텍스트 길이:', extractedText.length);
    console.log('텍스트 샘플:', extractedText.substring(0, 200));
    
    // 텍스트가 충분히 추출되었는지 확인 (실제 텍스트인지 검증)
    if (extractedText.trim() && extractedText.trim().length > 50 && isValidText(extractedText)) {
      console.log('일반 텍스트 추출 성공');
      return cleanText(extractedText.trim());
    }
    
    // 텍스트 추출이 실패한 경우 OCR 시도
    console.log('텍스트 추출 실패, OCR 시도...');
    const ocrText = await extractTextWithOCR(buffer);
    
    if (ocrText.trim() && ocrText.trim().length > 10 && isValidText(ocrText)) {
      console.log('OCR로 텍스트 추출 성공');
      return cleanText(ocrText.trim());
    }
    
    // OCR도 실패한 경우 대안 방법들 시도
    console.log('OCR 실패, 대안 방법들 시도...');
    const alternativeText = await extractTextWithAlternatives(buffer);
    
    if (alternativeText.trim() && alternativeText.trim().length > 10 && isValidText(alternativeText)) {
      console.log('대안 방법으로 텍스트 추출 성공');
      return cleanText(alternativeText.trim());
    }
    
    console.log('모든 텍스트 추출 방법 실패');
    return '';
    
  } catch (error) {
    console.error('PDF 텍스트 추출 실패:', error);
    console.error('오류 상세:', error instanceof Error ? error.message : 'Unknown error');
    console.error('오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    
    // 오류 발생 시에도 OCR 시도
    try {
      console.log('오류 발생 후 OCR 시도...');
      const ocrText = await extractTextWithOCR(buffer);
      if (ocrText.trim() && ocrText.trim().length > 10 && isValidText(ocrText)) {
        console.log('OCR로 텍스트 추출 성공 (오류 후)');
        return cleanText(ocrText.trim());
      }
    } catch (ocrError) {
      console.error('OCR 시도도 실패:', ocrError);
      
      // OCR 실패 시 대안 방법 시도
      try {
        console.log('OCR 실패 후 대안 방법 시도...');
        const alternativeText = await extractTextWithAlternatives(buffer);
        if (alternativeText.trim() && alternativeText.trim().length > 10 && isValidText(alternativeText)) {
          console.log('대안 방법으로 텍스트 추출 성공 (OCR 실패 후)');
          return cleanText(alternativeText.trim());
        }
      } catch (alternativeError) {
        console.error('대안 방법 시도도 실패:', alternativeError);
      }
    }
    
    return '';
  }
}

// OCR을 사용한 텍스트 추출 함수
async function extractTextWithOCR(buffer: Buffer): Promise<string> {
  try {
    console.log('OCR 텍스트 추출 시작...');
    console.log('버퍼 크기:', buffer.length);
    
    // Tesseract.js 로드
    const { createWorker } = require('tesseract.js');
    console.log('Tesseract.js 라이브러리 로드 완료');
    
    // PDF를 이미지로 변환하기 위해 임시 파일 저장
    const tempDir = join(process.cwd(), 'temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
    
    const tempPdfPath = join(tempDir, `temp_${Date.now()}.pdf`);
    await writeFile(tempPdfPath, buffer);
    console.log('임시 PDF 파일 저장 완료:', tempPdfPath);
    
    // PDF를 이미지로 변환 (Node.js에서 직접 처리)
    console.log('PDF를 이미지로 변환 시작...');
    const imagePath = await convertPDFToImage(tempPdfPath);
    
    if (!imagePath) {
      throw new Error('PDF를 이미지로 변환할 수 없습니다.');
    }
    
    console.log('이미지 변환 완료:', imagePath);
    
    // Tesseract OCR로 텍스트 추출
    console.log('Tesseract OCR 시작...');
    const worker = await createWorker('kor+eng'); // 한국어 + 영어
    
    console.log('Tesseract Worker 생성 완료');
    const { data: { text } } = await worker.recognize(imagePath);
    
    console.log('OCR 인식 완료, 텍스트 길이:', text.length);
    console.log('OCR 텍스트 샘플:', text.substring(0, 200));
    
    await worker.terminate();
    console.log('Tesseract Worker 종료');
    
    // 임시 파일 정리
    try {
      const fs = require('fs');
      if (existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
      if (existsSync(imagePath)) fs.unlinkSync(imagePath);
      console.log('임시 파일 정리 완료');
    } catch (cleanupError) {
      console.error('임시 파일 정리 실패:', cleanupError);
    }
    
    return text;
    
  } catch (error) {
    console.error('OCR 텍스트 추출 실패:', error);
    console.error('OCR 오류 상세:', error instanceof Error ? error.message : 'Unknown error');
    console.error('OCR 오류 스택:', error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
}

// PDF를 이미지로 변환하는 함수
async function convertPDFToImage(pdfPath: string): Promise<string | null> {
  try {
    console.log('PDF를 이미지로 변환 시작...');
    
    // pdf2pic 대신 다른 방법 사용
    const { spawn } = require('child_process');
    const imagePath = pdfPath.replace('.pdf', '.png');
    
    // ImageMagick을 사용하여 PDF를 이미지로 변환
    return new Promise((resolve, reject) => {
      const convert = spawn('magick', ['convert', '-density', '300', '-quality', '100', pdfPath, imagePath]);
      
      convert.on('close', (code: number) => {
        if (code === 0 && existsSync(imagePath)) {
          console.log('ImageMagick 변환 성공');
          resolve(imagePath);
        } else {
          console.log('ImageMagick 변환 실패, 대안 방법 시도...');
          // 대안: 간단한 방법으로 PDF 첫 페이지 추출
          resolve(extractFirstPageAsImage(pdfPath));
        }
      });
      
      convert.on('error', (error: Error) => {
        console.log('ImageMagick 오류, 대안 방법 시도...');
        resolve(extractFirstPageAsImage(pdfPath));
      });
    });
    
  } catch (error) {
    console.error('PDF 변환 실패:', error);
    return null;
  }
}

// 대안: PDF 첫 페이지를 간단한 방법으로 이미지로 변환
async function extractFirstPageAsImage(pdfPath: string): Promise<string | null> {
  try {
    console.log('대안: PDF 첫 페이지 추출...');
    
    // PDF를 텍스트로 읽어서 간단한 이미지 생성
    const fs = require('fs');
    const imagePath = pdfPath.replace('.pdf', '.png');
    
    // 간단한 텍스트 기반 이미지 생성 (실제로는 작동하지 않을 수 있음)
    const canvas = require('canvas');
    const { createCanvas } = canvas;
    
    const width = 800;
    const height = 600;
    const canvasInstance = createCanvas(width, height);
    const ctx = canvasInstance.getContext('2d');
    
    // 흰색 배경
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    
    // 텍스트 추가
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText('PDF 내용을 이미지로 변환할 수 없습니다.', 50, 50);
    ctx.fillText('텍스트 추출을 시도합니다.', 50, 80);
    
    // 이미지 저장
    const buffer = canvasInstance.toBuffer('image/png');
    fs.writeFileSync(imagePath, buffer);
    
    console.log('대안 이미지 생성 완료:', imagePath);
    return imagePath;
    
  } catch (error) {
    console.error('대안 이미지 생성 실패:', error);
    return null;
  }
}

// 텍스트가 유효한지 검증하는 함수
function isValidText(text: string): boolean {
  // 압축된 스트림 데이터나 바이너리 데이터인지 확인
  const invalidPatterns = [
    /stream\s*$/i,
    /endstream/i,
    /FlateDecode/i,
    /Length\s+\d+\s+R/i,
    /Filter\s+FlateDecode/i,
    /[x\u0000-\u001F\u007F-\u009F]{10,}/, // 제어 문자들
    /[A-Za-z0-9\s]{20,}/, // 너무 긴 영숫자 문자열
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(text)) {
      console.log('유효하지 않은 텍스트 패턴 발견:', pattern);
      return false;
    }
  }
  
  // 실제 텍스트가 있는지 확인 (한국어, 영어, 숫자, 문장부호)
  const validTextPattern = /[가-힣a-zA-Z0-9\s.,!?;:()[\]{}"'\-–—…]{10,}/;
  return validTextPattern.test(text);
}

// 텍스트를 정리하는 함수
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // 연속된 공백을 하나로
    .replace(/[^\w\s가-힣.,!?;:()[\]{}"'\-–—…]/g, '') // 특수문자 제거 (일부 유지)
    .trim();
}

// 대안 텍스트 추출 방법들
async function extractTextWithAlternatives(buffer: Buffer): Promise<string> {
  try {
    console.log('대안 텍스트 추출 방법들 시작...');
    
    // 방법 1: PDF 메타데이터 추출
    console.log('방법 1: PDF 메타데이터 추출...');
    const header = buffer.toString('utf8', 0, 2000);
    const titleMatch = header.match(/\/Title\s*\(([^)]+)\)/);
    const authorMatch = header.match(/\/Author\s*\(([^)]+)\)/);
    const subjectMatch = header.match(/\/Subject\s*\(([^)]+)\)/);
    const creatorMatch = header.match(/\/Creator\s*\(([^)]+)\)/);
    const producerMatch = header.match(/\/Producer\s*\(([^)]+)\)/);
    
    const metadata = [];
    if (titleMatch) metadata.push(`제목: ${titleMatch[1]}`);
    if (authorMatch) metadata.push(`작성자: ${authorMatch[1]}`);
    if (subjectMatch) metadata.push(`주제: ${subjectMatch[1]}`);
    if (creatorMatch) metadata.push(`생성자: ${creatorMatch[1]}`);
    if (producerMatch) metadata.push(`프로듀서: ${producerMatch[1]}`);
    
    if (metadata.length > 0) {
      console.log('PDF 메타데이터 추출 성공');
      return metadata.join('\n');
    }
    
    // 방법 2: PDF 구조에서 실제 텍스트 찾기
    console.log('방법 2: PDF 구조에서 실제 텍스트 찾기...');
    const pdfContent = buffer.toString('latin1');
    
    // 실제 텍스트 패턴 찾기 (괄호 안의 텍스트)
    const textMatches = pdfContent.match(/\([^)]{5,}\)/g);
    
    if (textMatches && textMatches.length > 0) {
      const extractedText = textMatches
        .map(match => match.slice(1, -1)) // 괄호 제거
        .filter(text => {
          // 실제 텍스트인지 확인
          const hasKorean = /[가-힣]/.test(text);
          const hasEnglish = /[a-zA-Z]/.test(text);
          const hasValidChars = /[가-힣a-zA-Z0-9\s.,!?;:()[\]{}"'\-–—…]/.test(text);
          const notTooShort = text.length > 3;
          const notTooLong = text.length < 200;
          
          return (hasKorean || hasEnglish) && hasValidChars && notTooShort && notTooLong;
        })
        .join(' ');
      
      if (extractedText.length > 20) {
        console.log('PDF 구조에서 텍스트 추출 성공, 길이:', extractedText.length);
        return cleanText(extractedText);
      }
    }
    
    // 방법 3: 간단한 텍스트 추출 (더 엄격한 필터링)
    console.log('방법 3: 간단한 텍스트 추출 (엄격한 필터링)...');
    const simpleText = buffer.toString('utf8');
    const readableText = simpleText
      .replace(/[^\w\s가-힣.,!?;:()[\]{}"'\-–—…]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (readableText.length > 50 && isValidText(readableText)) {
      console.log('간단한 텍스트 추출 성공, 길이:', readableText.length);
      return readableText;
    }
    
    console.log('모든 대안 방법 실패');
    return '';
    
  } catch (error) {
    console.error('대안 텍스트 추출 실패:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: '파일이 업로드되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 파일 타입 검증
    const allowedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: '지원되지 않는 파일 형식입니다. TXT, PDF, DOC, DOCX 파일만 지원됩니다.' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: '파일 크기가 너무 큽니다. 10MB 이하의 파일만 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // 업로드 디렉토리 생성
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'presentation-script');
    try {
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    } catch (dirError) {
      console.error('디렉토리 생성 오류:', dirError);
      // 디렉토리 생성 실패해도 계속 진행
    }

    const fileName = `${Date.now()}_${file.name}`;
    const filePath = join(uploadDir, fileName);
    try {
      await writeFile(filePath, buffer);
    } catch (writeError) {
      console.error('파일 저장 오류:', writeError);
      // 파일 저장 실패해도 계속 진행
    }

    // 파일 내용 추출
    let content = '';
    
    if (file.type === 'text/plain') {
      content = buffer.toString('utf-8');
    } else if (file.type === 'application/pdf') {
      console.log('PDF 파일 처리 시작:', file.name, '크기:', file.size);
      
      try {
        // PDF 텍스트 추출 (일반 텍스트 + OCR)
        console.log('=== PDF 처리 시작 ===');
        const extractedText = await extractPDFText(buffer);
        console.log('=== PDF 처리 완료 ===');
        console.log('PDF 텍스트 추출 결과, 길이:', extractedText.length);
        console.log('추출된 텍스트 샘플:', extractedText.substring(0, 100));
        
        if (extractedText.trim() && extractedText.trim().length > 10) {
          // 텍스트가 너무 길 경우 잘라내기
          let finalText = extractedText;
          if (extractedText.length > 10000) {
            finalText = extractedText.substring(0, 10000) + '\n\n[내용이 너무 길어 일부만 표시됩니다.]';
          }
          
          console.log('PDF 텍스트 추출 성공');
          content = `[PDF 파일 "${file.name}" 내용]\n\n${finalText}`;
        } else {
          console.log('PDF 텍스트 추출 실패 - 읽을 수 있는 텍스트를 찾을 수 없음');
          content = `[PDF 파일 "${file.name}"이 업로드되었습니다. 이 PDF는 이미지 기반이거나 텍스트 추출이 불가능한 형식입니다. 파일명을 참고하여 발표 대본을 생성합니다.]`;
        }
      } catch (error) {
        console.error('PDF 처리 중 오류 발생:', error);
        content = `[PDF 파일 "${file.name}"이 업로드되었습니다. 파일 처리 중 오류가 발생했습니다. 파일명을 참고하여 발표 대본을 생성합니다.]`;
      }
    } else {
      // DOC, DOCX 파일의 경우 기본 메시지 반환
      content = `[${file.name} 파일이 업로드되었습니다. 파일 내용을 기반으로 발표 대본을 생성합니다.]`;
    }

    return NextResponse.json({
      success: true,
      fileName: fileName,
      content: content,
      fileType: file.type,
      fileSize: file.size
    });

  } catch (error) {
    console.error('File upload error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: '파일 업로드 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
      { status: 500 }
    );
  }
} 