const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:./prisma/dev.db"
    }
  }
});

async function main() {
  try {
    console.log('🔌 데이터베이스 연결 중...');
    
    // 모든 사용자 조회
    const users = await prisma.user.findMany();
    console.log(`📊 총 ${users.length}명의 사용자가 등록되어 있습니다.`);
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - ${user.role || 'USER'} (ID: ${user.id})`);
    });
    
    // 특정 이메일 찾기
    const email = 'onminds123@gmail.com';
    const targetUser = users.find(u => u.email === email);
    
    if (!targetUser) {
      console.log(`❌ ${email} 사용자를 찾을 수 없습니다.`);
      return;
    }
    
    console.log(`\n🎯 대상 사용자: ${targetUser.email}`);
    console.log(`현재 역할: ${targetUser.role || 'USER'}`);
    
    if (targetUser.role === 'ADMIN') {
      console.log('✅ 이미 관리자입니다!');
      return;
    }
    
    // 관리자로 업데이트
    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: { role: 'ADMIN' }
    });
    
    console.log(`🎉 ${email}을 관리자로 설정했습니다!`);
    console.log(`새로운 역할: ${updated.role}`);
    
  } catch (error) {
    console.error('❌ 오류:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 