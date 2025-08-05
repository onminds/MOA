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
    const body = await req.json();
    const content = body.content;
    if (!content) return NextResponse.json({ error: '댓글 내용이 없습니다.' }, { status: 400 });
    const db = await getConnection();
    await db.request()
      .input('post_id', post_id)
      .input('author_id', user_id)
      .input('content', content)
      .query('INSERT INTO comments (post_id, author_id, content, created_at) VALUES (@post_id, @author_id, @content, GETDATE())');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('댓글 작성 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
} 