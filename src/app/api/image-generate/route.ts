import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { requireAuth } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const prisma = new PrismaClient();

// 사용자 플랜별 이미지 생성 제한 확인
async function checkImageGenerationLimit(userId: string) {
  // 사용자 정보와 결제 내역 확인
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      payments: {
        where: { status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (!user) {
    return { allowed: false, error: '사용자를 찾을 수 없습니다.' };
  }

  // 현재 사용량 확인
  const usage = await prisma.usage.findUnique({
    where: {
      userId_serviceType: {
        userId,
        serviceType: 'image-generate'
      }
    }
  });

  let maxLimit = 2; // 기본 (로그인만)
  let planType = 'basic';
  
  // 최근 결제 내역이 있으면 플랜에 따라 제한 설정
  if (user.payments.length > 0) {
    const latestPayment = user.payments[0];
    planType = latestPayment.planType;
    
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

  const currentUsage = usage?.usageCount || 0;
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
  await prisma.usage.upsert({
    where: {
      userId_serviceType: {
        userId,
        serviceType: 'image-generate'
      }
    },
    update: {
      usageCount: {
        increment: 1
      }
    },
    create: {
      userId,
      serviceType: 'image-generate',
      usageCount: 1,
      limitCount: 2, // 기본값
      resetDate: new Date()
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    // 새로운 사용량 제한 체크
    const usageCheck = await checkImageGenerationLimit(user.id);
    if (!usageCheck.allowed) {
      return NextResponse.json({ 
        error: usageCheck.error,
        usage: usageCheck
      }, { status: 429 });
    }

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const ratio = formData.get('ratio') as string;
    const referenceImage = formData.get('referenceImage') as File | null;

    if (!prompt) {
      return NextResponse.json({ error: '프롬프트가 필요합니다.' }, { status: 400 });
    }

    console.log('이미지 생성 요청:', { prompt, ratio, hasReferenceImage: !!referenceImage, userId: user.id });

    // 비율에 따른 크기 설정
    const size = ratio === "1:1" ? "1024x1024" : "1792x1024";

    let response;

    // 참고 이미지가 있는 경우 스타일 분석 후 프롬프트에 추가
    if (referenceImage) {
      // 파일 크기 검증 (4MB = 4 * 1024 * 1024 bytes)
      if (referenceImage.size > 4 * 1024 * 1024) {
        return NextResponse.json({ error: '이미지 크기는 4MB 이하여야 합니다.' }, { status: 400 });
      }

      // 프롬프트 로깅 (디버깅용)
      console.log('참고 이미지와 함께 사용된 프롬프트:', prompt);

      // 이미지 분석을 통한 스타일 추출
      let styleDescription = "";
      try {
        const imageBuffer = await referenceImage.arrayBuffer();
        const imageInfo = await sharp(Buffer.from(imageBuffer)).metadata();
        
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
        if (referenceImage.size > 2 * 1024 * 1024) {
          styleDescription += "고해상도 고품질, ";
        }
        
        styleDescription += "참고 이미지와 동일한 아트 스타일, 색상 팔레트, 조명, 브러시 스타일, 질감, 분위기로";
      } catch (error) {
        console.error('이미지 분석 오류:', error);
        styleDescription = "참고 이미지와 동일한 아트 스타일, 색상 팔레트, 조명, 구도, 브러시 스타일, 질감, 분위기로";
      }

      // 참고 이미지의 스타일을 프롬프트에 추가
      const enhancedPrompt = `${prompt}, ${styleDescription} 생성해주세요. 참고 이미지의 모든 시각적 요소를 그대로 유지하면서`;

      console.log('향상된 프롬프트:', enhancedPrompt);

      // 일반 이미지 생성 (참고 이미지 스타일을 프롬프트에 반영)
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: size,
      });
    } else {
      // 일반 이미지 생성
      console.log('일반 프롬프트로 이미지 생성:', prompt);
      
      response = await openai.images.generate({
        model: "dall-e-3",
        prompt: prompt,
        n: 1,
        size: size,
      });
    }

    if (response.data && response.data[0] && response.data[0].url) {
      console.log('이미지 생성 성공:', response.data[0].url);
      
      // 사용량 증가
      await incrementImageUsage(user.id);
      
      // 업데이트된 사용량 정보 반환
      const updatedUsage = await checkImageGenerationLimit(user.id);
      
      return NextResponse.json({ 
        url: response.data[0].url,
        usage: updatedUsage
      });
    } else {
      console.error('이미지 생성 응답 오류:', response);
      return NextResponse.json({ error: '이미지 생성에 실패했습니다.' }, { status: 500 });
    }
  } catch (error) {
    console.error('이미지 생성 오류:', error);
    
    // OpenAI API 에러 처리
    if (error instanceof Error) {
      if (error.message.includes('insufficient_quota')) {
        return NextResponse.json({ error: 'OpenAI API 할당량이 부족합니다.' }, { status: 500 });
      }
      if (error.message.includes('content_policy_violation')) {
        return NextResponse.json({ error: '프롬프트가 정책에 위반됩니다. 다른 설명을 시도해주세요.' }, { status: 400 });
      }
    }
    
    return NextResponse.json({ error: '이미지 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 