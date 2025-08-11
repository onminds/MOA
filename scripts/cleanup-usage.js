const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanupUsage() {
  try {
    console.log('불필요한 사용량 데이터 정리 시작...');

    // 불필요한 서비스 타입들 삭제
    const servicesToRemove = ['ai-chat', 'code-generate', 'sns-post'];
    
    for (const serviceType of servicesToRemove) {
      const deletedCount = await prisma.usage.deleteMany({
        where: {
          serviceType: serviceType
        }
      });
      console.log(`${serviceType} 서비스 사용량 데이터 ${deletedCount.count}개 삭제됨`);
    }

    // 영상 생성 서비스가 없는 사용자들에게 추가
    const usersWithoutVideoUsage = await prisma.user.findMany({
      where: {
        usage: {
          none: {
            serviceType: 'video-generate'
          }
        }
      }
    });

    console.log(`영상 생성 사용량이 없는 사용자 ${usersWithoutVideoUsage.length}명 발견`);

    for (const user of usersWithoutVideoUsage) {
      await prisma.usage.create({
        data: {
          userId: user.id,
          serviceType: 'video-generate',
          limitCount: 1, // Basic 플랜
          usageCount: 0,
          resetDate: new Date()
        }
      });
      console.log(`사용자 ${user.email}에게 영상 생성 사용량 추가됨`);
    }

    console.log('사용량 데이터 정리 완료!');
  } catch (error) {
    console.error('정리 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUsage(); 