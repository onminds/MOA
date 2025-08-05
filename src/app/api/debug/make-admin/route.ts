import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import { getConnection } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." }, 
        { status: 401 }
      );
    }

    const db = await getConnection();

    // 현재 로그인한 사용자를 관리자로 만들기
    const currentUserResult = await db.request().query(`
      SELECT * FROM users WHERE email = '${session.user.email}'
    `);

    if (currentUserResult.recordset.length === 0) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." }, 
        { status: 404 }
      );
    }

    const currentUser = currentUserResult.recordset[0];

    if (currentUser.role === 'ADMIN') {
      return NextResponse.json({
        message: "이미 관리자 권한을 가지고 있습니다.",
        user: currentUser
      });
    }

    // 관리자로 업데이트
    const updatedUserResult = await db.request().query(`
      UPDATE users 
      SET role = 'ADMIN' 
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role
      WHERE email = '${session.user.email}'
    `);

    const updatedUser = updatedUserResult.recordset[0];

    return NextResponse.json({
      message: "관리자 권한이 설정되었습니다. 페이지를 새로고침하세요.",
      user: updatedUser
    });

  } catch (error) {
    console.error("관리자 설정 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." }, 
      { status: 500 }
    );
  }
} 