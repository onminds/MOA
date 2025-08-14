-- 구독 관련 테이블 생성

-- 1. 빌링키 테이블 (카드 정보 저장)
CREATE TABLE billing_keys (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id NVARCHAR(255) NOT NULL,
    customer_key NVARCHAR(255) NOT NULL UNIQUE,
    billing_key NVARCHAR(255) NOT NULL,
    card_info NVARCHAR(MAX), -- 카드 정보 (마스킹된)
    is_active BIT DEFAULT 1,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 2. 구독 테이블
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
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (billing_key_id) REFERENCES billing_keys(id)
);

-- 3. 구독 결제 내역 테이블
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
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    FOREIGN KEY (billing_key_id) REFERENCES billing_keys(id)
);

-- 인덱스 생성
CREATE INDEX idx_billing_keys_user_id ON billing_keys(user_id);
CREATE INDEX idx_billing_keys_customer_key ON billing_keys(customer_key);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_next_billing_date ON subscriptions(next_billing_date);
CREATE INDEX idx_subscription_payments_subscription_id ON subscription_payments(subscription_id);
CREATE INDEX idx_subscription_payments_billing_date ON subscription_payments(billing_date);

-- 기존 payments 테이블에 subscription 관련 컬럼 추가
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'is_subscription')
BEGIN
    ALTER TABLE payments ADD is_subscription BIT DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'payments' AND COLUMN_NAME = 'subscription_id')
BEGIN
    ALTER TABLE payments ADD subscription_id INT NULL;
END 