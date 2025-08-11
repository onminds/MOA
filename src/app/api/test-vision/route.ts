import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET() {
  try {
    console.log('=== GPT-4 Vision API 테스트 시작 ===');
    
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
    
    // Base64 인코딩
    const base64Data = buffer.toString('base64');
    console.log('Base64 길이:', base64Data.length);
    
    // OpenAI API 키 확인
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API 키가 설정되지 않았습니다.' });
    }
    
    console.log('✅ OpenAI API 키 확인됨');
    
    // GPT-4 Vision API 호출
    console.log('🚀 GPT-4 Vision API 호출 시작...');
    
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "이 PDF 문서의 모든 텍스트를 추출해주세요. 문서의 구조와 내용을 그대로 유지하면서 모든 텍스트를 정확히 읽어주세요."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    });

    console.log('✅ GPT-4 Vision API 응답 받음');
    
    const visionText = visionResponse.choices[0]?.message?.content;
    
    if (visionText && visionText.trim().length > 0) {
      console.log('✅ GPT-4 Vision API로 텍스트 추출 성공!');
      console.log('📝 텍스트 길이:', visionText.length);
      console.log('📝 텍스트 미리보기:', visionText.substring(0, 200) + '...');
      
      return NextResponse.json({
        success: true,
        fileSize: buffer.length,
        signature: signature,
        base64Length: base64Data.length,
        extractedText: visionText,
        textLength: visionText.length,
        hasText: visionText.length > 0
      });
      
    } else {
      console.log('❌ GPT-4 Vision API에서 텍스트가 비어있음');
      return NextResponse.json({ 
        error: 'GPT-4 Vision API에서 텍스트를 추출할 수 없습니다.',
        success: false
      });
    }
    
  } catch (error) {
    console.error('GPT-4 Vision API 테스트 오류:', error);
    return NextResponse.json({ 
      error: 'GPT-4 Vision API 테스트 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류',
      success: false
    });
  }
} 