export type CategoryKey =
	| 'avatar'
	| 'image'
	| 'video'
	| 'audio'
	| 'writing'
	| 'coding'
	| 'productivity'
	| 'chat';

export const CATEGORY_LABEL_KO: Record<CategoryKey, string> = {
	avatar: '아바타/디지털휴먼',
	image: '이미지 생성',
	video: '영상 생성',
	audio: '음성/음악',
	writing: '글쓰기',
	coding: '코딩',
	productivity: '생산성',
	chat: '채팅/대화',
};

// 한/영/변형(오타 포함) 동의어
export const CATEGORY_SYNONYMS: Record<CategoryKey, string[]> = {
	avatar: [
		'avatar','avata','아바타','vtuber','digital human','digital-human','digitalhuman','virtual human','virtual-human','virtualhuman','character','프로필','디지털 휴먼','디지털휴먼','virtual human avatar'
	],
	image: ['image','drawing','drowing','art','이미지','그림','사진','ai art','ai 아트'],
	video: ['video','비디오','영상','동영상','video generation'],
	audio: ['audio','음성','오디오','음악','music','voice','tts','stt'],
	writing: ['writing','write','writer','text','text generation','텍스트','문서','보고서','레포트','글쓰기','라이팅','요약','summarize','document','report','essay','paper','blog','caption','content writing','content'],
	coding: ['coding','code','코딩','개발','프로그래밍'],
	productivity: ['education','workflow','task','자동화','automation','생산성'],
	chat: ['chat','llm','assistant','채팅','대화','chat bot','character chat','charactor chat'],
};

export function resolveCategoryFromNotion(notionCategories: string[] | undefined | null): CategoryKey {
	if (!notionCategories || notionCategories.length === 0) return 'productivity';
	const cats = notionCategories.map(c => (c || '').toLowerCase());
	const hasAny = (keywords: string[]) => cats.some(cat => keywords.some(k => cat.includes(k)));
	const order: CategoryKey[] = ['avatar','image','video','audio','chat','writing','coding','productivity'];
	for (const key of order) {
		if (hasAny(CATEGORY_SYNONYMS[key])) return key;
	}
	return 'productivity';
}

export function getCategoryLabelKo(key: string): string {
	return CATEGORY_LABEL_KO[(key as CategoryKey)] ?? '기타';
}
