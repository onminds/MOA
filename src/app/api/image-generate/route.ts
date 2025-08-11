import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import Replicate from 'replicate';
import sharp from 'sharp';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Replicate 클라이언트 초기화 - REPLICATE_API_TOKEN 환경변수를 자동으로 사용
const replicate = new Replicate();



// 임시 파일 생성 및 정리 함수
async function createTempFile(buffer: Buffer, extension: string = '.png'): Promise<string> {
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${extension}`);
  await fs.promises.writeFile(tempFile, buffer);
  return tempFile;
}

async function cleanupTempFile(filePath: string) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    console.error('임시 파일 삭제 실패:', error);
  }
}

// 캐릭터 분석 함수
async function analyzeCharacterFromImage(imageFile: File, hasStyle: boolean = false): Promise<string> {
  try {
    // 이미지를 base64로 변환
    const imageBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const dataUrl = `data:${imageFile.type};base64,${base64Image}`;
    
    // 스타일이 설정되어 있으면 그림체 분석 제외
    const analysisPrompt = hasStyle 
      ? "이 이미지의 캐릭터를 간결하게 분석해주세요. 다음 형식으로만 답변해주세요:\n\n캐릭터: [종류-성별]\n스타일: [주요 특징]\n의상: [의상 특징]\n\n예시: 캐릭터: 사람-남성, 스타일: 군사적, 의상: 전술 장비"
      : "이 이미지의 캐릭터를 간결하게 분석해주세요. 다음 형식으로만 답변해주세요:\n\n캐릭터: [종류-성별]\n스타일: [주요 특징]\n의상: [의상 특징]\n그림체: [아트 스타일/기법]\n\n예시: 캐릭터: 사람-남성, 스타일: 군사적, 의상: 전술 장비, 그림체: 사실적 사진";
    
    // GPT-4o를 사용하여 캐릭터 분석
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: analysisPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.3
    });
    
    const analysis = analysisResponse.choices[0]?.message?.content || "";
    console.log('캐릭터 분석 결과:', analysis);
    
    // 분석 결과가 유효한지 확인
    if (analysis && analysis.length > 10 && !analysis.includes("죄송합니다")) {
      return analysis;
    } else {
      // 기본적인 이미지 특성 기반 분석
      const imageInfo = await sharp(Buffer.from(imageBuffer)).metadata();
      let basicAnalysis = "참고 이미지 스타일로 ";
      
      if (imageInfo.width && imageInfo.height) {
        const aspectRatio = imageInfo.width / imageInfo.height;
        if (aspectRatio > 1.5) {
          basicAnalysis += "가로형 구도, ";
        } else if (aspectRatio < 0.7) {
          basicAnalysis += "세로형 구도, ";
        } else {
          basicAnalysis += "정사각형 구도, ";
        }
      }
      
      basicAnalysis += "동일한 색상과 조명으로 생성";
      return basicAnalysis;
    }
  } catch (error) {
    console.error('캐릭터 분석 실패:', error);
    // 기본적인 이미지 특성 기반 분석
    try {
      const imageBuffer = await imageFile.arrayBuffer();
      const imageInfo = await sharp(Buffer.from(imageBuffer)).metadata();
      let basicAnalysis = "참고 이미지 스타일로 ";
      
      if (imageInfo.width && imageInfo.height) {
        const aspectRatio = imageInfo.width / imageInfo.height;
        if (aspectRatio > 1.5) {
          basicAnalysis += "가로형 구도, ";
        } else if (aspectRatio < 0.7) {
          basicAnalysis += "세로형 구도, ";
        } else {
          basicAnalysis += "정사각형 구도, ";
        }
      }
      
      // 파일 크기로 이미지 품질 추정하여 그림체 판단
      if (imageFile.size > 2 * 1024 * 1024) {
        basicAnalysis += "고해상도 사실적 스타일, ";
      } else if (imageFile.size > 500 * 1024) {
        basicAnalysis += "일반 품질 스타일, ";
      } else {
        basicAnalysis += "간단한 스타일, ";
      }
      
      basicAnalysis += "동일한 색상과 조명으로 생성";
      return basicAnalysis;
    } catch (sharpError) {
      console.error('이미지 메타데이터 분석 실패:', sharpError);
      return "참고 이미지와 동일한 스타일로 생성";
    }
  }
}

// 사용자 플랜별 이미지 생성 제한 확인
async function checkImageGenerationLimit(userId: string) {
  const db = await getConnection();
  
  // 사용자 정보와 결제 내역 확인
  const userResult = await db.request()
    .input('userId', userId)
    .query(`
      SELECT u.id, u.email, u.role, p.plan_type
      FROM users u
      LEFT JOIN (
        SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
        FROM payments 
        WHERE status = 'completed'
      ) p ON u.id = p.user_id AND p.rn = 1
      WHERE u.id = @userId AND u.is_active = 1
    `);

  if (userResult.recordset.length === 0) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  const user = userResult.recordset[0];

  // 현재 사용량 확인
  const usageResult = await db.request()
    .input('userId', userId)
    .input('serviceType', 'image-generate')
    .query('SELECT usage_count FROM usage WHERE user_id = @userId AND service_type = @serviceType');

  let maxLimit = 2; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.plan_type) {
    planType = user.plan_type;
    
    switch (planType) {
      case 'standard':
        maxLimit = 120;
        break;
      case 'pro':
        maxLimit = 300;
        break;
      default:
        maxLimit = 2;
    }
  }
  // 관리자이면서 결제 내역이 없으면 무제한
  else if (user.role === 'ADMIN') {
    maxLimit = 9999;
    planType = 'admin';
  }

  const currentUsage = usageResult.recordset[0]?.usage_count || 0;
  const allowed = currentUsage < maxLimit;

  console.log(`이미지 생성 요청 - 사용자: ${user.email}, 역할: ${user.role}, 플랜: ${planType}, 사용량: ${currentUsage}/${maxLimit}`);

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount: Math.max(0, maxLimit - currentUsage),
    planType,
    error: allowed ? null : `${planType === 'basic' ? '기본' : planType === 'standard' ? 'Standard' : planType === 'pro' ? 'Pro' : 'Admin'} 플랜의 이미지 생성 한도에 도달했습니다.`
  };
}

// 이미지 생성 사용량 증가
async function incrementImageUsage(userId: string) {
  const db = await getConnection();
  
  await db.request()
    .input('userId', userId)
    .input('serviceType', 'image-generate')
    .query(`
      MERGE usage AS target
      USING (SELECT @userId as user_id, @serviceType as service_type) AS source
      ON target.user_id = source.user_id AND target.service_type = source.service_type
      WHEN MATCHED THEN
        UPDATE SET usage_count = usage_count + 1, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (user_id, service_type, usage_count, limit_count, created_at, updated_at)
        VALUES (@userId, @serviceType, 1, 2, GETDATE(), GETDATE());
    `);
}

// 모델별 설정
const modelConfigs = {
  "DALL-E 3": {
    model: "dall-e-3",
    apiType: "openai",
    supportsStyle: true,
    maxTokens: 4000
  },
  "DALL-E 2": {
    model: "dall-e-2",
    apiType: "openai",
    supportsStyle: true,
    maxTokens: 4000
  },
  "Stable Diffusion XL": {
    model: "stability-ai/sdxl:39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
    apiType: "replicate",
    supportsStyle: true,
    maxTokens: 4000
  },
  "Kandinsky": {
    model: "ai-forever/kandinsky-2.2:ad9d7879fbffa2874e1d909d1d37d9bc682889cc65b31f7bb00d2362619f194a",
    apiType: "replicate",
    supportsStyle: false,
    maxTokens: 4000
  },
  "Realistic Vision": {
    model: "cjwbw/realistic-vision-v5:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4",
    apiType: "replicate",
    supportsStyle: true,
    maxTokens: 4000
  }
};

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    // 사용량 체크
    const usageCheck = await checkImageGenerationLimit(user.id);
    if (!usageCheck.allowed) {
      const errorMessage = usageCheck.error || '이미지 생성 한도를 초과했습니다.';
      const upgradeMessage = usageCheck.planType === 'basic' 
        ? '플랜을 업그레이드하여 더 많은 이미지를 생성할 수 있습니다.' 
        : '';
      
      return NextResponse.json({ 
        error: errorMessage,
        upgradeMessage: upgradeMessage,
        currentUsage: usageCheck.usageCount, 
        maxLimit: usageCheck.limitCount,
        planType: usageCheck.planType,
        remainingCount: usageCheck.remainingCount
      }, { status: 429 });
    }

    const formData = await request.formData();
    const originalPrompt = formData.get('originalPrompt') as string; // 사용자 원본 입력
    const prompt = formData.get('prompt') as string; // AI 최적화된 프롬프트
    const style = formData.get('style') as string;
    const size = formData.get('size') as string;
    const width = parseInt(formData.get('width') as string);
    const height = parseInt(formData.get('height') as string);
    const model = formData.get('model') as string;
    const ratio = formData.get('ratio') as string;
    const referenceImages = formData.getAll('referenceImages') as File[];

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    console.log('이미지 생성 요청:', { 
      prompt, 
      style, 
      size, 
      width, 
      height, 
      model, 
      ratio, 
      referenceImagesCount: referenceImages.length,
      userId: user.id 
    });

    let finalPrompt = prompt;

    // 모델 설정 가져오기
    let modelConfig = modelConfigs[model as keyof typeof modelConfigs] || modelConfigs["DALL-E 3"];
    
    // DALL-E 3에서 이미지가 첨부되면 스타일 추출 후 DALL-E 3 사용
    if (model === "DALL-E 3" && referenceImages.length > 0) {
      console.log('DALL-E 3에서 이미지 첨부 감지, 스타일 추출 후 DALL-E 3 사용');
      // 모델은 그대로 DALL-E 3 유지
    }

    // 크기 설정
    const sizeString = `${width}x${height}`;
    
    // DALL-E 3 모델의 크기 제한에 맞게 조정
    let validSize: string;
    if (width === 1024 && height === 1024) {
      validSize = "1024x1024";
    } else if (width === 1792 && height === 1024) {
      validSize = "1792x1024";
    } else if (width === 1024 && height === 1792) {
      validSize = "1024x1792";
    } else {
      // 기본값으로 설정
      validSize = "1024x1024";
    }

    // 참고 이미지가 있는 경우 처리
    if (referenceImages.length > 0) {
      console.log('참고 이미지 처리 시작:', {
        referenceImagesCount: referenceImages.length,
        originalPrompt: prompt,
        model: model
      });
      
      // Stable Diffusion XL 모델인 경우 이미지 분석 건너뛰기
      if (model === "Stable Diffusion XL") {
        console.log('Stable Diffusion XL 모델: 이미지 분석 건너뛰고 Image-to-Image 모드로 진행');
        // 프롬프트는 그대로 유지
      } else {
        // 다른 모델들에 대해서만 이미지 분석 수행
        let styleDescription = "";
        
        try {
          // 모든 참고 이미지를 분석하여 통합된 스타일 설명 생성
          for (let i = 0; i < referenceImages.length; i++) {
            const imageFile = referenceImages[i];
            console.log(`참고 이미지 ${i + 1} 분석:`, {
              name: imageFile.name,
              size: imageFile.size,
              type: imageFile.type
            });
            
            // 파일 크기 검증 (4MB = 4 * 1024 * 1024 bytes)
            if (imageFile.size > 4 * 1024 * 1024) {
              return NextResponse.json({ error: '이미지 크기는 4MB 이하여야 합니다.' }, { status: 400 });
            }

            // 이미지 분석을 통한 스타일 추출
            const imageBuffer = await imageFile.arrayBuffer();
            const imageInfo = await sharp(Buffer.from(imageBuffer)).metadata();
            
            console.log(`이미지 ${i + 1} 메타데이터:`, {
              width: imageInfo.width,
              height: imageInfo.height,
              format: imageInfo.format,
              size: imageFile.size
            });
            
            // 이미지 특성에 따른 스타일 설명
            if (imageInfo.width && imageInfo.height) {
              const aspectRatio = imageInfo.width / imageInfo.height;
              
              if (aspectRatio > 1.5) {
                styleDescription += "가로형 풍경화 스타일, ";
              } else if (aspectRatio < 0.7) {
                styleDescription += "세로형 인물화 스타일, ";
              } else {
                styleDescription += "정사각형 구도 스타일, ";
              }
            }
            
            // 파일 크기로 이미지 품질 추정
            if (imageFile.size > 2 * 1024 * 1024) {
              styleDescription += "고해상도 고품질, ";
            }
          }
          
          // 여러 이미지의 공통 스타일 요소 추가
          styleDescription += "참고 이미지들과 동일한 아트 스타일, 색상 팔레트, 조명, 브러시 스타일, 질감, 분위기로";
          
          console.log('생성된 스타일 설명:', styleDescription);
          
          // 참고 이미지의 스타일을 프롬프트에 추가
          if (model === "DALL-E 3") {
            // DALL-E 3에서는 더 상세한 캐릭터 분석 추가
            const hasStyle = modelConfig.supportsStyle && style && style !== "자동 스타일";
            const characterAnalysis = await analyzeCharacterFromImage(referenceImages[0], !!hasStyle);
            // 사용자 프롬프트를 강조하고 분석 결과를 간결하게 추가
            finalPrompt = `${prompt} - ${characterAnalysis}`;
          } else {
            // 다른 모델들은 기존 방식 유지
            finalPrompt = `${prompt}, ${styleDescription} 생성해주세요. 참고 이미지들의 모든 시각적 요소를 그대로 유지하면서`;
          }
        } catch (error) {
          console.error('이미지 분석 오류:', error);
          styleDescription = "참고 이미지들과 동일한 아트 스타일, 색상 팔레트, 조명, 구도, 브러시 스타일, 질감, 분위기로";
          finalPrompt = `${prompt}, ${styleDescription} 생성해주세요. 참고 이미지들의 모든 시각적 요소를 그대로 유지하면서`;
        }
      }
      
      console.log('최종 프롬프트:', finalPrompt);
    } else {
      console.log('참고 이미지 없음');
    }

    // 스타일이 설정 가능한 모델들에 대해 스타일 프롬프트 추가
    if (modelConfig.supportsStyle && style && style !== "자동 스타일") {
      const stylePrompts = {
        "실사화": ", realistic, high quality, detailed, photorealistic",
        "만화": ", cartoon style, anime, illustration, colorful",
        "수채화": ", watercolor painting, soft colors, artistic",
        "애니메이션": ", 3D animation, CGI, Pixar style",
        "유화": ", oil painting, textured, artistic, painterly",
        "3D": ", 3D render, digital art, clean",
        "미니멀리스트": ", minimalist, simple, clean lines, geometric",
        "팝 아트": ", pop art, bold colors, graphic design, Andy Warhol style"
      };
      
      const stylePrompt = stylePrompts[style as keyof typeof stylePrompts];
      if (stylePrompt) {
        finalPrompt += stylePrompt;
      }
    }

    // 프롬프트 길이 제한
    if (finalPrompt.length > modelConfig.maxTokens) {
      finalPrompt = finalPrompt.substring(0, modelConfig.maxTokens - 100) + "...";
    }

    console.log('최종 프롬프트:', finalPrompt);

    // 이미지 생성
    let response;

    if (modelConfig.apiType === "openai") {
      // OpenAI API 사용 (DALL-E 3)
      response = await openai.images.generate({
        model: modelConfig.model,
        prompt: finalPrompt,
        n: 1,
        size: validSize as "1024x1024" | "1792x1024" | "1024x1792",
      });
    } else if (modelConfig.apiType === "replicate") {
      // Replicate API 사용 (다른 모델들)
      console.log('Replicate API 호출 시작:', {
        model: modelConfig.model,
        prompt: finalPrompt,
        width: parseInt(validSize.split('x')[0]),
        height: parseInt(validSize.split('x')[1]),
        hasReferenceImages: referenceImages.length > 0
      });
      
      // 기본 입력 파라미터
      const inputParams: any = {
        prompt: finalPrompt,
        width: parseInt(validSize.split('x')[0]),
        height: parseInt(validSize.split('x')[1]),
        num_outputs: 1,
        scheduler: "K_EULER",
        num_inference_steps: 50,
        guidance_scale: 7.5,
        negative_prompt: "blurry, low quality, distorted, ugly, bad anatomy"
      };
      
      // 참고 이미지가 있고 Stable Diffusion XL 모델인 경우 Image-to-Image 사용
      if (referenceImages.length > 0 && model === "Stable Diffusion XL") {
        console.log('Image-to-Image 모드 활성화');
        
        // 첫 번째 참고 이미지를 init_image로 사용
        const referenceImage = referenceImages[0];
        const imageBuffer = await referenceImage.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const dataUrl = `data:${referenceImage.type};base64,${base64Image}`;
        
        inputParams.init_image = dataUrl;
        inputParams.strength = 0.7; // 원본 이미지와 생성 이미지의 혼합 정도 (0.0-1.0)
        
        console.log('Image-to-Image 파라미터 설정:', {
          hasInitImage: !!inputParams.init_image,
          strength: inputParams.strength,
          imageType: referenceImage.type,
          imageSize: referenceImage.size
        });
      }
      
      // prediction 생성
      const prediction = await replicate.predictions.create({
        version: modelConfig.model, // 전체 모델 식별자 사용
        input: inputParams
      });
      
      console.log('Replicate prediction 생성됨:', prediction);
      
      // prediction이 완료될 때까지 polling
      let finalPrediction = prediction;
      let attempts = 0;
      const maxAttempts = 60; // 최대 60초 대기
      
      while (finalPrediction.status !== 'succeeded' && finalPrediction.status !== 'failed' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
        finalPrediction = await replicate.predictions.get(prediction.id);
        attempts++;
        console.log(`Prediction 상태 (${attempts}/${maxAttempts}):`, finalPrediction.status);
      }
      
      if (finalPrediction.status === 'failed') {
        throw new Error('Replicate API에서 이미지 생성에 실패했습니다.');
      }
      
      if (finalPrediction.status !== 'succeeded') {
        throw new Error(`Replicate API에서 예상치 못한 상태를 받았습니다: ${finalPrediction.status}`);
      }
      
      console.log('Replicate API 최종 응답:', finalPrediction.output);
      
      // output에서 URL 추출
      let imageUrl: string;
      if (Array.isArray(finalPrediction.output)) {
        imageUrl = finalPrediction.output[0];
      } else if (typeof finalPrediction.output === 'string') {
        imageUrl = finalPrediction.output;
      } else {
        console.error('예상치 못한 Replicate 응답 형식:', finalPrediction.output);
        throw new Error('Replicate API에서 유효한 이미지 URL을 받지 못했습니다.');
      }
      
      // URL 유효성 검사
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        throw new Error('Replicate API에서 빈 URL을 받았습니다.');
      }
      
      console.log('최종 이미지 URL:', imageUrl);
      
      response = {
        data: [{
          url: imageUrl
        }]
      };
    } else {
      throw new Error(`지원하지 않는 API 타입: ${modelConfig.apiType}`);
    }

    if (response.data && response.data[0] && response.data[0].url) {
      console.log('이미지 생성 성공:', response.data[0].url);
      
      // 사용량 증가
      await incrementImageUsage(user.id);
      
      // 업데이트된 사용량 정보 반환
      const updatedUsage = await checkImageGenerationLimit(user.id);
      
      // DB에 이미지 히스토리 저장
      try {
        const pool = await sql.connect({
          server: process.env.DB_SERVER || '',
          database: process.env.DB_NAME || '',
          user: process.env.DB_USER || '',
          password: process.env.DB_PASSWORD || '',
          options: {
            encrypt: true,
            trustServerCertificate: true,
          },
        });

        console.log('💾 DB 저장 시작 - 사용자:', user.id);
        
        // user.id가 숫자인지 이메일인지 확인
        let userId: number;
        
        if (typeof user.id === 'string' && user.id.includes('@')) {
          // 이메일인 경우: users 테이블에서 ID 조회
          console.log('📧 이메일로 사용자 ID 조회 중:', user.id);
          const userResult = await pool.request()
            .input('userEmail', sql.VarChar, user.id)
            .query(`SELECT id FROM users WHERE email = @userEmail`);
          
          if (userResult.recordset.length === 0) {
            console.error('❌ 사용자를 찾을 수 없습니다:', user.id);
            return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
          }
          
          userId = userResult.recordset[0].id;
          console.log('👤 이메일로 조회된 사용자 ID:', userId);
        } else {
          // 이미 숫자 ID인 경우: 그대로 사용
          userId = parseInt(user.id as string);
          console.log('👤 직접 사용자 ID:', userId);
        }
        
        // 현재 사용자의 히스토리 개수 확인
        const checkResult = await pool.request()
          .input('userId', sql.Int, userId)
          .query(`SELECT COUNT(*) as count FROM image_generation_history WHERE user_id = @userId`);

        const currentCount = checkResult.recordset[0].count;
        console.log('📊 현재 히스토리 개수:', currentCount);

        // 10개가 넘으면 가장 오래된 것 삭제
        if (currentCount >= 10) {
          console.log('🗑️ 오래된 히스토리 삭제 중...');
          await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
              DELETE FROM image_generation_history
              WHERE id IN (
                SELECT TOP 1 id FROM image_generation_history 
                WHERE user_id = @userId 
                ORDER BY created_at ASC
              )
            `);
          console.log('✅ 오래된 히스토리 삭제 완료');
        }

        // 새로운 이미지 생성 히스토리 저장
        console.log('💾 새 히스토리 저장 중...');
        
        // 제목을 사용자가 입력한 원본 프롬프트로 설정 (50자 제한)
        const title = originalPrompt.length > 50 ? originalPrompt.substring(0, 50) + '...' : originalPrompt;
        
        const insertResult = await pool.request()
          .input('userId', sql.Int, userId)
          .input('prompt', sql.NVarChar, finalPrompt)
          .input('generatedImageUrl', sql.NVarChar, response.data[0].url)
          .input('model', sql.NVarChar, model)
          .input('size', sql.NVarChar, `${width}x${height}`)
          .input('style', sql.NVarChar, style || 'unknown')
          .input('quality', sql.NVarChar, 'standard')
          .input('title', sql.NVarChar, title)
          .query(`
            INSERT INTO image_generation_history 
            (user_id, prompt, generated_image_url, model, size, style, quality, title, created_at, status)
            VALUES (@userId, @prompt, @generatedImageUrl, @model, @size, @style, @quality, @title, GETDATE(), 'success');
            SELECT SCOPE_IDENTITY() as id;
          `);

        console.log('✅ 이미지 히스토리가 DB에 저장되었습니다. ID:', insertResult.recordset[0]?.id);
      } catch (dbError) {
        console.error('❌ DB 저장 실패:', dbError);
        // DB 저장 실패는 이미지 생성 성공에 영향을 주지 않음
      }

      return NextResponse.json({ 
        url: response.data[0].url,
        usage: updatedUsage,
        prompt: finalPrompt
      });
    } else {
      console.error('이미지 생성 응답 오류:', response);
      return NextResponse.json({ error: '이미지 생성에 실패했습니다.' }, { status: 500 });
    }
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    
    // API별 에러 처리
    if (error instanceof Error) {
      // OpenAI API 관련 에러
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({ error: 'OpenAI API 할당량이 부족합니다.' }, { status: 500 });
      }
      if (error.message.includes('content_policy_violation')) {
        return NextResponse.json({ error: '프롬프트가 정책에 위반됩니다. 다른 설명을 시도해주세요.' }, { status: 400 });
      }
      if (error.message.includes('model_not_found')) {
        return NextResponse.json({ error: '선택한 모델을 찾을 수 없습니다.' }, { status: 400 });
      }
      if (error.message.includes('rate_limit') || error.message.includes('rate limit')) {
        return NextResponse.json({ error: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
      }
      if (error.message.includes('invalid_api_key')) {
        return NextResponse.json({ error: 'API 키가 유효하지 않습니다.' }, { status: 401 });
      }
      
      // Replicate API 관련 에러 처리
      if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
        return NextResponse.json({ error: 'Replicate API 인증에 실패했습니다. API 토큰을 확인해주세요.' }, { status: 401 });
      }
      if (error.message.includes('quota') || error.message.includes('insufficient_quota')) {
        return NextResponse.json({ error: 'Replicate API 할당량이 부족합니다.' }, { status: 500 });
      }
      if (error.message.includes('invalid_input') || error.message.includes('bad_request')) {
        return NextResponse.json({ error: '잘못된 입력 파라미터입니다.' }, { status: 400 });
      }
      if (error.message.includes('server_error') || error.message.includes('internal_error')) {
        return NextResponse.json({ error: 'API 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
      }
      
      // 네트워크 관련 에러
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return NextResponse.json({ error: '네트워크 연결 오류가 발생했습니다. 인터넷 연결을 확인해주세요.' }, { status: 500 });
      }
      
      // 기타 알려진 에러들
      if (error.message.includes('timeout')) {
        return NextResponse.json({ error: '요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.' }, { status: 408 });
      }
    }
    
    // 일반적인 에러 메시지
    return NextResponse.json({ 
      error: '이미지 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}