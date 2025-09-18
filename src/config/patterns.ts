// 공통 카테고리/액션 패턴 정의
// 대분류 키: category, 동의어: keywords, 행동 동사: actions, 세부 시나리오: scenarios

export type CategoryPattern = {
	category: string;
	keywords: string[]; // 카테고리 동의어/연관어
	actions: string[];  // 만들다/편집/추천/알려 등 동사
	scenarios?: string[]; // 자주 나오는 세부 요청어
};

export type DialogAct = 'question' | 'command' | 'exploration' | 'critique' | 'assistant_request';

export const DIALOG_ONTOLOGY = {
	version: '1.0.0',
	acts: ['question','command','exploration','critique','assistant_request'] as DialogAct[],
};

export function classifyDialogAct(text: string): DialogAct {
	const q = text.trim();
	const lower = q.toLowerCase();
	if (/[?？]$/.test(q) || /(어떻게|무엇|뭐가|추천|알려|where|what|how)/i.test(q)) return 'question';
	if (/(해줘|만들어줘|작성해줘|생성해줘|정리해줘|번역해줘|요약해줘|해주세요|please)/i.test(q)) return 'command';
	if (/(비교|장단점|대안|대체|alternative|pros|cons|vs)/i.test(lower)) return 'exploration';
	if (/(문제|이슈|버그|틀렸|부정|비판|나쁜|안좋|불만)/i.test(lower)) return 'critique';
	if (/(일정|예약|메모|리마인드|알림|전송|이메일|메일)/i.test(lower)) return 'assistant_request';
	return 'question';
}

// 라우팅 전략 정의 및 선택기
export type RoutingStrategy = {
	streamingPreferred: boolean;   // 스트리밍 우선 여부
	returnCards: boolean;          // 카드(툴 추천) 포함 여부
	showChips: boolean;            // 칩(빠른슬롯) 노출 여부
	style: 'general' | 'compare' | 'howto' | 'summary';
};

export function selectRoutingStrategy(act: DialogAct, opts: { isToolSearch?: boolean; category?: string | null } = {}): RoutingStrategy {
	const isTool = !!opts.isToolSearch;
	if (isTool) {
		return { streamingPreferred: false, returnCards: true, showChips: true, style: 'general' };
	}
	if (act === 'exploration') {
		return { streamingPreferred: true, returnCards: false, showChips: true, style: 'compare' };
	}
	if (act === 'command') {
		return { streamingPreferred: false, returnCards: true, showChips: true, style: 'howto' };
	}
	if (act === 'assistant_request') {
		return { streamingPreferred: false, returnCards: false, showChips: true, style: 'howto' };
	}
	if (act === 'critique') {
		return { streamingPreferred: true, returnCards: false, showChips: false, style: 'summary' };
	}
	return { streamingPreferred: true, returnCards: false, showChips: true, style: 'general' };
}

export const CATEGORY_PATTERNS: CategoryPattern[] = [
	{ category: 'image', keywords: ['이미지','사진','그림','로고','썸네일','poster','banner','image','photo','picture'], actions: ['생성','그려','만들','편집','업스케일','배경제거','추천','알려'] },
	{ category: 'video', keywords: ['영상','비디오','동영상','video','movie','모션그래픽','유튜브','shorts','릴스'], actions: ['제작','편집','합성','컷','자막','렌더','효과','템플릿','추천','알려'] },
	{ category: 'audio', keywords: ['오디오','음성','voice','tts','stt','보이스','더빙','voiceover'], actions: ['수정','편집','변환','합성','클린업','제거','노이즈','복제','synthesis','추천','알려'] },
	{ category: 'text', keywords: ['텍스트','글','문서','카피','카피라이팅','요약','번역','word','워드','오피스'], actions: ['작성','만들','생성','써','요약','번역','템플릿','추천','알려'] },
	{ category: 'spreadsheet', keywords: ['엑셀','스프레드시트','sheets','spreadsheet','표','테이블'], actions: ['분석','정리','템플릿','자동화','매크로','추천','알려'] },
	{ category: 'ppt', keywords: ['ppt','파워포인트','프레젠테이션','슬라이드','발표자료'], actions: ['만들','작성','템플릿','초안','추천','알려'] },
	{ category: 'code', keywords: ['코드','코딩','개발','programming','code','api','스크립트','ide','에디터'], actions: ['생성','리뷰','검토','정적','lint','linter','분석','추천','알려'] },
	{ category: 'design', keywords: ['디자인','ui','ux','브랜딩','타이포','레이아웃'], actions: ['만들','템플릿','키트','시스템','가이드','추천','알려'] },
	{ category: 'workflow', keywords: ['워크플로우','업무','업무관리','프로세스','칸반','kanban','todo','생산성','project','프로젝트','automation','자동화'], actions: ['설계','자동화','추천','알려'] },
	{ category: 'avatar', keywords: ['아바타','avatar','버추얼 휴먼','virtual human','가상 캐릭터','vtuber','v-tuber'], actions: ['만들','생성','편집','추천','알려'] },
	// 추가 카테고리 매핑 (사용자 제공 분류 대응)
	{ category: '3d', keywords: ['3d','three d','3차원','모델링','리깅','렌더','blender','maya'], actions: ['모델링','렌더','텍스처','리깅','애니메이션','추천','알려'] },
	{ category: 'agent', keywords: ['ai agent','agent','에이전트','자동 에이전트','에이전트워크','agentic'], actions: ['만들','설계','자동화','연결','워크플로우','추천','알려'] },
	{ category: 'dataviz', keywords: ['data visualization','데이터 시각화','차트','그래프','dashboard','대시보드','bi'], actions: ['만들','그리','시각화','분석','추천','알려'] },
	{ category: 'social', keywords: ['social media','소셜','인스타','페이스북','트위터','틱톡','스케줄러','SNS','manager'], actions: ['관리','일정','스케줄','생성','작성','추천','알려','자동'] },
	{ category: 'llm', keywords: ['llm','모델','foundation model','파인데튠','fine-tune','파인튜닝','모델 호스팅','inference'], actions: ['학습','훈련','튜닝','배포','서빙','평가','추천','알려'] },
	{ category: 'drawing', keywords: ['drawing','드로잉','스케치','낙서','일러스트'], actions: ['그려','스케치','색칠','만들','추천','알려'] },
	{ category: 'education', keywords: ['education','교육','학습','러닝','study','강의'], actions: ['작성','설계','추천','알려','생성'] },
	{ category: 'chatbot', keywords: ['chatbot','챗봇','bot','대화형','대화 봇','캐릭터 챗'], actions: ['만들','설계','배포','연동','추천','알려'] },
	{ category: 'utility', keywords: ['utility','유틸','편의','보조'], actions: ['추천','알려','자동화'] },
	{ category: 'baas', keywords: ['baas','backend as a service','supabase','firebase','appwrite'], actions: ['배포','db','auth','저장소','추천','알려'] },
	{ category: 'database', keywords: ['database','db','sql','nosql','postgres','mysql','mongo','vector','벡터','데이터베이스'], actions: ['저장','쿼리','임베딩','검색','추천','알려'] },
	{ category: 'crawler', keywords: ['crawler','크롤','크롤링','스파이더','scrape','스크래핑','ai crawl'], actions: ['수집','크롤','다운로드','파싱','추천','알려'] },
	{ category: 'character', keywords: ['character chat','캐릭터 챗','역할놀이','롤플레잉','persona','프롬프트 캐릭터'], actions: ['만들','설계','대화','추천','알려'] },
	{ category: 'translation', keywords: ['translation','번역','translate'], actions: ['번역','로컬라이즈','현지화','추천','알려'] },
	{ category: 'notes', keywords: ['proceedings','회의록','minutes','기록','write records','기록 작성'], actions: ['작성','요약','정리','추천','알려'] },
	{ category: 'microsoft', keywords: ['microsoft','ms','azure','power automate','copilot','office365','o365'], actions: ['연동','자동화','추천','알려'] },
	// 헬스케어/의료 카테고리
	{ category: 'healthcare', keywords: ['헬스케어','의료','메디컬','medical','healthcare','의학','병원','medtech','진단','emr','ehr','의무기록','의료영상','pacs','원격의료','telemedicine','웰니스','건강'], actions: ['추천','알려','분석','진단','예측','관리'] },
	// 추가 카테고리(요청 확장)
	{ category: 'novel', keywords: ['소설','novel','스토리','시나리오','플롯','세계관','캐릭터'], actions: ['작성','구성','설계','추천','알려'] },
	{ category: 'document', keywords: ['문서','document','pdf','PDF','ocr','OCR','스캔','양식','폼','서명','전자서명'], actions: ['추출','변환','요약','인식','작성','추천','알려'] },
	{ category: 'webapp', keywords: ['웹사이트','웹페이지','landing','랜딩','no-code','builder','사이트 빌더','앱 빌더','app builder'], actions: ['만들','생성','배포','추천','알려'] },
	{ category: 'marketing', keywords: ['마케팅','seo','SEM','광고','캠페인','콘텐츠 캘린더','해시태그','퍼포먼스','CTR','CPC','CPA'], actions: ['작성','기획','운영','최적화','추천','알려'] },
	{ category: 'sales', keywords: ['세일즈','영업','리드','CRM','파이프라인','인바운드','아웃바운드','제안서'], actions: ['작성','스코어링','예측','추천','알려'] },
	{ category: 'hr', keywords: ['인사','HR','채용','리크루팅','러닝','교육','온보딩','평가'], actions: ['작성','스크리닝','추천','알려'] },
	{ category: 'legal', keywords: ['법무','legal','계약','조항','컴플라이언스','규정','판례'], actions: ['초안','리뷰','비교','요약','추천','알려'] },
	{ category: 'finance', keywords: ['재무','회계','영수증','명세서','분개','리포트','결산'], actions: ['인식','정리','요약','분석','추천','알려'] },
	{ category: 'science', keywords: ['과학','science','바이오','bio','논문','literature','patent','실험노트','유전체','genomics','단백질','proteomics'], actions: ['검색','요약','분석','추천','알려'] },
	{ category: 'realestate', keywords: ['부동산','real estate','건축','architecture','도면','견적','시뮬레이션'], actions: ['분석','계산','시뮬','추천','알려'] },
	{ category: 'arvr', keywords: ['AR','VR','XR','메타버스','가상현실','증강현실'], actions: ['에셋','씬','인터랙션','추천','알려'] },
	{ category: 'robotics_iot', keywords: ['로보틱스','robotics','iot','사물인터넷','엣지','edge ai','예지보전','센서'], actions: ['제어','예측','모니터링','추천','알려'] },
	{ category: 'news', keywords: ['뉴스','news','동향','trend','요약','브리핑'], actions: ['검색','요약','링크','추천','알려'] },
	{ category: 'productivity', keywords: ['생산성','업무','캘린더','회의록','액션아이템','투두','메모'], actions: ['정리','생성','추천','알려'] },
	{ category: 'ecommerce', keywords: ['전자상거래','이커머스','리테일','상품','카탈로그','리뷰','추천 엔진'], actions: ['작성','분류','추천','알려'] },
	{ category: 'search', keywords: ['검색','search','웹검색','사이트검색','엔진','인덱스'], actions: ['색인','크롤','랭킹','추천','알려'] },
];

export function hasAny(text: string, candidates: string[]): boolean {
	return candidates.some(k => text.includes(k));
}

export function matchCategory(text: string): { key: string | null; pattern?: CategoryPattern } {
	const q = text.toLowerCase();
	for (const p of CATEGORY_PATTERNS) {
		if (hasAny(q, p.keywords.map(k => k.toLowerCase()))) return { key: p.category, pattern: p };
	}
	return { key: null };
}

export function looksLikeToolSearch(text: string): boolean {
	const q = text.toLowerCase();
	const genericVerbs = ['추천','찾','검색','알려','소개','top','best','골라'];
	const genericVerbsEn = ['recommend','best','top','find','search','show'];
	return hasAny(q, [...genericVerbs, ...genericVerbsEn].map(v => v.toLowerCase()));
}


