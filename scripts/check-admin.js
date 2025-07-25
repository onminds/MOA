const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    console.log('관리자 계정 상태 확인...');

    // 모든 사용자 조회
    const users = await prisma.user.findMany({
      include: {
        usage: true
      }
    });

    console.log(`총 사용자 수: ${users.length}`);

    users.forEach(user => {
      console.log(`- ${user.email} (${user.name}): ${user.role}`);
      console.log(`  사용량: ${user.usage.length}개`);
      user.usage.forEach(usage => {
        console.log(`    ${usage.serviceType}: ${usage.usageCount}/${usage.limitCount}`);
      });
    });

    // admin@moa.com 계정 특별 확인
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@moa.com' },
      include: { usage: true }
    });

    if (adminUser) {
      console.log('\n=== 관리자 계정 상세 정보 ===');
      console.log(`이메일: ${adminUser.email}`);
      console.log(`이름: ${adminUser.name}`);
      console.log(`역할: ${adminUser.role}`);
      console.log(`사용량 개수: ${adminUser.usage.length}`);
      
      if (adminUser.role !== 'ADMIN') {
        console.log('⚠️  관리자 역할이 아닙니다! ADMIN으로 변경합니다...');
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { role: 'ADMIN' }
        });
        console.log('✅ 관리자 역할로 변경되었습니다.');
      } else {
        console.log('✅ 이미 관리자 역할입니다.');
      }
    } else {
      console.log('❌ admin@moa.com 계정을 찾을 수 없습니다.');
    }

  } catch (error) {
    console.error('확인 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin(); 