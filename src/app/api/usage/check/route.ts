import { NextRequest, NextResponse } from "next/server";
import { requireAuth, checkUsageLimit } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const { searchParams } = new URL(request.url);
    const serviceType = searchParams.get('serviceType');

    if (!serviceType) {
      return NextResponse.json({ error: '서비스 타입이 필요합니다.' }, { status: 400 });
    }

    // 사용량 정보 확인
    const usageInfo = await checkUsageLimit(user.id, serviceType);

    return NextResponse.json(usageInfo);
  } catch (error) {
    console.error('사용량 확인 오류:', error);
    return NextResponse.json({ error: '사용량 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 