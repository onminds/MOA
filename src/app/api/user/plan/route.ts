import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const db = await getConnection();
    
    // 사용자 플랜 정보 조회 (payments 테이블에서 최신 결제 내역의 plan_type 사용)
    const result = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT TOP 1 plan_type 
        FROM payments 
        WHERE user_id = @userId 
          AND status = 'completed'
        ORDER BY created_at DESC
      `);

    // 결제 내역이 없으면 기본값 'basic' 사용
    const planType = result.recordset.length > 0 ? result.recordset[0].plan_type : 'basic';
    
    // 플랜 정보 매핑
    const planInfo = {
      basic: {
        name: 'Basic Plan',
        displayName: 'Basic',
        color: 'from-blue-400 to-blue-600',
        features: ['월 2회 이미지 생성', '월 1회 영상 생성', '기본 AI 도구 사용', '커뮤니티 읽기', '이메일 지원']
      },
      standard: {
        name: 'Standard Plan',
        displayName: 'Standard',
        color: 'from-yellow-400 to-orange-500',
        features: ['월 120회 이미지 생성', '월 20회 영상 생성', '모든 AI 도구 사용', '우선 고객 지원', '고급 분석 기능', '커뮤니티 글쓰기', '광고 제거']
      },
      pro: {
        name: 'Pro Plan',
        displayName: 'Pro',
        color: 'from-purple-400 to-pink-500',
        features: ['월 300회 이미지 생성', '월 45회 영상 생성', '모든 AI 도구 사용', 'API 접근', '전용 고객 지원', '팀 관리 기능', '고급 분석 대시보드', '맞춤형 통합']
      }
    };

    return NextResponse.json({
      planType: planType,
      planInfo: planInfo[planType as keyof typeof planInfo] || planInfo.basic
    });

  } catch (error) {
    console.error('플랜 정보 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증되지 않은 사용자입니다.' }, { status: 401 });
    }

    const { planType } = await request.json();
    
    if (!planType || !['basic', 'standard', 'pro'].includes(planType)) {
      return NextResponse.json({ error: '유효하지 않은 플랜 타입입니다.' }, { status: 400 });
    }

    const db = await getConnection();
    
    // Basic 플랜으로 전환하는 경우 새로운 결제 레코드 생성 (무료)
    if (planType === 'basic') {
      await db.request()
        .input('userId', session.user.id)
        .input('planType', planType)
        .input('amount', 0)
        .input('status', 'completed')
        .query(`
          INSERT INTO payments (
            user_id, plan_type, amount, status, created_at, updated_at
          )
          VALUES (
            @userId, @planType, @amount, @status, GETDATE(), GETDATE()
          )
        `);
    } else {
      // 유료 플랜의 경우 기존 로직 유지 (정기결제는 별도 API에서 처리)
      return NextResponse.json({ 
        error: '유료 플랜은 정기결제를 통해 구독해야 합니다.' 
      }, { status: 400 });
    }

    console.log('플랜 전환 완료:', { userId: session.user.id, planType });

    return NextResponse.json({
      success: true,
      message: '플랜이 성공적으로 전환되었습니다.',
      planType: planType
    });

  } catch (error) {
    console.error('플랜 전환 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
} 