import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 결제 확인 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { paymentKey, orderId, amount, planId } = await request.json();
    
    console.log('결제 확인 요청 받음:', { paymentKey, orderId, amount, planId });

    // 1. 토스페이먼츠 API 호출하여 결제 검증
    console.log('토스페이먼츠 API 호출 준비:', {
      secretKey: process.env.TOSS_SECRET_KEY ? '설정됨' : '설정되지 않음',
      secretKeyLength: process.env.TOSS_SECRET_KEY?.length || 0
    });
    
    const response = await fetch(`https://api.tosspayments.com/v1/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        paymentKey: paymentKey,
        orderId: orderId,
        amount: amount
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.status === 'DONE') {
      // 결제 성공
      console.log('토스페이먼츠 결제 성공:', {
        paymentKey,
        orderId,
        amount,
        planId,
        result: result
      });
      
      const db = await getConnection();

      // 2. DB 업데이트 (한 번에 모든 정보 업데이트)
      await db.request()
        .input('transactionId', orderId)
        .input('paymentKey', paymentKey)
        .input('status', 'completed')
        .input('paymentMethod', result.method || 'card')
        .input('planType', planId)
        .query(`
          UPDATE payments 
          SET receipt_id = @paymentKey, 
              status = @status, 
              payment_method = @paymentMethod, 
              plan_type = @planType,
              updated_at = GETDATE()
          WHERE transaction_id = @transactionId
        `);

      console.log('결제 정보 업데이트 완료:', {
        orderId,
        planId,
        status: 'completed'
      });

      // 4. 사용자 플랜은 payments 테이블의 plan_type으로 관리하므로 users 테이블 업데이트 불필요

      return NextResponse.json({
        success: true,
        message: '결제가 완료되었습니다.',
        planType: planId
      });
    } else {
      // 결제 실패
      console.log('토스페이먼츠 결제 실패:', {
        responseStatus: response.status,
        result: result
      });
      
      const db = await getConnection();
      await db.request()
        .input('transactionId', orderId)
        .input('status', 'failed')
        .query(`
          UPDATE payments 
          SET status = @status, updated_at = GETDATE()
          WHERE transaction_id = @transactionId
        `);

      return NextResponse.json({
        success: false,
        message: '결제에 실패했습니다.',
        error: result.message || '알 수 없는 오류'
      });
    }

  } catch (error) {
    console.error('결제 확인 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 