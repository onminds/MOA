const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function updateLimits() {
  try {
    console.log('사용자별 제한 업데이트 시작...');

    // 일반 사용자 (onminds123@gmail.com)의 이미지 생성 제한을 2회로 변경
    const normalUser = await prisma.user.findUnique({
      where: { email: 'onminds123@gmail.com' },
      include: { usage: true }
    });

    if (normalUser) {
      const imageUsage = normalUser.usage.find(u => u.serviceType === 'image-generate');
      if (imageUsage) {
        await prisma.usage.update({
          where: { id: imageUsage.id },
          data: { limitCount: 2 }
        });
        console.log(`일반 사용자 이미지 제한 변경: ${imageUsage.limitCount} → 2`);
      }
    }

    // 관리자 (admin@moa.com)의 이미지 생성 제한을 9999회로 변경
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@moa.com' },
      include: { usage: true }
    });

    if (adminUser) {
      const imageUsage = adminUser.usage.find(u => u.serviceType === 'image-generate');
      if (imageUsage) {
        await prisma.usage.update({
          where: { id: imageUsage.id },
          data: { limitCount: 9999 }
        });
        console.log(`관리자 이미지 제한 변경: ${imageUsage.limitCount} → 9999`);
      }
    }

    console.log('제한 업데이트 완료!');
  } catch (error) {
    console.error('업데이트 중 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateLimits(); 