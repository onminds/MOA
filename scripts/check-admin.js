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

async function checkAdmin() {
  let pool;
  try {
    console.log('🔍 관리자 권한 확인 중...');
    
    pool = await sql.connect(config);
    
    // 모든 사용자 조회
    const usersResult = await pool.request().query(`
      SELECT id, username, email, role, is_active 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.log('\n📊 전체 사용자 목록:');
    console.log('='.repeat(80));
    
    usersResult.recordset.forEach((user, index) => {
      const status = user.is_active ? '✅ 활성' : '❌ 비활성';
      const role = user.role || 'user';
      console.log(`${index + 1}. ${user.username} (${user.email}) - ${role} ${status}`);
    });
    
    // 관리자 권한을 가진 사용자 찾기
    const adminResult = await pool.request().query(`
      SELECT id, username, email, role 
      FROM users 
      WHERE role = 'admin' AND is_active = 1
    `);
    
    console.log('\n👑 관리자 권한을 가진 사용자:');
    console.log('='.repeat(80));
    
    if (adminResult.recordset.length === 0) {
      console.log('❌ 관리자 권한을 가진 사용자가 없습니다.');
    } else {
      adminResult.recordset.forEach((admin, index) => {
        console.log(`${index + 1}. ${admin.username} (${admin.email})`);
      });
    }
    
    // 특정 사용자 상세 정보
    const targetEmail = 'admin@moa.com';
    const targetUserResult = await pool.request()
      .input('email', targetEmail)
      .query('SELECT * FROM users WHERE email = @email');
    
    console.log(`\n🎯 대상 사용자 (${targetEmail}) 상세 정보:`);
    console.log('='.repeat(80));
    
    if (targetUserResult.recordset.length === 0) {
      console.log('❌ 해당 이메일의 사용자를 찾을 수 없습니다.');
    } else {
      const user = targetUserResult.recordset[0];
      console.log(`ID: ${user.id}`);
      console.log(`이름: ${user.username}`);
      console.log(`이메일: ${user.email}`);
      console.log(`권한: ${user.role || 'user'}`);
      console.log(`활성 상태: ${user.is_active ? '활성' : '비활성'}`);
      console.log(`생성일: ${user.created_at}`);
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkAdmin(); 