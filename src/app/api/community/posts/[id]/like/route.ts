import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const post_id = Number(params.id);
  try {
    const auth = await requireAuth();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user_id = auth.user.id;
    const db = await getConnection();
    // 이미 좋아요가 있으면 중복 저장 방지
    const exists = await db.request()
      .input('user_id', user_id)
      .input('post_id', post_id)
      .query('SELECT id FROM likes WHERE user_id = @user_id AND post_id = @post_id');
    if (exists.recordset.length > 0) {
      return NextResponse.json({ success: false, message: '이미 좋아요를 눌렀습니다.' }, { status: 200 });
    }
    await db.request()
      .input('user_id', user_id)
      .input('post_id', post_id)
      .query('INSERT INTO likes (user_id, post_id, created_at) VALUES (@user_id, @post_id, GETDATE())');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('좋아요 추가 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const post_id = Number(params.id);
  const auth = await requireAuth();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user_id = auth.user.id;
  try {
    const db = await getConnection();
    await db.request()
      .input('user_id', user_id)
      .input('post_id', post_id)
      .query('DELETE FROM likes WHERE user_id = @user_id AND post_id = @post_id');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('좋아요 삭제 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
} 