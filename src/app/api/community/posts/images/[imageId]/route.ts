import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// 특정 이미지 조회 (GET)
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  try {
    const params = await context.params;
    const imageId = params.imageId;

    const db = await getConnection();
    const result = await db.request()
      .input('imageId', Number(imageId))
      .query(`
        SELECT file_data, mime_type, original_name
        FROM post_images
        WHERE id = @imageId AND is_deleted = 0
      `);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 });
    }

    const image = result.recordset[0];
    
    // 이미지 데이터를 Response로 반환
    // file_data가 Buffer인지 확인하고 적절히 처리
    let imageBuffer;
    if (Buffer.isBuffer(image.file_data)) {
      imageBuffer = image.file_data;
    } else if (typeof image.file_data === 'string') {
      // 문자열인 경우 Buffer로 변환
      imageBuffer = Buffer.from(image.file_data, 'binary');
    } else {
      // 기타 경우 (ArrayBuffer 등)
      imageBuffer = Buffer.from(image.file_data);
    }
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': image.mime_type,
        'Content-Disposition': `inline; filename="${encodeURIComponent(image.original_name)}"`,
        'Cache-Control': 'public, max-age=31536000' // 1년 캐시
      }
    });

  } catch (error) {
    console.error('이미지 조회 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}

// 이미지 삭제 (DELETE)
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  try {
    const { getServerSession } = await import('next-auth/next');
    const { authOptions } = await import('@/lib/authOptions');
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const params = await context.params;
    const imageId = params.imageId;

    const db = await getConnection();
    
    // 이미지 정보 및 권한 확인
    const imageResult = await db.request()
      .input('imageId', Number(imageId))
      .input('userId', session.user.id)
      .query(`
        SELECT pi.id, pi.post_id, p.author_id, u.role
        FROM post_images pi
        JOIN posts p ON pi.post_id = p.id
        JOIN users u ON p.author_id = u.id
        WHERE pi.id = @imageId AND pi.is_deleted = 0
      `);

    if (imageResult.recordset.length === 0) {
      return NextResponse.json({ error: '이미지를 찾을 수 없습니다' }, { status: 404 });
    }

    const image = imageResult.recordset[0];
    
    // 작성자 또는 관리자만 삭제 가능
    if (image.author_id !== session.user.id && image.role !== 'ADMIN') {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    // 이미지 삭제 (소프트 삭제)
    await db.request()
      .input('imageId', Number(imageId))
      .query(`
        UPDATE post_images 
        SET is_deleted = 1, updated_at = GETDATE()
        WHERE id = @imageId
      `);

    return NextResponse.json({
      success: true,
      message: '이미지가 삭제되었습니다'
    });

  } catch (error) {
    console.error('이미지 삭제 오류:', error);
    return NextResponse.json({ error: '서버 오류' }, { status: 500 });
  }
}
