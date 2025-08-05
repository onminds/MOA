import { NextRequest, NextResponse } from "next/server";
<<<<<<< HEAD
import { getConnection } from "@/lib/db";
import bcrypt from "bcryptjs";

=======
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
export async function POST(request: NextRequest) {
  try {
    const adminEmail = "admin@moa.com";
    const adminPassword = "admin123";

<<<<<<< HEAD
    const db = await getConnection();

    // 이미 관리자 계정이 있는지 확인
    const existingAdminResult = await db.request().query(`
      SELECT * FROM users WHERE email = '${adminEmail}'
    `);

    if (existingAdminResult.recordset.length > 0) {
=======
    // 이미 관리자 계정이 있는지 확인
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b
      return NextResponse.json({
        message: "관리자 계정이 이미 존재합니다.",
        email: adminEmail,
        password: adminPassword
      });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // 관리자 계정 생성
<<<<<<< HEAD
    const adminResult = await db.request().query(`
      INSERT INTO users (email, password, name, role, createdAt)
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.name, INSERTED.role
      VALUES ('${adminEmail}', '${hashedPassword}', '관리자', 'ADMIN', GETDATE())
    `);

    const admin = adminResult.recordset[0];

    // 관리자 기본 사용량 설정
    await db.request().query(`
      INSERT INTO usage (userId, serviceType, usageCount, limitCount, resetDate)
      VALUES 
        ('${admin.id}', 'image', 0, 9999, DATEADD(week, 1, GETDATE())),
        ('${admin.id}', 'video', 0, 9999, DATEADD(week, 1, GETDATE())),
        ('${admin.id}', 'chat', 0, 9999, DATEADD(week, 1, GETDATE())),
        ('${admin.id}', 'code', 0, 9999, DATEADD(week, 1, GETDATE())),
        ('${admin.id}', 'summary', 0, 9999, DATEADD(week, 1, GETDATE()))
    `);
=======
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: "관리자",
        role: "ADMIN", // 관리자 역할 설정
      },
    });

    // 관리자 기본 사용량 설정
    await prisma.usage.createMany({
      data: [
        {
          userId: admin.id,
          serviceType: "image-generate",
          limitCount: 9999, // 관리자는 무제한
        },
        {
          userId: admin.id,
          serviceType: "video-generate",
          limitCount: 9999, // 관리자는 무제한
        },
      ],
    });
>>>>>>> 8d8297ec14b0c95d4fdb86cf889b0ddbfb085f4b

    return NextResponse.json({
      message: "관리자 계정이 생성되었습니다.",
      email: adminEmail,
      password: adminPassword,
      userId: admin.id,
      role: "ADMIN"
    });

  } catch (error) {
    console.error("관리자 계정 생성 오류:", error);
    return NextResponse.json(
      { error: "관리자 계정 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
} 