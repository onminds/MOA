// 환경변수 수동 설정
process.env.DATABASE_URL = "file:./prisma/dev.db";

const sql = require('mssql');

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433'),
  database: process.env.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
};

async function makeAdmin() {
  let pool;
  try {
    console.log('🔧 관리자 권한 부여 중...');
    
    pool = await sql.connect(config);
    
    // 모든 사용자 조회
    const allUsersResult = await pool.request().query(`
      SELECT id, username, email, role, is_active 
      FROM users 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);
    
    console.log('\n📊 현재 사용자 목록:');
    console.log('='.repeat(80));
    
    allUsersResult.recordset.forEach((user, index) => {
      const role = user.role || 'user';
      console.log(`${index + 1}. ${user.username} (${user.email}) - ${role}`);
    });
    
    // admin@moa.com 계정 찾기
    const targetEmail = 'admin@moa.com';
    const userResult = await pool.request()
      .input('email', targetEmail)
      .query('SELECT * FROM users WHERE email = @email');
    
    if (userResult.recordset.length === 0) {
      console.log(`\n❌ ${targetEmail} 계정을 찾을 수 없습니다.`);
      console.log('먼저 해당 이메일로 계정을 생성해주세요.');
      return;
    }
    
    const user = userResult.recordset[0];
    console.log(`\n🎯 대상 사용자: ${user.username} (${user.email})`);
    console.log(`현재 권한: ${user.role || 'user'}`);
    
    if (user.role === 'admin') {
      console.log('✅ 이미 관리자 권한을 가지고 있습니다.');
      return;
    }
    
    // 관리자 권한 부여
    await pool.request()
      .input('userId', user.id)
      .query('UPDATE users SET role = \'admin\' WHERE id = @userId');
    
    console.log('✅ 관리자 권한이 성공적으로 부여되었습니다!');
    
    // 업데이트된 정보 확인
    const updatedUserResult = await pool.request()
      .input('email', targetEmail)
      .query('SELECT username, email, role FROM users WHERE email = @email');
    
    const updatedUser = updatedUserResult.recordset[0];
    console.log(`\n📋 업데이트된 정보:`);
    console.log(`이름: ${updatedUser.username}`);
    console.log(`이메일: ${updatedUser.email}`);
    console.log(`권한: ${updatedUser.role}`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

makeAdmin(); 