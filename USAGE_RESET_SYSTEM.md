# MOA 월 초기화 시스템 (정확한 시간 기준)

## 개요

MOA 프로젝트의 사용량 초기화 시스템은 **계정 생성일 기준으로 정확히 한 달 후**에 자동으로 초기화됩니다. 이 시스템은 사용자의 서비스 사용량을 계정 생성 시간과 동일한 시간에 매월 초기화합니다.

## 시스템 특징

### 🕐 **초기화 주기**
- **기본 주기**: 계정 생성일 기준으로 정확히 한 달 후
- **시간 정확성**: 계정 생성 시간과 동일한 시간에 초기화
- **자동 연속**: 이전 초기화일 기준으로 정확히 한 달 후 자동 계산

### 📅 **초기화 날짜 계산 로직**

#### **첫 번째 초기화**
```typescript
// 계정 생성일 기준으로 정확히 한 달 후 설정
const resetDate = new Date(userCreatedAt);
resetDate.setMonth(resetDate.getMonth() + 1);
// 시간은 그대로 유지 (오후 1시 생성 → 다음 달 오후 1시 초기화)
```

#### **이후 초기화**
```typescript
// 이전 초기화일 기준으로 정확히 한 달 후 설정
const nextReset = new Date(nextResetDate);
nextReset.setMonth(nextReset.getMonth() + 1);
// 시간은 그대로 유지
```

### 🔄 **초기화 프로세스**

1. **사용량 체크**: 서비스 사용 시마다 `checkUsageLimit()` 함수 호출
2. **초기화 판단**: 현재 날짜가 `next_reset_date`를 지났는지 확인
3. **자동 초기화**: 초기화 필요 시 `usage_count`를 0으로 리셋
4. **다음 초기화 설정**: 정확히 한 달 후로 `next_reset_date` 업데이트

### 📊 **실제 예시**

- **계정 생성**: 2025년 8월 25일 오후 1시
- **첫 초기화**: 2025년 9월 25일 오후 1시
- **두 번째 초기화**: 2025년 10월 25일 오후 1시
- **세 번째 초기화**: 2025년 11월 25일 오후 1시

## 데이터베이스 스키마

### **usage 테이블**
```sql
CREATE TABLE usage (
  id INT PRIMARY KEY IDENTITY(1,1),
  user_id BIGINT NOT NULL,
  service_type NVARCHAR(100) NOT NULL,
  usage_count INT NULL,
  limit_count INT NULL,
  reset_date DATETIME2(7) NULL,
  created_at DATETIME2(7) NULL,
  updated_at DATETIME2(7) NULL,
  next_reset_date DATETIME2(7) NULL  -- 정확한 시간 기준 월 초기화용
);
```

### **주요 컬럼 설명**
- `next_reset_date`: 다음 초기화 날짜 (계정 생성일 기준 정확히 한 달 후)
- `usage_count`: 현재 사용량
- `limit_count`: 사용량 제한
- `reset_date`: 이전 초기화 날짜 (레거시)

## 서비스별 사용량 제한

### **이미지 생성 (image-generate)**
- **기본**: 2회/월
- **Standard**: 120회/월
- **Pro**: 300회/월
- **Admin**: 9999회/월 (무제한)

### **영상 생성 (video-generate)**
- **기본**: 1회/월
- **Standard**: 20회/월
- **Pro**: 45회/월
- **Admin**: 9999회/월 (무제한)

### **AI 채팅 (ai-chat)**
- **기본**: 20회/월
- **모든 플랜**: 동일 제한

## 구현된 파일들

### **핵심 API**
- `src/app/api/usage/check/route.ts` - 사용량 체크 및 초기화
- `src/app/api/admin/usage/route.ts` - 관리자 수동 초기화
- `src/app/api/video-generate/route.ts` - 영상 생성 사용량 관리

### **유틸리티 함수**
- `src/lib/utils.ts` - 정확한 시간 기준 월 초기화 계산 함수들
- `src/lib/auth.ts` - 인증 및 사용량 체크

### **마이그레이션 스크립트**
- `scripts/migrate-reset-date.js` - DB 마이그레이션

### **테스트 페이지**
- `src/app/test-usage-reset/page.tsx` - 정확한 시간 기준 월 초기화 시스템 테스트

## 유틸리티 함수

### **getNextMonthSameTime(baseDate)**
```typescript
export function getNextMonthSameTime(baseDate: Date = new Date()): Date {
  const nextMonth = new Date(baseDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth;
}
```

### **getInitialResetDate(userCreatedAt)**
```typescript
export function getInitialResetDate(userCreatedAt: Date): Date {
  const resetDate = new Date(userCreatedAt);
  resetDate.setMonth(resetDate.getMonth() + 1);
  return resetDate;
}
```

### **shouldResetUsage(resetDate)**
```typescript
export function shouldResetUsage(resetDate: Date): boolean {
  const now = new Date();
  return now > resetDate;
}
```

## 관리자 기능

### **수동 초기화**
```typescript
// 특정 서비스 초기화
PATCH /api/admin/usage
{
  "userId": "user_id",
  "action": "reset",
  "serviceType": "image-generate"
}

// 모든 서비스 초기화
PATCH /api/admin/usage
{
  "userId": "user_id",
  "action": "reset"
}
```

### **무제한 설정**
```typescript
PATCH /api/admin/usage
{
  "userId": "user_id",
  "action": "unlimited",
  "serviceType": "image-generate"
}
```

### **커스텀 제한 설정**
```typescript
PATCH /api/admin/usage
{
  "userId": "user_id",
  "action": "setLimit",
  "serviceType": "image-generate",
  "customLimit": 100
}
```

## 마이그레이션 가이드

### **1. DB 스키마 업데이트**
```sql
-- next_reset_date 컬럼 추가 (이미 존재하는 경우 생략)
ALTER TABLE usage ADD next_reset_date DATETIME2(7) NULL;
```

### **2. 마이그레이션 스크립트 실행**
```bash
cd ai-search-frontend
node scripts/migrate-reset-date.js
```

### **3. 환경 변수 확인**
```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_NAME=your_db_name
```

## 테스트 방법

### **테스트 페이지 접근**
```
http://localhost:3000/test-usage-reset
```

### **테스트 시나리오**
1. **정상 초기화**: 계정 생성일이 지난 경우
2. **초기화 대기**: 아직 초기화일이 도래하지 않은 경우
3. **시간 정확성**: 계정 생성 시간과 초기화 시간이 동일한지 확인
4. **경계값 테스트**: 월말과 월초 경계

## 주의사항

### **시간대 처리**
- 모든 날짜는 서버 시간대 기준으로 처리
- 계정 생성 시간과 동일한 시간에 정확한 초기화

### **성능 고려사항**
- 사용량 체크 시마다 초기화 로직 실행
- 대량 사용자 처리 시 인덱스 최적화 필요

### **데이터 일관성**
- 초기화 중 오류 발생 시 롤백 처리
- 동시 초기화 요청에 대한 락 처리

## 향후 개선 계획

- [ ] **배치 초기화**: 매일 자동 스케줄러로 초기화 필요 사용자 체크
- [ ] **초기화 알림**: 사용자에게 초기화 완료 알림
- [ ] **통계 대시보드**: 월별 사용량 통계
- [ ] **유연한 주기**: 사용자별 맞춤 초기화 주기 설정

## 문제 해결

### **일반적인 문제들**
1. **초기화가 안 되는 경우**: `next_reset_date` 값 확인
2. **잘못된 날짜 계산**: 시간대 설정 확인
3. **성능 이슈**: DB 인덱스 및 쿼리 최적화

### **디버깅 방법**
```typescript
// 로그 확인
console.log(`사용자 ${userId}의 ${serviceType} 사용량 초기화: ${usage.usage_count} -> 0`);

// DB 직접 확인
SELECT * FROM usage WHERE user_id = 'user_id' AND service_type = 'service_type';
```

## 기존 시스템과의 차이점

### **이전 (매월 1일 자정)**
- 모든 사용자가 동일한 날짜에 초기화
- 시간은 항상 00:00:00
- 단순하지만 사용자별 맞춤성 부족

### **현재 (정확한 시간 기준)**
- 각 사용자별로 개별 초기화 날짜
- 계정 생성 시간과 동일한 시간 유지
- 사용자 경험 향상 및 공정성 증대

---

**마지막 업데이트**: 2024년 12월
**버전**: 2.1 (정확한 시간 기준 월 초기화 시스템)
