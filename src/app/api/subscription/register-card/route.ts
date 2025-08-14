import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 카드 등록 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { planId, planName, amount } = await request.json();
    console.log('받은 데이터:', { planId, planName, amount });

    // 플랜 정보 검증
    const planInfo = {
      basic: { name: 'Basic Plan', amount: 0 },
      standard: { name: 'Standard Plan', amount: 15900 },
      pro: { name: 'Pro Plan', amount: 29000 }
    };

    const plan = planInfo[planId as keyof typeof planInfo];
    if (!plan || plan.amount !== amount) {
      return NextResponse.json({ error: '잘못된 플랜 정보입니다.' }, { status: 400 });
    }

    const db = await getConnection();
    
    // 고유한 customerKey 생성
    const customerKey = uuidv4();
    
    // 빌링키 발급을 위한 URL 생성
    const successUrl = `${process.env.NEXTAUTH_URL}/subscription/success?customerKey=${customerKey}`;
    const failUrl = `${process.env.NEXTAUTH_URL}/subscription/fail`;

    // 임시로 customerKey 저장 (나중에 빌링키와 함께 업데이트)
    await db.request()
      .input('userId', session.user.id)
      .input('customerKey', customerKey)
      .input('planType', planId)
      .input('amount', amount)
      .query(`
        INSERT INTO billing_keys (user_id, customer_key, billing_key, card_info, is_active)
        VALUES (@userId, @customerKey, 'temp', 'temp', 0)
      `);

    return NextResponse.json({
      success: true,
      customerKey,
      successUrl,
      failUrl,
      planInfo: {
        planId,
        planName: plan.name,
        amount
      }
    });

  } catch (error) {
    console.error('카드 등록 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 