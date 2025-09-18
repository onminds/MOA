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

async function autoPlanChangeScheduler() {
  let pool;
  try {
    console.log('🔄 자동 플랜 전환 스케줄러 시작...');
    
    pool = await sql.connect(config);
    console.log('✅ 데이터베이스 연결 성공');
    
    // 1. 다음 결제일이 도래한 취소된 구독 조회
    const expiredSubscriptions = await pool.request().query(`
      SELECT 
        sc.user_id,
        sc.subscription_id,
        sc.next_billing_date,
        s.plan_type
      FROM subscription_cancellations sc
      INNER JOIN subscriptions s ON sc.subscription_id = s.subscription_id
      WHERE sc.auto_plan_change = 1
        AND sc.next_billing_date <= GETDATE()
        AND sc.plan_changed = 0
    `);
    
    console.log(`📊 자동 플랜 전환 대상 구독 수: ${expiredSubscriptions.recordset.length}`);
    
    if (expiredSubscriptions.recordset.length === 0) {
      console.log('✅ 전환할 구독이 없습니다.');
      return;
    }
    
    // 2. 각 구독에 대해 Basic Plan으로 전환
    for (const subscription of expiredSubscriptions.recordset) {
      try {
        console.log(`🔄 구독 전환 처리 중: ${subscription.subscription_id}`);
        
        // Basic Plan 결제 기록 생성 (무료)
        await pool.request()
          .input('userId', subscription.user_id)
          .input('planType', 'basic')
          .input('amount', 0)
          .input('status', 'completed')
          .input('subscriptionId', subscription.subscription_id)
          .query(`
            INSERT INTO payments (
              user_id, plan_type, amount, status, subscription_id,
              created_at, updated_at
            ) VALUES (
              @userId, @planType, @amount, @status, @subscriptionId,
              GETDATE(), GETDATE()
            )
          `);
        
        // 자동 플랜 전환 완료 표시
        await pool.request()
          .input('subscriptionId', subscription.subscription_id)
          .query(`
            UPDATE subscription_cancellations 
            SET plan_changed = 1,
                plan_changed_at = GETDATE(),
                updated_at = GETDATE()
            WHERE subscription_id = @subscriptionId
          `);
        
        console.log(`✅ 구독 전환 완료: ${subscription.subscription_id} (${subscription.plan_type} → basic)`);
        
      } catch (error) {
        console.error(`❌ 구독 전환 실패: ${subscription.subscription_id}`, error);
      }
    }
    
    console.log('🎉 자동 플랜 전환 스케줄러 완료');
    
  } catch (error) {
    console.error('❌ 자동 플랜 전환 스케줄러 오류:', error);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 데이터베이스 연결 종료');
    }
  }
}

// 스케줄러 실행 (매일 자정에 실행)
async function scheduleAutoPlanChange() {
  console.log('⏰ 자동 플랜 전환 스케줄러 등록...');
  
  // 현재 시간과 다음 자정까지의 시간 계산
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = nextMidnight.getTime() - now.getTime();
  
  console.log(`⏰ 다음 실행 시간: ${nextMidnight.toLocaleString()}`);
  console.log(`⏰ 대기 시간: ${Math.round(timeUntilMidnight / 1000 / 60)}분`);
  
  // 다음 자정까지 대기
  setTimeout(async () => {
    await autoPlanChangeScheduler();
    
    // 24시간마다 반복 실행
    setInterval(autoPlanChangeScheduler, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);
}

// 즉시 실행 (테스트용)
if (process.argv.includes('--run-now')) {
  autoPlanChangeScheduler();
} else {
  // 스케줄러 등록
  scheduleAutoPlanChange();
  
  // 프로세스 종료 방지
  process.on('SIGINT', () => {
    console.log('\n🛑 스케줄러 종료 중...');
    process.exit(0);
  });
  
  console.log('🚀 자동 플랜 전환 스케줄러가 백그라운드에서 실행 중입니다.');
  console.log('💡 즉시 실행하려면: node auto-plan-change-scheduler.js --run-now');
}
