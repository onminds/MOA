import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  let orderId: string | undefined;
  
  try {
    console.log('=== 빌링키 발급 API 시작 ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('인증되지 않은 사용자');
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    console.log('사용자 인증 확인됨:', session.user.id);

    const { billingAuthKey, orderId: reqOrderId, amount, planId, customerKey } = await request.json();
    orderId = reqOrderId;
    
    console.log('빌링키 발급 요청 받음:', { billingAuthKey, orderId, amount, planId, customerKey });
    console.log('토스페이먼츠 공식 문서 기반: 빌링키 생성 API를 사용합니다.');
    console.log('⚠️ 주의: 테스트 환경에서 빌링 기능이 제대로 설정되어 있는지 확인이 필요합니다.');
    console.log('토스페이먼츠 대시보드에서 빌링 사용 계약 상태를 확인해주세요.');

    if (!billingAuthKey || !orderId || !amount || !planId || !customerKey) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    // 1. 토스페이먼츠 빌링키 발급 API 호출 (공식 문서 기반)
    console.log('=== 환경 변수 디버깅 ===');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('TOSS_SECRET_KEY 설정 여부:', !!process.env.TOSS_SECRET_KEY);
    console.log('TOSS_SECRET_KEY 길이:', process.env.TOSS_SECRET_KEY?.length || 0);
    console.log('TOSS_SECRET_KEY 접두사:', process.env.TOSS_SECRET_KEY?.substring(0, 10) || 'N/A');
    console.log('TOSS_SECRET_KEY 전체:', process.env.TOSS_SECRET_KEY || 'N/A');
    console.log('=== 토스페이먼츠 API 호출 준비 ===');
    console.log('토스페이먼츠 빌링키 발급 API 호출 준비:', {
      apiKey: process.env.TOSS_SECRET_KEY ? '설정됨' : '설정되지 않음',
      apiKeyLength: process.env.TOSS_SECRET_KEY?.length || 0,
      apiKeyPrefix: process.env.TOSS_SECRET_KEY?.substring(0, 10) || 'N/A',
      apiUrl: 'https://api.tosspayments.com/v1/billing/authorizations/issue'
    });
    
    // API Key 형식 검증 (토스페이먼츠 실제 형식)
    const expectedLength = 36; // 토스페이먼츠 Secret Key 실제 길이
    if (!process.env.TOSS_SECRET_KEY || process.env.TOSS_SECRET_KEY.length !== expectedLength) {
      console.error('🚨 API Key 형식 오류: 토스페이먼츠 형식에 맞지 않습니다.');
      console.error('🚨 예상 형식: test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (36자)');
      console.error('🚨 현재 길이:', process.env.TOSS_SECRET_KEY?.length || 0);
      console.error('🚨 현재 설정된 API Key:', process.env.TOSS_SECRET_KEY || 'N/A');
      console.error('🚨 토스페이먼츠 대시보드에서 Secret Key를 다시 확인해주세요.');
      return NextResponse.json({ 
        error: 'API Key 형식이 올바르지 않습니다. 토스페이먼츠 대시보드에서 올바른 Secret Key를 확인해주세요.',
        details: {
          expectedLength: expectedLength,
          currentLength: process.env.TOSS_SECRET_KEY?.length || 0,
          currentPrefix: process.env.TOSS_SECRET_KEY?.substring(0, 10) || 'N/A',
          currentKey: process.env.TOSS_SECRET_KEY || 'N/A'
        }
      }, { status: 400 });
    }
    
    // Basic 인증 헤더 생성 (토스페이먼츠 공식 문서 기반)
    const secretKey = process.env.TOSS_SECRET_KEY;
    const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');
    
    // 빌링키 발급 요청 - 토스페이먼츠 공식 문서에 맞춘 파라미터
    const requestBody = {
      authKey: billingAuthKey, // 토스페이먼츠에서 전달받은 authKey
      customerKey: customerKey
    };
    
    console.log('토스페이먼츠 빌링키 발급 API 요청 본문:', requestBody);
    
    const response = await fetch('https://api.tosspayments.com/v1/billing/authorizations/issue', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    
    console.log('토스페이먼츠 빌링키 발급 API 응답:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      result: result
    });

    if (response.ok && result.billingKey) {
      // 빌링키 발급 성공
      console.log('토스페이먼츠 빌링키 발급 성공:', {
        billingKey: result.billingKey,
        orderId,
        amount,
        result: result
      });
      
      const db = await getConnection();

      // 2. 빌링키 정보를 subscriptions 테이블에 저장
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const nextBillingDate = new Date();
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      await db.request()
        .input('userId', session.user.id)
        .input('subscriptionId', subscriptionId)
        .input('billingKey', result.billingKey)
        .input('customerKey', customerKey)
        .input('planType', planId)
        .input('amount', amount)
        .input('status', 'active')
        .input('nextBillingDate', nextBillingDate)
        .input('autoRenewal', true)
        .query(`
          INSERT INTO subscriptions (
            user_id, subscription_id, billing_key, customer_key, plan_type, 
            amount, status, subscription_start_date, next_billing_date, 
            auto_renewal, created_at, updated_at
          ) VALUES (
            @userId, @subscriptionId, @billingKey, @customerKey, @planType,
            @amount, @status, GETDATE(), @nextBillingDate,
            @autoRenewal, GETDATE(), GETDATE()
          )
        `);

      console.log('구독 정보 저장 완료:', {
        subscriptionId,
        billingKey: result.billingKey,
        planId,
        status: 'active',
        nextBillingDate: nextBillingDate.toISOString()
      });

      // 3. payments 테이블 상태를 completed로 업데이트
      await db.request()
        .input('orderId', orderId)
        .input('billingKey', result.billingKey)
        .input('subscriptionId', subscriptionId)
        .input('status', 'completed')
        .input('paymentMethod', 'card')
        .query(`
          UPDATE payments 
          SET billing_key = @billingKey,
              status = @status,
              payment_method = @paymentMethod,
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);

      console.log('결제 정보 업데이트 완료');

      // 4. users 테이블은 plan_type 컬럼이 없으므로 payments 테이블만 업데이트
      console.log('사용자 플랜 정보는 payments 테이블에서 관리됩니다.');

      return NextResponse.json({
        success: true,
        message: '빌링키가 성공적으로 발급되었습니다.',
        billingKey: result.billingKey,
        subscriptionId: subscriptionId,
        nextBillingDate: nextBillingDate.toISOString()
      });

    } else {
      // 빌링키 발급 실패
      console.error('토스페이먼츠 빌링키 생성 실패:', {
        status: response.status,
        statusText: response.statusText,
        result: result,
        requestBody: requestBody
      });
      
      // payments 테이블 상태를 failed로 업데이트
      const db = await getConnection();
      await db.request()
        .input('orderId', orderId)
        .input('errorMessage', result.message || '빌링키 발급 실패')
        .input('status', 'failed')
        .query(`
          UPDATE payments 
          SET status = @status,
              error_message = @errorMessage,
              updated_at = GETDATE()
          WHERE transaction_id = @orderId
        `);

      // API Key 오류인 경우 특별한 안내 추가
      if (result.errorCode === 'COMMON_INVALID_API_KEY') {
        console.error('🚨 API Key 오류: 토스페이먼츠 대시보드에서 올바른 Secret Key를 확인해주세요.');
        console.error('🚨 테스트 환경: test_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (36자)');
        console.error('🚨 운영 환경: live_sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx (36자)');
        console.error('🚨 현재 설정된 API Key 길이:', process.env.TOSS_SECRET_KEY?.length || 0);
      }
      
      return NextResponse.json({
        success: false,
        error: result.msg || '빌링키 생성에 실패했습니다.',
        code: result.errorCode || 'UNKNOWN_ERROR',
        details: {
          status: response.status,
          statusText: response.statusText,
          response: result,
          apiKeyInfo: {
            isSet: !!process.env.TOSS_SECRET_KEY,
            length: process.env.TOSS_SECRET_KEY?.length || 0,
            prefix: process.env.TOSS_SECRET_KEY?.substring(0, 7) || 'N/A'
          }
        }
      }, { status: 400 });

    }

  } catch (error) {
    console.error('빌링키 발급 API 오류:', error);
    
    // 에러 발생 시 payments 테이블 상태를 failed로 업데이트
    try {
      if (orderId) {
        const db = await getConnection();
        await db.request()
          .input('orderId', orderId)
          .input('errorMessage', error instanceof Error ? error.message : '알 수 없는 오류')
          .input('status', 'failed')
          .query(`
            UPDATE payments 
            SET status = @status,
                error_message = @errorMessage,
                updated_at = GETDATE()
            WHERE transaction_id = @orderId
          `);
      }
    } catch (updateError) {
      console.error('결제 상태 업데이트 실패:', updateError);
    }

    return NextResponse.json({ 
      error: '서버 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : '알 수 없는 오류'
    }, { status: 500 });
  }
}
