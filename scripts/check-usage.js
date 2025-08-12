const sql = require('mssql');

const config = {
  server: 'localhost',
  database: 'moa_plus',
  user: 'sa',
  password: 'your_password', // 실제 비밀번호로 변경 필요
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkUsage() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    // 모든 사용자 조회
    const users = await sql.query(`
      SELECT id, email, name, role, created_at
      FROM users 
      WHERE is_active = 1
      ORDER BY created_at DESC
    `);

    console.log(`\n총 ${users.recordset.length}명의 사용자 발견\n`);

    for (const user of users.recordset) {
      console.log(`👤 ${user.name} (${user.email}) - ${user.role}`);
      console.log(`   📅 가입일: ${user.created_at}`);
      
      // 사용자의 사용량 조회
      const usage = await sql.query(`
        SELECT service_type, usage_count, limit_count, next_reset_date
        FROM usage 
        WHERE user_id = ${user.id}
        ORDER BY service_type
      `);

      if (usage.recordset.length > 0) {
        for (const service of usage.recordset) {
          const remaining = service.limit_count - service.usage_count;
          const status = remaining > 0 ? '✅' : '❌';
          console.log(`   ${status} ${service.service_type}: ${service.usage_count}/${service.limit_count} (남은 횟수: ${remaining})`);
          if (service.next_reset_date) {
            console.log(`      🔄 다음 초기화: ${service.next_reset_date}`);
          }
        }
      } else {
        console.log('   ⚠️  사용량 데이터 없음');
      }
      console.log('');
    }

  } catch (error) {
    console.error('사용량 확인 오류:', error);
  } finally {
    await sql.close();
  }
}

checkUsage(); 