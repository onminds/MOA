const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 로컬 데이터베이스 상태 확인...');
    
    // 1. 데이터베이스 연결 테스트
    await prisma.$connect();
    console.log('✅ 데이터베이스 연결 성공');
    
    // 2. 필수 테이블들 확인
    const tables = ['users', 'accounts', 'sessions', 'usage'];
    
    for (const table of tables) {
      try {
        const count = await prisma.$queryRaw`SELECT COUNT(*) as count FROM ${table}`;
        console.log(`✅ ${table} 테이블: ${count[0]?.count || 0}개 레코드`);
      } catch (error) {
        console.log(`❌ ${table} 테이블 없음:`, error.message);
      }
    }
    
    // 3. 사용자 목록 확인
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true }
    });
    
    console.log(`\n👥 등록된 사용자 (${users.length}명):`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.role})`);
    });
    
    // 4. NextAuth 세션 테이블 확인
    try {
      const sessions = await prisma.session.findMany();
      console.log(`\n🔐 활성 세션: ${sessions.length}개`);
    } catch (error) {
      console.log('\n❌ 세션 테이블 문제:', error.message);
    }
    
  } catch (error) {
    console.error('❌ 데이터베이스 확인 오류:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 