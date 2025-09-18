import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { checkUsageLimit, incrementUsage } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { user } = auth;
    const body = await request.json().catch(() => ({}));
    const serviceType = String(body?.serviceType || '').trim();

    if (!serviceType) {
      return NextResponse.json({ error: 'serviceType이 필요합니다.' }, { status: 400 });
    }

    const check = await checkUsageLimit(user.id, serviceType);
    if (!check.allowed) {
      return NextResponse.json({
        error: '사용량 한도에 도달했습니다.',
        currentUsage: check.limit - check.remaining,
        maxLimit: check.limit,
        resetDate: check.resetDate,
      }, { status: 429 });
    }

    await incrementUsage(user.id, serviceType);
    const updated = await checkUsageLimit(user.id, serviceType);

    return NextResponse.json({
      usage: {
        current: updated.limit - updated.remaining,
        limit: updated.limit,
        remaining: updated.remaining,
      }
    });
  } catch (error) {
    console.error('usage/increment 오류:', error);
    return NextResponse.json({ error: '사용량 증가 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}


