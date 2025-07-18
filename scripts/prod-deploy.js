const fs = require('fs');
const { execSync } = require('child_process');

console.log('🚀 Vercel 배포용 환경 설정 시작...');

try {
  // 1. 프로덕션 스키마로 복구
  if (fs.existsSync('prisma/schema.production.prisma')) {
    console.log('🔄 프로덕션 스키마로 복구...');
    fs.copyFileSync('prisma/schema.production.prisma', 'prisma/schema.prisma');
  } else {
    console.log('⚠️ 프로덕션 스키마 백업이 없습니다. 현재 스키마를 그대로 사용합니다.');
  }
  
  // 2. Prisma 클라이언트 재생성 (PostgreSQL용)
  console.log('📦 프로덕션용 Prisma 클라이언트 생성...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  // 3. Git에 커밋
  console.log('📝 변경사항 커밋...');
  execSync('git add .', { stdio: 'inherit' });
  
  const commitMessage = `🚀 배포: ${new Date().toISOString().split('T')[0]}`;
  execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
  
  // 4. Vercel 배포
  console.log('🌐 Vercel에 배포...');
  execSync('git push', { stdio: 'inherit' });
  
  console.log('✅ Vercel 배포 완료!');
  console.log('🔗 사이트: https://moa-kappa.vercel.app');
  console.log('');
  console.log('📋 배포 후 확인사항:');
  console.log('   - 로그인/회원가입 테스트');
  console.log('   - 관리자 기능 확인');
  console.log('   - AI 기능 사용량 제한 확인');
  
} catch (error) {
  console.error('❌ 배포 중 오류:', error.message);
  
  // 오류 발생 시 로컬 개발용 스키마로 되돌리기
  if (fs.existsSync('prisma/schema.local.prisma')) {
    console.log('🔄 로컬 개발용 스키마로 복구...');
    fs.copyFileSync('prisma/schema.local.prisma', 'prisma/schema.prisma');
    execSync('npx prisma generate', { stdio: 'inherit' });
    console.log('✅ 로컬 환경 복구 완료');
  }
} 