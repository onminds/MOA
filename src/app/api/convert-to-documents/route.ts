import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(
      { message: 'PDF와 PPTX 생성은 모두 클라이언트에서 처리됩니다.' },
      { status: 200 }
    );
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { error: 'API 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}




