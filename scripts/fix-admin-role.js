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

async function fixAdminRole() {
  let pool;
  try {
    console.log('🔧 관리자 권한 수정 중...');
    
    pool = await sql.connect(config);
    
    // admin@moa.com 계정 찾기
    const adminUserResult = await pool.request()
      .input('email', 'admin@moa.com')
      .query('SELECT * FROM users WHERE email = @email');
    
    if (adminUserResult.recordset.length === 0) {
      console.log('❌ admin@moa.com 계정을 찾을 수 없습니다.');
      return;
    }
    
    const adminUser = adminUserResult.recordset[0];
    console.log(`\n🎯 대상 사용자: ${adminUser.username} (${adminUser.email})`);
    console.log(`현재 권한: ${adminUser.role || 'user'}`);
    
    // 관리자 권한 부여
    await pool.request()
      .input('userId', adminUser.id)
      .query('UPDATE users SET role = \'admin\' WHERE id = @userId');
    
    console.log('✅ 관리자 권한이 부여되었습니다.');
    
    // 관리자용 사용량 제한 설정
    const adminUsageResult = await pool.request()
      .input('userId', adminUser.id)
      .query('SELECT * FROM usage WHERE user_id = @userId');
    
    if (adminUsageResult.recordset.length === 0) {
      // 관리자용 사용량 제한 생성
      const serviceTypes = ['image-generate', 'ai-chat', 'code-generate', 'document-ocr'];
      
      for (const serviceType of serviceTypes) {
        await pool.request()
          .input('userId', adminUser.id)
          .input('serviceType', serviceType)
          .input('limitCount', 999)
          .query(`
            INSERT INTO usage (user_id, service_type, usage_count, limit_count, created_at, updated_at)
            VALUES (@userId, @serviceType, 0, @limitCount, GETDATE(), GETDATE())
          `);
      }
      
      console.log('✅ 관리자용 사용량 제한이 설정되었습니다.');
    } else {
      // 기존 사용량 제한을 관리자용으로 업데이트
      await pool.request()
        .input('userId', adminUser.id)
        .query('UPDATE usage SET limit_count = 999 WHERE user_id = @userId');
      
      console.log('✅ 기존 사용량 제한이 관리자용으로 업데이트되었습니다.');
    }
    
    // 최종 확인
    const finalUserResult = await pool.request()
      .input('email', 'admin@moa.com')
      .query('SELECT username, email, role FROM users WHERE email = @email');
    
    const finalUser = finalUserResult.recordset[0];
    console.log(`\n📋 최종 확인:`);
    console.log(`이름: ${finalUser.username}`);
    console.log(`이메일: ${finalUser.email}`);
    console.log(`권한: ${finalUser.role}`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

fixAdminRole(); 