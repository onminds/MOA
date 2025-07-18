const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixAdminRole() {
  try {
    console.log('관리자 역할 수정 시작...');

    // admin@moa.com 계정 찾기
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@moa.com' }
    });

    if (!adminUser) {
      console.log('admin@moa.com 계정을 찾을 수 없습니다.');
      return;
    }

    console.log(`기존 관리자 계정 발견: ${adminUser.email}, 현재 역할: ${adminUser.role}`);

    // 역할을 ADMIN으로 변경
    if (adminUser.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'ADMIN' }
      });
      console.log('관리자 역할로 변경되었습니다.');
    } else {
      console.log('이미 관리자 역할입니다.');
    }

    // 관리자 사용량이 없으면 추가
    const adminUsage = await prisma.usage.findMany({
      where: { userId: adminUser.id }
    });

    if (adminUsage.length === 0) {
      await prisma.usage.createMany({
        data: [
          {
            userId: adminUser.id,
            serviceType: "image-generate",
            limitCount: 9999, // 관리자는 무제한
          },
          {
            userId: adminUser.id,
            serviceType: "video-generate",
            limitCount: 9999, // 관리자는 무제한
          },
        ],
      });
      console.log('관리자 사용량 설정이 추가되었습니다.');
    } else {
      console.log('관리자 사용량 설정이 이미 존재합니다.');
    }

    console.log('관리자 역할 수정 완료!');
  } catch (error) {
    console.error('수정 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminRole(); 