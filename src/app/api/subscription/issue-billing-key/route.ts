import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('=== 빌링키 발급 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { authKey, customerKey } = await request.json();
    console.log('받은 데이터:', { authKey, customerKey });

    // 토스페이먼츠 API 호출하여 빌링키 발급
    const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        authKey,
        customerKey
      })
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 API 응답:', {
      status: response.status,
      ok: response.ok,
      result: result
    });

    if (response.ok && result.billingKey) {
      // 빌링키 발급 성공
      const db = await getConnection();
      
      // 빌링키 정보 업데이트
      await db.request()
        .input('customerKey', customerKey)
        .input('billingKey', result.billingKey)
        .input('cardInfo', JSON.stringify(result.card || {}))
        .input('isActive', 1)
        .query(`
          UPDATE billing_keys 
          SET billing_key = @billingKey, 
              card_info = @cardInfo, 
              is_active = @isActive,
              updated_at = GETDATE()
          WHERE customer_key = @customerKey
        `);

      console.log('빌링키 발급 완료:', {
        customerKey,
        billingKey: result.billingKey
      });

      return NextResponse.json({
        success: true,
        billingKey: result.billingKey,
        card: result.card
      });
    } else {
      // 빌링키 발급 실패
      console.log('빌링키 발급 실패:', {
        responseStatus: response.status,
        result: result
      });

      return NextResponse.json({
        success: false,
        message: '빌링키 발급에 실패했습니다.',
        error: result.message || '알 수 없는 오류'
      }, { status: 400 });
    }

  } catch (error) {
    console.error('빌링키 발급 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 