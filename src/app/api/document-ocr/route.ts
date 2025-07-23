import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
        // 외부 프로세스로 pdf-parse 실행
        console.log('📄 외부 프로세스로 pdf-parse 실행 시도...');
        
        // 임시 PDF 파일 생성
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        
        const tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
        fs.writeFileSync(tempPdfPath, buffer);
        console.log('임시 PDF 파일 생성:', tempPdfPath);
        
        // 외부 Node.js 스크립트로 pdf-parse 실행
        const scriptPath = path.join(process.cwd(), 'extract-pdf-text.js');
        const extractScript = `
const fs = require('fs');
const pdfParse = require('pdf-parse');

async function extractText() {
  try {
    // 경고 메시지 억제
    const originalWarn = console.warn;
    console.warn = () => {};
    
    const pdfPath = process.argv[2];
    const buffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(buffer);
    
    // 경고 메시지 복원
    console.warn = originalWarn;
    
    console.log(JSON.stringify({
      success: true,
      text: data.text,
      numpages: data.numpages,
      info: data.info
    }));
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
}

extractText();
        `;
        
        fs.writeFileSync(scriptPath, extractScript);
        console.log('추출 스크립트 생성:', scriptPath);
        
        // 외부 프로세스 실행
        const { stdout, stderr } = await execAsync(`node "${scriptPath}" "${tempPdfPath}"`);
        
        if (stderr) {
          console.log('외부 프로세스 stderr:', stderr);
        }
        
        // stdout에서 JSON 부분만 추출
        const lines = stdout.split('\n');
        let jsonOutput = '';
        
        for (const line of lines) {
          if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
            jsonOutput = line.trim();
            break;
          }
        }
        
        if (!jsonOutput) {
          console.log('❌ JSON 출력을 찾을 수 없습니다. 전체 출력:', stdout);
          throw new Error('외부 프로세스에서 유효한 JSON을 받지 못했습니다.');
        }
        
        const result = JSON.parse(jsonOutput);
        
        if (result.success && result.text && result.text.trim().length > 0) {
          console.log('✅ 외부 프로세스로 텍스트 추출 성공!');
          console.log('📝 텍스트 길이:', result.text.length);
          console.log('📝 텍스트 미리보기:', result.text.substring(0, 200) + '...');
          console.log('📊 PDF 정보:', {
            페이지수: result.numpages,
            메타데이터: result.info
          });
          
          // 텍스트 품질 검사
          const hasKoreanText = /[가-힣]/.test(result.text);
          const hasEnglishText = /[a-zA-Z]/.test(result.text);
          const hasMeaningfulContent = result.text.length > 200 && (hasKoreanText || hasEnglishText);
          
          console.log('📊 텍스트 품질 검사:', {
            length: result.text.length,
            hasKorean: hasKoreanText,
            hasEnglish: hasEnglishText,
            hasMeaningfulContent: hasMeaningfulContent
          });
          
          if (hasMeaningfulContent) {
            results.push({
              page: 1,
              text: result.text.trim(),
              success: true,
              error: undefined,
              extractionMethod: '외부 pdf-parse',
              numPages: result.numpages
            });
          } else {
            throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
          }
          
        } else {
          throw new Error('외부 프로세스에서 텍스트를 추출할 수 없습니다.');
        }
        
        // 임시 파일 정리
        fs.unlinkSync(tempPdfPath);
        fs.unlinkSync(scriptPath);
        
      } catch (error) {
        console.log('❌ 외부 프로세스 실패:', error);
        
        // 대안: 향상된 패턴 매칭
        try {
          console.log('📄 대안: 향상된 패턴 매칭 시도 중...');
          
          const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 500000));
          
          // 실제 텍스트를 찾기 위한 다양한 패턴
          const patterns = [
            // 영어 문장 패턴
            /[A-Z][a-z\s]{20,}[.!?]/g,
            // 한국어 문장 패턴  
            /[가-힣][가-힣\s]{10,}[.!?]/g,
            // 일반적인 텍스트 블록
            /[A-Za-z가-힣][A-Za-z가-힣0-9\s]{30,}[A-Za-z가-힣0-9]/g,
            // 특수 문자 제거 후 텍스트
            /[A-Za-z가-힣][A-Za-z가-힣0-9\s\.\,\!\?]{20,}[A-Za-z가-힣0-9]/g
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
                .replace(/[^\w\s가-힣\.\,\!\?]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              
              if (potentialText.length > bestLength && potentialText.length > 100) {
                bestText = potentialText;
                bestLength = potentialText.length;
                extractionMethod = `패턴 ${i + 1}`;
              }
            }
          }
          
          if (bestText.length > 0) {
            console.log('✅ 향상된 패턴 매칭으로 텍스트 추출 성공!');
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
                extractionMethod: extractionMethod
              });
            } else {
              throw new Error('의미 있는 텍스트를 찾을 수 없습니다.');
            }
            
          } else {
            throw new Error('텍스트 추출에 실패했습니다.');
          }

        } catch (patternError) {
          console.log('❌ 향상된 패턴 매칭 실패:', patternError);
          
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
              results.push({ page: 1, text: bestText, success: true, error: undefined, extractionMethod: '기본 패턴 매칭' });
            } else {
              throw new Error('기본 텍스트 추출도 실패했습니다.');
            }
          } catch (finalError) {
            console.log('❌ 기본 텍스트 추출 실패:', finalError);
            results.push({ page: 1, text: 'PDF에서 텍스트를 추출할 수 없습니다.', success: false, error: '모든 텍스트 추출 방법이 실패했습니다.' });
          }
        }
      }
    }

    console.log('문서 OCR 처리 완료');
    
    const successCount = results.filter(r => r.success).length;
    const totalPages = results.length;
    
    return NextResponse.json({
      success: successCount > 0,
      totalPages: totalPages,
      results: results,
      successCount: successCount,
      errorCount: totalPages - successCount
    });

  } catch (error) {
    console.error('문서 OCR 처리 중 오류:', error);
    return NextResponse.json(
      { error: '문서 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 