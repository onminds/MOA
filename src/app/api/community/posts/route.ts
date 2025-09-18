import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const sort = searchParams.get('sort') || 'latest';
    const exclude = searchParams.get('exclude'); // 특정 게시글 제외
    
    // 페이지네이션 계산
    const offset = (page - 1) * limit;
    
    const db = await getConnection();
    
    // WHERE 조건 구성
    let whereConditions = ['p.is_deleted = 0'];
    let params: any = {};
    
    if (category && category !== '전체') {
      whereConditions.push('c.name = @category');
      params.category = category;
    }
    
    if (search) {
      whereConditions.push('(p.title LIKE @search OR u.display_name LIKE @search)');
      params.search = `%${search}%`;
    }
    
    // 특정 게시글 제외
    if (exclude) {
      whereConditions.push('p.id != @exclude');
      params.exclude = parseInt(exclude);
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    // 정렬 조건
    let orderBy = 'p.created_at DESC';
    if (sort === 'popular') {
      orderBy = 'like_count DESC, p.created_at DESC';
    } else if (sort === 'views') {
      orderBy = 'p.view_count DESC, p.created_at DESC';
    }
    
    // 전체 게시글 수 조회
    const countQuery = `
      SELECT COUNT(*) as total
      FROM posts p
      JOIN users u ON p.author_id = u.id
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;
    
    const countResult = await db.request()
      .input('category', params.category)
      .input('search', params.search)
      .input('exclude', params.exclude)
      .query(countQuery);
    
    const total = countResult.recordset[0].total;
    
    // 게시글 목록 조회 (페이지네이션 적용)
    const postsQuery = `
      SELECT 
        p.id, p.title, p.content, p.created_at, p.updated_at,
        u.display_name AS author_name,
        p.author_id,
        c.name AS category_name,
        ISNULL(p.view_count, 0) AS view_count,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id AND cm.is_deleted = 0) AS comment_count,
        (SELECT COUNT(*) FROM post_images pi WHERE pi.post_id = p.id AND pi.is_deleted = 0) AS image_count,
        (SELECT TOP 1 pi.id FROM post_images pi WHERE pi.post_id = p.id AND pi.is_deleted = 0 ORDER BY pi.created_at ASC) AS first_image_id
      FROM posts p
      JOIN users u ON p.author_id = u.id
      JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY ${orderBy}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;
    
    const result = await db.request()
      .input('category', params.category)
      .input('search', params.search)
      .input('exclude', params.exclude)
      .input('offset', offset)
      .input('limit', limit)
      .query(postsQuery);
    
    return NextResponse.json({ 
      posts: result.recordset,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalPosts: total,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1
      }
    });
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
    
    // 사용자 role 확인
    const userResult = await db.request()
      .input('userId', session.user.id)
      .query(`
        SELECT role 
        FROM users 
        WHERE id = @userId
      `);

    if (userResult.recordset.length === 0) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    const userRole = userResult.recordset[0].role;
    
    // 공지 카테고리인지 확인
    const categoryResult = await db.request()
      .input('categoryId', category_id)
      .query(`
        SELECT name 
        FROM categories 
        WHERE id = @categoryId
      `);

    if (categoryResult.recordset.length === 0) {
      return NextResponse.json({ error: '카테고리를 찾을 수 없습니다' }, { status: 404 });
    }

    const categoryName = categoryResult.recordset[0].name;
    
    // ADMIN이 아니면 공지 카테고리로 글쓰기 금지
    if (categoryName === '공지' && userRole !== 'ADMIN') {
      return NextResponse.json({ error: '공지 게시글은 관리자만 작성할 수 있습니다' }, { status: 403 });
    }

    const result = await db.request()
      .input('title', title)
      .input('content', content)
      .input('author_id', session.user.id)
      .input('category_id', category_id)
      .query(`
        INSERT INTO posts (title, content, author_id, category_id, created_at, updated_at)
        OUTPUT INSERTED.id
        VALUES (@title, @content, @author_id, @category_id, GETDATE(), NULL)
      `);

    const postId = result.recordset[0].id;
    return NextResponse.json({ success: true, postId });
  } catch (err) {
    console.error('게시글 작성 오류:', err);
    return NextResponse.json({ error: 'DB 오류', detail: err }, { status: 500 });
  }
} 