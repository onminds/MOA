import { NextResponse } from "next/server";
<<<<<<< HEAD
import { getConnection } from "@/lib/db";
=======
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

export async function POST() {
  try {
    console.log("🔄 데이터베이스 마이그레이션 시작...");
    
    // 데이터베이스 연결 테스트
<<<<<<< HEAD
    const db = await getConnection();
    console.log("✅ 데이터베이스 연결 성공");
    
    // 기본 쿼리 테스트
    await db.request().query(`SELECT 1`);
=======
    await prisma.$connect();
    console.log("✅ 데이터베이스 연결 성공");
    
    // Prisma db push를 사용해서 스키마 동기화
    await prisma.$executeRaw`SELECT 1`;
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
    console.log("✅ 기본 쿼리 테스트 성공");
    
    // 테이블 생성 확인
    try {
<<<<<<< HEAD
      const userCountResult = await db.request().query(`SELECT COUNT(*) as count FROM users`);
      const userCount = userCountResult.recordset[0].count;
=======
      const userCount = await prisma.user.count();
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      console.log(`📊 현재 사용자 수: ${userCount}`);
    } catch (error) {
      console.log("⚠️ 사용자 테이블이 없습니다. 스키마 적용이 필요합니다.");
    }
    
    console.log("✅ 데이터베이스 마이그레이션 완료");
    
    return NextResponse.json({ 
      success: true, 
      message: "데이터베이스 마이그레이션 완료",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ 마이그레이션 오류:", error);
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      message: "마이그레이션 실패"
    }, { status: 500 });
<<<<<<< HEAD
=======
  } finally {
    await prisma.$disconnect();
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
  }
} 