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

async function autoBillingScheduler() {
  let pool;
  try {
    console.log('🔄 자동 결제 실행 스케줄러 시작...');
    
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 다음 결제일이 도래한 활성 구독 조회
    const expiredSubscriptions = await pool.request().query(`
      SELECT 
        s.subscription_id,
        s.user_id,
        s.billing_key,
        s.plan_type,
        s.amount,
        s.next_billing_date,
        u.name as user_name,
        u.email as user_email
      FROM subscriptions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active'
        AND s.auto_renewal = 1
        AND s.billing_key IS NOT NULL
        AND s.next_billing_date <= GETDATE()
        AND s.billing_key != ''
    `);
    
    console.log(`📊 자동 결제 실행 대상 구독 수: ${expiredSubscriptions.recordset.length}`);
    
    if (expiredSubscriptions.recordset.length === 0) {
      console.log('✅ 자동 결제할 구독이 없습니다.');
      return;
    }
    
    // 2. 각 구독에 대해 자동 결제 실행
    for (const subscription of expiredSubscriptions.recordset) {
      try {
        console.log(`🔄 자동 결제 처리 중: ${subscription.subscription_id} (${subscription.plan_type})`);
        
        // 고유한 주문 ID 생성
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substr(2, 9);
        const orderId = `recurring_${timestamp}_${randomStr}`;
        const orderName = `MOA ${subscription.plan_type} 플랜 자동 결제`;
        
        // 토스페이먼츠 자동결제 실행
        const billingResponse = await fetch(`https://api.tosspayments.com/v1/billing/${subscription.billing_key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: subscription.amount,
            orderId: orderId,
            orderName: orderName,
            customerName: subscription.user_name || '사용자',
            customerEmail: subscription.user_email || 'user@example.com'
          })
        });

        const billingResult = await billingResponse.json();
        
        if (billingResponse.ok && billingResult.status === 'DONE') {
          // 자동결제 성공
          console.log(`✅ 자동 결제 성공: ${subscription.subscription_id}`);
          
          // 결제 내역에 성공 기록
          await pool.request()
            .input('userId', subscription.user_id)
            .input('orderId', orderId)
            .input('billingKey', subscription.billing_key)
            .input('amount', subscription.amount)
            .input('status', 'completed')
            .input('paymentMethod', 'card')
            .input('paymentKey', billingResult.paymentKey)
            .input('transactionId', billingResult.transactionId)
            .input('planType', subscription.plan_type)
            .query(`
              INSERT INTO payments (
                user_id, transaction_id, billing_key, amount, 
                status, payment_method, payment_key, receipt_id,
                plan_type, created_at, updated_at
              ) VALUES (
                @userId, @orderId, @billingKey, @amount,
                @status, @paymentMethod, @paymentKey, @transactionId,
                @planType, GETDATE(), GETDATE()
              )
            `);

          // 구독 정보 업데이트 (다음 결제일 갱신)
          const nextBillingDate = new Date();
          nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

          await pool.request()
            .input('subscriptionId', subscription.subscription_id)
            .input('nextBillingDate', nextBillingDate)
            .input('lastBillingDate', new Date())
            .query(`
              UPDATE subscriptions 
              SET next_billing_date = @nextBillingDate,
                  last_billing_date = @lastBillingDate,
                  updated_at = GETDATE()
              WHERE subscription_id = @subscriptionId
            `);

          console.log(`✅ 구독 정보 업데이트 완료: ${subscription.subscription_id}`);
          console.log(`📅 다음 결제일: ${nextBillingDate.toISOString()}`);
          
        } else {
          // 자동결제 실패
          console.error(`❌ 자동 결제 실패: ${subscription.subscription_id}`, billingResult);
          
          // 실패한 결제 내역 기록
          await pool.request()
            .input('userId', subscription.user_id)
            .input('orderId', orderId)
            .input('billingKey', subscription.billing_key)
            .input('amount', subscription.amount)
            .input('status', 'failed')
            .input('paymentMethod', 'card')
            .input('errorMessage', billingResult.message || '자동결제 실행 실패')
            .input('planType', subscription.plan_type)
            .query(`
              INSERT INTO payments (
                user_id, transaction_id, billing_key, amount, 
                status, payment_method, error_message, plan_type,
                created_at, updated_at
              ) VALUES (
                @userId, @orderId, @billingKey, @amount,
                @status, @paymentMethod, @errorMessage, @planType,
                GETDATE(), GETDATE()
              )
            `);

          // 자동결제 실패 시 구독 상태를 inactive로 변경
          await pool.request()
            .input('subscriptionId', subscription.subscription_id)
            .query(`
              UPDATE subscriptions 
              SET status = 'inactive',
                  auto_renewal = 0,
                  updated_at = GETDATE()
              WHERE subscription_id = @subscriptionId
            `);

          console.log(`⚠️ 구독 상태를 inactive로 변경: ${subscription.subscription_id}`);
        }
        
      } catch (error) {
        console.error(`❌ 구독 처리 중 오류: ${subscription.subscription_id}`, error);
        
        // 오류 발생 시에도 실패 기록
        try {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substr(2, 9);
          const orderId = `error_${timestamp}_${randomStr}`;
          
          await pool.request()
            .input('userId', subscription.user_id)
            .input('orderId', orderId)
            .input('billingKey', subscription.billing_key)
            .input('amount', subscription.amount)
            .input('status', 'failed')
            .input('paymentMethod', 'card')
            .input('errorMessage', error.message || '스케줄러 처리 오류')
            .input('planType', subscription.plan_type)
            .query(`
              INSERT INTO payments (
                user_id, transaction_id, billing_key, amount, 
                status, payment_method, error_message, plan_type,
                created_at, updated_at
              ) VALUES (
                @userId, @orderId, @billingKey, @amount,
                @status, @paymentMethod, @errorMessage, @planType,
                GETDATE(), GETDATE()
              )
            `);
        } catch (dbError) {
          console.error('실패 기록 저장 중 오류:', dbError);
        }
      }
    }
    
    console.log('🎉 자동 결제 실행 스케줄러 완료');
    
  } catch (error) {
    console.error('❌ 자동 결제 실행 스케줄러 오류:', error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 데이터베이스 연결 종료');
    }
  }
}

// 스케줄러 실행 (매시간 실행)
async function scheduleAutoBilling() {
  console.log('⏰ 자동 결제 실행 스케줄러 등록...');
  
  // 현재 시간과 다음 정시까지의 시간 계산
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  
  const timeUntilNextHour = nextHour.getTime() - now.getTime();
  
  console.log(`⏰ 다음 실행 시간: ${nextHour.toLocaleString()}`);
  console.log(`⏰ 대기 시간: ${Math.round(timeUntilNextHour / 1000 / 60)}분`);
  
  // 다음 정시까지 대기
  setTimeout(async () => {
    await autoBillingScheduler();
    
    // 1시간마다 반복 실행
    setInterval(autoBillingScheduler, 60 * 60 * 1000);
  }, timeUntilNextHour);
}

// 즉시 실행 (테스트용)
if (process.argv.includes('--run-now')) {
  autoBillingScheduler();
} else {
  // 스케줄러 등록
  scheduleAutoBilling();
  
  // 프로세스 종료 방지
  process.on('SIGINT', () => {
    console.log('\n🛑 스케줄러 종료 중...');
    process.exit(0);
  });
  
  console.log('🚀 자동 결제 실행 스케줄러가 백그라운드에서 실행 중입니다.');
  console.log('💡 즉시 실행하려면: node auto-billing-scheduler.js --run-now');
  console.log('⏰ 실행 주기: 매시간');
}
