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

async function fixImageLimits() {
  let pool;
  try {
    console.log('🔧 이미지 생성 제한 수정 중...');
    
    pool = await sql.connect(config);
    
    // 모든 사용자 조회
    const usersResult = await pool.request().query(`
      SELECT id, username, email, role 
      FROM users 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📊 총 ${usersResult.recordset.length}명의 사용자를 처리합니다.`);
    
    for (const user of usersResult.recordset) {
      console.log(`\n👤 처리 중: ${user.username} (${user.email})`);
      
      // 해당 사용자의 이미지 생성 사용량 조회
      const usageResult = await pool.request()
        .input('userId', user.id)
        .input('serviceType', 'image-generate')
        .query('SELECT * FROM usage WHERE user_id = @userId AND service_type = @serviceType');
      
      if (usageResult.recordset.length === 0) {
        // 사용량 레코드가 없으면 생성
        await pool.request()
          .input('userId', user.id)
          .input('serviceType', 'image-generate')
          .input('limitCount', 1)
          .query(`
            INSERT INTO usage (user_id, service_type, usage_count, limit_count, created_at, updated_at)
            VALUES (@userId, @serviceType, 0, @limitCount, GETDATE(), GETDATE())
          `);
        
        console.log(`   ✅ 이미지 생성 제한 생성: 1회`);
      } else {
        // 기존 사용량 레코드 업데이트
        const usage = usageResult.recordset[0];
        const newLimit = user.role === 'admin' ? 999 : 1;
        
        await pool.request()
          .input('userId', user.id)
          .input('serviceType', 'image-generate')
          .input('limitCount', newLimit)
          .query('UPDATE usage SET limit_count = @limitCount WHERE user_id = @userId AND service_type = @serviceType');
        
        console.log(`   ✅ 이미지 생성 제한 업데이트: ${newLimit}회`);
      }
    }
    
    console.log('\n🎉 모든 사용자의 이미지 생성 제한이 수정되었습니다!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

fixImageLimits(); 