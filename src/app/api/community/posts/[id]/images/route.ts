import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import { getConnection } from '@/lib/db';

// 이미지 업로드 (POST)
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const params = await context.params;
    const postId = params.id;

    // 게시글 존재 및 권한 확인
    const db = await getConnection();
    const postResult = await db.request()
      .input('postId', Number(postId))
      .input('userId', session.user.id)
      .query(`
        SELECT p.id, p.author_id, u.role
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = @postId AND p.is_deleted = 0
      `);

    if (postResult.recordset.length === 0) {
      return NextResponse.json({ error: '게시글을 찾을 수 없습니다' }, { status: 404 });
    }

    const post = postResult.recordset[0];
    
    // 작성자 또는 관리자만 이미지 업로드 가능
    if (post.author_id !== session.user.id && post.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // FormData 파싱
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '업로드할 이미지가 없습니다' }, { status: 400 });
    }

    // 파일 개수 제한 (최대 10개)
    if (files.length > 10) {
      return NextResponse.json({ error: '최대 10개까지 업로드 가능합니다' }, { status: 400 });
    }

    const uploadedImages = [];

    for (const file of files) {
      // 파일 타입 검증
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다' }, { status: 400 });
      }

      // 파일 크기 제한 (10MB)
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 });
      }

      // 파일 데이터를 Buffer로 변환
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // 파일명 생성 (타임스탬프 + 원본명)
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${timestamp}_${file.name}`;

      // 이미지 정보 추출 (간단한 방식)
      let width = null, height = null;
      try {
        // 실제로는 sharp나 jimp 라이브러리를 사용해서 이미지 크기를 추출해야 함
        // 여기서는 임시로 null로 설정
      } catch (error) {
        console.log('이미지 크기 추출 실패:', error);
      }

             // DB에 이미지 저장
       await db.request()
         .input('postId', Number(postId))
         .input('fileName', fileName)
         .input('originalName', file.name)
         .input('fileData', buffer)
         .input('fileSize', file.size)
         .input('mimeType', file.type)
         .input('width', width)
         .input('height', height)
         .query(`
           INSERT INTO post_images (post_id, file_name, original_name, file_data, file_size, mime_type, width, height)
           VALUES (@postId, @fileName, @originalName, @fileData, @fileSize, @mimeType, @width, @height)
         `);

       // 방금 삽입된 이미지의 ID 가져오기
       const idResult = await db.request()
         .input('postId', Number(postId))
         .input('fileName', fileName)
         .query(`
           SELECT TOP 1 id 
           FROM post_images 
           WHERE post_id = @postId AND file_name = @fileName 
           ORDER BY created_at DESC
         `);

       const imageId = idResult.recordset[0].id;
      uploadedImages.push({
        id: imageId,
        fileName: fileName,
        originalName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        width: width,
        height: height
      });
    }

    return NextResponse.json({
      success: true,
      message: `${uploadedImages.length}개의 이미지가 업로드되었습니다`,
      images: uploadedImages
    });

  } catch (error) {
    console.error('이미지 업로드 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// 이미지 목록 조회 (GET)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const postId = params.id;

    const db = await getConnection();
    const result = await db.request()
      .input('postId', Number(postId))
      .query(`
        SELECT id, file_name, original_name, file_size, mime_type, width, height, created_at
        FROM post_images
        WHERE post_id = @postId AND is_deleted = 0
        ORDER BY created_at ASC
      `);

    return NextResponse.json({
      success: true,
      images: result.recordset
    });

  } catch (error) {
    console.error('이미지 목록 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
