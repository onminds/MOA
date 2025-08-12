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

async function createAdmin() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    // 기존 관리자 확인
    const existingAdmin = await sql.query(`
      SELECT id, email, role 
      FROM users 
      WHERE email = 'admin@moa.com'
    `);

    if (existingAdmin.recordset.length > 0) {
      console.log('관리자 계정이 이미 존재합니다:', existingAdmin.recordset[0]);
      return;
    }

    // 새 관리자 생성
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const result = await sql.query(`
      INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
      VALUES ('admin@moa.com', '${hashedPassword}', '관리자', 'ADMIN', 1, GETDATE(), GETDATE());
      
      SELECT SCOPE_IDENTITY() as id;
    `);

    const adminId = result.recordset[0].id;
    console.log('관리자 계정이 생성되었습니다!');
    console.log('ID:', adminId);
    console.log('이메일: admin@moa.com');
    console.log('비밀번호: admin123');

  } catch (error) {
    console.error('관리자 생성 오류:', error);
  } finally {
    await sql.close();
  }
}

createAdmin(); 