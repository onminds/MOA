import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import sharp from 'sharp';
import sql from 'mssql';
import { requireAuth } from "@/lib/auth";
import { getKoreanTimeNow } from "@/lib/utils";

// Replicate 클라이언트 초기화
const replicate = new Replicate();

// 사용자 플랜별 영상 생성 제한 확인
async function checkVideoGenerationLimit(userId: string) {
  const db = await getConnection();
  
  // userId를 정수로 변환
  const userIdInt = parseInt(userId);
  
  // 사용자 정보와 최근 결제 내역 조회
  const userResult = await db.request()
    .input('userId', userIdInt)
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
    .input('userId', userIdInt)
    .input('serviceType', 'video-generate')
    .query(`
      SELECT usage_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  let maxLimit = 1; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.plan_type) {
    planType = user.plan_type;
    
    switch (planType) {
      case 'standard':
        maxLimit = 30;
        break;
      case 'pro':
        maxLimit = 100;
        break;
      default:
        maxLimit = 1;
    }
  }
  // 관리자이면서 결제 내역이 없으면 무제한
  else if (user.role === 'ADMIN') {
    maxLimit = 9999;
    planType = 'admin';
  }

  let currentUsage = usageResult.recordset[0]?.usage_count || 0;
  let nextResetDate = usageResult.recordset[0]?.next_reset_date;
  
  // next_reset_date가 없으면 계정 생성일 기준으로 월 초기화로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userIdInt)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      // 계정 생성일 기준으로 정확히 한 달 후로 설정
      const resetDate = new Date(userCreatedAt);
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
      
      // DB에 next_reset_date 저장
      await db.request()
        .input('userId', userIdInt)
        .input('serviceType', 'video-generate')
        .input('nextResetDate', nextResetDate)
        .query(`
          UPDATE usage 
          SET next_reset_date = @nextResetDate 
          WHERE user_id = @userId AND service_type = @serviceType
        `);
    }
  }
  
  const now = getKoreanTimeNow(); // 한국 시간 기준
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 영상 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 정확히 한 달 후로 설정 (한국 시간 기준)
    const nextReset = new Date(nextResetDate);
    nextReset.setMonth(nextReset.getMonth() + 1);
    
    await db.request()
      .input('userId', userIdInt)
      .input('serviceType', 'video-generate')
      .input('nextResetDate', nextReset)
      .query(`
        UPDATE usage 
        SET usage_count = 0, next_reset_date = @nextResetDate 
        WHERE user_id = @userId AND service_type = @serviceType
      `);
    
    currentUsage = 0;
  }

  const allowed = currentUsage < maxLimit;

  console.log(`영상 생성 요청 - 사용자: ${user.email}, 역할: ${user.role}, 플랜: ${planType}, 사용량: ${currentUsage}/${maxLimit}`);

  return {
    allowed,
    usageCount: currentUsage,
    limitCount: maxLimit,
    remainingCount: Math.max(0, maxLimit - currentUsage),
    planType,
    error: allowed ? null : `${planType === 'basic' ? '기본' : planType === 'standard' ? 'Standard' : planType === 'pro' ? 'Pro' : 'Admin'} 플랜의 영상 생성 한도에 도달했습니다.`
  };
}

// 영상 생성 사용량 증가
async function incrementVideoUsage(userId: string) {
  const db = await getConnection();
  
  // userId를 정수로 변환
  const userIdInt = parseInt(userId);
  
  // 기존 사용량 확인
  const existingUsage = await db.request()
    .input('userId', userIdInt)
    .input('serviceType', 'video-generate')
    .query(`
      SELECT usage_count, next_reset_date 
      FROM usage 
      WHERE user_id = @userId AND service_type = @serviceType
    `);

  if (existingUsage.recordset.length > 0) {
    // 기존 사용량이 있으면 증가
    await db.request()
      .input('userId', userIdInt)
      .input('serviceType', 'video-generate')
      .query(`
        UPDATE usage 
        SET usage_count = usage_count + 1 
        WHERE user_id = @userId AND service_type = @serviceType
      `);
  } else {
    // 기존 사용량이 없으면 새로 생성
    const userCreatedResult = await db.request()
      .input('userId', userIdInt)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    let nextResetDate = null;
    
    if (userCreatedAt) {
      const resetDate = new Date(userCreatedAt);
      // 계정 생성일 기준으로 정확히 한 달 후 초기화 시간 설정
      resetDate.setMonth(resetDate.getMonth() + 1);
      nextResetDate = resetDate;
    }
    
    await db.request()
      .input('userId', userIdInt)
      .input('serviceType', 'video-generate')
      .input('nextResetDate', nextResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, 1, @nextResetDate, GETDATE(), GETDATE())
      `);
  }
}

// 모델별 설정
const modelConfigs = {
  "kling": {
    model: "kwaivgi/kling-v2.1",
    apiType: "replicate",
    supportsImageInput: true,
    resolution: "720p", // 720p 해상도 설정
    supportedResolutions: ["720p", "1080p"], // Kling은 720p, 1080p 지원
    maxResolution: "1080p"
  },
  "Minimax": {
    model: "minimax/hailuo-02",
    apiType: "replicate",
    supportsImageInput: true,
    resolution: "720p", // 720p 해상도 설정
    supportedResolutions: ["720p", "768p"], // Minimax는 720p, 768p 지원 (768p는 10초용)
    maxResolution: "768p"
  },
  "Runway": {
    model: "gen4_turbo",
    apiType: "runway",
    supportsImageInput: true,
    resolution: "720p", // 720p 해상도 설정
    supportedResolutions: ["720p", "1080p"], // Runway는 720p, 1080p 지원
    maxResolution: "1080p"
  }
};

// 모델별 프롬프트 최적화 함수
function optimizePromptForModel(prompt: string, model: string): string {
  switch (model) {
    case "kling":
      // Kling은 상세하고 구체적인 프롬프트를 선호
      return `Create a cinematic video with smooth motion and high quality: ${prompt}. The video should have natural movement, cinematic lighting, and professional quality.`;
    
    case "Minimax":
      // Minimax는 간결하고 명확한 프롬프트를 선호
      return `Generate a smooth video with natural motion: ${prompt}. Focus on fluid movement and realistic transitions.`;
    
    case "Runway":
      // Runway는 창의적이고 예술적인 프롬프트를 선호
      return `Create an artistic and creative video: ${prompt}. The video should have artistic style, creative transitions, and visually appealing effects.`;
    
    default:
      return prompt;
  }
}

// 공통 비율 처리 함수
function getVideoDimensions(size: string, resolution: string = "720p") {
  const [width, height] = size.split(':').map(Number);
  const isLandscape = width > height;
  
  // 해상도에 따른 크기 설정
  let targetWidth, targetHeight;
  
  if (resolution === "1080p") {
    // 1080p 해상도 (가로형: 1920x1080, 세로형: 1080x1920)
    targetWidth = isLandscape ? 1920 : 1080;
    targetHeight = isLandscape ? 1080 : 1920;
  } else if (resolution === "768p") {
    // 768p 해상도 (가로형: 1024x768, 세로형: 768x1024)
    targetWidth = isLandscape ? 1024 : 768;
    targetHeight = isLandscape ? 768 : 1024;
  } else {
    // 720p 해상도 (가로형: 1280x720, 세로형: 720x1280)
    targetWidth = isLandscape ? 1280 : 720;
    targetHeight = isLandscape ? 720 : 1280;
  }
  
  return {
    width: targetWidth,
    height: targetHeight,
    isLandscape,
    ratio: `${targetWidth}:${targetHeight}`,
    originalRatio: `${width}:${height}`,
    resolution: resolution
  };
}

// 이미지 리사이즈 함수
async function resizeImageForVideo(imageBuffer: ArrayBuffer, targetWidth: number, targetHeight: number) {
  const image = sharp(Buffer.from(imageBuffer));
  const metadata = await image.metadata();
  
  console.log('🔍 원본 이미지 메타데이터:', {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    originalRatio: (metadata.width || 1) / (metadata.height || 1)
  });
  
  // 정확한 비율로 강제 변환
  const resizedImageBuffer = await image
    .resize(targetWidth, targetHeight, {
      fit: 'contain', // 이미지가 확대되지 않고 전체가 보이도록
      background: { r: 0, g: 0, b: 0, alpha: 1 } // 배경을 검은색으로 채움
    })
    .jpeg({ quality: 80 }) // 품질은 80% 유지
    .toBuffer();

  console.log('🔄 이미지 리사이즈 (강제 비율 변환):', {
    originalDimensions: `${metadata.width}x${metadata.height}`,
    targetDimensions: `${targetWidth}x${targetHeight}`,
    fitMode: 'contain',
    background: 'black',
    quality: '80% JPEG',
    finalRatio: (targetWidth / targetHeight).toFixed(3)
  });

  return resizedImageBuffer;
}

// 비디오 다운로드 및 바이너리 변환
async function downloadAndSaveVideo(videoUrl: string): Promise<Buffer> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`비디오 다운로드 실패: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 영상 생성 API 호출 시작');
    
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      console.log('❌ 인증 실패: 로그인이 필요합니다');
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    console.log('✅ 인증 성공 - 사용자 이메일:', session.user.email);

    // 사용자의 숫자 ID 조회
    const db = await getConnection();
    const userResult = await db.request()
      .input('email', sql.NVarChar, session.user.email)
      .query('SELECT id FROM users WHERE email = @email');

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const userId = userResult.recordset[0].id;
    console.log('📊 사용자 ID:', userId);

    // 사용량 체크
    const limitCheck = await checkVideoGenerationLimit(userId.toString());
    console.log('📊 사용량 체크 결과:', limitCheck);
    
    if (!limitCheck.allowed) {
      return NextResponse.json({ 
        error: limitCheck.error || '영상 생성 한도를 초과했습니다.', 
        currentUsage: limitCheck.usageCount, 
        maxLimit: limitCheck.limitCount 
      }, { status: 429 });
    }

    const formData = await request.formData();
    const originalPrompt = formData.get('prompt') as string; // 원본 프롬프트
    const prompt = formData.get('prompt') as string;
    const duration = formData.get('duration') as string;
    const seconds = parseInt(formData.get('seconds') as string);
    const model = formData.get('model') as string;
    const size = formData.get('size') as string;
    const resolution = formData.get('resolution') as string || "720p";
    const referenceImages = formData.getAll('referenceImages') as File[];

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    console.log('영상 생성 요청:', { 
      prompt, 
      duration, 
      seconds, 
      model, 
      size, 
      resolution,
      referenceImagesCount: referenceImages.length,
      userId: userId 
    });

    // 모델 설정 가져오기
    const modelConfig = modelConfigs[model as keyof typeof modelConfigs];
    if (!modelConfig) {
      return NextResponse.json({ error: '지원하지 않는 모델입니다.' }, { status: 400 });
    }

    // 해상도 유효성 검사
    if (!modelConfig.supportedResolutions.includes(resolution)) {
      return NextResponse.json({ 
        error: `${model} 모델은 ${resolution} 해상도를 지원하지 않습니다. 지원 해상도: ${modelConfig.supportedResolutions.join(', ')}` 
      }, { status: 400 });
    }

    // 특정 모델에 대한 처리
    if (model === "kling") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 공통 비율 처리
      const dimensions = getVideoDimensions(size, resolution);
      console.log('🎯 Kling 비율 설정:', {
        userSelectedSize: size,
        userSelectedResolution: resolution,
        targetDimensions: `${dimensions.width}x${dimensions.height}`,
        targetRatio: dimensions.ratio,
        isLandscape: dimensions.isLandscape,
        resolution: dimensions.resolution
      });

      // 첫 번째 이미지를 base64로 변환
      const imageFile = referenceImages[0];
      const imageBuffer = await imageFile.arrayBuffer();
      
      // 이미지 리사이즈
      const resizedImageBuffer = await resizeImageForVideo(imageBuffer, dimensions.width, dimensions.height);
      const base64Image = resizedImageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      console.log('kling 모델 호출 시작:', { 
        prompt: prompt, 
        seconds: seconds,
        dimensions: `${dimensions.width}x${dimensions.height}`,
        ratio: dimensions.ratio,
        resolution: dimensions.resolution
      });

      // Kling용 프롬프트 최적화
      const optimizedPrompt = optimizePromptForModel(prompt, "kling");
      console.log('Kling 최적화된 프롬프트:', optimizedPrompt);

      const prediction = await replicate.predictions.create({
        version: modelConfig.model,
        input: {
          prompt: optimizedPrompt,
          start_image: dataUrl,
          duration: seconds
        }
      });

      console.log('kling prediction 생성됨:', prediction);

      // 예측 완료까지 대기 (최대 300초 - 5분)
      let completedPrediction = prediction;
      for (let i = 0; i < 150; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        completedPrediction = await replicate.predictions.get(prediction.id);
        console.log(`kling prediction 상태 확인 ${i + 1}/150:`, completedPrediction.status);
        
        if (completedPrediction.status === 'succeeded') {
          break;
        } else if (completedPrediction.status === 'failed') {
          throw new Error('영상 생성에 실패했습니다.');
        } else if (completedPrediction.status === 'canceled') {
          throw new Error('영상 생성이 취소되었습니다.');
        }
      }

      if (completedPrediction.status !== 'succeeded') {
        throw new Error('영상 생성 시간이 초과되었습니다. (5분)');
      }

      const videoUrl = completedPrediction.output;
      console.log('kling 영상 생성 성공:', videoUrl);
      const videoBuffer = await downloadAndSaveVideo(videoUrl);

      // 사용량 증가
      await incrementVideoUsage(userId.toString());

      // 영상 생성 히스토리 저장
      let newId: number | null = null;
      let internalUrl: string | null = null;
      
      try {
        // 현재 히스토리 개수 확인
        const countResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .query('SELECT COUNT(*) as count FROM video_generation_history WHERE user_id = @userId');
        
        const currentCount = countResult.recordset[0].count;
        console.log('📊 현재 영상 히스토리 개수:', currentCount);

        // 5개를 초과하면 가장 오래된 것 삭제 (FIFO)
        if (currentCount >= 5) {
          console.log('🗑️ 오래된 영상 히스토리 삭제 중...');
          await db.request()
            .input('userId', sql.BigInt, userId)
            .query(`
              DELETE FROM video_generation_history 
              WHERE id IN (
                SELECT TOP 1 id FROM video_generation_history 
                WHERE user_id = @userId 
                ORDER BY created_at ASC
              )
            `);
          console.log('✅ 오래된 영상 히스토리 삭제 완료');
        }

        // 새로운 영상 생성 히스토리 저장 (video_data 포함)
        console.log('💾 새 영상 히스토리 저장 중...');
        const title = originalPrompt.length > 50 ? originalPrompt.substring(0, 50) + '...' : originalPrompt;

        const insertResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .input('prompt', sql.NVarChar, optimizedPrompt)
          .input('generatedVideoUrl', sql.NVarChar, videoUrl) // 임시로 외부 URL 저장 후 업데이트
          .input('model', sql.NVarChar, model)
          .input('size', sql.NVarChar, size)
          .input('duration', sql.NVarChar, duration)
          .input('resolution', sql.NVarChar, resolution)
          .input('style', sql.NVarChar, 'unknown')
          .input('quality', sql.NVarChar, 'standard')
          .input('title', sql.NVarChar, title)
          .input('videoData', sql.VarBinary(sql.MAX), videoBuffer)
          .query(`
            INSERT INTO video_generation_history 
            (user_id, prompt, generated_video_url, model, size, duration, resolution, style, quality, title, created_at, status, video_data)
            VALUES (@userId, @prompt, @generatedVideoUrl, @model, @size, @duration, @resolution, @style, @quality, @title, GETDATE(), 'success', @videoData);
            SELECT SCOPE_IDENTITY() as id;
          `);

        newId = insertResult.recordset[0]?.id;
        internalUrl = `/api/video/${newId}`;
        await db.request()
          .input('id', sql.Int, newId)
          .input('internalUrl', sql.NVarChar, internalUrl)
          .query(`UPDATE video_generation_history SET generated_video_url = @internalUrl WHERE id = @id`);

        console.log('✅ 영상 히스토리가 DB에 저장되었습니다. ID:', newId);
      } catch (dbError) {
        console.error('❌ DB 저장 실패:', dbError);
        // DB 저장 실패는 영상 생성 성공에 영향을 주지 않음
      }

      // DB 저장 성공 여부와 관계없이 응답 반환
      const finalUrl = internalUrl || videoUrl; // 내부 URL이 있으면 사용, 없으면 원본 URL 사용
      
      return NextResponse.json({ 
        url: finalUrl,
        usage: await checkVideoGenerationLimit(userId.toString())
      });

    } else if (model === "Minimax") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 공통 비율 처리
      const dimensions = getVideoDimensions(size, modelConfig.maxResolution);
      console.log('🎯 Minimax 비율 설정:', {
        userSelectedSize: size,
        targetDimensions: `${dimensions.width}x${dimensions.height}`,
        targetRatio: dimensions.ratio,
        isLandscape: dimensions.isLandscape,
        resolution: dimensions.resolution
      });

      // 첫 번째 이미지를 base64로 변환
      const imageFile = referenceImages[0];
      const imageBuffer = await imageFile.arrayBuffer();
      
      // Minimax는 6초만 지원하므로 변환
      let minimaxDuration = seconds;
      
      if (seconds === 5) {
        minimaxDuration = 6; // 5초는 6초로 변환
      } else if (seconds === 10) {
        minimaxDuration = 6; // Minimax는 10초를 지원하지 않으므로 6초로 변환
        console.log('⚠️ Minimax 10초 duration 경고: Minimax는 10초를 지원하지 않아 6초로 변경합니다.');
      } else {
        minimaxDuration = 6; // 기본값은 6초
      }

      // Minimax는 세로형 영상을 더 잘 지원하므로 가로형일 경우 경고 로그 추가
      if (dimensions.isLandscape) {
        console.log('⚠️ Minimax 가로형 영상 경고: Minimax는 세로형 영상을 더 잘 지원합니다.');
      }

      // 720p 해상도로 재계산
      const minimaxDimensions = getVideoDimensions(size, resolution);
      console.log('🎯 Minimax 최종 설정:', {
        originalDimensions: `${dimensions.width}x${dimensions.height}`,
        minimaxDimensions: `${minimaxDimensions.width}x${minimaxDimensions.height}`,
        duration: minimaxDuration,
        resolution: resolution
      });

      // 720p 해상도로 이미지 재리사이즈
      const resizedImageBuffer720p = await resizeImageForVideo(imageBuffer, minimaxDimensions.width, minimaxDimensions.height);
      const base64Image720p = resizedImageBuffer720p.toString('base64');
      const dataUrl720p = `data:image/jpeg;base64,${base64Image720p}`;

      // Minimax용 프롬프트 최적화
      const optimizedPrompt = optimizePromptForModel(prompt, "Minimax");
      console.log('Minimax 최적화된 프롬프트:', optimizedPrompt);

      const prediction = await replicate.predictions.create({
        version: modelConfig.model,
        input: {
          prompt: optimizedPrompt,
          prompt_optimizer: false,
          first_frame_image: dataUrl720p,
          duration: minimaxDuration
        }
      });

      console.log('Minimax prediction 생성됨:', prediction);

      // 예측 완료까지 대기 (최대 300초 - 5분)
      let completedPrediction = prediction;
      for (let i = 0; i < 150; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        completedPrediction = await replicate.predictions.get(prediction.id);
        console.log(`Minimax prediction 상태 확인 ${i + 1}/150:`, completedPrediction.status);
        
        if (completedPrediction.status === 'succeeded') {
          break;
        } else if (completedPrediction.status === 'failed') {
          console.error('Minimax prediction 실패 상세 정보:', JSON.stringify(completedPrediction, null, 2));
          
          // 다양한 에러 필드 확인
          let errorMessage = '알 수 없는 오류';
          if (completedPrediction.error) {
            errorMessage = String(completedPrediction.error);
          } else if (completedPrediction.logs) {
            errorMessage = String(completedPrediction.logs);
          } else if (completedPrediction.output && typeof completedPrediction.output === 'string') {
            errorMessage = completedPrediction.output;
          }
          
          throw new Error(`Minimax 영상 생성에 실패했습니다. 에러: ${errorMessage}`);
        } else if (completedPrediction.status === 'canceled') {
          throw new Error('Minimax 영상 생성이 취소되었습니다.');
        }
      }

      if (completedPrediction.status !== 'succeeded') {
        throw new Error('영상 생성 시간이 초과되었습니다. (5분)');
      }

      const videoUrl = completedPrediction.output;
      const videoBuffer = await downloadAndSaveVideo(videoUrl);
      console.log('Minimax 영상 생성 성공:', videoUrl);

      // 사용량 증가
      await incrementVideoUsage(userId.toString());

      // 영상 생성 히스토리 저장
      let newId: number | null = null;
      let internalUrl: string | null = null;
      
      try {
        // 현재 히스토리 개수 확인
        const countResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .query('SELECT COUNT(*) as count FROM video_generation_history WHERE user_id = @userId');
        
        const currentCount = countResult.recordset[0].count;
        console.log('📊 현재 영상 히스토리 개수:', currentCount);

        // 5개를 초과하면 가장 오래된 것 삭제 (FIFO)
        if (currentCount >= 5) {
          console.log('🗑️ 오래된 영상 히스토리 삭제 중...');
          await db.request()
            .input('userId', sql.BigInt, userId)
            .query(`
              DELETE FROM video_generation_history 
              WHERE id IN (
                SELECT TOP 1 id FROM video_generation_history 
                WHERE user_id = @userId 
                ORDER BY created_at ASC
              )
            `);
          console.log('✅ 오래된 영상 히스토리 삭제 완료');
        }

        // 새로운 영상 생성 히스토리 저장
        console.log('💾 새 영상 히스토리 저장 중...');
        
        // 제목을 사용자가 입력한 원본 프롬프트로 설정 (50자 제한)
        const title = originalPrompt.length > 50 ? originalPrompt.substring(0, 50) + '...' : originalPrompt;
        
        const insertResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .input('prompt', sql.NVarChar, optimizedPrompt)
          .input('generatedVideoUrl', sql.NVarChar, videoUrl)
          .input('model', sql.NVarChar, model)
          .input('size', sql.NVarChar, size)
          .input('duration', sql.NVarChar, duration)
          .input('resolution', sql.NVarChar, resolution)
          .input('style', sql.NVarChar, 'unknown')
          .input('quality', sql.NVarChar, 'standard')
          .input('title', sql.NVarChar, title)
          .input('videoData', sql.VarBinary(sql.MAX), videoBuffer)
          .query(`
            INSERT INTO video_generation_history 
            (user_id, prompt, generated_video_url, model, size, duration, resolution, style, quality, title, created_at, status, video_data)
            VALUES (@userId, @prompt, @generatedVideoUrl, @model, @size, @duration, @resolution, @style, @quality, @title, GETDATE(), 'success', @videoData);
            SELECT SCOPE_IDENTITY() as id;
          `);

        newId = insertResult.recordset[0]?.id;
        internalUrl = `/api/video/${newId}`;
        await db.request()
          .input('id', sql.Int, newId)
          .input('internalUrl', sql.NVarChar, internalUrl)
          .query(`UPDATE video_generation_history SET generated_video_url = @internalUrl WHERE id = @id`);

        console.log('✅ 영상 히스토리가 DB에 저장되었습니다. ID:', newId);
      } catch (dbError) {
        console.error('❌ DB 저장 실패:', dbError);
        // DB 저장 실패는 영상 생성 성공에 영향을 주지 않음
      }

      // DB 저장 성공 여부와 관계없이 응답 반환
      const finalUrl = internalUrl || videoUrl; // 내부 URL이 있으면 사용, 없으면 원본 URL 사용
      
      return NextResponse.json({ 
        url: finalUrl,
        usage: await checkVideoGenerationLimit(userId.toString())
      });

    } else if (model === "Runway") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 공통 비율 처리
      const dimensions = getVideoDimensions(size, modelConfig.maxResolution);
      console.log('🎯 Runway 비율 설정:', {
        userSelectedSize: size,
        targetDimensions: `${dimensions.width}x${dimensions.height}`,
        targetRatio: dimensions.ratio,
        isLandscape: dimensions.isLandscape,
        resolution: dimensions.resolution
      });

      // 첫 번째 이미지를 base64로 변환
      const imageFile = referenceImages[0];
      const imageBuffer = await imageFile.arrayBuffer();
      
      // 이미지 리사이즈
      const resizedImageBuffer = await resizeImageForVideo(imageBuffer, dimensions.width, dimensions.height);
      const base64Image = resizedImageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;

      console.log('Runway 모델 호출 시작:', { 
        prompt: prompt,
        dimensions: `${dimensions.width}x${dimensions.height}`,
        ratio: dimensions.ratio,
        model: "gen4_turbo",
        duration: seconds,
        resolution: dimensions.resolution
      });

      // Runway API 호출
      const requestBody: any = {
        promptImage: dataUrl,
        model: "gen4_turbo",
        ratio: dimensions.isLandscape ? "1280:720" : "720:1280", // Runway API 지원 비율
        position: "first",
        seed: Math.floor(Math.random() * 4294967295),
        contentModeration: {
          publicFigureThreshold: "low"
        }
      };
      
      // promptText가 있으면 추가
      if (prompt && prompt.trim()) {
        // Runway용 프롬프트 최적화
        const optimizedPrompt = optimizePromptForModel(prompt, "Runway");
        console.log('Runway 최적화된 프롬프트:', optimizedPrompt);
        requestBody.promptText = optimizedPrompt;
      }
      
      // duration이 5 또는 10이 아니면 기본값 10 사용
      if (seconds === 5 || seconds === 10) {
        requestBody.duration = seconds;
      } else {
        requestBody.duration = 10; // 기본값
      }
      
      console.log('Runway API 요청 본문:', JSON.stringify(requestBody, null, 2));
      console.log('🎯 Runway API 비율 설정:', {
        userSelectedSize: size,
        userSelectedRatio: dimensions.isLandscape ? "16:9" : "9:16",
        actualRequestRatio: dimensions.ratio,
        actualRequestDimensions: dimensions.ratio === "1280:720" ? "1280x720" : "720x1280",
        resolution: dimensions.resolution
      });
      
      const runwayResponse = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
          'X-Runway-Version': '2024-11-06'
        },
        body: JSON.stringify(requestBody)
      });

      if (!runwayResponse.ok) {
        const errorData = await runwayResponse.json();
        console.error('Runway API 오류:', errorData);
        throw new Error(`Runway API 오류: ${runwayResponse.status} - ${errorData.error}`);
      }

      const runwayData = await runwayResponse.json();
      console.log('Runway API 응답:', runwayData);
      console.log('Runway task ID:', runwayData.id);

      // Runway task 결과 확인 (최대 10분 대기)
      let videoUrl = null;
      for (let i = 0; i < 300; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기
        
        try {
          const resultResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${runwayData.id}`, {
            headers: {
              'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
              'X-Runway-Version': '2024-11-06'
            }
          });
          
          if (resultResponse.ok) {
            const resultData = await resultResponse.json();
            console.log(`Runway task 상태 확인 ${i + 1}/300:`, resultData.status);
            
            // Runway API 문서에 따른 상태 확인
            if (resultData.status === 'COMPLETED' || resultData.status === 'SUCCEEDED') {
              // 다양한 응답 구조 확인
              if (resultData.output && Array.isArray(resultData.output) && resultData.output.length > 0) {
                // Runway API: output이 배열 형태
                videoUrl = resultData.output[0];
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: dimensions.isLandscape ? "16:9" : "9:16",
                  requestedDimensions: dimensions.isLandscape ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: '배열 형태'
                });
                break;
              } else if (resultData.output && resultData.output.video) {
                videoUrl = resultData.output.video;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: dimensions.isLandscape ? "16:9" : "9:16",
                  requestedDimensions: dimensions.isLandscape ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: 'output.video 형태'
                });
                break;
              } else if (resultData.output && typeof resultData.output === 'string') {
                videoUrl = resultData.output;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: dimensions.isLandscape ? "16:9" : "9:16",
                  requestedDimensions: dimensions.isLandscape ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: '문자열 형태'
                });
                break;
              } else if (resultData.video) {
                videoUrl = resultData.video;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: dimensions.isLandscape ? "16:9" : "9:16",
                  requestedDimensions: dimensions.isLandscape ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: 'video 형태'
                });
                break;
              } else {
                console.log('Runway 응답 구조:', JSON.stringify(resultData, null, 2));
              }
            } else if (resultData.status === 'FAILED' || resultData.status === 'ABORTED') {
              console.error('Runway task 실패 상세 정보:', JSON.stringify(resultData, null, 2));
              
              // 다양한 에러 필드 확인
              let errorMessage = '알 수 없는 오류';
              if (resultData.failure) {
                errorMessage = resultData.failure;
              } else if (resultData.error) {
                errorMessage = resultData.error;
              } else if (resultData.message) {
                errorMessage = resultData.message;
              } else if (resultData.reason) {
                errorMessage = resultData.reason;
              } else if (resultData.details) {
                errorMessage = resultData.details;
              } else if (resultData.output && resultData.output.error) {
                errorMessage = resultData.output.error;
              }
              
              throw new Error(`Runway 영상 생성에 실패했습니다. 상태: ${resultData.status}, 에러: ${errorMessage}`);
            } else if (resultData.status === 'PENDING' || resultData.status === 'RUNNING') {
              // 계속 대기
              console.log(`Runway task 진행 중: ${resultData.status}`);
            } else {
              console.log(`Runway task 알 수 없는 상태: ${resultData.status}`);
            }
          } else if (resultResponse.status === 404) {
            throw new Error('Runway task가 존재하지 않거나 삭제되었습니다.');
          } else {
            console.error('Runway task 확인 실패:', resultResponse.status);
          }
        } catch (error) {
          console.error('Runway task 확인 오류:', error);
        }
      }

      if (!videoUrl) {
        throw new Error('Runway 영상 생성 시간이 초과되었습니다. (10분)');
      }

      console.log('Runway 영상 생성 성공:', videoUrl);
      const videoBuffer = await downloadAndSaveVideo(videoUrl);

      // 사용량 증가
      await incrementVideoUsage(userId.toString());

      // 영상 생성 히스토리 저장
      let newId: number | null = null;
      let internalUrl: string | null = null;
      
      try {
        // 현재 히스토리 개수 확인
        const countResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .query('SELECT COUNT(*) as count FROM video_generation_history WHERE user_id = @userId');
        
        const currentCount = countResult.recordset[0].count;
        console.log('📊 현재 영상 히스토리 개수:', currentCount);

        // 5개를 초과하면 가장 오래된 것 삭제 (FIFO)
        if (currentCount >= 5) {
          console.log('🗑️ 오래된 영상 히스토리 삭제 중...');
          await db.request()
            .input('userId', sql.BigInt, userId)
            .query(`
              DELETE FROM video_generation_history 
              WHERE id IN (
                SELECT TOP 1 id FROM video_generation_history 
                WHERE user_id = @userId 
                ORDER BY created_at ASC
              )
            `);
          console.log('✅ 오래된 영상 히스토리 삭제 완료');
        }

        // 새로운 영상 생성 히스토리 저장
        console.log('💾 새 영상 히스토리 저장 중...');
        
        // 제목을 사용자가 입력한 원본 프롬프트로 설정 (50자 제한)
        const title = originalPrompt.length > 50 ? originalPrompt.substring(0, 50) + '...' : originalPrompt;
        
        const insertResult = await db.request()
          .input('userId', sql.BigInt, userId)
          .input('prompt', sql.NVarChar, prompt)
          .input('generatedVideoUrl', sql.NVarChar, videoUrl)
          .input('model', sql.NVarChar, model)
          .input('size', sql.NVarChar, size)
          .input('duration', sql.NVarChar, duration)
          .input('resolution', sql.NVarChar, resolution)
          .input('style', sql.NVarChar, 'unknown')
          .input('quality', sql.NVarChar, 'standard')
          .input('title', sql.NVarChar, title)
          .input('videoData', sql.VarBinary(sql.MAX), videoBuffer)
          .query(`
            INSERT INTO video_generation_history 
            (user_id, prompt, generated_video_url, model, size, duration, resolution, style, quality, title, created_at, status, video_data)
            VALUES (@userId, @prompt, @generatedVideoUrl, @model, @size, @duration, @resolution, @style, @quality, @title, GETDATE(), 'success', @videoData);
            SELECT SCOPE_IDENTITY() as id;
          `);

        newId = insertResult.recordset[0]?.id;
        internalUrl = `/api/video/${newId}`;
        await db.request()
          .input('id', sql.Int, newId)
          .input('internalUrl', sql.NVarChar, internalUrl)
          .query(`UPDATE video_generation_history SET generated_video_url = @internalUrl WHERE id = @id`);

        console.log('✅ 영상 히스토리가 DB에 저장되었습니다. ID:', newId);
      } catch (dbError) {
        console.error('❌ DB 저장 실패:', dbError);
        // DB 저장 실패는 영상 생성 성공에 영향을 주지 않음
      }

      // DB 저장 성공 여부와 관계없이 응답 반환
      const finalUrl = internalUrl || videoUrl; // 내부 URL이 있으면 사용, 없으면 원본 URL 사용
      
      return NextResponse.json({ 
        url: finalUrl,
        usage: await checkVideoGenerationLimit(userId.toString())
      });

    } else {
      return NextResponse.json({ error: "해당 모델은 아직 지원되지 않습니다." }, { status: 400 });
    }

  } catch (error) {
    console.error('영상 생성 오류:', error);
    
    // API별 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('authentication')) {
        return NextResponse.json({ error: 'Replicate API 인증에 실패했습니다. API 토큰을 확인해주세요.' }, { status: 401 });
      }
      if (error.message.includes('quota')) {
        return NextResponse.json({ error: 'Replicate API 할당량이 부족합니다.' }, { status: 500 });
      }
      if (error.message.includes('invalid_input')) {
        return NextResponse.json({ error: '잘못된 입력 파라미터입니다.' }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: '영상 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 