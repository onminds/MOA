-- 특정 이메일의 사용자를 관리자로 설정
UPDATE users SET role = 'ADMIN' WHERE email = 'onminds123@gmail.com';

-- 결과 확인
SELECT id, email, name, role FROM users WHERE email = 'onminds123@gmail.com'; 