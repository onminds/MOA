-- 기존 사용자들의 next_reset_date 설정
-- 계정 생성일 기준으로 일주일 후로 설정

-- 이미지 생성 서비스
UPDATE usage 
SET next_reset_date = DATEADD(day, 7, u.created_at)
FROM usage us
INNER JOIN users u ON us.user_id = u.id
WHERE us.service_type = 'image-generate' 
  AND us.next_reset_date IS NULL;

-- 영상 생성 서비스
UPDATE usage 
SET next_reset_date = DATEADD(day, 7, u.created_at)
FROM usage us
INNER JOIN users u ON us.user_id = u.id
WHERE us.service_type = 'video-generate' 
  AND us.next_reset_date IS NULL;

-- 설정된 next_reset_date 확인
SELECT 
    u.email,
    us.service_type,
    us.usage_count,
    us.next_reset_date,
    u.created_at as user_created_at
FROM usage us
INNER JOIN users u ON us.user_id = u.id
WHERE us.service_type IN ('image-generate', 'video-generate')
ORDER BY u.email, us.service_type; 