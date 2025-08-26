# AI Chat - 노션 DB 연동 설정 가이드

## 🚀 구현 완료 사항

### Week 1-4 구현 완료
1. ✅ **노션 DB 클라이언트** (`src/lib/notion-client.ts`)
   - AI 툴 검색 기능
   - 필터링 (카테고리, 가격, 기능)
   - 목업 데이터 폴백

2. ✅ **의도 분석 엔진** (`src/lib/intent-analyzer.ts`)
   - 사용자 질문 의도 파악
   - 가격/기간/카테고리/기능 감지
   - 구조화된 프롬프트 생성

3. ✅ **API 통합** (`src/app/api/chat/route.ts`)
   - AI 툴 검색 의도 감지
   - 노션 DB 검색 연동
   - 구조화된 응답 생성

4. ✅ **프론트엔드** (`src/app/ai-chat/page.tsx`)
   - AI 툴 카드 렌더링
   - 가격/기능 배지 표시
   - 평점 시각화

## 📋 환경변수 설정

`.env.local` 파일에 다음 환경변수 추가:

```env
# Notion API 설정
NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_database_id_here
```

### 노션 API 키 발급 방법
1. https://www.notion.so/my-integrations 접속
2. "New integration" 클릭
3. 이름 입력 및 워크스페이스 선택
4. "Submit" → API 키 복사

### 노션 데이터베이스 설정
1. 노션에서 새 데이터베이스 생성 (Table 형식)
2. 다음 속성 추가:
   - **Name** (Title): AI 툴 이름
   - **URL** (URL): 툴 웹사이트
   - **Category** (Select): image/text/video/audio/code/design
   - **Price** (Select): free/freemium/paid
   - **Features** (Multi-select): 실사/애니메이션/3D/아트/API/한국어
   - **API** (Checkbox): API 제공 여부
   - **Description** (Text): 툴 설명
   - **UsageLimit** (Text): 무료 사용 제한
   - **Rating** (Number): 평점 (1-5)
   - **Image** (URL): 툴 이미지 URL

3. 데이터베이스 URL에서 ID 추출
   - URL 형식: `https://notion.so/{DATABASE_ID}?v=xxx`
   - DATABASE_ID 부분 복사

4. 통합 연결
   - 데이터베이스 페이지 우측 상단 "..." 메뉴
   - "Connections" → 생성한 통합 추가

## 🧪 테스트 방법

### 1. 기본 테스트 (목업 데이터)
환경변수 설정 없이도 목업 데이터로 테스트 가능:

```bash
npm run dev
```

http://localhost:3000/ai-chat 접속 후 다음 질문 테스트:
- "무료 이미지 생성 AI 툴 추천해줘"
- "단기간 사용할 실사 이미지 생성 툴 찾고 있어"
- "API 지원하는 텍스트 AI 툴 알려줘"

### 2. 노션 DB 연동 테스트
1. 환경변수 설정 완료
2. 노션 데이터베이스에 AI 툴 데이터 입력
3. 서버 재시작 후 테스트

## 📝 예시 질문

### 이미지 생성 관련
- "난 단기간에 쓸 수 있는 무료 이미지 생성 AI툴을 찾고 있는데 실사로 만드는 이미지를 전문하는 이미지생성툴을 찾고 싶어"
- "로고 디자인에 적합한 AI 툴 추천해줘"
- "3D 이미지 생성 가능한 툴 있어?"

### 텍스트 관련
- "한국어 지원하는 대화형 AI 추천해줘"
- "코드 생성 도와주는 AI 툴 알려줘"
- "번역에 특화된 AI 서비스 찾고 있어"

### 비디오/오디오 관련
- "무료로 쓸 수 있는 비디오 생성 AI 있어?"
- "음성 합성 AI 툴 추천해줘"

## 🎨 응답 형식

AI는 다음 구조로 응답합니다:

```
## 🎯 추천 AI 툴: [툴 이름]

### 1. 한줄평
[핵심 특징 요약]

### 2. 추천 이유
• [매칭 이유들]

### 3. API 여부
[API 정보]

### 4. 활용 방안
• [사용 시나리오]

### 5. 결론
[최종 정리]
```

추천 툴은 카드 형식으로 표시:
- 툴 이름, 설명
- 가격 배지 (무료/무료+유료/유료)
- API 지원 배지
- 기능 태그
- 평점 (별점)
- 사용 제한 정보

## 🔧 문제 해결

### 노션 API 연결 실패
- API 키 확인
- 데이터베이스 ID 확인
- 통합 권한 확인

### 검색 결과 없음
- 데이터베이스 속성명 확인 (대소문자 구분)
- 필터 조건 확인
- 목업 데이터로 폴백되는지 확인

### 의도 분석 실패
- 키워드가 제대로 감지되는지 확인
- `detectToolSearchIntent` 함수 로그 확인

## 📚 추가 개발 아이디어

1. **캐싱 구현**
   - 노션 API 응답 캐싱
   - Redis 연동

2. **고급 필터링**
   - 평점 기반 정렬
   - 복합 조건 검색

3. **사용자 피드백**
   - 추천 만족도 수집
   - 개인화 추천

4. **다국어 지원**
   - 영어 질문 지원
   - 응답 번역

## 📄 라이선스
MIT
