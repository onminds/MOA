import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
<<<<<<< HEAD
import { getConnection } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

=======
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { user } = authResult;
    const formData = await request.formData();
    
    const name = formData.get('name') as string;
    const imageFile = formData.get('image') as File | null;

    // 이름 유효성 검사
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: '이름을 입력해주세요.' }, { status: 400 });
    }

    if (name.trim().length > 50) {
      return NextResponse.json({ error: '이름은 50자 이하여야 합니다.' }, { status: 400 });
    }

    let imageUrl = null;

    // 이미지 파일이 있는 경우 처리
    if (imageFile && imageFile.size > 0) {
      // 파일 크기 체크 (5MB 제한)
      if (imageFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: '이미지 파일 크기는 5MB 이하여야 합니다.' }, { status: 400 });
      }

      // 파일 타입 체크
      if (!imageFile.type.startsWith('image/')) {
        return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 });
      }

      try {
        // 업로드 디렉토리 생성
        const uploadDir = join(process.cwd(), 'public', 'uploads', 'profile');
        await mkdir(uploadDir, { recursive: true });

        // 파일명 생성
        const timestamp = Date.now();
        const extension = imageFile.name.split('.').pop() || 'jpg';
        const filename = `${user.id}_${timestamp}.${extension}`;
        const filepath = join(uploadDir, filename);

        // 파일을 ArrayBuffer로 변환
        const bytes = await imageFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // 파일 저장
        await writeFile(filepath, buffer);

        // URL 생성
        imageUrl = `/uploads/profile/${filename}`;
      } catch (error) {
        console.error('이미지 저장 오류:', error);
        return NextResponse.json({ error: '이미지 저장 중 오류가 발생했습니다.' }, { status: 500 });
      }
    }

<<<<<<< HEAD
    // DB 업데이트
    const db = await getConnection();
    
    // 카카오 사용자 ID 처리 (문자열을 BIGINT로 변환)
    const userId = typeof user.id === 'string' ? BigInt(user.id) : user.id;
    
    let updateQuery = 'UPDATE users SET display_name = @display_name';
    if (imageUrl) {
      updateQuery += ', avatar_url = @avatar_url';
    }
    updateQuery += ', updated_at = GETDATE() WHERE id = @id';
    
    const requestDb = db.request()
      .input('display_name', name.trim())
      .input('id', userId);
    if (imageUrl) {
      requestDb.input('avatar_url', imageUrl);
    }
    
    await requestDb.query(updateQuery);

    // 업데이트된 정보 반환
    const result = await db.request()
      .input('id', userId)
      .query('SELECT id, email, display_name, avatar_url, role FROM users WHERE id = @id');
    const updatedUser = result.recordset[0];

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.display_name, // 프론트엔드 호환을 위해 name으로 반환
        email: updatedUser.email,
        image: updatedUser.avatar_url,
        role: updatedUser.role
      },
=======
    // 사용자 정보 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name.trim(),
        ...(imageUrl && { image: imageUrl })
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      message: '프로필이 성공적으로 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    return NextResponse.json({ error: '프로필 업데이트 중 오류가 발생했습니다.' }, { status: 500 });
  }
} 