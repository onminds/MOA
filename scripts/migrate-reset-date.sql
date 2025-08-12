-- 사용량 테이블의 reset_date를 next_reset_date로 마이그레이션
-- 기존 reset_date가 있는 경우 계정 생성일 기준으로 일주일 후로 설정

-- 1. next_reset_date 컬럼이 없으면 추가
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'usage' AND COLUMN_NAME = 'next_reset_date')
BEGIN
    ALTER TABLE usage ADD next_reset_date DATETIME NULL;
END

-- 2. 기존 reset_date가 있는 경우 next_reset_date로 마이그레이션
UPDATE usage 
SET next_reset_date = DATEADD(day, 7, u.created_at)
FROM usage us
INNER JOIN users u ON us.user_id = u.id
WHERE us.next_reset_date IS NULL 
  AND u.created_at IS NOT NULL;

-- 3. next_reset_date가 여전히 NULL인 경우 현재 시간 기준으로 일주일 후로 설정
UPDATE usage 
SET next_reset_date = DATEADD(day, 7, GETDATE())
WHERE next_reset_date IS NULL;

-- 4. 마이그레이션 결과 확인
SELECT 
    u.email,
    us.service_type,
    us.usage_count,
    us.limit_count,
    us.next_reset_date,
    u.created_at as user_created_at
FROM usage us
INNER JOIN users u ON us.user_id = u.id
ORDER BY u.email, us.service_type;

-- 5. reset_date 컬럼 제거 (선택사항 - 안전을 위해 주석 처리)
-- ALTER TABLE usage DROP COLUMN reset_date;
