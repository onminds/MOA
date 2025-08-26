import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'popular'; // popular, views, comments
    const limit = parseInt(searchParams.get('limit') || '5');
    
    const db = await getConnection();
    
    let query = '';
    let orderBy = '';
    
    switch (type) {
      case 'popular':
        orderBy = 'like_count DESC, p.created_at DESC';
        break;
      case 'views':
        orderBy = 'p.view_count DESC, p.created_at DESC';
        break;
      case 'comments':
        orderBy = 'comment_count DESC, p.created_at DESC';
        break;
      default:
        orderBy = 'like_count DESC, p.created_at DESC';
    }
    
    // 최근 24시간 내 게시글 중 Best 조회
    query = `
      SELECT TOP ${limit}
        p.id, p.title, p.content, p.created_at, p.updated_at,
        u.display_name AS author_name,
        p.author_id,
        c.name AS category_name,
        ISNULL(p.view_count, 0) AS view_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.is_deleted = 0) AS comment_count,
        (SELECT TOP 1 pi.id FROM post_images pi WHERE pi.post_id = p.id AND pi.is_deleted = 0 ORDER BY pi.created_at ASC) AS first_image_id
      FROM posts p
      JOIN users u ON p.author_id = u.id
      JOIN categories c ON p.category_id = c.id
      WHERE p.is_deleted = 0 
        AND p.created_at >= DATEADD(hour, -24, GETDATE())
      ORDER BY ${orderBy}
    `;
    
    const result = await db.request().query(query);
    
    return NextResponse.json({ 
      posts: result.recordset,
      type: type,
      limit: limit
    });
  } catch (err) {
    console.error('실시간 Best 조회 오류:', err);
    return NextResponse.json({ error: 'DB 오류', detail: err }, { status: 500 });
  }
}
