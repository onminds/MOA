import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const prisma = new PrismaClient();

// 플랜별 영상 생성 제한
const VIDEO_LIMITS = {
  basic: 1,
  standard: 20,
  pro: 45,
};

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const userId = session.user.id;

    // 사용자의 플랜 정보 조회
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        payments: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1
        } 
      },
    });

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    const planType = user.payments.length > 0 ? user.payments[0].planType : 'basic';
    const limit = VIDEO_LIMITS[planType as keyof typeof VIDEO_LIMITS];

    // 관리자는 무제한으로 설정 (결제 내역이 없는 경우에만)
    let actualLimit = limit;
    if (user.role === 'ADMIN' && user.payments.length === 0) {
      actualLimit = 9999;
    }

    // 현재 사용량 확인
    const currentUsage = await prisma.usage.findUnique({
      where: {
        userId_serviceType: {
          userId: userId,
          serviceType: 'video-generate',
        },
      },
    });

    const usageCount = currentUsage?.usageCount || 0;

    console.log(`영상 생성 요청 - 사용자: ${user.email}, 역할: ${user.role}, 플랜: ${planType}, 사용량: ${usageCount}/${actualLimit}`);

    if (usageCount >= actualLimit) {
      console.log(`사용량 초과 - 현재: ${usageCount}, 제한: ${actualLimit}`);
      return NextResponse.json({ 
        error: `영상 생성 한도(${actualLimit}회)를 초과했습니다. 플랜을 업그레이드해주세요.`,
        usageCount,
        limit: actualLimit
      }, { status: 429 });
    }

    console.log(`사용량 확인 통과 - 현재: ${usageCount}, 제한: ${actualLimit}, 남은 횟수: ${actualLimit - usageCount}`);

    const formData = await request.formData();
    const prompt = formData.get('prompt') as string;
    const duration = formData.get('duration') as string;
    const aspectRatio = formData.get('aspectRatio') as string;
    const referenceImage = formData.get('referenceImage') as File | null;

    if (!referenceImage) {
      return NextResponse.json({ error: '참고 이미지가 필요합니다.' }, { status: 400 });
    }

    // Runway API 설정
    const RUNWAY_API_KEY = process.env.RUNWAY_API_KEY;
    const RUNWAY_API_URL = 'https://api.dev.runwayml.com/v1/image_to_video';

    if (!RUNWAY_API_KEY) {
      return NextResponse.json({ error: 'Runway API 키가 설정되지 않았습니다.' }, { status: 500 });
    }

    // 비율 매핑 (gen4_turbo 지원 해상도)
    const ratioMapping: { [key: string]: string } = {
      "16:9": "1280:720",
      "9:16": "720:1280"
    };

    const selectedRatio = ratioMapping[aspectRatio || "16:9"];

    // 이미지 처리 및 검증
    const imageBuffer = await referenceImage.arrayBuffer();
    
    // Sharp를 사용하여 이미지 처리
    let processedImageBuffer: Buffer;
    try {
      const image = sharp(Buffer.from(imageBuffer));
      const metadata = await image.metadata();
      
      // 이미지 크기 제한 (Runway API 요구사항에 맞게)
      const maxSize = 1024;
      let processedImage = image;
      
      if (metadata.width && metadata.height) {
        // 비율에 따라 크기 조정
        if (aspectRatio === "16:9") {
          processedImage = image.resize(maxSize, Math.round(maxSize * 9 / 16), {
            fit: 'cover',
            position: 'center'
          });
        } else if (aspectRatio === "9:16") {
          processedImage = image.resize(Math.round(maxSize * 9 / 16), maxSize, {
            fit: 'cover',
            position: 'center'
          });
        } else {
          processedImage = image.resize(maxSize, maxSize, {
            fit: 'cover',
            position: 'center'
          });
        }
      }
      
      // JPEG 형식으로 변환 (Runway API가 더 잘 지원하는 형식)
      processedImageBuffer = await processedImage
        .jpeg({ quality: 90 })
        .toBuffer();
        
    } catch (imageError) {
      console.error('이미지 처리 오류:', imageError);
      return NextResponse.json({ error: '이미지 처리 중 오류가 발생했습니다.' }, { status: 400 });
    }

    // 처리된 이미지를 base64로 변환
    const base64Image = processedImageBuffer.toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    // 영상 생성 파라미터 설정 (Runway API 문서에 맞게)
    const videoParams: {
      promptImage: string;
      model: string;
      ratio: string;
      duration: number;
      seed: number;
      promptText?: string;
    } = {
      promptImage: dataUri,
      model: "gen4_turbo",
      ratio: selectedRatio,
      duration: parseInt(duration),
      seed: Math.floor(Math.random() * 1000000)
    };

    // 프롬프트가 있는 경우 추가
    if (prompt) {
      videoParams.promptText = prompt;
    }

    console.log('Runway API 요청 파라미터:', JSON.stringify({
      ...videoParams,
      promptImage: dataUri.substring(0, 100) + '...' // 로그에서 전체 base64 숨김
    }, null, 2));

    // Runway API 호출
    const response = await fetch(RUNWAY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RUNWAY_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06'
      },
      body: JSON.stringify(videoParams),
    });

    console.log('Runway API 응답 상태:', response.status);
    console.log('Runway API 응답 헤더:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Runway API 오류:', errorData);
      return NextResponse.json({ error: `영상 생성에 실패했습니다: ${errorData.error}` }, { status: 500 });
    }

    const data = await response.json();
    console.log('Runway API 응답 데이터:', data);
    
    // Runway는 생성 작업을 시작하고 ID를 반환
    if (data.id) {
      // 생성된 영상의 URL을 가져오기 위해 상태 확인
      const checkStatus = async (generationId: string) => {
        const statusResponse = await fetch(`https://api.dev.runwayml.com/v1/tasks/${generationId}`, {
          headers: {
            'Authorization': `Bearer ${RUNWAY_API_KEY}`,
            'X-Runway-Version': '2024-11-06'
          },
        });
        
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          console.log('상태 확인 응답:', statusData);
          if (statusData.status === 'SUCCEEDED' && statusData.output && Array.isArray(statusData.output)) {
            return statusData.output[0]; // 첫 번째 영상 반환
          } else if (statusData.status === 'FAILED') {
            throw new Error('영상 생성이 실패했습니다.');
          }
        }
        return null;
      };

      // 상태 확인을 위해 폴링 (최대 60초)
      let videoUrl = null;
      for (let i = 0; i < 60; i++) {
        videoUrl = await checkStatus(data.id);
        if (videoUrl) {
          console.log('영상 생성 완료:', videoUrl);
          break;
        }
        console.log(`폴링 시도 ${i + 1}/60`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
      }

      if (videoUrl) {
        // 사용량 증가
        if (currentUsage) {
          await prisma.usage.update({
            where: { id: currentUsage.id },
            data: { usageCount: usageCount + 1 },
          });
        } else {
          await prisma.usage.create({
            data: {
              userId: userId,
              serviceType: 'video-generate',
              usageCount: 1,
              limitCount: actualLimit,
            },
          });
        }

        return NextResponse.json({ 
          url: videoUrl,
          usageCount: usageCount + 1,
          limit: actualLimit
        });
      } else {
        return NextResponse.json({ error: '영상 생성 시간이 초과되었습니다.' }, { status: 408 });
      }
    } else {
      return NextResponse.json({ error: '영상 생성에 실패했습니다.' }, { status: 500 });
    }
  } catch (error) {
    console.error('영상 생성 오류:', error);
    return NextResponse.json({ error: '영상 생성 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 