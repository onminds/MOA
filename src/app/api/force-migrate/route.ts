import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log("🔄 강제 데이터베이스 마이그레이션 시작...");
    
    // 데이터베이스 연결
    await prisma.$connect();
    console.log("✅ 데이터베이스 연결 성공");
    
    // 테이블 생성 SQL 직접 실행
    const createTables = `
      -- Users 테이블
      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "password" TEXT,
        "name" TEXT,
        "image" TEXT,
        "role" TEXT DEFAULT 'USER',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Accounts 테이블 (NextAuth)
      CREATE TABLE IF NOT EXISTS "accounts" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        UNIQUE("provider", "providerAccountId")
      );

      -- Sessions 테이블 (NextAuth)
      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" TEXT PRIMARY KEY,
        "sessionToken" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );

      -- Usage 테이블
      CREATE TABLE IF NOT EXISTS "usage" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "serviceType" TEXT NOT NULL,
        "usageCount" INTEGER DEFAULT 0,
        "limitCount" INTEGER DEFAULT 10,
        "resetDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        UNIQUE("userId", "serviceType")
      );

      -- Payments 테이블
      CREATE TABLE IF NOT EXISTS "payments" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "amount" INTEGER NOT NULL,
        "creditsAdded" INTEGER NOT NULL,
        "paymentMethod" TEXT NOT NULL,
        "status" TEXT DEFAULT 'pending',
        "transactionId" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      );

      -- Verification tokens 테이블 (NextAuth)
      CREATE TABLE IF NOT EXISTS "verification_tokens" (
        "identifier" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        UNIQUE("identifier", "token")
      );
    `;

    // SQL 실행
    await prisma.$executeRawUnsafe(createTables);
    console.log("✅ 모든 테이블 생성 완료");

    // 테이블 확인
    const userCount = await prisma.user.count().catch(() => 0);
    console.log(`📊 사용자 수: ${userCount}`);

    return NextResponse.json({ 
      success: true, 
      message: "강제 마이그레이션 완료",
      userCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ 강제 마이그레이션 오류:", error);
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      message: "강제 마이그레이션 실패"
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
} 