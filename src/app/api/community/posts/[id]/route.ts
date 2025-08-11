export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const id = params.id;
  let user_id: number | null = null;
  try {
    const auth = await requireAuth();
    if (!('error' in auth)) user_id = auth.user.id;
  } catch {}

  if (!id) return NextResponse.json({ error: 'id 파라미터 누락' }, { status: 400 });

  try {
    const db = await getConnection();
    // 게시글 + 좋아요/댓글 수
    const postResult = await db.request()
      .input('id', Number(id))
      .query(`
        SELECT p.id, p.title, p.content, p.created_at, u.display_name AS author, c.name AS category, p.author_id,
          (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
          (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.is_deleted = 0) AS comment_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN categories c ON p.category_id = c.id
        WHERE p.id = @id AND p.is_deleted = 0
      `);
    if (!postResult.recordset[0]) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
    }
    // 댓글 목록 (author_id 포함)
    const commentsResult = await db.request()
      .input('id', Number(id))
      .query(`
        SELECT cm.id, cm.content, cm.created_at, u.display_name AS author, cm.author_id
        FROM comments cm
        JOIN users u ON cm.author_id = u.id
        WHERE cm.post_id = @id AND cm.is_deleted = 0
        ORDER BY cm.created_at ASC
      `);
    // 내가 좋아요를 눌렀는지
    let liked = false;
    if (user_id) {
      const likedResult = await db.request()
        .input('user_id', user_id)
        .input('post_id', Number(id))
        .query('SELECT id FROM likes WHERE user_id = @user_id AND post_id = @post_id');
      liked = likedResult.recordset.length > 0;
    }
    const post = postResult.recordset[0];
    post.comments = commentsResult.recordset;
    post.liked = liked;
    return NextResponse.json(post);
  } catch (e) {
    console.error('게시글 상세 조회 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
} 