const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 개발 환경 설정 시작...');

try {
  // 1. 환경 변수 파일 확인
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.log('📝 .env.local 파일 생성 중...');
    const envContent = `# 데이터베이스 설정
DB_USER=sa
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=moa_plus

# OpenAI 설정
OPENAI_API_KEY=your_openai_api_key

# NextAuth 설정
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth 설정
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 기타 설정
NODE_ENV=development
`;
    fs.writeFileSync(envPath, envContent);
    console.log('✅ .env.local 파일 생성 완료');
  } else {
    console.log('✅ .env.local 파일이 이미 존재합니다');
  }

  // 2. 의존성 설치 확인
  console.log('📦 의존성 설치 확인 중...');
  if (!fs.existsSync('node_modules')) {
    console.log('📦 node_modules 설치 중...');
    execSync('npm install', { stdio: 'inherit' });
  } else {
    console.log('✅ node_modules가 이미 설치되어 있습니다');
  }

  // 3. 데이터베이스 연결 테스트
  console.log('🔌 데이터베이스 연결 테스트 중...');
  try {
    const sql = require('mssql');
    const config = {
      server: process.env.DB_SERVER || 'localhost',
      database: process.env.DB_NAME || 'moa_plus',
      user: process.env.DB_USER || 'sa',
      password: process.env.DB_PASSWORD || 'your_password',
      options: {
        encrypt: false,
        trustServerCertificate: true
      }
    };
    
    await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공');
    await sql.close();
  } catch (error) {
    console.log('⚠️  데이터베이스 연결 실패 (설정 확인 필요)');
    console.log('   DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME 환경변수를 확인하세요');
  }

  console.log('\n🎉 개발 환경 설정 완료!');
  console.log('다음 명령어로 개발 서버를 시작하세요:');
  console.log('npm run dev');

} catch (error) {
  console.error('❌ 설정 중 오류 발생:', error.message);
  process.exit(1);
} 