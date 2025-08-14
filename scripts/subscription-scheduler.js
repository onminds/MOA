const cron = require('node-cron');
const sql = require('mssql');
const fetch = require('node-fetch');

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

// 매일 자정에 실행되는 구독 결제 스케줄러
cron.schedule('0 0 * * *', async () => {
  console.log('=== 구독 결제 스케줄러 시작 ===', new Date().toISOString());
  
  try {
    const pool = await sql.connect(config);
    
    // 오늘 결제 예정인 구독 조회
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await pool.request()
      .input('today', today)
      .input('tomorrow', tomorrow)
      .query(`
        SELECT s.id, s.user_id, s.plan_type, s.amount, s.billing_cycle,
               bk.billing_key, bk.customer_key,
               u.email, u.display_name
        FROM subscriptions s
        JOIN billing_keys bk ON s.billing_key_id = bk.id
        JOIN users u ON s.user_id = u.id
        WHERE s.status = 'active' 
          AND s.next_billing_date >= @today 
          AND s.next_billing_date < @tomorrow
      `);

    console.log(`오늘 결제 예정 구독: ${result.recordset.length}개`);

    for (const subscription of result.recordset) {
      try {
        console.log(`구독 ID ${subscription.id} 결제 처리 시작...`);
        
        // 주문 ID 생성
        const orderId = `sub_${Date.now()}_${subscription.id}_${Math.random().toString(36).substr(2, 9)}`;
        
        // 토스페이먼츠 빌링 결제 API 호출
        const response = await fetch(`https://api.tosspayments.com/v1/billing/${subscription.billing_key}`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.TOSS_SECRET_KEY + ':').toString('base64')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            customerKey: subscription.customer_key,
            amount: subscription.amount,
            orderId: orderId,
            orderName: `${subscription.plan_type} 구독 결제`,
            customerEmail: subscription.email || 'user@example.com',
            customerName: subscription.display_name || '사용자',
            taxFreeAmount: 0
          })
        });

        const result = await response.json();
        
        if (response.ok && result.status === 'DONE') {
          // 결제 성공
          const paymentKey = result.paymentKey;
          
          // 구독 결제 내역 저장
          await pool.request()
            .input('subscriptionId', subscription.id)
            .input('billingKeyId', subscription.billing_key_id)
            .input('orderId', orderId)
            .input('paymentKey', paymentKey)
            .input('amount', subscription.amount)
            .input('status', 'completed')
            .input('billingDate', new Date())
            .query(`
              INSERT INTO subscription_payments (subscription_id, billing_key_id, order_id, payment_key, amount, status, billing_date)
              VALUES (@subscriptionId, @billingKeyId, @orderId, @paymentKey, @amount, @status, @billingDate)
            `);

          // 다음 결제일 업데이트
          const nextBillingDate = new Date();
          if (subscription.billing_cycle === 'monthly') {
            nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
          } else if (subscription.billing_cycle === 'yearly') {
            nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
          }

          await pool.request()
            .input('subscriptionId', subscription.id)
            .input('nextBillingDate', nextBillingDate)
            .query(`
              UPDATE subscriptions 
              SET next_billing_date = @nextBillingDate, updated_at = GETDATE()
              WHERE id = @subscriptionId
            `);

          console.log(`구독 ID ${subscription.id} 결제 성공: ${subscription.amount}원`);
        } else {
          // 결제 실패
          await pool.request()
            .input('subscriptionId', subscription.id)
            .input('billingKeyId', subscription.billing_key_id)
            .input('orderId', orderId)
            .input('amount', subscription.amount)
            .input('status', 'failed')
            .input('billingDate', new Date())
            .query(`
              INSERT INTO subscription_payments (subscription_id, billing_key_id, order_id, amount, status, billing_date)
              VALUES (@subscriptionId, @billingKeyId, @orderId, @amount, @status, @billingDate)
            `);

          console.log(`구독 ID ${subscription.id} 결제 실패: ${result.message || '알 수 없는 오류'}`);
        }
      } catch (error) {
        console.error(`구독 ID ${subscription.id} 처리 중 오류:`, error);
      }
    }
    
    console.log('=== 구독 결제 스케줄러 완료 ===');
  } catch (error) {
    console.error('구독 결제 스케줄러 오류:', error);
  }
});

// 테스트용: 매분 실행 (개발 환경에서만 사용)
if (process.env.NODE_ENV === 'development') {
  console.log('개발 환경: 매분 구독 결제 스케줄러 활성화');
  cron.schedule('* * * * *', async () => {
    console.log('=== 개발 환경 구독 결제 스케줄러 실행 ===', new Date().toISOString());
    // 위의 로직과 동일하지만 더 자주 실행
  });
}

console.log('구독 결제 스케줄러가 시작되었습니다.'); 