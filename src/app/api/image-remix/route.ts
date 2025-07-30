import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

// 투명 이미지에서 정확한 마스크 생성 함수
async function createMaskFromTransparentImage(transparentImageArrayBuffer: ArrayBuffer): Promise<Blob> {
  try {
    // ArrayBuffer를 Buffer로 변환
    const transparentBuffer = Buffer.from(transparentImageArrayBuffer);
    
    // 알파 채널을 기반으로 흑백 마스크 생성
    const maskBuffer = await createAlphaBasedMask(transparentBuffer);
    const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
    
    console.log('마스크 생성 완료 (알파 채널 기반):', {
      originalSize: transparentImageArrayBuffer.byteLength,
      maskSize: maskBuffer.length,
      maskBlobSize: maskBlob.size
    });
    
    return maskBlob;
  } catch (error) {
    console.error('마스크 생성 실패:', error);
    // 실패 시 투명 이미지를 그대로 마스크로 사용 (fallback)
    return new Blob([transparentImageArrayBuffer], { type: 'image/png' });
  }
}

// 알파 채널 기반 마스크 생성 함수
async function createAlphaBasedMask(transparentBuffer: Buffer): Promise<Buffer> {
  try {
    // sharp를 사용하여 알파 채널 기반 마스크 생성
    const sharp = require('sharp');
    
    const maskBuffer = await sharp(transparentBuffer)
      .ensureAlpha()
      .extractChannel('alpha')
      .threshold(1) // threshold 값을 10에서 1로 낮춤 - 조금이라도 알파가 있으면 피사체로 간주
      .negate() // ✅ 반전: 피사체는 검정(보호), 배경은 흰색(편집)
      .toColourspace('b-w')
      .png()
      .toBuffer();
    
    console.log('마스크 생성 상세 정보:', {
      originalBufferSize: transparentBuffer.length,
      maskBufferSize: maskBuffer.length,
      threshold: 1,
      inverted: true
    });
    
    return maskBuffer;
  } catch (error) {
    console.error('sharp 마스크 생성 실패, 기본 방식 사용:', error);
    
    // sharp 실패 시 기본 방식으로 마스크 생성
    return createBasicMask(transparentBuffer);
  }
}

// 기본 마스크 생성 함수 (sharp 없을 때 사용)
async function createBasicMask(transparentBuffer: Buffer): Promise<Buffer> {
  try {
    // PNG 파싱하여 알파 채널 추출
    const uint8Array = new Uint8Array(transparentBuffer);
    const maskData = new Uint8Array(uint8Array.length);
    
    // 알파 채널을 기반으로 마스크 생성
    for (let i = 0; i < uint8Array.length; i += 4) {
      const alpha = uint8Array[i + 3]; // 알파 채널
      
      // 알파 값이 높으면 불투명 (피사체) = 검은색 (0) - 보호 영역
      // 알파 값이 낮으면 투명 (배경) = 흰색 (255) - 편집 영역
      // threshold를 1로 낮춤 - 조금이라도 알파가 있으면 피사체로 간주
      // ✅ 반전: 피사체는 검은색(0), 배경은 흰색(255)
      const maskValue = alpha > 1 ? 0 : 255; // 이미 올바른 방향으로 설정됨
      
      maskData[i] = maskValue;     // R
      maskData[i + 1] = maskValue; // G
      maskData[i + 2] = maskValue; // B
      maskData[i + 3] = 255;       // A (불투명)
    }
    
    console.log('기본 마스크 생성 상세 정보:', {
      originalSize: transparentBuffer.length,
      maskDataSize: maskData.length,
      threshold: 1,
      inverted: true
    });
    
    return Buffer.from(maskData);
  } catch (error) {
    console.error('기본 마스크 생성 실패:', error);
    throw error;
  }
}

// 스타일 프리셋 결정 함수
function determineStylePreset(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();
  
  // 자연 풍경 (실사)
  if (lowerPrompt.includes('mountain') || lowerPrompt.includes('forest') || 
      lowerPrompt.includes('landscape') || lowerPrompt.includes('nature')) {
    return 'photographic';
  }
  
  // 판타지/예술적
  if (lowerPrompt.includes('fantasy') || lowerPrompt.includes('magical') || 
      lowerPrompt.includes('artistic') || lowerPrompt.includes('dreamy')) {
    return 'fantasy-art';
  }
  
  // 도시/현대적
  if (lowerPrompt.includes('city') || lowerPrompt.includes('urban') || 
      lowerPrompt.includes('modern') || lowerPrompt.includes('neon')) {
    return 'cinematic';
  }
  
  // 바다/하늘
  if (lowerPrompt.includes('ocean') || lowerPrompt.includes('sea') || 
      lowerPrompt.includes('sky') || lowerPrompt.includes('clouds')) {
    return 'enhance';
  }
  
  // 기본값 (실사)
  return 'photographic';
}

export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const negativePrompt = formData.get('negativePrompt') as string || '';
    const initImage = formData.get('initImage') as string;
    const category = formData.get('category') as string;
    const searchPrompt = formData.get('searchPrompt') as string || '';
    const selectPrompt = formData.get('selectPrompt') as string || '';
    const colorPrompt = formData.get('colorPrompt') as string || '';
    const maskData = formData.get('maskData') as string || '';
    const outpaintDirection = formData.get('outpaintDirection') as string || '';
    const outpaintPixels = parseInt(formData.get('outpaintPixels') as string || '200');
    const backgroundPrompt = formData.get('backgroundPrompt') as string || '';

    // 디버깅: FormData 수신 확인
    console.log('백엔드 FormData 수신:', {
      prompt,
      category,
      backgroundPrompt,
      backgroundPromptLength: backgroundPrompt?.length,
      backgroundPromptTrimmed: backgroundPrompt?.trim(),
      isEmpty: !backgroundPrompt?.trim()
    });
    
    // FormData의 모든 키 확인
    console.log('FormData의 모든 키:');
    for (let [key, value] of formData.entries()) {
      console.log(`  ${key}:`, value);
    }

    if (!initImage) {
      return NextResponse.json(
        { error: '기본 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 카테고리별 프롬프트 검증
    if (category === 'add-background' && !backgroundPrompt) {
      return NextResponse.json(
        { error: '배경 프롬프트가 필요합니다.' },
        { status: 400 }
      );
    }
    
    if (!prompt && category !== 'remove-background' && category !== 'background' && category !== 'add-background') {
      return NextResponse.json(
        { error: '프롬프트가 필요합니다.' },
        { status: 400 }
      );
    }

    // Stability AI API 키 확인
    const stabilityApiKey = process.env.STABILITY_API_KEY;
    if (!stabilityApiKey) {
      return NextResponse.json(
        { error: 'Stability AI API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    // 한국어 프롬프트를 영어로 번역
    let translatedPrompt = prompt;
    let translatedNegativePrompt = negativePrompt;
    let finalPrompt = prompt; // 최종 강화된 프롬프트 초기화
    
    // OpenAI API 키 가져오기
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    // 한국어 감지 함수
    const isKorean = (text: string): boolean => {
      const koreanRegex = /[가-힣]/;
      return koreanRegex.test(text);
    };
    
    try {
      // OpenAI API를 사용하여 한국어를 영어로 번역 및 강화
      if (openaiApiKey && isKorean(prompt)) {
        const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are an expert image generation prompt translator and enhancer. 
                Your task is to translate Korean text to English and enhance it for better image generation results.
                
                Guidelines:
                1. Translate Korean to natural English
                2. Add descriptive details that enhance visual quality
                3. Include relevant artistic terms (e.g., "high quality", "detailed", "beautiful lighting")
                4. Maintain the original intent while making it more specific
                5. Add style descriptors when appropriate (e.g., "photorealistic", "cinematic", "artistic")
                
                Return only the enhanced English prompt, nothing else.`
              },
              {
                role: 'user',
                content: `Translate and enhance this Korean text for image generation: "${prompt}"`
              }
            ],
            max_tokens: 300,
            temperature: 0.4
          })
        });

        if (translationResponse.ok) {
          const translationData = await translationResponse.json();
          translatedPrompt = translationData.choices[0].message.content.trim();
          console.log('프롬프트 번역 및 강화:', { original: prompt, enhanced: translatedPrompt });
        }
      } else if (openaiApiKey && !isKorean(prompt)) {
        // 영어 프롬프트도 강화
        const enhancementResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are an expert image generation prompt enhancer.
                Enhance the given English prompt to create better image generation results.
                
                Guidelines:
                1. Add descriptive details that enhance visual quality
                2. Include relevant artistic terms (e.g., "high quality", "detailed", "beautiful lighting")
                3. Add style descriptors when appropriate (e.g., "photorealistic", "cinematic", "artistic")
                4. Maintain the original intent while making it more specific
                5. Keep the enhanced prompt concise but impactful
                
                Return only the enhanced prompt, nothing else.`
              },
              {
                role: 'user',
                content: `Enhance this English prompt for better image generation: "${prompt}"`
              }
            ],
            max_tokens: 300,
            temperature: 0.3
          })
        });

        if (enhancementResponse.ok) {
          const enhancementData = await enhancementResponse.json();
          translatedPrompt = enhancementData.choices[0].message.content.trim();
          console.log('영어 프롬프트 강화:', { original: prompt, enhanced: translatedPrompt });
        } else {
          console.log('이미 영어 프롬프트이므로 번역 건너뜀:', prompt);
          translatedPrompt = prompt;
        }
      }
      
      // 네거티브 프롬프트도 번역 및 강화
      if (negativePrompt && isKorean(negativePrompt)) {
        const negativeTranslationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are an expert image generation prompt translator and enhancer.
                Translate Korean negative prompt to English and enhance it for better image generation results.
                
                Guidelines:
                1. Translate Korean to natural English
                2. Add common negative terms for image generation (e.g., "blurry", "low quality", "distorted")
                3. Include technical terms that prevent unwanted artifacts
                4. Keep it concise but comprehensive
                
                Return only the enhanced English negative prompt, nothing else.`
              },
              {
                role: 'user',
                content: `Translate and enhance this Korean negative prompt for image generation: "${negativePrompt}"`
              }
            ],
            max_tokens: 200,
            temperature: 0.3
          })
        });

        if (negativeTranslationResponse.ok) {
          const negativeTranslationData = await negativeTranslationResponse.json();
          translatedNegativePrompt = negativeTranslationData.choices[0].message.content.trim();
          console.log('네거티브 프롬프트 번역 및 강화:', { original: negativePrompt, enhanced: translatedNegativePrompt });
        }
      } else if (negativePrompt && !isKorean(negativePrompt)) {
        // 영어 네거티브 프롬프트도 강화
        const negativeEnhancementResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
              {
                role: 'system',
                content: `You are an expert image generation negative prompt enhancer.
                Enhance the given English negative prompt to prevent unwanted image artifacts.
                
                Guidelines:
                1. Add common negative terms for image generation (e.g., "blurry", "low quality", "distorted")
                2. Include technical terms that prevent unwanted artifacts
                3. Keep it concise but comprehensive
                4. Focus on preventing common AI generation issues
                
                Return only the enhanced negative prompt, nothing else.`
              },
              {
                role: 'user',
                content: `Enhance this English negative prompt for better image generation: "${negativePrompt}"`
              }
            ],
            max_tokens: 200,
            temperature: 0.3
          })
        });

        if (negativeEnhancementResponse.ok) {
          const negativeEnhancementData = await negativeEnhancementResponse.json();
          translatedNegativePrompt = negativeEnhancementData.choices[0].message.content.trim();
          console.log('영어 네거티브 프롬프트 강화:', { original: negativePrompt, enhanced: translatedNegativePrompt });
        }
      }
      
      // 최종 프롬프트에 추가 강화 요소 적용
      finalPrompt = translatedPrompt;
      if (finalPrompt && !finalPrompt.includes('high quality') && !finalPrompt.includes('detailed')) {
        finalPrompt += ', high quality, detailed, professional photography';
      }
      
      // 카테고리별 추가 강화
      if (category === 'background') {
        if (!finalPrompt.includes('beautiful') && !finalPrompt.includes('stunning')) {
          finalPrompt += ', beautiful, stunning background';
        }
      } else if (category === 'subject') {
        if (!finalPrompt.includes('clear') && !finalPrompt.includes('sharp')) {
          finalPrompt += ', clear, sharp focus';
        }
      } else if (category === 'inpaint') {
        if (!finalPrompt.includes('seamless') && !finalPrompt.includes('natural')) {
          finalPrompt += ', seamless integration, natural blending';
        }
      }
      
      console.log('최종 강화된 프롬프트:', finalPrompt);
    } catch (error) {
      console.error('프롬프트 번역 실패:', error);
      // 번역 실패 시 원본 프롬프트 사용
      finalPrompt = prompt;
    }

    // 이미지 처리 - URL인지 Base64인지 확인
    let imageBlob: Blob;
    
    if (initImage.startsWith('http')) {
      // URL인 경우 이미지를 다운로드
      console.log('이미지 URL에서 다운로드:', initImage);
      const imageResponse = await fetch(initImage);
      if (!imageResponse.ok) {
        throw new Error('이미지 다운로드에 실패했습니다.');
      }
      const imageArrayBuffer = await imageResponse.arrayBuffer();
      
      // Content-Type 확인
      const contentType = imageResponse.headers.get('content-type');
      console.log('다운로드된 이미지 Content-Type:', contentType);
      
      // 적절한 MIME 타입 설정
      const mimeType = contentType?.includes('png') ? 'image/png' : 'image/jpeg';
      imageBlob = new Blob([imageArrayBuffer], { type: mimeType });
      
      console.log('이미지 Blob 생성 완료:', {
        size: imageBlob.size,
        type: imageBlob.type
      });
    } else {
      // Base64인 경우
      console.log('Base64 이미지 처리');
      const base64Image = initImage.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Image, 'base64');
      imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
      
      console.log('Base64 이미지 변환 완료:', {
        originalLength: base64Image.length,
        bufferSize: imageBuffer.length,
        blobSize: imageBlob.size
      });
    }

    let endpoint = '';
    let requestBody = new FormData();
    
    // 이미지 파일 확장자 결정
    const fileExtension = imageBlob.type.includes('png') ? 'png' : 'jpg';
    const imageFileName = `image.${fileExtension}`;
    
    console.log('사용할 파일명:', imageFileName, '이미지 타입:', imageBlob.type);
    
    // 카테고리별로 다른 API 엔드포인트 사용
    switch (category) {
      case 'background':
        // 새로운 배경 변경 방식: 배경 제거 → 정확한 마스크 생성 → inpaint
        console.log('배경 변경 시작:', { backgroundPrompt, imageSize: imageBlob.size });
        
        // 1단계: 배경 제거
        const removeBackgroundEndpoint = 'https://api.stability.ai/v2beta/stable-image/edit/remove-background';
        const removeBackgroundBody = new FormData();
        removeBackgroundBody.append('image', imageBlob, imageFileName);
        removeBackgroundBody.append('output_format', 'png');
        
        console.log('1단계: 배경 제거 시작');
        const removeBackgroundResponse = await fetch(removeBackgroundEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${stabilityApiKey}`,
            'Accept': 'image/*',
          },
          body: removeBackgroundBody,
        });
        
        if (!removeBackgroundResponse.ok) {
          const errorData = await removeBackgroundResponse.text();
          console.error('배경 제거 실패:', errorData);
          throw new Error('배경 제거에 실패했습니다.');
        }
        
        // 투명 배경 이미지 받기
        const transparentImageArrayBuffer = await removeBackgroundResponse.arrayBuffer();
        console.log('1단계: 배경 제거 완료, 투명 이미지 크기:', transparentImageArrayBuffer.byteLength);
        
        // 2단계: 정확한 마스크 생성 및 새로운 배경 생성 (inpaint)
        console.log('2단계: 정확한 마스크 생성 및 새로운 배경 생성 시작');
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';
        
        // 배경 프롬프트 번역 및 최적화
        let translatedBackgroundPrompt = backgroundPrompt;
        
        // 배경 프롬프트가 비어있으면 기본값 설정
        if (!translatedBackgroundPrompt || !translatedBackgroundPrompt.trim()) {
          translatedBackgroundPrompt = 'a peaceful mountain landscape';
          console.log('배경 프롬프트가 비어있어 기본값 사용:', translatedBackgroundPrompt);
        } else {
          // 배경 프롬프트 번역 시도
          try {
            if (openaiApiKey) {
              console.log('배경 프롬프트 번역 시작:', backgroundPrompt);
              const translationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a translator. Translate Korean text to English for image generation. Keep the meaning and style intact. Only return the English translation, nothing else.'
                    },
                    {
                      role: 'user',
                      content: `Translate this Korean text to English for image generation: "${backgroundPrompt}"`
                    }
                  ],
                  max_tokens: 200,
                  temperature: 0.3
                })
              });

              if (translationResponse.ok) {
                const translationData = await translationResponse.json();
                translatedBackgroundPrompt = translationData.choices[0].message.content.trim();
                console.log('배경 프롬프트 번역 완료:', { original: backgroundPrompt, translated: translatedBackgroundPrompt });
                
                // 따옴표 제거 및 정리
                translatedBackgroundPrompt = translatedBackgroundPrompt.replace(/^["']|["']$/g, '').trim();
                console.log('번역된 프롬프트 정리 후:', translatedBackgroundPrompt);
              } else {
                console.error('번역 API 오류:', translationResponse.status);
                // 번역 실패 시 원본 사용 (영어로만 작성하라는 안내 포함)
                translatedBackgroundPrompt = `${backgroundPrompt} (please write in English)`;
              }
            } else {
              console.warn('OpenAI API 키가 없어 번역을 건너뜁니다.');
              // API 키가 없으면 원본 사용
              translatedBackgroundPrompt = `${backgroundPrompt} (please write in English)`;
            }
          } catch (error) {
            console.error('배경 프롬프트 번역 실패:', error);
            // 번역 실패 시 원본 사용 (영어로만 작성하라는 안내 포함)
            translatedBackgroundPrompt = `${backgroundPrompt} (please write in English)`;
          }
        }
        
        // 투명 이미지를 Blob으로 변환
        const transparentImageBlob = new Blob([transparentImageArrayBuffer], { type: 'image/png' });
        
        // 정확한 마스크 생성 (알파 채널 기반)
        // 투명 영역 = 흰색 (배경 편집), 불투명 영역 = 검은색 (피사체 보호)
        const maskBlob = await createMaskFromTransparentImage(transparentImageArrayBuffer);
        
        // 마스크 크기 검증 및 디버깅
        console.log('마스크 생성 결과 검증:', {
          transparentImageSize: transparentImageArrayBuffer.byteLength,
          maskBlobSize: maskBlob.size,
          maskBlobType: maskBlob.type,
          expectedSizeRatio: maskBlob.size / transparentImageArrayBuffer.byteLength
        });
        
        // 마스크 크기가 너무 작으면 경고
        if (maskBlob.size < 10000) {
          console.warn('⚠️ 마스크 크기가 너무 작습니다:', {
            maskSize: maskBlob.size,
            expectedMinSize: 10000,
            recommendation: 'threshold 값을 더 낮추거나 마스크 생성 방식을 개선해야 합니다.'
          });
        }
        
        // 배경에만 집중된 프롬프트 생성 (단순화)
        const backgroundOnlyPrompt = `${translatedBackgroundPrompt}, harmonious background, well-balanced composition, detailed, cinematic`;
        const subjectProtectionPrompt = 'blurry, distorted, extra limbs, duplicate, low quality, watermark, text, signature';
        
        // 스타일 프리셋 결정 (이미지 톤에 맞게)
        const stylePreset = determineStylePreset(translatedBackgroundPrompt);
        
        // inpaint API 파라미터 설정 (정확한 inpaint 방식)
        requestBody.append('image', imageBlob, imageFileName); // 원본 이미지
        requestBody.append('prompt', backgroundOnlyPrompt); // 배경에만 집중된 프롬프트
        requestBody.append('negative_prompt', subjectProtectionPrompt); // 피사체 보호
        requestBody.append('mask', maskBlob, 'mask.png'); // 정확한 마스크 사용
        requestBody.append('output_format', 'jpeg');
        requestBody.append('style_preset', stylePreset); // 동적 스타일 프리셋
        
        console.log('inpaint API 파라미터:', {
          prompt: backgroundOnlyPrompt,
          negative_prompt: subjectProtectionPrompt,
          style_preset: stylePreset,
          usingOriginalImage: true,
          usingAccurateMask: true
        });
        break;

      case 'subject':
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/search-and-replace';
        requestBody.append('image', imageBlob, imageFileName);
        requestBody.append('prompt', prompt); // 원본 프롬프트 사용 (finalPrompt 대신)
        requestBody.append('search_prompt', searchPrompt || 'person');
        if (translatedNegativePrompt) requestBody.append('negative_prompt', translatedNegativePrompt);
        requestBody.append('output_format', 'jpeg');
        break;

      case 'remove-background':
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/remove-background';
        requestBody.append('image', imageBlob, imageFileName);
        requestBody.append('output_format', 'png');
        break;

      case 'inpaint':
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';
        requestBody.append('image', imageBlob, imageFileName);
        requestBody.append('prompt', prompt); // 원본 프롬프트 사용 (finalPrompt 대신)
        if (translatedNegativePrompt) requestBody.append('negative_prompt', translatedNegativePrompt);
        if (maskData) {
          const maskBase64 = maskData.replace(/^data:image\/[a-z]+;base64,/, '');
          const maskBuffer = Buffer.from(maskBase64, 'base64');
          const maskBlob = new Blob([maskBuffer], { type: 'image/png' });
          requestBody.append('mask', maskBlob, 'mask.png');
        }
        requestBody.append('output_format', 'jpeg');
        break;

      case 'recolor':
        // 색상 변경을 search-and-replace 방식으로 처리
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/search-and-replace';
        requestBody.append('image', imageBlob, imageFileName);
        
        // 색상 변경 프롬프트 생성
        let colorChangePrompt = '';
        let translatedSelectPrompt = selectPrompt;
        let translatedColorPrompt = colorPrompt;
        
        if (colorPrompt && selectPrompt) {
          // selectPrompt 번역
          if (openaiApiKey && isKorean(selectPrompt)) {
            try {
              const selectTranslationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a translator. Translate Korean text to English for image generation. Keep the meaning and style intact. Only return the English translation, nothing else.'
                    },
                    {
                      role: 'user',
                      content: `Translate this Korean text to English for image generation: "${selectPrompt}"`
                    }
                  ],
                  max_tokens: 100,
                  temperature: 0.3
                })
              });

              if (selectTranslationResponse.ok) {
                const selectTranslationData = await selectTranslationResponse.json();
                translatedSelectPrompt = selectTranslationData.choices[0].message.content.trim();
                // 따옴표 제거
                translatedSelectPrompt = translatedSelectPrompt.replace(/^["']|["']$/g, '').trim();
                console.log('selectPrompt 번역:', { original: selectPrompt, translated: translatedSelectPrompt });
              }
            } catch (error) {
              console.error('selectPrompt 번역 실패:', error);
            }
          }
          
          // colorPrompt 번역
          if (openaiApiKey && isKorean(colorPrompt)) {
            try {
              const colorTranslationResponse = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiApiKey}`,
                },
                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are a translator. Translate Korean text to English for image generation. Keep the meaning and style intact. Only return the English translation, nothing else.'
                    },
                    {
                      role: 'user',
                      content: `Translate this Korean text to English for image generation: "${colorPrompt}"`
                    }
                  ],
                  max_tokens: 200,
                  temperature: 0.3
                })
              });

              if (colorTranslationResponse.ok) {
                const colorTranslationData = await colorTranslationResponse.json();
                translatedColorPrompt = colorTranslationData.choices[0].message.content.trim();
                // 따옴표 제거
                translatedColorPrompt = translatedColorPrompt.replace(/^["']|["']$/g, '').trim();
                console.log('colorPrompt 번역:', { original: colorPrompt, translated: translatedColorPrompt });
              }
            } catch (error) {
              console.error('colorPrompt 번역 실패:', error);
            }
          }
          
          // 색상 변경 프롬프트 생성 - 더 구체적으로
          colorChangePrompt = `change only the ${translatedSelectPrompt} to ${translatedColorPrompt}, keep everything else exactly the same`;
        }
        
        requestBody.append('prompt', colorChangePrompt);
        requestBody.append('search_prompt', `${translatedSelectPrompt} area, specific part only`); // 더 구체적인 검색어
        if (translatedNegativePrompt) requestBody.append('negative_prompt', translatedNegativePrompt);
        requestBody.append('output_format', 'jpeg');
        
        // 디버깅: 색상 변경 프롬프트 확인
        console.log('색상 변경 프롬프트 확인:', {
          originalColorPrompt: colorPrompt,
          translatedColorPrompt: translatedColorPrompt,
          originalSelectPrompt: selectPrompt,
          translatedSelectPrompt: translatedSelectPrompt,
          colorChangePrompt: colorChangePrompt,
          searchPrompt: translatedSelectPrompt
        });
        
        // 디버깅: 실제 API 전송 데이터 확인
        console.log('색상 변경 API 전송 데이터:');
        for (let [key, value] of requestBody.entries()) {
          console.log(`  ${key}:`, value);
        }
        break;

      case 'outpaint':
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/outpaint';
        requestBody.append('image', imageBlob, imageFileName);
        if (finalPrompt) requestBody.append('prompt', finalPrompt); // 최종 강화된 프롬프트 사용
        
        // 확장 방향에 따라 파라미터 설정
        const directions = outpaintDirection.split(',');
        directions.forEach(dir => {
          if (dir.includes('left')) requestBody.append('left', outpaintPixels.toString());
          if (dir.includes('right')) requestBody.append('right', outpaintPixels.toString());
          if (dir.includes('up')) requestBody.append('up', outpaintPixels.toString());
          if (dir.includes('down')) requestBody.append('down', outpaintPixels.toString());
        });
        
        requestBody.append('creativity', '0.5');
        requestBody.append('output_format', 'jpeg');
        break;

      case 'other':
        // 전체 편집은 search-and-replace 방식으로 처리
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/search-and-replace';
        requestBody.append('image', imageBlob, imageFileName);
        requestBody.append('prompt', prompt); // 원본 프롬프트 사용 (finalPrompt 대신)
        requestBody.append('search_prompt', 'image'); // 전체 이미지를 대상으로
        if (translatedNegativePrompt) requestBody.append('negative_prompt', translatedNegativePrompt);
        requestBody.append('output_format', 'jpeg');
        break;

      default: // 기타 카테고리 - 기본 inpaint
        endpoint = 'https://api.stability.ai/v2beta/stable-image/edit/inpaint';
        requestBody.append('image', imageBlob, imageFileName);
        requestBody.append('prompt', prompt); // 원본 프롬프트 사용 (finalPrompt 대신)
        if (translatedNegativePrompt) requestBody.append('negative_prompt', translatedNegativePrompt);
        requestBody.append('output_format', 'jpeg');
        break;
    }

    // Stability AI API 호출
    const stabilityResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stabilityApiKey}`,
        'Accept': 'image/*',
      },
      body: requestBody,
    });

    if (!stabilityResponse.ok) {
      const errorData = await stabilityResponse.text();
      console.error('Stability AI API 오류:', {
        status: stabilityResponse.status,
        statusText: stabilityResponse.statusText,
        error: errorData,
        endpoint: endpoint,
        category: category
      });
      
      // 더 구체적인 오류 메시지 제공
      let errorMessage = '이미지 편집에 실패했습니다.';
      try {
        const errorJson = JSON.parse(errorData);
        if (errorJson.errors && errorJson.errors.length > 0) {
          errorMessage = `편집 실패: ${errorJson.errors[0]}`;
        }
      } catch (e) {
        // JSON 파싱 실패 시 기본 메시지 사용
      }
      
      throw new Error(errorMessage);
    }

    // 이미지 응답을 Base64로 변환
    const imageArrayBuffer = await stabilityResponse.arrayBuffer();
    const imageBase64 = Buffer.from(imageArrayBuffer).toString('base64');
    const mimeType = (category === 'remove-background' || category === 'background') ? 'image/png' : 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${imageBase64}`;

    console.log('이미지 편집 완료:', {
      category: category,
      imageSize: imageArrayBuffer.byteLength,
      mimeType: mimeType,
      hasBackgroundPrompt: !!backgroundPrompt
    });

    const responseData = {
      url: imageUrl,
      category: category,
      prompt: prompt,
      negativePrompt: negativePrompt
    };

    console.log('응답 데이터 생성:', {
      hasUrl: !!responseData.url,
      urlLength: responseData.url?.length,
      category: responseData.category
    });

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('이미지 편집 오류:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 