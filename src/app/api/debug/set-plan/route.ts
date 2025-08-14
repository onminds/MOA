import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." }, 
        { status: 401 }
      );
    }

    const { planType } = await request.json();

    if (!planType || !['basic', 'standard', 'pro'].includes(planType)) {
      return NextResponse.json(
        { error: "올바른 플랜 타입을 선택해주세요. (basic, standard, pro)" }, 
        { status: 400 }
      );
    }

    const db = await getConnection();

    const currentUserResult = await db.request().query(`
      SELECT * FROM users WHERE email = '${session.user.email}'
    `);

    if (currentUserResult.recordset.length === 0) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." }, 
        { status: 404 }
      );
    }

    const currentUser = currentUserResult.recordset[0];

    // 기존 결제 내역 확인
    const existingPaymentResult = await db.request()
      .input('userId', currentUser.id)
      .query(`
        SELECT TOP 1 id, plan_type, subscription_status 
        FROM payments 
        WHERE user_id = @userId 
          AND status = 'completed'
        ORDER BY created_at DESC
      `);

    if (existingPaymentResult.recordset.length > 0) {
      const existingPayment = existingPaymentResult.recordset[0];
      
      // 활성 구독이 있는 경우 취소 처리
      if (existingPayment.subscription_status === 'active') {
        await db.request()
          .input('paymentId', existingPayment.id)
          .query(`
            UPDATE payments 
            SET subscription_status = 'canceled',
                canceled_at = GETDATE(),
                auto_renewal = 0,
                updated_at = GETDATE()
            WHERE id = @paymentId
          `);
      }
    }

    // 새로운 결제 내역 생성 (디버그용 플랜 변경)
    const amount = planType === 'basic' ? 0 : (planType === 'standard' ? 15900 : 29000);
    
    await db.request()
      .input('userId', currentUser.id)
      .input('planType', planType)
      .input('amount', amount)
      .input('status', 'completed')
      .input('paymentMethod', 'debug_manual')
      .query(`
        INSERT INTO payments (
          user_id, plan_type, amount, status, payment_method, created_at, updated_at
        )
        VALUES (
          @userId, @planType, @amount, @status, @paymentMethod, GETDATE(), GETDATE()
        )
      `);

    console.log('디버그 플랜 변경 완료:', { 
      userId: currentUser.id, 
      email: session.user.email, 
      planType, 
      amount 
    });

    return NextResponse.json({
      success: true,
      message: `플랜이 ${planType}으로 변경되었습니다.`,
      planType: planType,
      amount: amount
    });

  } catch (error) {
    console.error('디버그 플랜 변경 오류:', error);
    return NextResponse.json(
      { error: "플랜 변경 중 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
} 