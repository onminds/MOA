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


