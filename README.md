# MOA - AI Search Engine

## 🚀 자동 결제 시스템

### 자동 결제 실행 스케줄러

MOA는 완전 자동화된 구독 결제 시스템을 제공합니다.

#### 실행 방법

```bash
# 백그라운드에서 매시간 실행 (권장)
npm run auto-billing

# 즉시 실행 (테스트용)
npm run auto-billing:now
```

#### 주요 기능

- **자동 결제 실행**: `next_billing_date` 도달 시 자동으로 결제 진행
- **실패 처리**: 결제 실패 시 구독 상태를 `inactive`로 변경
- **로깅**: 모든 결제 시도와 결과를 상세히 기록
- **에러 복구**: 네트워크 오류나 시스템 오류 시에도 안전하게 처리

#### 실행 주기

- **기본**: 매시간 실행
- **실행 시점**: 매 정시 (00:00, 01:00, 02:00...)
- **처리 대상**: `next_billing_date <= 현재시간`인 활성 구독

#### 모니터링

스케줄러 실행 시 다음과 같은 로그를 확인할 수 있습니다:

```
🔄 자동 결제 실행 스케줄러 시작...
✅ 데이터베이스 연결 성공
📊 자동 결제 실행 대상 구독 수: 2
🔄 자동 결제 처리 중: sub_123 (standard)
✅ 자동 결제 성공: sub_123
✅ 구독 정보 업데이트 완료: sub_123
📅 다음 결제일: 2025-10-21T10:00:00.000Z
🎉 자동 결제 실행 스케줄러 완료
```

#### 환경 변수

`.env.local` 파일에 다음 환경 변수가 설정되어 있어야 합니다:

```env
# Database
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_PORT=1433
DB_NAME=your_db_name

# TossPayments
TOSS_SECRET_KEY=your_toss_secret_key
```

#### 프로덕션 배포

프로덕션 환경에서는 다음과 같이 실행하는 것을 권장합니다:

```bash
# PM2를 사용한 백그라운드 실행
pm2 start scripts/auto-billing-scheduler.js --name "moa-auto-billing"

# 또는 systemd 서비스로 등록
sudo systemctl enable moa-auto-billing
sudo systemctl start moa-auto-billing
```

---

## 📋 기존 기능들

### 주요 기능
- AI 도구 검색 및 추천
- 이미지 생성 및 편집
- 영상 생성
- 문서 처리 및 분석
- 커뮤니티 기능

### 기술 스택
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, MSSQL
- **Authentication**: NextAuth.js
- **Payment**: TossPayments
- **AI Services**: OpenAI, Replicate

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 자동 결제 스케줄러 실행
npm run auto-billing
```

### 환경 설정

`.env.local` 파일을 생성하고 필요한 환경 변수를 설정하세요.

---

## 🤝 기여하기

프로젝트에 기여하고 싶으시다면 Pull Request를 보내주세요!

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.
