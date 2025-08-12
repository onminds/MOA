import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 SQL Server 데이터베이스 연결 확인 중...");

    // SQL Server 연결 테스트
    const sql = require('mssql');
    const config = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'moa_plus',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'your_password',
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };

    await sql.connect(config);
    console.log("✅ SQL Server 연결 성공");
    await sql.close();

    return NextResponse.json({ 
      success: true, 
      message: "SQL Server 데이터베이스 연결 확인 완료",
      note: "Prisma에서 SQL Server로 마이그레이션 완료"
    });

  } catch (error) {
    console.error("❌ 데이터베이스 연결 오류:", error);
    return NextResponse.json({ 
      error: "데이터베이스 연결 실패" 
    }, { status: 500 });
  }
} 