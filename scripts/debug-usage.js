const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugUsage() {
  try {
    console.log('=== 사용량 디버그 ===');
    
    // 모든 사용자 조회
    const users = await prisma.user.findMany();
    console.log(`총 사용자 수: ${users.length}`);
    
    for (const user of users) {
      console.log(`\n사용자: ${user.email} (${user.name})`);
      console.log(`역할: ${user.role}`);
      
      // 사용량 조회
      const usage = await prisma.usage.findMany({
        where: { userId: user.id }
      });
      
      console.log(`사용량 레코드 수: ${usage.length}`);
      usage.forEach(u => {
        console.log(`  ${u.serviceType}: ${u.usageCount}/${u.limitCount}`);
      });
      
      // 결제 내역 조회
      const payments = await prisma.payment.findMany({
        where: { userId: user.id }
      });
      
      console.log(`결제 내역 수: ${payments.length}`);
      payments.forEach(p => {
        console.log(`  플랜: ${p.planType}, 상태: ${p.status}`);
      });
    }
    
  } catch (error) {
    console.error('디버그 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugUsage(); 