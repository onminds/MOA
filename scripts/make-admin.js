// 환경변수 수동 설정
process.env.DATABASE_URL = "file:./prisma/dev.db";

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function makeAdmin(email) {
  try {
    if (!email) {
      console.error('이메일을 입력해주세요: node scripts/make-admin.js your-email@example.com');
      process.exit(1);
    }

    console.log('데이터베이스 연결 중...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);

    // 데이터베이스 연결 테스트
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공');

    // 모든 사용자 목록 먼저 출력
    console.log('\n📋 현재 등록된 사용자들:');
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });
    
    if (allUsers.length === 0) {
      console.log('❌ 등록된 사용자가 없습니다. 먼저 회원가입을 진행해주세요.');
      process.exit(1);
    }
    
    allUsers.forEach((u, index) => {
      console.log(`${index + 1}. ${u.email} (${u.name || '이름없음'}) - 역할: ${u.role}`);
    });

    // 특정 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.error(`\n❌ 이메일 ${email}로 가입된 사용자를 찾을 수 없습니다.`);
      console.log('위의 목록에서 정확한 이메일을 확인해주세요.');
      process.exit(1);
    }

    console.log(`\n🔍 찾은 사용자: ${user.email} (현재 역할: ${user.role})`);

    // 이미 관리자인 경우
    if (user.role === 'ADMIN') {
      console.log('✅ 이미 관리자 권한을 가지고 있습니다.');
      process.exit(0);
    }

    // 관리자로 업데이트
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' }
    });

    console.log(`\n🎉 ${email} 사용자가 관리자로 설정되었습니다!`);
    console.log(`📝 사용자 ID: ${updatedUser.id}`);
    console.log(`👑 새로운 역할: ${updatedUser.role}`);
    console.log('\n💡 이제 로그인하면 Header에 "관리자" 버튼이 표시됩니다.');
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    if (error.code) console.error('오류 코드:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
makeAdmin(email); 