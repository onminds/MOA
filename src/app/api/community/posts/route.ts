import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET() {
  try {
    const db = await getConnection();
    const result = await db.request().query(`
      SELECT TOP 10
        p.id, p.title, p.content, p.created_at,
        u.display_name AS author_name,
        p.author_id,
        c.name AS category_name,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.is_deleted = 0) AS comment_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_deleted = 0
      ORDER BY p.created_at DESC
    `);
    return NextResponse.json({ posts: result.recordset });
  } catch (err) {
    console.error('게시글 목록 조회 오류:', err);
    return NextResponse.json({ error: 'DB 오류', detail: err }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content, category_id } = body;

    if (!title || !content || !category_id) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 });
    }

    const db = await getConnection();
    await db.request()
      .input('title', title)
      .input('content', content)
      .input('author_id', session.user.id)
      .input('category_id', category_id)
      .query(`
        INSERT INTO posts (title, content, author_id, category_id, created_at, updated_at)
        VALUES (@title, @content, @author_id, @category_id, GETDATE(), GETDATE())
      `);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('게시글 작성 오류:', err);
    return NextResponse.json({ error: 'DB 오류', detail: err }, { status: 500 });
  }
} 