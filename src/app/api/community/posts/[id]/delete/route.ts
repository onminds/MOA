import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const post_id = Number(params.id);
  const auth = await requireAuth();
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user_id = auth.user.id;
  const user_role = auth.user.role;
  
  try {
    const db = await getConnection();
    // 본인 게시글 또는 관리자 권한인지 확인
    const result = await db.request()
      .input('id', post_id)
      .query('SELECT author_id FROM posts WHERE id = @id AND is_deleted = 0');
    if (!result.recordset[0]) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }
    const author_id = result.recordset[0].author_id;
    
    // 타입을 통일하여 비교
    if (String(author_id) !== String(user_id) && user_role !== 'ADMIN') {
      return NextResponse.json({ error: '본인 또는 관리자만 삭제할 수 있습니다.' }, { status: 403 });
    }
    await db.request()
      .input('id', post_id)
      .query('UPDATE posts SET is_deleted = 1 WHERE id = @id');
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('게시글 삭제 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
} 