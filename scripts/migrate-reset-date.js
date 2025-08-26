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

async function migrateResetDate() {
  try {
    console.log('데이터베이스 연결 중...');
    await sql.connect(config);
    console.log('연결 성공!');

    // 1. next_reset_date 컬럼이 없으면 추가
    console.log('1. next_reset_date 컬럼 확인 중...');
    const columnCheck = await sql.query(`
      SELECT COUNT(*) as count 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'usage' AND COLUMN_NAME = 'next_reset_date'
    `);
    
    if (columnCheck.recordset[0].count === 0) {
      console.log('next_reset_date 컬럼 추가 중...');
      await sql.query('ALTER TABLE usage ADD next_reset_date DATETIME NULL');
      console.log('컬럼 추가 완료!');
    } else {
      console.log('next_reset_date 컬럼이 이미 존재합니다.');
    }

    // 2. 기존 reset_date가 있는 경우 next_reset_date로 마이그레이션
    console.log('2. 기존 데이터 마이그레이션 중...');
    const migrationResult = await sql.query(`
      UPDATE usage 
      SET next_reset_date = DATEADD(month, 1, u.created_at)
      FROM usage us
      INNER JOIN users u ON us.user_id = u.id
      WHERE us.next_reset_date IS NULL 
        AND u.created_at IS NOT NULL
    `);
    console.log(`${migrationResult.rowsAffected[0]}개 레코드 마이그레이션 완료`);

    // 3. next_reset_date가 여전히 NULL인 경우 현재 시간 기준으로 정확히 한 달 후로 설정
    console.log('3. NULL 값 처리 중...');
    const nullUpdateResult = await sql.query(`
      UPDATE usage 
      SET next_reset_date = DATEADD(month, 1, GETDATE())
      WHERE next_reset_date IS NULL
    `);
    console.log(`${nullUpdateResult.rowsAffected[0]}개 NULL 값 업데이트 완료`);

    // 4. 마이그레이션 결과 확인
    console.log('4. 마이그레이션 결과 확인 중...');
    const checkResult = await sql.query(`
      SELECT 
        u.email,
        us.service_type,
        us.usage_count,
        us.limit_count,
        us.next_reset_date,
        u.created_at as user_created_at
      FROM usage us
      INNER JOIN users u ON us.user_id = u.id
      ORDER BY u.email, us.service_type
    `);

    console.log('\n=== 마이그레이션 결과 ===');
    checkResult.recordset.forEach(record => {
      console.log(`${record.email} - ${record.service_type}: ${record.usage_count}/${record.limit_count}, 다음 초기화: ${record.next_reset_date}`);
    });

    console.log('\n마이그레이션 완료!');

  } catch (error) {
    console.error('마이그레이션 오류:', error);
  } finally {
    await sql.close();
  }
}

migrateResetDate();
