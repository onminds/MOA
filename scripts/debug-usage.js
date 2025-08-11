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

async function debugUsage() {
  let pool;
  try {
    console.log('🔍 사용량 정보 디버깅 중...');
    
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
    
    // 사용량 정보 조회
    const usageResult = await pool.request().query(`
      SELECT 
        u.username,
        u.email,
        us.service_type,
        us.usage_count,
        us.limit_count,
        us.created_at,
        us.updated_at
      FROM usage us
      JOIN users u ON us.user_id = u.id
      ORDER BY u.username, us.service_type
    `);
    
    console.log('\n📈 사용량 정보:');
    console.log('='.repeat(80));
    
    if (usageResult.recordset.length === 0) {
      console.log('❌ 사용량 정보가 없습니다.');
    } else {
      usageResult.recordset.forEach((usage, index) => {
        const remaining = usage.limit_count - usage.usage_count;
        const status = remaining > 0 ? '✅' : '❌';
        console.log(`${index + 1}. ${usage.username} (${usage.email})`);
        console.log(`   서비스: ${usage.service_type}`);
        console.log(`   사용량: ${usage.usage_count}/${usage.limit_count} (남은 횟수: ${remaining}) ${status}`);
        console.log(`   생성일: ${usage.created_at}`);
        console.log(`   업데이트: ${usage.updated_at}`);
        console.log('');
      });
    }
    
    // 결제 정보 조회
    const paymentsResult = await pool.request().query(`
      SELECT 
        u.username,
        u.email,
        p.plan_type,
        p.amount,
        p.status,
        p.payment_date,
        p.created_at
      FROM payments p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
    `);
    
    console.log('\n💳 결제 정보:');
    console.log('='.repeat(80));
    
    if (paymentsResult.recordset.length === 0) {
      console.log('❌ 결제 정보가 없습니다.');
    } else {
      paymentsResult.recordset.forEach((payment, index) => {
        console.log(`${index + 1}. ${payment.username} (${payment.email})`);
        console.log(`   플랜: ${payment.plan_type}`);
        console.log(`   금액: ${payment.amount}원`);
        console.log(`   상태: ${payment.status}`);
        console.log(`   결제일: ${payment.payment_date}`);
        console.log(`   생성일: ${payment.created_at}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

debugUsage(); 