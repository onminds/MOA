import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { planId, planName, amount } = await request.json();
    
    // 임시로 create-order API와 동일한 로직 사용
    const orderId = `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return NextResponse.json({
      orderId,
      orderName: `${planName} (정기결제)`,
      amount,
      billingCycle: 'monthly'
    });

  } catch (error) {
    console.error('카드 등록 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
