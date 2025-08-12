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

async function updateLimits() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    // 일반 사용자 제한 업데이트
    const normalUser = await sql.query(`
      SELECT id, email 
      FROM users 
      WHERE email = 'test@example.com' AND role = 'USER'
    `);

    if (normalUser.recordset.length > 0) {
      await sql.query(`
        UPDATE usage 
        SET limit_count = 50 
        WHERE user_id = ${normalUser.recordset[0].id} AND service_type = 'image-generate'
      `);
      console.log(`일반 사용자 ${normalUser.recordset[0].email}의 이미지 생성 제한을 50으로 업데이트`);
    }

    // 관리자 제한 업데이트
    const adminUser = await sql.query(`
      SELECT id, email 
      FROM users 
      WHERE email = 'admin@moa.com' AND role = 'ADMIN'
    `);

    if (adminUser.recordset.length > 0) {
      await sql.query(`
        UPDATE usage 
        SET limit_count = 9999 
        WHERE user_id = ${adminUser.recordset[0].id} AND service_type = 'image-generate'
      `);
      console.log(`관리자 ${adminUser.recordset[0].email}의 이미지 생성 제한을 9999로 업데이트`);
    }

    console.log('제한 업데이트 완료!');

  } catch (error) {
    console.error('제한 업데이트 오류:', error);
  } finally {
    await sql.close();
  }
}

updateLimits(); 