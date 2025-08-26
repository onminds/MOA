import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest, context: { params: Promise<{ id: string, commentId: string }> }) {
  const params = await context.params;
  const post_id = Number(params.id);
  const parent_comment_id = Number(params.commentId);
  
  try {
    const auth = await requireAuth();
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const user_id = auth.user.id;
    
    const body = await req.json();
    const content = body.content;
    
    if (!content) return NextResponse.json({ error: '대댓글 내용이 없습니다.' }, { status: 400 });
    
    const db = await getConnection();
    
    // 부모 댓글이 존재하는지 확인
    const parentCommentResult = await db.request()
      .input('comment_id', parent_comment_id)
      .input('post_id', post_id)
      .query('SELECT id FROM comments WHERE id = @comment_id AND post_id = @post_id AND is_deleted = 0');
    
    if (!parentCommentResult.recordset[0]) {
      return NextResponse.json({ error: '부모 댓글을 찾을 수 없습니다.' }, { status: 404 });
    }
    
    // 대댓글 삽입
    await db.request()
      .input('post_id', post_id)
      .input('author_id', user_id)
      .input('content', content)
      .input('parent_id', parent_comment_id)
      .query('INSERT INTO comments (post_id, author_id, content, parent_id, created_at) VALUES (@post_id, @author_id, @content, @parent_id, GETDATE())');
    
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('대댓글 작성 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
