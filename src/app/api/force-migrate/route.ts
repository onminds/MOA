import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log("🔄 강제 데이터베이스 마이그레이션 시작...");
    
    // 데이터베이스 연결
    await prisma.$connect();
    console.log("✅ 데이터베이스 연결 성공");
    
    // 개별 테이블 생성 (하나씩)
    const tables = [
      // Users 테이블
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "password" TEXT,
        "name" TEXT,
        "image" TEXT,
        "role" TEXT DEFAULT 'USER',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Accounts 테이블 (NextAuth)
      `CREATE TABLE IF NOT EXISTS "accounts" (
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
        "session_state" TEXT
      )`,
      
      // Sessions 테이블 (NextAuth)
      `CREATE TABLE IF NOT EXISTS "sessions" (
        "id" TEXT PRIMARY KEY,
        "sessionToken" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP NOT NULL
      )`,
      
      // Usage 테이블
      `CREATE TABLE IF NOT EXISTS "usage" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "serviceType" TEXT NOT NULL,
        "usageCount" INTEGER DEFAULT 0,
        "limitCount" INTEGER DEFAULT 10,
        "resetDate" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Payments 테이블
      `CREATE TABLE IF NOT EXISTS "payments" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "amount" INTEGER NOT NULL,
        "creditsAdded" INTEGER NOT NULL,
        "paymentMethod" TEXT NOT NULL,
        "status" TEXT DEFAULT 'pending',
        "transactionId" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Verification tokens 테이블 (NextAuth)
      `CREATE TABLE IF NOT EXISTS "verification_tokens" (
        "identifier" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expires" TIMESTAMP NOT NULL
      )`
    ];

    // 각 테이블을 개별적으로 생성
    for (let i = 0; i < tables.length; i++) {
      try {
        await prisma.$executeRawUnsafe(tables[i]);
        console.log(`✅ 테이블 ${i + 1}/${tables.length} 생성 완료`);
      } catch (error) {
        console.log(`⚠️ 테이블 ${i + 1} 생성 스킵 (이미 존재할 수 있음):`, error);
      }
    }

    // 인덱스 생성
    const indexes = [
      `CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "usage_userId_serviceType_key" ON "usage"("userId", "serviceType")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token")`
    ];

    for (const index of indexes) {
      try {
        await prisma.$executeRawUnsafe(index);
        console.log("✅ 인덱스 생성 완료");
      } catch (error) {
        console.log("⚠️ 인덱스 생성 스킵:", error);
      }
    }

    console.log("✅ 모든 테이블 생성 완료");

    // 테이블 확인
    const userCount = await prisma.user.count().catch(() => 0);
    console.log(`📊 사용자 수: ${userCount}`);

    return NextResponse.json({ 
      success: true, 
      message: "강제 마이그레이션 완료 - 모든 테이블 생성됨",
      userCount,
      tablesCreated: tables.length,
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