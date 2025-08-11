import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호는 필수입니다." },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "올바른 이메일 형식이 아닙니다." },
        { status: 400 }
      );
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return NextResponse.json(
        { error: "비밀번호는 최소 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }

    // 기존 사용자 확인
    const db = await getConnection();
    const existingUserResult = await db.request()
      .input('email', email)
      .query('SELECT id FROM users WHERE email = @email AND is_active = 1');

    if (existingUserResult.recordset.length > 0) {
      return NextResponse.json(
        { error: "이미 가입된 이메일입니다." },
        { status: 400 }
      );
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 12);

    // 사용자 생성
    const userResult = await db.request()
      .input('email', email)
      .input('username', email)
      .input('display_name', name || email.split('@')[0])
      .input('password_hash', hashedPassword)
      .input('role', 'USER')
      .query(`
        INSERT INTO users (email, username, display_name, password_hash, role, is_active, created_at, updated_at)
        VALUES (@email, @username, @display_name, @password_hash, @role, 1, GETDATE(), GETDATE());
        SELECT SCOPE_IDENTITY() as id;
      `);

    const userId = userResult.recordset[0].id;

    // 기본 사용량 설정
    await db.request()
      .input('userId', userId)
      .input('serviceType', 'image-generate')
      .input('limitCount', 2)
      .input('usageCount', 0)
      .query(`
        INSERT INTO usage (user_id, service_type, limit_count, usage_count, created_at, updated_at)
        VALUES (@userId, @serviceType, @limitCount, @usageCount, GETDATE(), GETDATE())
      `);

    await db.request()
      .input('userId', userId)
      .input('serviceType', 'video-generate')
      .input('limitCount', 1)
      .input('usageCount', 0)
      .query(`
        INSERT INTO usage (user_id, service_type, limit_count, usage_count, created_at, updated_at)
        VALUES (@userId, @serviceType, @limitCount, @usageCount, GETDATE(), GETDATE())
      `);

    return NextResponse.json(
      { message: "회원가입이 완료되었습니다.", userId: userId },
      { status: 201 }
    );
  } catch (error) {
    console.error("회원가입 오류:", error);
    return NextResponse.json(
      { error: "회원가입 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
} 