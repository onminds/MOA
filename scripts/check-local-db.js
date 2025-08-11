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

async function checkLocalDb() {
  let pool;
  try {
    console.log('🔍 로컬 데이터베이스 상태 확인 중...');
    
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공');
    
    // 테이블 목록 조회
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📋 데이터베이스 테이블 목록:');
    console.log('='.repeat(50));
    
    tablesResult.recordset.forEach((table, index) => {
      console.log(`${index + 1}. ${table.TABLE_NAME}`);
    });
    
    // 각 테이블의 레코드 수 확인
    console.log('\n📊 테이블별 레코드 수:');
    console.log('='.repeat(50));
    
    for (const table of tablesResult.recordset) {
      const tableName = table.TABLE_NAME;
      const countResult = await pool.request()
        .input('table', tableName)
        .query('SELECT COUNT(*) as count FROM @table');
      
      console.log(`${tableName}: ${countResult.recordset[0].count}개 레코드`);
    }
    
    // 사용자 정보 조회
    const usersResult = await pool.request().query(`
      SELECT id, username, email, role, is_active, created_at
      FROM users 
      ORDER BY created_at DESC
    `);
    
    console.log('\n👥 사용자 정보:');
    console.log('='.repeat(80));
    
    if (usersResult.recordset.length === 0) {
      console.log('❌ 등록된 사용자가 없습니다.');
    } else {
      usersResult.recordset.forEach((user, index) => {
        const status = user.is_active ? '✅ 활성' : '❌ 비활성';
        const role = user.role || 'user';
        console.log(`${index + 1}. ${user.username} (${user.email}) - ${role} ${status}`);
        console.log(`   생성일: ${user.created_at}`);
      });
    }
    
    // 세션 정보 조회 (세션 테이블이 있는 경우)
    try {
      const sessionsResult = await pool.request().query(`
        SELECT session_token, expires, created_at
        FROM sessions 
        ORDER BY created_at DESC
      `);
      
      console.log('\n🔐 세션 정보:');
      console.log('='.repeat(50));
      
      if (sessionsResult.recordset.length === 0) {
        console.log('❌ 활성 세션이 없습니다.');
      } else {
        sessionsResult.recordset.forEach((session, index) => {
          console.log(`${index + 1}. 토큰: ${session.session_token.substring(0, 20)}...`);
          console.log(`   만료일: ${session.expires}`);
          console.log(`   생성일: ${session.created_at}`);
        });
      }
    } catch (error) {
      console.log('\n⚠️ 세션 테이블이 없거나 접근할 수 없습니다.');
    }
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

checkLocalDb(); 