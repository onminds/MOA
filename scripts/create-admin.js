// 환경변수 수동 설정
process.env.DATABASE_URL = "file:./prisma/dev.db";

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    console.log('데이터베이스 연결 중...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);

    // 데이터베이스 연결 테스트
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 관리자 이메일과 비밀번호 설정
    const adminEmail = 'admin@moa.com';
    const adminPassword = 'admin123';
    const adminName = '관리자';

    // 기존 관리자 계정 확인
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      console.log('✅ 관리자 계정이 이미 존재합니다.');
      console.log(`📧 이메일: ${existingAdmin.email}`);
      console.log(`👑 역할: ${existingAdmin.role}`);
      console.log(`🆔 ID: ${existingAdmin.id}`);
      return;
    }

    // 비밀번호 해시화
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // 관리자 계정 생성
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'ADMIN'
      }
    });

    console.log('🎉 관리자 계정이 성공적으로 생성되었습니다!');
    console.log(`📧 이메일: ${admin.email}`);
    console.log(`🔑 비밀번호: ${adminPassword}`);
    console.log(`👑 역할: ${admin.role}`);
    console.log(`🆔 ID: ${admin.id}`);
    console.log('\n💡 이제 이 계정으로 로그인하면 관리자 권한을 사용할 수 있습니다.');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    if (error.code) console.error('오류 코드:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin(); 