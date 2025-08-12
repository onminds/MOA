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

async function makeAdmin() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    // 특정 사용자를 관리자로 변경
    const targetEmail = 'test@example.com';
    
    const result = await sql.query(`
      UPDATE users 
      SET role = 'ADMIN', updated_at = GETDATE()
      WHERE email = '${targetEmail}'
    `);

    if (result.rowsAffected[0] > 0) {
      console.log(`✅ ${targetEmail}을 관리자로 설정했습니다!`);
    } else {
      console.log(`❌ ${targetEmail} 사용자를 찾을 수 없습니다.`);
    }

  } catch (error) {
    console.error('관리자 설정 오류:', error);
  } finally {
    await sql.close();
  }
}

makeAdmin(); 