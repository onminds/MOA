const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsage() {
  try {
    console.log('사용자별 사용량 확인...');

    // 모든 사용자 조회
    const users = await prisma.user.findMany({
      include: {
        usage: true,
        payments: {
          where: { status: 'completed' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    users.forEach(user => {
      console.log(`\n=== ${user.email} (${user.name}) ===`);
      console.log(`역할: ${user.role}`);
      console.log(`결제 내역: ${user.payments.length}개`);
      
      if (user.payments.length > 0) {
        console.log(`최근 플랜: ${user.payments[0].planType}`);
      } else {
        console.log(`플랜: basic (기본)`);
      }
      
      console.log('사용량:');
      user.usage.forEach(usage => {
        console.log(`  ${usage.serviceType}: ${usage.usageCount}/${usage.limitCount}`);
      });
    });

  } catch (error) {
    console.error('확인 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsage(); 