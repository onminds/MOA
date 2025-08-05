const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixImageLimits() {
  try {
    console.log('이미지 생성 제한 수정 시작...');

    // 모든 사용자 조회
    const users = await prisma.user.findMany({
      include: {
        usage: true
      }
    });

    for (const user of users) {
      console.log(`\n사용자: ${user.email} (${user.name})`);
      
      // 이미지 생성 사용량 찾기
      const imageUsage = user.usage.find(u => u.serviceType === 'image-generate');
      
      if (imageUsage) {
        console.log(`현재 이미지 제한: ${imageUsage.limitCount}`);
        
        // 일반 사용자는 2회, 관리자는 9999회로 설정
        let newLimit = 2; // 기본값
        if (user.role === 'ADMIN') {
          newLimit = 9999; // 관리자는 무제한
        }
        
        if (imageUsage.limitCount !== newLimit) {
          await prisma.usage.update({
            where: { id: imageUsage.id },
            data: { limitCount: newLimit }
          });
          console.log(`이미지 제한 변경: ${imageUsage.limitCount} → ${newLimit}`);
        } else {
          console.log(`이미지 제한 유지: ${newLimit}`);
        }
      } else {
        console.log('이미지 생성 사용량이 없습니다.');
      }
    }

    console.log('\n이미지 생성 제한 수정 완료!');
  } catch (error) {
    console.error('수정 중 오류 발생:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixImageLimits(); 