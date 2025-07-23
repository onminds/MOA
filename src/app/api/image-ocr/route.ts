import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: '이미지 데이터가 없습니다.' },
        { status: 400 }
      );
    }

    console.log('OpenAI Vision API로 이미지 처리 시작...');

    try {
      // Base64 이미지 데이터에서 데이터 URL 제거
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      console.log('Base64 데이터 처리 완료, 길이:', base64Data.length);
      
      // OpenAI Vision API 호출
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 이미지에서 모든 텍스트를 추출해주세요. 한국어와 영어 모두 포함해서 정확하게 추출해주세요. 추출된 텍스트만 반환하고 다른 설명은 하지 마세요."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Data}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
      });

      console.log('OpenAI Vision API 응답 완료');
      
      const extractedText = response.choices[0]?.message?.content?.trim();
      
      if (extractedText && extractedText.length > 0) {
        console.log('텍스트 추출 성공, 길이:', extractedText.length);
        console.log('추출된 텍스트 샘플:', extractedText.substring(0, 200));
        
        return NextResponse.json({
          success: true,
          text: extractedText
        });
      } else {
        console.log('텍스트 추출 실패 - 빈 응답');
        return NextResponse.json({
          success: true,
          text: '이미지에서 텍스트를 찾을 수 없습니다.'
        });
      }

    } catch (visionError) {
      console.error('OpenAI Vision API 처리 실패:', visionError);
      console.error('Vision API 오류 상세:', visionError instanceof Error ? visionError.message : 'Unknown error');
      
      return NextResponse.json({
        success: true,
        text: '이미지에서 텍스트를 추출할 수 없습니다. 이미지 품질을 확인해주세요.'
      });
    }

  } catch (error) {
    console.error('이미지 Vision API 오류:', error);
    console.error('API 오류 상세:', error instanceof Error ? error.message : 'Unknown error');
    
    return NextResponse.json(
      { error: '이미지 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 