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
    
    // 조회수 증가 (게시글을 볼 때마다 증가)
    db.request()
      .input('id', Number(id))
      .query('UPDATE posts SET view_count = ISNULL(view_count, 0) + 1 WHERE id = @id')
      .catch(error => console.error('조회수 증가 오류:', error));
    
         // 게시글 + 좋아요/댓글 수 + 조회수 + 이미지 개수
     const postResult = await db.request()
       .input('id', Number(id))
       .query(`
         SELECT p.id, p.title, p.content, p.created_at, p.updated_at, u.display_name AS author, c.name AS category, p.author_id,
           ISNULL(p.view_count, 0) AS view_count,
           ISNULL(p.image_count, 0) AS image_count,
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
    // 댓글 목록 (대댓글 포함, author_id 포함)
    const commentsResult = await db.request()
      .input('id', Number(id))
      .query(`
        SELECT 
          cm.id, 
          cm.content, 
          cm.created_at, 
          u.display_name AS author, 
          cm.author_id,
          cm.parent_id,
          CASE 
            WHEN cm.parent_id IS NOT NULL THEN 
              (SELECT u2.display_name FROM comments c2 JOIN users u2 ON c2.author_id = u2.id WHERE c2.id = cm.parent_id)
            ELSE NULL 
          END AS parent_author
        FROM comments cm
        JOIN users u ON cm.author_id = u.id
        WHERE cm.post_id = @id AND cm.is_deleted = 0
        ORDER BY 
          COALESCE(cm.parent_id, cm.id) ASC,
          cm.parent_id ASC,
          cm.created_at ASC
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
    
    // 이미지 목록 조회
    const imagesResult = await db.request()
      .input('id', Number(id))
      .query(`
        SELECT id, file_name, original_name, file_size, mime_type, width, height, created_at
        FROM post_images
        WHERE post_id = @id AND is_deleted = 0
        ORDER BY created_at ASC
      `);
    
    post.images = imagesResult.recordset;
    return NextResponse.json(post);
  } catch (e) {
    console.error('게시글 상세 조회 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// 게시글 업데이트 (PUT)
export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { requireAuth } = await import('@/lib/auth');
    const auth = await requireAuth();
    if ('error' in auth) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const params = await context.params;
    const id = params.id;
    const { title, content, category_id, skipUpdatedAt } = await req.json();

    const db = await getConnection();
    
    // 게시글 존재 및 권한 확인
    const postResult = await db.request()
      .input('id', Number(id))
      .input('userId', auth.user.id)
      .query(`
        SELECT p.id, p.author_id, u.role
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = @id AND p.is_deleted = 0
      `);

    if (postResult.recordset.length === 0) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    }

    const post = postResult.recordset[0];
    
    // 작성자 또는 관리자만 수정 가능
    if (post.author_id !== auth.user.id && post.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // 카테고리 권한 확인 (공지 카테고리는 ADMIN만 수정 가능)
    if (category_id) {
      const categoryResult = await db.request()
        .input('categoryId', category_id)
        .query(`
          SELECT name 
          FROM categories 
          WHERE id = @categoryId
        `);

      if (categoryResult.recordset.length > 0) {
        const categoryName = categoryResult.recordset[0].name;
        if (categoryName === '공지' && post.role !== 'ADMIN') {
          return NextResponse.json({ error: '공지 게시글은 관리자만 수정할 수 있습니다' }, { status: 403 });
        }
      }
    }

    // 게시글 업데이트 (title, content, category_id 모두 지원)
    const updateFields = [];
    const inputs = [];
    
    if (title !== undefined) {
      updateFields.push('title = @title');
      inputs.push(['title', title]);
    }
    if (content !== undefined) {
      updateFields.push('content = @content');
      inputs.push(['content', content]);
    }
    if (category_id !== undefined) {
      updateFields.push('category_id = @category_id');
      inputs.push(['category_id', category_id]);
    }
    
    // skipUpdatedAt이 true가 아닐 때만 updated_at 업데이트
    if (!skipUpdatedAt) {
      updateFields.push('updated_at = GETDATE()');
    }

    if (updateFields.length > 0) { // updated_at가 포함되지 않을 수 있으므로 0보다 커야 함
      const request = db.request().input('id', Number(id));
      
      inputs.forEach(([key, value]) => {
        request.input(key, value);
      });

      await request.query(`
        UPDATE posts 
        SET ${updateFields.join(', ')}
        WHERE id = @id
      `);
    }

    // content가 업데이트된 경우, 사용되지 않는 이미지들을 삭제 처리
    if (content !== undefined) {
      // content에서 사용되는 이미지 ID들을 추출
      const imageIdMatches = content.match(/!\[([^\]]*)\]\((\d+)\)/g);
      const usedImageIds = new Set<number>();
      
      if (imageIdMatches) {
        imageIdMatches.forEach((match: string) => {
          const imageIdMatch = match.match(/!\[([^\]]*)\]\((\d+)\)/);
          if (imageIdMatch) {
            usedImageIds.add(parseInt(imageIdMatch[2]));
          }
        });
      }

      // 사용되지 않는 이미지들을 is_deleted = 1로 업데이트
      if (usedImageIds.size > 0) {
        const usedImageIdsArray = Array.from(usedImageIds);
        const placeholders = usedImageIdsArray.map((_, index) => `@imageId${index}`).join(',');
        
        const request = db.request().input('postId', Number(id));
        usedImageIdsArray.forEach((imageId, index) => {
          request.input(`imageId${index}`, imageId);
        });

        await request.query(`
          UPDATE post_images 
          SET is_deleted = 1 
          WHERE post_id = @postId 
          AND id NOT IN (${placeholders})
          AND is_deleted = 0
        `);
      } else {
        // content에 이미지가 없으면 모든 이미지를 삭제 처리
        await db.request()
          .input('postId', Number(id))
          .query(`
            UPDATE post_images 
            SET is_deleted = 1 
            WHERE post_id = @postId 
            AND is_deleted = 0
          `);
      }
    }

    return NextResponse.json({ success: true, message: '게시글이 업데이트되었습니다' });

  } catch (e) {
    console.error('게시글 업데이트 오류:', e);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
} 