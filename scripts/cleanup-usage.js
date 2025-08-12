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

async function cleanupUsage() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    console.log('불필요한 사용량 데이터 정리 시작...');

    // 불필요한 서비스 타입들 삭제
    const servicesToRemove = ['ai-chat', 'code-generate', 'sns-post'];
    
    for (const serviceType of servicesToRemove) {
      const result = await sql.query(`
        DELETE FROM usage 
        WHERE service_type = '${serviceType}'
      `);
      console.log(`${serviceType} 서비스 사용량 데이터 ${result.rowsAffected[0]}개 삭제됨`);
    }

    // 영상 생성 서비스가 없는 사용자들에게 추가
    const usersWithoutVideoUsage = await sql.query(`
      SELECT u.id, u.email
      FROM users u
      LEFT JOIN usage us ON u.id = us.user_id AND us.service_type = 'video-generate'
      WHERE us.user_id IS NULL AND u.is_active = 1
    `);

    console.log(`영상 생성 사용량이 없는 사용자 ${usersWithoutVideoUsage.recordset.length}명 발견`);

    for (const user of usersWithoutVideoUsage.recordset) {
      await sql.query(`
        INSERT INTO usage (user_id, service_type, usage_count, limit_count, created_at, updated_at)
        VALUES (${user.id}, 'video-generate', 0, 1, GETDATE(), GETDATE())
      `);
      console.log(`사용자 ${user.email}에게 영상 생성 사용량 추가됨`);
    }

    console.log('사용량 데이터 정리 완료!');
  } catch (error) {
    console.error('정리 중 오류 발생:', error);
  } finally {
    await sql.close();
  }
}

cleanupUsage(); 