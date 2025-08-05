import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';
import sharp from 'sharp';

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
  
  // next_reset_date가 없으면 계정 생성일 기준으로 일주일 후로 설정
  if (!nextResetDate) {
    const userCreatedResult = await db.request()
      .input('userId', userIdInt)
      .query('SELECT created_at FROM users WHERE id = @userId');
    
    const userCreatedAt = userCreatedResult.recordset[0]?.created_at;
    if (userCreatedAt) {
      // 계정 생성일 + 7일로 설정
      const resetDate = new Date(userCreatedAt);
      resetDate.setDate(resetDate.getDate() + 7);
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
  
  const now = new Date();
  
  // 초기화 시간이 지났으면 사용량 리셋하고 다음 초기화 시간 설정
  if (nextResetDate && now > new Date(nextResetDate) && currentUsage > 0) {
    console.log(`사용자 ${userId}의 영상 생성 사용량 초기화: ${currentUsage} -> 0`);
    
    // 다음 초기화 시간을 일주일 후로 설정
    const nextReset = new Date(nextResetDate);
    nextReset.setDate(nextReset.getDate() + 7);
    
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
    let nextResetDate = new Date();
    
    if (userCreatedAt) {
      // 계정 생성일 + 7일로 설정
      const resetDate = new Date(userCreatedAt);
      resetDate.setDate(resetDate.getDate() + 7);
      nextResetDate = resetDate;
    }
    
    await db.request()
      .input('userId', userIdInt)
      .input('serviceType', 'video-generate')
      .input('usageCount', 1)
      .input('nextResetDate', nextResetDate)
      .query(`
        INSERT INTO usage (user_id, service_type, usage_count, next_reset_date, created_at, updated_at)
        VALUES (@userId, @serviceType, @usageCount, @nextResetDate, GETDATE(), GETDATE())
      `);
  }
}

// 모델별 설정
const modelConfigs = {
  "kling": {
    model: "kwaivgi/kling-v2.1",
    apiType: "replicate",
    supportsImageInput: true,
    resolution: "720p" // 720p 해상도 설정
  },
  "Minimax": {
    model: "minimax/hailuo-02",
    apiType: "replicate",
    supportsImageInput: true,
    resolution: "720p" // 720p 해상도 설정
  },
  "Runway": {
    model: "gen4_turbo",
    apiType: "runway",
    supportsImageInput: true,
    resolution: "720p" // 720p 해상도 설정
  }
};

export async function POST(request: NextRequest) {
  try {
    console.log('🎬 영상 생성 API 호출 시작');
    
    // 인증 체크
    const authResult = await requireAuth();
    console.log('🔐 인증 결과:', authResult);
    
    if ('error' in authResult) {
      console.log('❌ 인증 실패:', authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    console.log('✅ 인증 성공 - 사용자 ID:', user.id, '이메일:', user.email);

    // 사용량 체크
    const limitCheck = await checkVideoGenerationLimit(user.id);
    console.log('📊 사용량 체크 결과:', limitCheck);
    
    if (!limitCheck.allowed) {
      return NextResponse.json({ 
        error: limitCheck.error || '영상 생성 한도를 초과했습니다.', 
        currentUsage: limitCheck.usageCount, 
        maxLimit: limitCheck.limitCount 
      }, { status: 429 });
    }

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const duration = formData.get('duration') as string;
    const seconds = parseInt(formData.get('seconds') as string);
    const model = formData.get('model') as string;
    const size = formData.get('size') as string;
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
      referenceImagesCount: referenceImages.length,
      userId: user.id 
    });

    // 모델 설정 가져오기
    const modelConfig = modelConfigs[model as keyof typeof modelConfigs];
    if (!modelConfig) {
      return NextResponse.json({ error: '지원하지 않는 모델입니다.' }, { status: 400 });
    }

    // 특정 모델에 대한 처리
    if (model === "kling") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 첫 번째 이미지를 base64로 변환
      const imageFile = referenceImages[0];
      const imageBuffer = await imageFile.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const dataUrl = `data:${imageFile.type};base64,${base64Image}`;

      console.log('kling 모델 호출 시작:', { prompt: prompt, seconds: seconds });

      const prediction = await replicate.predictions.create({
        version: modelConfig.model,
        input: {
          prompt: prompt,
          start_image: dataUrl,
          duration: seconds  // seconds 파라미터 추가
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

      // 사용량 증가
      await incrementVideoUsage(user.id);

      return NextResponse.json({ 
        url: videoUrl,
        usage: await checkVideoGenerationLimit(user.id)
      });

    } else if (model === "Minimax") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 첫 번째 이미지를 base64로 변환
      const imageFile = referenceImages[0];
      const imageBuffer = await imageFile.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString('base64');
      const dataUrl = `data:${imageFile.type};base64,${base64Image}`;

      console.log('Minimax 모델 호출 시작:', { prompt: prompt, seconds: seconds });

      const prediction = await replicate.predictions.create({
        version: modelConfig.model,
        input: {
          prompt: prompt,
          prompt_optimizer: false,
          first_frame_image: dataUrl,
          duration: seconds  // seconds 파라미터 추가
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
          throw new Error('영상 생성에 실패했습니다.');
        } else if (completedPrediction.status === 'canceled') {
          throw new Error('영상 생성이 취소되었습니다.');
        }
      }

      if (completedPrediction.status !== 'succeeded') {
        throw new Error('영상 생성 시간이 초과되었습니다. (5분)');
      }

      const videoUrl = completedPrediction.output;
      console.log('Minimax 영상 생성 성공:', videoUrl);

      // 사용량 증가
      await incrementVideoUsage(user.id);

      return NextResponse.json({ 
        url: videoUrl,
        usage: await checkVideoGenerationLimit(user.id)
      });

    } else if (model === "Runway") {
      if (!referenceImages || referenceImages.length === 0) {
        return NextResponse.json({ error: "참고 이미지가 필요합니다." }, { status: 400 });
      }

      // 첫 번째 이미지를 적절한 비율로 리사이즈
      const imageFile = referenceImages[0];
      
      console.log('📸 이미지 파일 정보:', {
        fileName: imageFile.name,
        fileSize: `${(imageFile.size / 1024 / 1024).toFixed(2)} MB`,
        fileType: imageFile.type,
        lastModified: new Date(imageFile.lastModified).toLocaleString()
      });
      
      const imageBuffer = await imageFile.arrayBuffer();
      
      // 이미지 메타데이터 확인
      const image = sharp(Buffer.from(imageBuffer));
      const metadata = await image.metadata();
      
      console.log('🔍 원본 이미지 메타데이터:', {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        channels: metadata.channels,
        depth: metadata.depth,
        density: metadata.density,
        hasProfile: metadata.hasProfile,
        hasAlpha: metadata.hasAlpha,
        orientation: metadata.orientation
      });
      
      // Runway API의 최종 출력 비율에 맞춰 이미지 리사이즈 (720p 해상도)
      // size가 '1920:1080' 형태로 전달되므로 이를 파싱
      const [width, height] = size.split(':').map(Number);
      const isLandscape = width > height; // 가로형인지 세로형인지 판단
      
      console.log('🔍 비율 파싱 디버깅:', {
        originalSize: size,
        parsedWidth: width,
        parsedHeight: height,
        isLandscape: isLandscape,
        comparison: `${width} > ${height} = ${width > height}`
      });
      
      // 720p 해상도로 설정 (가로형: 1280x720, 세로형: 720x1280)
      const targetRunwayRatio = isLandscape ? "1280:720" : "720:1280";
      let [runwayTargetWidth, runwayTargetHeight] = targetRunwayRatio.split(':').map(Number);

      console.log('🎯 Runway API 타겟 비율 (720p):', {
        selectedSize: size,
        parsedDimensions: `${width}x${height}`,
        isLandscape: isLandscape,
        targetRatio: targetRunwayRatio,
        targetDimensions: `${runwayTargetWidth}x${runwayTargetHeight}`,
        resolution: "720p",
        originalDimensions: `${metadata.width}x${metadata.height}`,
        originalRatio: (metadata.width / metadata.height).toFixed(3)
      });

      // 원본 이미지 크기와 비율에 무관하게 정확한 Runway API 비율로 강제 변환
      const resizedImageBuffer = await image
        .resize(runwayTargetWidth, runwayTargetHeight, {
          fit: 'contain', // 이미지가 확대되지 않고 전체가 보이도록
          background: { r: 0, g: 0, b: 0, alpha: 1 } // 배경을 검은색으로 채움
        })
        .jpeg({ quality: 80 }) // 품질은 80% 유지
        .toBuffer();

      console.log('🔄 이미지 리사이즈 (강제 비율 변환):', {
        originalDimensions: `${metadata.width}x${metadata.height}`,
        targetDimensions: `${runwayTargetWidth}x${runwayTargetHeight}`,
        fitMode: 'contain',
        background: 'black',
        quality: '80% JPEG',
        finalRatio: (runwayTargetWidth / runwayTargetHeight).toFixed(3),
        guaranteedOutput: `${size === "16:9" ? "16:9" : "9:16"} 비율 보장`
      });

      console.log('📦 리사이즈된 이미지 정보:', {
        originalSize: `${(imageBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`,
        resizedSize: `${(resizedImageBuffer.length / 1024 / 1024).toFixed(2)} MB`,
        compressionRatio: `${((1 - resizedImageBuffer.length / imageBuffer.byteLength) * 100).toFixed(1)}%`,
        dimensions: `${runwayTargetWidth}x${runwayTargetHeight}`,
        quality: '80% JPEG'
      });
      
      const base64Image = resizedImageBuffer.toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64Image}`;
      
      console.log('📤 Base64 변환 완료:', {
        base64Length: base64Image.length,
        dataUrlLength: dataUrl.length,
        estimatedTransferSize: `${(dataUrl.length / 1024).toFixed(2)} KB`,
        isUnder5MB: dataUrl.length < 5 * 1024 * 1024 ? '✅' : '❌'
      });

      console.log('Runway 모델 호출 시작:', { 
        prompt: prompt,
        originalRatio: (metadata.width || 1) / (metadata.height || 1),
        resizedRatio: runwayTargetWidth / runwayTargetHeight,
        dimensions: `${runwayTargetWidth}x${runwayTargetHeight}`,
        model: "gen4_turbo",
        ratio: size === "16:9" ? "1280:720" : "720:1280",
        duration: seconds
      });

      // Runway API 호출
      const requestBody: any = {
        promptImage: dataUrl,
        model: "gen4_turbo",  // gen4_turbo 사용
        ratio: targetRunwayRatio,  // 계산된 targetRunwayRatio 사용
        position: "first",
        seed: Math.floor(Math.random() * 4294967295),
        contentModeration: {
          publicFigureThreshold: "low"
        }
      };
      
      // promptText가 있으면 추가
      if (prompt && prompt.trim()) {
        requestBody.promptText = prompt;
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
        userSelectedRatio: isLandscape ? "16:9" : "9:16",
        actualRequestRatio: targetRunwayRatio,
        actualRequestDimensions: targetRunwayRatio === "1280:720" ? "1280x720" : "720x1280"
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
                  requestedRatio: size === "16:9" ? "16:9" : "9:16",
                  requestedDimensions: size === "16:9" ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: '배열 형태'
                });
                break;
              } else if (resultData.output && resultData.output.video) {
                videoUrl = resultData.output.video;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: size === "16:9" ? "16:9" : "9:16",
                  requestedDimensions: size === "16:9" ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: 'output.video 형태'
                });
                break;
              } else if (resultData.output && typeof resultData.output === 'string') {
                videoUrl = resultData.output;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: size === "16:9" ? "16:9" : "9:16",
                  requestedDimensions: size === "16:9" ? "1280:720" : "720:1280",
                  videoUrl: videoUrl,
                  actualOutput: '문자열 형태'
                });
                break;
              } else if (resultData.video) {
                videoUrl = resultData.video;
                console.log('✅ Runway 영상 생성 완료:', {
                  requestedRatio: size === "16:9" ? "16:9" : "9:16",
                  requestedDimensions: size === "16:9" ? "1280:720" : "720:1280",
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

      // 사용량 증가
      await incrementVideoUsage(user.id);

      return NextResponse.json({ 
        url: videoUrl,
        usage: await checkVideoGenerationLimit(user.id)
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