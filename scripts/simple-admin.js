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

async function simpleAdmin() {
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

    console.log(`\n총 ${users.recordset.length}명의 사용자:\n`);

    users.recordset.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
    });

    // 사용자 역할 변경 (예시)
    const targetEmail = 'test@example.com';
    const newRole = 'ADMIN';

    const result = await sql.query(`
      UPDATE users 
      SET role = '${newRole}', updated_at = GETDATE()
      WHERE email = '${targetEmail}'
    `);

    if (result.rowsAffected[0] > 0) {
      console.log(`\n✅ ${targetEmail}의 역할을 ${newRole}로 변경했습니다.`);
    } else {
      console.log(`\n⚠️  ${targetEmail} 사용자를 찾을 수 없습니다.`);
    }

  } catch (error) {
    console.error('관리자 스크립트 오류:', error);
  } finally {
    await sql.close();
  }
}

simpleAdmin(); 