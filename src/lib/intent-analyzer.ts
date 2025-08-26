// AI 툴 검색 의도 분석 엔진

export interface UserIntent {
  pricePreference: 'free' | 'paid' | 'any';
  timeframe: 'short' | 'long' | 'any';
  category: string | null;
  features: string[];
  useCase: string | null;
  isToolSearch: boolean;
  count: number | null;
}

// V2: 단문/모호문 인식 강화를 위한 고수준 의도 라벨
export type HighLevelIntent = 'ppt_generate' | 'image_generate' | 'search_tools' | 'general_chat';
export interface InferredIntentV2 {
  label: HighLevelIntent;
  confidence: number; // 0~1
  slots: Partial<{
    topic: string; slides: number; tone: 'formal' | 'casual'; language: 'ko' | 'en'; purpose: 'work' | 'class' | 'talk';
    action: 'generate' | 'edit' | 'analyze' | 'summarize' | 'translate';
    platform: 'youtube' | 'instagram' | 'tiktok' | 'none';
  }>;
  rationale: string[];
}

// 사용자 의도 분석
export function analyzeUserIntent(query: string): UserIntent {
  const lowerQuery = query.toLowerCase();
  
  return {
    pricePreference: detectPrice(lowerQuery),
    timeframe: detectTimeframe(lowerQuery),
    category: detectCategory(lowerQuery),
    features: detectFeatures(lowerQuery),
    useCase: detectUseCase(lowerQuery),
    isToolSearch: detectToolSearchIntent(lowerQuery),
    count: detectCount(lowerQuery)
  };
}

// 간단 한국어 정규화
function normalizeKo(text: string): string {
  return text
    .replace(/\s+/g, ' ') // 다중 공백 정리
    .replace(/[~!@#\$%\^&\*\(\)_\+=\[\]{};:"<>\\|]/g, '')
    .trim();
}

// 규칙 기반 V2 의도 추론: 저지연
export function inferIntentV2(raw: string): InferredIntentV2 {
  const q = normalizeKo(raw.toLowerCase());
  const rationale: string[] = [];

  // 키 집합
  const pptKeys = ['ppt', '피피티', '프레젠테이션', '슬라이드', '발표자료', '발표 자료'];
  const makeKeys = ['만들', '제작', '생성', '만들어', '초안', '템플릿', '만들어줘', '만들어 줘'];
  const topicKeys = ['주제', '제목'];
  const slidesMatch = q.match(/(\d+)\s*(장|페이지|슬라이드)/);
  const formal = /(격식|포멀|formal|정중)/.test(q);
  const casual = /(친근|편한|캐주얼|casual)/.test(q);
  const langKo = /(한국어|한글|ko|korean)/.test(q);
  const langEn = /(영어|en|english)/.test(q);
  const platform = ((): 'youtube' | 'instagram' | 'tiktok' | 'none' => {
    if (/(유튜브|youtube|yt)/.test(q)) return 'youtube';
    if (/(인스타|instagram|ig|릴스)/.test(q)) return 'instagram';
    if (/(틱톡|tiktok)/.test(q)) return 'tiktok';
    return 'none';
  })();
  const action = ((): 'generate' | 'edit' | 'analyze' | 'summarize' | 'translate' => {
    if (/(편집|자르기|컷편집|합성|보정|레벨|정리)/.test(q)) return 'edit';
    if (/(분석|탐지|식별|인식|추출)/.test(q)) return 'analyze';
    if (/(요약|summary|summarize)/.test(q)) return 'summarize';
    if (/(번역|translate|translation)/.test(q)) return 'translate';
    return 'generate';
  })();

  // 점수 계산
  let score = 0;
  if (pptKeys.some(k => q.includes(k))) { score += 0.5; rationale.push('ppt 키워드'); }
  if (makeKeys.some(k => q.includes(k))) { score += 0.3; rationale.push('생성 동사'); }
  if (slidesMatch) { score += 0.1; rationale.push('분량 감지'); }
  if (formal || casual) { score += 0.05; rationale.push('톤 감지'); }
  if (langKo || langEn) { score += 0.05; rationale.push('언어 감지'); }

  // 라벨 결정
  let label: HighLevelIntent = 'general_chat';
  if (score >= 0.45) label = 'ppt_generate';
  else if (/(이미지|image|사진|그림)/.test(q) && makeKeys.some(k => q.includes(k))) label = 'image_generate';
  else if (detectToolSearchIntent(q)) label = 'search_tools';

  // 슬롯 추출
  const slots: any = {};
  if (slidesMatch) slots.slides = Math.min(parseInt(slidesMatch[1], 10) || 10, 30);
  if (formal) slots.tone = 'formal';
  if (casual) slots.tone = 'casual';
  if (langKo) slots.language = 'ko';
  if (langEn) slots.language = 'en';
  if (platform !== 'none') slots.platform = platform;
  slots.action = action;

  return { label, confidence: Math.min(score, 1), slots, rationale };
}

// 의도 레지스트리 기반 스코어링(확장용)
export function scoreWithRegistry(text: string): { key: string | null; score: number } {
  const q = normalizeKo(text.toLowerCase());
  // 동적 import 방지: 경량 의존 없이 간단 스코어링 (레지스트리 존재 시만 동작)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { INTENT_REGISTRY } = require('@/config/intents');
    let best: { key: string | null; score: number } = { key: null, score: 0 };
    for (const [key, cfg] of Object.entries(INTENT_REGISTRY)) {
      let s = 0;
      if ((cfg as any).nouns.some((n: string) => q.includes(n))) s += 0.5;
      if ((cfg as any).verbs.some((v: string) => q.includes(v))) s += 0.3;
      if (s > best.score) best = { key, score: s };
    }
    return best;
  } catch {
    return { key: null, score: 0 };
  }
}

// 모호도 점수: 0(명확) ~ 1(매우 모호)
export function computeAmbiguity(raw: string): { score: number; reasons: string[] } {
  const q = normalizeKo(String(raw || '').toLowerCase());
  const reasons: string[] = [];
  let score = 0;
  // 매우 짧은 입력
  if (q.length <= 6) { score += 0.4; reasons.push('짧은 입력'); }
  // 카테고리 미탐지
  const cat = detectCategory(q);
  if (!cat) { score += 0.3; reasons.push('카테고리 없음'); }
  // 의미 적은 일반 동사만 존재
  if (/(알려줘|추천|도와줘|해줘|해줄래|가능해|가능|뭐가|무엇)/.test(q) && !/(자세히|가격|API|무료|유료|개수|조건)/.test(q)) {
    score += 0.2; reasons.push('일반 동사 위주');
  }
  // 숫자/제약 부재
  if (!/(\d+\s*개|무료|유료|api|개수|최소|top|best)/.test(q)) { score += 0.1; reasons.push('제약 없음'); }
  return { score: Math.min(1, score), reasons };
}

// 웹페이지 관련 의도 감지: "웹페이지를 만들고 싶어"와 같은 제작 의도 탐지
export function detectWebsiteBuildIntent(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const pageWords = /(웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트|웹\s*앱|웹앱|web\s*app|webapp)/;
  const buildWords = /(만들|만들만한|제작|생성|빌드|build|개발|제작해|만들어)/;
  // 질문형/의지 표현
  const wantPattern = /(싶어|원해|가능|될까|할 수 있|어떻게.*만들|방법)/;
  return pageWords.test(q) && (buildWords.test(q) || wantPattern.test(q));
}

// 웹페이지 제작에 "도움이 되는" 도구를 찾는 의도 감지
export function detectWebsiteAssistIntent(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const pageWords = /(웹\s*페이지|웹페이지|웹사이트|홈페이지|landing\s*page|랜딩\s*페이지|사이트|웹\s*앱|웹앱|web\s*app|webapp)/;
  const helpWords = /(도움|유용|추천|알려|있어\?|있나요|무엇|뭐가|빨리|빠르게|손쉽게|간편|쉽게|빠른|빠르게\s*만드는)/;
  // "만드는 데 도움이 되는"과 같이 보조 성격의 질의
  const assistStruct = /(만들.*도움|제작.*도움|만들.*유용|제작.*유용)/;
  return pageWords.test(q) && (assistStruct.test(q) || helpWords.test(q));
}

// 가격 선호도 감지
function detectPrice(query: string): 'free' | 'paid' | 'any' {
  if (/무료|free|공짜|프리|비용.*없|돈.*안|무비용/.test(query)) return 'free';
  if (/유료|paid|구독|프리미엄|결제|비용/.test(query)) return 'paid';
  return 'any';
}

// 사용 기간 감지
function detectTimeframe(query: string): 'short' | 'long' | 'any' {
  if (/단기|임시|잠시|일시적|짧은|며칠|일주일|한.*달/.test(query)) return 'short';
  if (/장기|계속|지속|영구|오래|꾸준|항상/.test(query)) return 'long';
  return 'any';
}

// 카테고리 감지 (동의어 확장)
function detectCategory(query: string): string | null {
  try {
    const { CATEGORY_PATTERNS } = require('@/config/patterns');
    for (const p of CATEGORY_PATTERNS) {
      if (p.keywords.some((k: string) => query.includes(String(k).toLowerCase()))) {
        // 몇몇 카테고리는 기존 명칭과 매핑
        if (p.category === 'dataviz') return 'design';
        if (p.category === 'notes') return 'text';
        if (p.category === 'spreadsheet') return 'spreadsheet';
        return p.category;
      }
    }
  } catch {}
  if (/(이미지|그림|사진|비주얼|image|photo|picture|픽처|로고|썸네일|포스터|배너)/.test(query)) return 'image';
  if (/(텍스트|글|문서|text|writing|작성|문장|카피|카피라이팅|요약|번역)/.test(query)) return 'text';
  if (/(비디오|영상|동영상|video|movie|무비|편집\s*툴|영상\s*툴|컷편집|모션그래픽|유튜브|shorts|릴스)/.test(query)) return 'video';
  if (/(오디오|음성|소리|audio|voice|sound|사운드|tts|stt|음성합성|음성인식)/.test(query)) return 'audio';
  if (/(코드|프로그래밍|개발|code|programming|코딩|api|스크립트|자동화)/.test(query)) return 'code';
  // IDE/에디터 계열도 코드 카테고리에 포함
  if (/(ide|에디터|편집기|visual\s*studio\s*code|vscode|intellij|jetbrains|sublime|vim)/.test(query)) return 'code';
  if (/(디자인|design|ui|ux|브랜딩|타이포|레이아웃)/.test(query)) return 'design';
  if (/(협업|collab|collaboration|워크플로우|workflow|업무관리|업무|프로세스|자동화\s*도구|작업관리|task|todo|to-do|칸반|kanban|프로젝트|project|생산성|productivity|일정|캘린더)/.test(query)) return 'workflow';
  // 아바타/버추얼 휴먼 관련 카테고리 (툴 검색 라우팅 강화를 위해 별도 태그)
  if (/(아바타|avatar|버추얼\s*휴먼|virtual\s*human|가상\s*캐릭터|vtuber|v-tuber)/.test(query)) return 'avatar';
  // 오피스/스프레드시트/워드/파워포인트 계열
  if (/(엑셀|excel|스프레드시트|spreadsheet|시트|google\s*sheets|구글\s*시트)/.test(query)) return 'spreadsheet';
  if (/(워드|ms\s*word|word|오피스|office|문서\s*편집)/.test(query)) return 'text';
  if (/(파워포인트|power\s*point|ppt|프레젠테이션)/.test(query)) return 'ppt';
  return null;
}

// 기능/특징 감지
function detectFeatures(query: string): string[] {
  const features = [];
  
  // 이미지 관련 특징
  if (/실사|사실적|리얼|realistic|photorealistic|포토/.test(query)) features.push('실사');
  if (/애니|만화|카툰|anime|cartoon|일러스트/.test(query)) features.push('애니메이션');
  if (/3d|3차원|입체|쓰리디/.test(query)) features.push('3D');
  if (/아트|예술|artistic|art/.test(query)) features.push('아트');
  if (/로고|logo|브랜드/.test(query)) features.push('로고');
  
  // 텍스트 관련 특징
  if (/번역|translate|translation/.test(query)) features.push('번역');
  if (/요약|summary|summarize/.test(query)) features.push('요약');
  if (/대화|chat|conversation|채팅/.test(query)) features.push('대화');
  
  // 기능 관련 특징
  if (/api|개발자.*연동|프로그래밍.*인터페이스/.test(query)) features.push('API');
  if (/한국어|한글|korean|국내/.test(query)) features.push('한국어');
  if (/빠른|fast|quick|속도/.test(query)) features.push('빠른처리');
  if (/고품질|high.*quality|퀄리티/.test(query)) features.push('고품질');
  
  // 편집 관련 공통 특징
  if (/(편집|edit|editing|컷편집|트림|clip|timeline|타임라인|합성|montage)/.test(query)) features.push('편집');
  if (/(업스케일|upscale)/.test(query)) features.push('업스케일');
  
  return features;
}

// 사용 목적 감지
function detectUseCase(query: string): string | null {
  if (/개인|personal|취미|hobby/.test(query)) return 'personal';
  if (/상업|비즈니스|business|commercial|업무|회사/.test(query)) return 'commercial';
  if (/교육|학습|education|study|공부|학교/.test(query)) return 'education';
  if (/연구|research|논문|학술/.test(query)) return 'research';
  return null;
}

// AI 툴 검색 의도 감지
export function detectToolSearchIntent(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  // '만들어줘'는 명령형: 추천/알려/검색 동사가 함께 있지 않으면 툴 검색에서 제외
  if (/만들어줘/.test(lowerQuery) && !/(추천|알려|검색)/.test(lowerQuery)) {
    return false;
  }
  // 공통 패턴 우선 적용
  try {
    const { CATEGORY_PATTERNS } = require('@/config/patterns');
    const hasCategory = CATEGORY_PATTERNS.some((p: any) => p.keywords.some((k: string) => lowerQuery.includes(String(k).toLowerCase())));
    const hasVerb = CATEGORY_PATTERNS.some((p: any) => p.actions.some((a: string) => lowerQuery.includes(String(a).toLowerCase())));
    if (hasCategory && hasVerb) return true;
  } catch {}
  
  // AI 툴 검색 관련 키워드
  const toolKeywords = [
    '툴', 'tool', '도구', '서비스', 'ai', '인공지능', '플랫폼', 'site', '사이트', '앱', 'app',
    '추천', '찾', '검색', '알려', '소개', 'top', 'best', '좋은', '뭐가', '무엇', '골라', '선정'
  ];
  
  // 카테고리 키워드
  const categoryKeywords = [
    '이미지', '텍스트', '글쓰기', '라이팅', '작문', '소설', '에세이', '카피', '카피라이팅', '비디오', '영상', '오디오', '음성', '보이스', '코드', '코딩', '개발', '프로그래밍', 'ide', '에디터', '디자인', '로고', '썸네일', '유튜브', '워크플로우', '업무', '업무관리', '프로젝트', '칸반', 'todo', '생산성',
    '엑셀', '스프레드시트', '워드', '파워포인트', 'ppt', '오피스',
    '코드리뷰', '코드 리뷰', '정적분석', 'lint', 'linter', 'static analysis',
    '협업', 'slack', 'teams', 'notion', 'jira', 'asana', 'trello', 'clickup', 'monday', 'confluence', 'google', 'workspace', 'drive', 'docs', 'calendar', 'gmail', 'dropbox', 'box',
    '아바타', '버추얼', '가상', '버추얼 휴먼', '가상 캐릭터',
    'image', 'text', 'video', 'audio', 'voice', 'code', 'coding', 'dev', 'developer', 'programming', 'ide', 'editor', 'design', 'logo', 'thumbnail', 'youtube', 'workflow', 'project', 'kanban', 'productivity',
    'excel', 'spreadsheet', 'sheets', 'word', 'powerpoint', 'office', 'tts', 'stt', 'voiceover',
    'avatar', 'virtual', 'virtual human', 'vtuber', 'v-tuber'
  ];
  
  // 툴 검색 의도가 있는지 확인
  const hasToolKeyword = toolKeywords.some(keyword => lowerQuery.includes(keyword));
  const hasCategoryKeyword = categoryKeywords.some(keyword => lowerQuery.includes(keyword));
  
  // 질문 패턴 확인
  const questionPatterns = [
    /어떤.*ai/,
    /ai.*추천/,
    /툴.*찾|도구.*찾/,
    /서비스.*알려/,
    /생성.*도구/,
    /만들.*수.*있/,
    /만들고\s*싶어/,
    /사용.*할.*수.*있/,
    /(ai|툴|도구|서비스).*\s*(필요|필요해|원해|있을까|없을까|있나요|알려줘|추천)/,
    /(쓸만한|괜찮은|유용한)\s*(ai|툴|도구|서비스)/,
    /(ai|툴|도구|서비스).*\s*(쓸만|괜찮)/,
    /(영상|이미지|텍스트|코드|오디오).*툴[은|은?]/,
    /(video|image|text|audio|code).*tool/,
    /(문서|워드|word|ms\s*word|엑셀|excel|스프레드시트|spreadsheet|파워포인트|power\s*point|ppt).*(만들|작성|생성|써|자동|템플릿|매크로|추천|알려)/,
    /(영상|비디오|video).*(제작|편집|합성|만들|컷|자막|렌더|효과|템플릿|자동|추천|알려)/,
    /(음성|오디오|voice|tts|stt).*(수정|편집|변환|합성|클린업|제거|노이즈|더빙|보이스오버|voiceover|튜닝|pitch|복제|synthesis|transcribe|clone)/,
    /(코드|code).*(리뷰|검토|정적|static|lint|linter)/,
    /(글쓰기|작문|라이팅|소설|에세이|카피|카피라이팅).*(도움|툴|도구|ai|추천|알려|있을까|있나요)/,
    /(협업|slack|슬랙|teams|팀즈|microsoft\s*teams|notion|노션|jira|지라|asana|trello|clickup|monday|confluence|google\s*(workspace|drive|docs|calendar|gmail)|구글\s*(워크스페이스|드라이브|독스|캘린더|지메일)|dropbox|box).*(있어|추천|알려|통합|연동)/
  ];
  
  const hasQuestionPattern = questionPatterns.some(pattern => pattern.test(lowerQuery));
  
  return (hasToolKeyword && hasCategoryKeyword) || hasQuestionPattern;
}

// 추천 개수 감지 (숫자와 한글 수사 모두 지원)
export function detectCount(query: string): number | null {
  const digit = query.match(/(\d+)\s*(개|가지)?/);
  if (digit) {
    const n = parseInt(digit[1], 10);
    if (!Number.isNaN(n) && n > 0) return Math.min(n, 10);
  }
  const mapping: Record<string, number> = {
    '하나': 1, '한개': 1, '한 개': 1, '한가지': 1, '한 가지': 1,
    '둘': 2, '두개': 2, '두 개': 2, '두가지': 2, '두 가지': 2,
    '셋': 3, '세개': 3, '세 개': 3, '세가지': 3, '세 가지': 3,
    '넷': 4, '네개': 4, '네 개': 4,
    '다섯': 5, '다섯개': 5, '다섯 개': 5,
    '여섯': 6, '여섯개': 6, '여섯 개': 6,
    '일곱': 7, '일곱개': 7, '일곱 개': 7,
    '여덟': 8, '여덟개': 8, '여덟 개': 8,
    '아홉': 9, '아홉개': 9, '아홉 개': 9,
    '열': 10, '열개': 10, '열 개': 10,
    '최소 다섯': 5
  };
  for (const [k, v] of Object.entries(mapping)) {
    if (query.includes(k)) return v;
  }
  const atLeast = query.match(/최소\s*(\d+)/);
  if (atLeast) {
    const n = parseInt(atLeast[1], 10);
    if (!Number.isNaN(n)) return Math.min(Math.max(n, 1), 10);
  }
  return null;
}

// 특정 툴 상세 요청 감지 및 툴 이름 후보 추출
export function detectToolDetailRequest(query: string): { isDetail: boolean; toolQuery: string | null } {
  const keywords = ['자세히', '상세', '설명', '알려줘', '더 알려줘', '정보', '사용법'];
  const hasKeyword = keywords.some(k => query.includes(k));
  if (!hasKeyword) return { isDetail: false, toolQuery: null };

  // "flux 자세히", "AgentQL 상세 설명", "~에 대해 알려줘" 패턴 간단 추출
  const m1 = query.match(/([a-zA-Z0-9\.\-\s]{2,})\s*(?:에\s*대해)?\s*(자세히|상세|설명|알려|정보)/);
  if (m1) {
    const name = m1[1].trim();
    return { isDetail: true, toolQuery: name };
  }
  const m2 = query.match(/(자세히|상세|설명|알려|정보)\s*(?:해줘|해주세요|해|줄래)?\s*(?:about| regarding)?\s*([a-zA-Z0-9\.\-\s]{2,})/);
  if (m2) {
    const name = m2[2].trim();
    return { isDetail: true, toolQuery: name };
  }
  // 툴명이 명확하지 않으면 상세로 보지 않음
  return { isDetail: false, toolQuery: null };
}

// 워크플로우 자동화/연동 의도 감지 (Zapier/Make/n8n 등 포함)
export function detectWorkflowAutomationIntent(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const keys = [
    'workflow', '워크플로우', '자동화', 'automate', 'automation', '통합', '연동', 'integration',
    'zapier', 'make', 'integromat', 'n8n', 'pipedream', 'ifttt', 'workato', 'webhook'
  ];
  return keys.some(k => q.includes(k));
}

// 초보자 친화 AI 소개 의도 감지 ("간단한 ai 소개", "초보자도 쓰기 쉬운" 등)
export function detectBeginnerFriendlyIntent(query: string): boolean {
  const q = String(query || '').toLowerCase();
  const easyWords = ['간단', '쉽', '쉬운', '초보', '입문', '기초', '처음', 'beginner', 'easy', 'simple'];
  const aiWords = ['ai', '인공지능', '툴', '도구', '서비스'];
  const askWords = ['소개', '추천', '알려', '시작', '쓸', '사용'];
  const hasEasy = easyWords.some(w => q.includes(w));
  const hasAi = aiWords.some(w => q.includes(w));
  const hasAsk = askWords.some(w => q.includes(w));
  return hasEasy && hasAi && hasAsk;
}

// 구조화된 응답 생성을 위한 헬퍼
export function generateStructuredPrompt(intent: UserIntent, tools: any[]): string {
  const requirements = [];
  
  if (intent.pricePreference !== 'any') {
    requirements.push(`가격: ${intent.pricePreference === 'free' ? '무료' : '유료'}`);
  }
  if (intent.timeframe !== 'any') {
    requirements.push(`사용 기간: ${intent.timeframe === 'short' ? '단기' : '장기'}`);
  }
  if (intent.category) {
    requirements.push(`카테고리: ${intent.category}`);
  }
  if (intent.features.length > 0) {
    requirements.push(`특징: ${intent.features.join(', ')}`);
  }
  if (intent.useCase) {
    requirements.push(`용도: ${intent.useCase}`);
  }
  const targetCount = intent.count ?? 5; // 사용자가 지정하지 않으면 5개
  const allowedNames = tools.map((t: any) => t.name).filter(Boolean);
  return `
사용자 요구사항:
${requirements.join('\n')}

다양성을 고려해 ${targetCount}개의 AI 툴을 추천하세요. 말투는 친절한 대화체로, 읽기 쉬운 한국어로 작성하세요. 표처럼 보이는 구분자(|)는 쓰지 마세요.

중요: 아래 제공 목록에 있는 도구 이름만 사용하세요. 목록에 없는 도구를 언급하거나 새로 만들지 마세요.
허용된 도구 이름: ${allowedNames.join(', ')}

각 항목은 아래 형식으로 간단히 작성하세요.
1. [툴 이름]를 추천드립니다!
- 추천이유: 한 줄로 핵심 이유
- 가격: 무료/부분무료/유료/구독형 등 실제 가격 구조를 간단히 설명
- 활용 방법: 대표 사용 시나리오 한 줄

마지막에는 불필요한 결론 없이 끝냅니다.`;
}

// 단일 툴에 대한 5개 항목 상세 응답 프롬프트
export function generateDetailedToolPrompt(tool: any): string {
  return `
아래 툴에 대해 친절한 대화체로 5개 항목으로 상세히 설명하세요. 표처럼 보이는 기호(|)나 #, *는 쓰지 말고, 자연스러운 한국어 문장으로 작성합니다.

툴 정보(사실 근거):
이름: ${tool.name}
가격: ${tool.price}
API: ${tool.hasAPI ? '있음' : '없음'}
설명: ${tool.description}
주요 기능: ${(tool.features || []).join(', ')}
웹사이트: ${tool.url}

응답 형식과 밀도 요구사항:
1. 한줄평
- 핵심 가치를 1문장으로 명확하게 요약

2. 추천이유
- 최소 3개 이상 번호 목록으로 제시
- 각 이유는 1~2문장으로 구체적으로 작성 (성능/편의/품질/지원 등)

3. API 여부
- API 제공 여부와 방식(문서/SDK/REST 등)을 1~2문장으로 설명
- API가 없다면 대체 연동 방법(자동화/확장/내보내기 등) 제안

4. 활용 방안
- 최소 3개 이상 번호 목록으로 제시
- 각 시나리오는 실제로 바로 해볼 수 있는 형태로 1문장씩 작성

5. 결론
- 어떤 사용자/팀/상황에 특히 적합한지 1~2문장으로 정리
- 필요시 가격 구조(무료/부분무료/유료/구독형) 선택 팁을 덧붙임
`;
}

// DB에 도구 정보가 없을 때, 이름만으로 안전하게 5개 섹션 템플릿을 작성하기 위한 프롬프트
export function generateNameOnlyDetailPrompt(toolName: string): string {
  return `
아래 도구 이름만으로, 과도한 단정 없이 일반적 정보를 바탕으로 5개 섹션 형식으로 소개해 주세요. 모호한 부분은 "제공 정보 기준" 또는 "공식 문서 확인 필요"라고 명시합니다. 표나 #, * 같은 특수기호는 쓰지 말고 자연스러운 한국어 문장으로 답변합니다.

도구 이름: ${toolName}

형식:
1. 한줄평
- 도구의 대표 가치 1문장. 확실하지 않다면 "워크플로우 자동화 도구로 알려져 있습니다"처럼 일반적 표현 사용

2. 추천이유
- 최소 3개. 각 이유는 1~2문장. 예: 생산성 향상, 다양한 통합 제공(공식 목록은 문서 확인), 비교적 쉬운 빌더 등

3. API 여부
- API/SDK 제공 가능성에 대해 일반적 안내와 "공식 문서 확인 필요" 문구를 함께 제시

4. 활용 방안
- 최소 3개. 이메일→슬랙 알림, 스프레드시트→Trello 카드 생성, 폼→CRM 적재처럼 당장 해볼 수 있는 예시를 1문장씩

5. 결론
- 어떤 팀/상황에 특히 적합한지 1~2문장으로 정리하고, 정확한 기능/가격/제한은 공식 문서 확인을 권장한다고 명시
`;
}
