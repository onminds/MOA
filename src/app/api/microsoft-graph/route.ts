import { NextRequest, NextResponse } from 'next/server';

interface MicrosoftGraphSlide {
  slideNumber: number;
  text: string;
  images: string[];
  slideType: 'text' | 'image' | 'mixed';
}

interface SlidesResponse {
  success: boolean;
  slides?: MicrosoftGraphSlide[];
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const accessToken = formData.get('accessToken') as string;
    
    if (!file) {
      return NextResponse.json({ error: '파일이 제공되지 않았습니다.' }, { status: 400 });
    }

    if (!accessToken) {
      return NextResponse.json({ error: 'Microsoft Graph 액세스 토큰이 필요합니다.' }, { status: 400 });
    }

    console.log('Microsoft Graph API 호출됨');
    console.log('파일명:', file.name, '크기:', file.size, 'bytes');
    
    const fileName = file.name.toLowerCase();
    const isPPTX = fileName.endsWith('.pptx');
    
    if (!isPPTX) {
      return NextResponse.json({ error: 'PPTX 파일만 지원됩니다.' }, { status: 400 });
    }

    try {
      // 1. 파일을 OneDrive에 업로드
      const uploadResponse = await uploadToOneDrive(file, accessToken);
      
      if (!uploadResponse.success) {
        throw new Error('파일 업로드 실패');
      }
      
      const fileId = uploadResponse.fileId;
      console.log('📤 파일 업로드 완료, ID:', fileId);
      
      // 2. PowerPoint 슬라이드 정보 가져오기
      const slidesResponse = await getPowerPointSlides(fileId, accessToken);
      
      if (!slidesResponse.success) {
        throw new Error('슬라이드 정보 가져오기 실패');
      }
      
      // slides가 undefined일 수 있는 상황 처리
      const slides = slidesResponse.slides || [];
      console.log('📊 슬라이드 정보 가져오기 완료:', slides.length, '슬라이드');
      
      return NextResponse.json({
        success: true,
        totalSlides: slides.length,
        slides: slides,
        environment: process.env.VERCEL === '1' ? 'Vercel' : '호스트'
      });
      
    } catch (graphError) {
      console.error('❌ Microsoft Graph API 실패:', graphError);
      return NextResponse.json(
        { error: 'Microsoft Graph API 처리에 실패했습니다.' },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('API 처리 중 오류:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// OneDrive에 파일 업로드
async function uploadToOneDrive(file: File, accessToken: string) {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    
    const response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/' + file.name + ':/content', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      },
      body: buffer
    });
    
    if (!response.ok) {
      throw new Error(`업로드 실패: ${response.status}`);
    }
    
    const result = await response.json();
    return {
      success: true,
      fileId: result.id
    };
    
  } catch (error) {
    console.error('OneDrive 업로드 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
}

// PowerPoint 슬라이드 정보 가져오기
async function getPowerPointSlides(fileId: string, accessToken: string): Promise<SlidesResponse> {
  try {
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/workbook/worksheets`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`슬라이드 정보 가져오기 실패: ${response.status}`);
    }
    
    const result = await response.json();
    const slides: MicrosoftGraphSlide[] = [];
    
    // 슬라이드 정보 파싱
    if (result.value && Array.isArray(result.value)) {
      for (let i = 0; i < result.value.length; i++) {
        const slide = result.value[i];
        
        slides.push({
          slideNumber: i + 1,
          text: slide.name || `슬라이드 ${i + 1}`,
          images: [], // Microsoft Graph API에서는 이미지 정보를 직접 제공하지 않음
          slideType: 'text'
        });
      }
    }
    
    return {
      success: true,
      slides: slides
    };
    
  } catch (error) {
    console.error('슬라이드 정보 가져오기 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류'
    };
  }
} 