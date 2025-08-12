const sql = require('mssql');

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '1234',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'moa_plus',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function checkPaymentStatus() {
  try {
    console.log('데이터베이스 연결 중...');
    const pool = await sql.connect(config);
    console.log('데이터베이스 연결 성공!');

    // 특정 사용자의 결제 내역 조회
    const userId = '85'; // Test1@Test.com 사용자 ID
    
    console.log(`\n=== 사용자 ID ${userId}의 결제 내역 ===`);
    const result = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT 
          transaction_id,
          user_id,
          plan_type,
          amount,
          status,
          receipt_id,
          payment_method,
          created_at,
          updated_at
        FROM payments 
        WHERE user_id = @userId
        ORDER BY created_at DESC
      `);

    if (result.recordset.length === 0) {
      console.log('결제 내역이 없습니다.');
    } else {
      result.recordset.forEach((payment, index) => {
        console.log(`\n--- 결제 ${index + 1} ---`);
        console.log(`주문 ID: ${payment.transaction_id}`);
        console.log(`플랜 타입: ${payment.plan_type || 'NULL'}`);
        console.log(`금액: ${payment.amount}원`);
        console.log(`상태: ${payment.status}`);
        console.log(`영수증 ID: ${payment.receipt_id || 'NULL'}`);
        console.log(`결제 방법: ${payment.payment_method || 'NULL'}`);
        console.log(`생성일: ${payment.created_at}`);
        console.log(`수정일: ${payment.updated_at}`);
      });
    }

    // completed 상태인 결제만 조회
    console.log(`\n=== 사용자 ID ${userId}의 완료된 결제 내역 ===`);
    const completedResult = await pool.request()
      .input('userId', userId)
      .query(`
        SELECT 
          transaction_id,
          plan_type,
          status,
          created_at
        FROM payments 
        WHERE user_id = @userId AND status = 'completed'
        ORDER BY created_at DESC
      `);

    if (completedResult.recordset.length === 0) {
      console.log('완료된 결제가 없습니다.');
    } else {
      completedResult.recordset.forEach((payment, index) => {
        console.log(`\n--- 완료된 결제 ${index + 1} ---`);
        console.log(`주문 ID: ${payment.transaction_id}`);
        console.log(`플랜 타입: ${payment.plan_type || 'NULL'}`);
        console.log(`상태: ${payment.status}`);
        console.log(`생성일: ${payment.created_at}`);
      });
    }

    await pool.close();
    console.log('\n데이터베이스 연결 종료');

  } catch (error) {
    console.error('오류 발생:', error);
  }
}

checkPaymentStatus();
