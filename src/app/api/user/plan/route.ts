import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const db = await getConnection();
    
    // 사용자 정보와 최신 결제 내역 조회
    const userResult = await db.request()
      .input('email', session.user.email)
      .query(`
        SELECT u.id, u.email, u.display_name, p.plan_type
        FROM users u
        LEFT JOIN (
          SELECT user_id, plan_type, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
          FROM payments 
          WHERE status = 'completed'
        ) p ON u.id = p.user_id AND p.rn = 1
        WHERE u.email = @email AND u.is_active = 1
      `);

    if (userResult.recordset.length === 0) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const user = userResult.recordset[0];
    const planType = user.plan_type || 'basic';

    // 플랜 정보 매핑
    const planInfo = {
      basic: {
        name: 'Basic Plan',
        displayName: 'Basic',
        color: 'from-blue-400 to-blue-600',
        features: [
          '월 2회 이미지 생성',
          '월 1회 영상 생성',
          '기본 AI 도구 사용',
          '커뮤니티 읽기',
          '이메일 지원'
        ]
      },
      standard: {
        name: 'Standard Plan',
        displayName: 'Standard',
        color: 'from-yellow-400 to-orange-500',
        features: [
          '월 120회 이미지 생성',
          '월 20회 영상 생성',
          '모든 AI 도구 사용',
          '우선 고객 지원',
          '고급 분석 기능',
          '커뮤니티 글쓰기',
          '광고 제거'
        ]
      },
      pro: {
        name: 'Pro Plan',
        displayName: 'Pro',
        color: 'from-purple-400 to-pink-500',
        features: [
          '월 300회 이미지 생성',
          '월 45회 영상 생성',
          '모든 AI 도구 사용',
          'API 접근',
          '전용 고객 지원',
          '팀 관리 기능',
          '고급 분석 대시보드',
          '맞춤형 통합'
        ]
      }
    };

    return NextResponse.json({
      planType,
      planInfo: planInfo[planType as keyof typeof planInfo] || planInfo.basic
    });

  } catch (error) {
    console.error('플랜 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '플랜 정보 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
} 