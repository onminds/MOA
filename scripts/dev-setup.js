const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 로컬 개발 환경 설정 시작...');

// 1. 로컬 환경변수 파일 확인
const envLocalPath = '.env.local';
if (!fs.existsSync(envLocalPath)) {
  console.log('📝 .env.local 파일이 없습니다. 생성해주세요:');
  console.log(`
  DATABASE_URL="file:./prisma/dev.db"
  NEXTAUTH_URL="http://localhost:3000"
  NEXTAUTH_SECRET="로컬개발용시크릿키123"
  `);
  process.exit(1);
}

console.log('✅ .env.local 파일 존재');

// 2. 로컬용 스키마로 백업 및 교체
try {
  console.log('🔄 프로덕션 스키마 백업...');
  fs.copyFileSync('prisma/schema.prisma', 'prisma/schema.production.prisma');
  
  console.log('🔄 로컬 개발용 스키마로 교체...');
  fs.copyFileSync('prisma/schema.local.prisma', 'prisma/schema.prisma');
  
  console.log('📦 Prisma 클라이언트 생성...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('🗄️ 로컬 데이터베이스 동기화...');
  execSync('npx prisma db push', { stdio: 'inherit' });
  
  console.log('✅ 로컬 개발 환경 설정 완료!');
  console.log('');
  console.log('🎯 이제 다음 명령어로 개발을 시작하세요:');
  console.log('   npm run dev');
  console.log('');
  console.log('📡 Vercel 배포할 때는 다음 명령어를 실행하세요:');
  console.log('   node scripts/prod-deploy.js');
  
} catch (error) {
  console.error('❌ 설정 중 오류:', error.message);
  
  // 오류 발생 시 원본 스키마 복구
  if (fs.existsSync('prisma/schema.production.prisma')) {
    fs.copyFileSync('prisma/schema.production.prisma', 'prisma/schema.prisma');
    console.log('🔄 원본 스키마 복구 완료');
  }
} 