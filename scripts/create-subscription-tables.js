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

const createTablesSQL = `
-- 구독 관련 테이블 생성

-- 1. 빌링키 테이블 (카드 정보 저장)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='billing_keys' AND xtype='U')
BEGIN
  CREATE TABLE billing_keys (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id NVARCHAR(255) NOT NULL,
      customer_key NVARCHAR(255) NOT NULL UNIQUE,
      billing_key NVARCHAR(255) NOT NULL,
      card_info NVARCHAR(MAX), -- 카드 정보 (마스킹된)
      is_active BIT DEFAULT 1,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
  );
  PRINT 'billing_keys 테이블이 생성되었습니다.';
END
ELSE
BEGIN
  PRINT 'billing_keys 테이블이 이미 존재합니다.';
END

-- 2. 구독 테이블
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='subscriptions' AND xtype='U')
BEGIN
  CREATE TABLE subscriptions (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id NVARCHAR(255) NOT NULL,
      billing_key_id INT NOT NULL,
      plan_type NVARCHAR(50) NOT NULL, -- basic, standard, pro
      status NVARCHAR(50) NOT NULL DEFAULT 'active', -- active, paused, cancelled
      amount INT NOT NULL,
      billing_cycle NVARCHAR(20) NOT NULL, -- monthly, yearly
      next_billing_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
  );
  PRINT 'subscriptions 테이블이 생성되었습니다.';
END
ELSE
BEGIN
  PRINT 'subscriptions 테이블이 이미 존재합니다.';
END

-- 3. 구독 결제 내역 테이블
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='subscription_payments' AND xtype='U')
BEGIN
  CREATE TABLE subscription_payments (
      id INT IDENTITY(1,1) PRIMARY KEY,
      subscription_id INT NOT NULL,
      billing_key_id INT NOT NULL,
      order_id NVARCHAR(255) NOT NULL UNIQUE,
      payment_key NVARCHAR(255),
      amount INT NOT NULL,
      status NVARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, completed, failed
      billing_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT GETDATE(),
      updated_at DATETIME DEFAULT GETDATE()
  );
  PRINT 'subscription_payments 테이블이 생성되었습니다.';
END
ELSE
BEGIN
  PRINT 'subscription_payments 테이블이 이미 존재합니다.';
END

-- 인덱스 생성
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_billing_keys_user_id')
BEGIN
  CREATE INDEX idx_billing_keys_user_id ON billing_keys(user_id);
  PRINT 'idx_billing_keys_user_id 인덱스가 생성되었습니다.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_billing_keys_customer_key')
BEGIN
  CREATE INDEX idx_billing_keys_customer_key ON billing_keys(customer_key);
  PRINT 'idx_billing_keys_customer_key 인덱스가 생성되었습니다.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_subscriptions_user_id')
BEGIN
  CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
  PRINT 'idx_subscriptions_user_id 인덱스가 생성되었습니다.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_subscriptions_next_billing_date')
BEGIN
  CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
  PRINT 'idx_subscriptions_next_billing_date 인덱스가 생성되었습니다.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_subscription_payments_subscription_id')
BEGIN
  CREATE INDEX idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
  PRINT 'idx_subscription_payments_subscription_id 인덱스가 생성되었습니다.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'idx_subscription_payments_billing_date')
BEGIN
  CREATE INDEX idx_subscription_payments_billing_date ON subscription_payments(billing_date);
  PRINT 'idx_subscription_payments_billing_date 인덱스가 생성되었습니다.';
END

-- 기존 payments 테이블에 subscription 관련 컬럼 추가
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'is_subscription')
BEGIN
    ALTER TABLE payments ADD is_subscription BIT DEFAULT 0;
    PRINT 'payments 테이블에 is_subscription 컬럼이 추가되었습니다.';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'subscription_id')
BEGIN
    ALTER TABLE payments ADD subscription_id INT NULL;
    PRINT 'payments 테이블에 subscription_id 컬럼이 추가되었습니다.';
END
`;

async function createTables() {
  try {
    console.log('데이터베이스 연결 중...');
    const pool = await sql.connect(config);
    console.log('데이터베이스 연결 성공!');

    console.log('구독 관련 테이블 생성 시작...');
    await pool.request().query(createTablesSQL);
    
    console.log('모든 테이블 생성이 완료되었습니다!');
    
    // 테이블 생성 확인
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('billing_keys', 'subscriptions', 'subscription_payments')
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n생성된 테이블 목록:');
    tablesResult.recordset.forEach(table => {
      console.log(`- ${table.TABLE_NAME}`);
    });

  } catch (error) {
    console.error('테이블 생성 중 오류 발생:', error);
  } finally {
    await sql.close();
  }
}

createTables(); 