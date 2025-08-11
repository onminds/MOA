import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;

    // 사용자의 이미지 생성 히스토리 조회
    const db = await getConnection();
    const result = await db.request()
      .input('userId', user.id)
      .query(`
        SELECT 
          id,
          prompt,
          generated_image_url,
          model,
          size,
          style,
          quality,
          created_at,
          cost,
          status
        FROM image_generation_history 
        WHERE user_id = @userId 
        ORDER BY created_at DESC
      `);

    const history = result.recordset.map(item => ({
      id: item.id,
      prompt: item.prompt,
      imageUrl: item.generated_image_url,
      model: item.model,
      size: item.size,
      style: item.style,
      quality: item.quality,
      createdAt: item.created_at,
      cost: item.cost,
      status: item.status
    }));

    return NextResponse.json({ 
      success: true,
      history,
      totalCount: history.length
    });

  } catch (error) {
    console.error('이미지 히스토리 조회 오류:', error);
    return NextResponse.json({ 
      error: '이미지 히스토리를 조회하는 중 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
