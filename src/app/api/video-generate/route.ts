import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
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

    // 이미지를 base64로 변환하여 data URI 형식으로 생성
    const imageBuffer = await referenceImage.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');
    const dataUri = `data:${referenceImage.type};base64,${base64Image}`;

    // 영상 생성 파라미터 설정 (Runway API 문서에 맞게)
    const videoParams: any = {
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

    console.log('Runway API 요청 파라미터:', JSON.stringify(videoParams, null, 2));

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
        return NextResponse.json({ url: videoUrl });
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