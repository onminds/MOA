# MOA - AI 도구 검색 및 커뮤니티 플랫폼

MOA는 AI 도구 검색, 커뮤니티, 그리고 다양한 AI 서비스를 제공하는 종합 플랫폼입니다.

## 🚀 주요 기능

### 🤖 AI 서비스
- **AI 채팅**: GPT-3.5/4o 모델을 활용한 지능형 대화
- **이미지 생성**: DALL-E, Stable Diffusion 등 다양한 AI 모델 지원
- **AI 도구 검색**: 500+ AI 도구 데이터베이스
- **리뷰 시스템**: AI 도구에 대한 사용자 리뷰 및 평가

### 💳 결제 시스템
- **토스페이먼츠 연동**: 안전한 결제 처리
- **플랜 시스템**: Basic(무료), Standard(15,900원), Pro(29,000원)
- **사용량 관리**: 플랜별 AI 서비스 사용량 제한 및 추적

### 👥 커뮤니티
- **게시글 작성**: 자유로운 커뮤니티 활동
- **댓글 시스템**: 게시글에 대한 댓글 및 대화
- **좋아요 기능**: 게시글 및 댓글 좋아요
- **카테고리 분류**: 주제별 게시글 분류

### 🔐 인증 시스템
- **소셜 로그인**: Google, Kakao OAuth 지원
- **자체 로그인**: 이메일/비밀번호 회원가입
- **프로필 관리**: 사용자 정보 및 아바타 업데이트

### 👨‍💼 관리자 기능
- **사용자 관리**: 회원 목록 및 권한 관리
- **플랜 관리**: 사용자 플랜 수동 변경
- **사용량 관리**: AI 서비스 사용량 초기화 및 제한 설정

## 🛠 기술 스택

### Frontend
- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS**

### Backend
- **Next.js API Routes**
- **SQL Server** (Microsoft SQL Server)
- **NextAuth.js** (인증)

### AI & 외부 서비스
- **OpenAI API** (GPT, DALL-E)
- **Replicate API** (Stable Diffusion 등)
- **토스페이먼츠** (결제)

## 📦 설치 및 실행

### 1. 환경 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
# 데이터베이스
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SERVER=your_db_server
DB_PORT=your_db_port
DB_NAME=your_db_name

# 인증
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# OAuth (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# OAuth (Kakao)
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret

# AI 서비스
OPENAI_API_KEY=your_openai_api_key
REPLICATE_API_TOKEN=your_replicate_token

# 결제
NEXT_PUBLIC_TOSS_CLIENT_KEY=your_toss_client_key
TOSS_SECRET_KEY=your_toss_secret_key
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 확인하세요.

## 🗄 데이터베이스 스키마

### 주요 테이블
- `users`: 사용자 정보
- `payments`: 결제 내역
- `usage`: AI 서비스 사용량
- `posts`: 커뮤니티 게시글
- `comments`: 댓글
- `likes`: 좋아요
- `ai_reviews`: AI 도구 리뷰
- `review_votes`: 리뷰 투표

## 🔄 마이그레이션 완료 사항

### ✅ 완료된 작업
1. **Prisma → SQL Server 마이그레이션**
   - 모든 데이터베이스 쿼리를 SQL Server로 변경
   - Prisma 의존성 완전 제거
   - 직접 SQL 쿼리 사용

2. **결제 시스템 통합**
   - 토스페이먼츠 결제 게이트웨이 연동
   - 플랜별 사용량 제한 시스템
   - 결제 내역 관리

3. **인증 시스템 개선**
   - Google, Kakao 소셜 로그인 완전 통합
   - 세션 관리 최적화
   - 사용자 권한 시스템

4. **커뮤니티 기능**
   - 게시글, 댓글, 좋아요 시스템
   - 실시간 업데이트
   - 권한 기반 삭제 기능

5. **AI 서비스**
   - 다중 AI 모델 지원
   - 사용량 기반 제한
   - 실시간 사용량 추적

## 🚀 배포

### Vercel 배포
```bash
npm run build
```

### 환경 변수 설정
배포 시 모든 환경 변수를 Vercel 대시보드에서 설정하세요.

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여

버그 리포트나 기능 제안은 이슈를 통해 해주세요.
Pull Request도 환영합니다!

---

**MOA Team** - AI 도구 검색의 새로운 기준
