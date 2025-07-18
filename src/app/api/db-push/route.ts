import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log("🔄 Prisma DB Push 실행 중...");
    
    // Prisma db push 실행
    const { stdout, stderr } = await execAsync("npx prisma db push --accept-data-loss");
    
    console.log("✅ Prisma DB Push 성공");
    console.log("stdout:", stdout);
    if (stderr) console.log("stderr:", stderr);
    
    return NextResponse.json({ 
      success: true, 
      message: "데이터베이스 스키마 적용 완료",
      stdout,
      stderr
    });
  } catch (error) {
    console.error("❌ DB Push 오류:", error);
    return NextResponse.json({ 
      success: false, 
      error: String(error),
      message: "스키마 적용 실패"
    }, { status: 500 });
  }
} 