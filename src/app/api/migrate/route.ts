import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  try {
    // 데이터베이스 연결 테스트
    await prisma.$connect();
    
    // 테이블이 존재하는지 확인하고 없으면 생성
    await prisma.$executeRaw`CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY)`;
    
    console.log("✅ 데이터베이스 마이그레이션 완료");
    
    return NextResponse.json({ 
      success: true, 
      message: "데이터베이스 마이그레이션 완료" 
    });
  } catch (error) {
    console.error("❌ 마이그레이션 오류:", error);
    return NextResponse.json({ 
      success: false, 
      error: String(error)
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 