import { INTENT_REGISTRY } from '@/config/intents';
import type { UserIntent } from '@/lib/intent-analyzer';

export type Chip = { label: string; send: string };

function dedupeChips(chips: Chip[]): Chip[] {
	const seen = new Set<string>();
	const out: Chip[] = [];
	for (const c of chips) {
		const key = `${c.label}::${c.send}`;
		if (!seen.has(key)) {
			seen.add(key);
			out.push(c);
		}
	}
	return out;
}

const CATEGORY_KO_LABEL: Record<string, string> = {
	image: '이미지',
	video: '영상',
	audio: '오디오',
	voice: '음성',
	text: '텍스트',
	spreadsheet: '스프레드시트',
	ppt: 'PPT',
	code: '코드',
	design: '디자인',
	workflow: '워크플로우',
	avatar: '아바타'
};

export function buildChipsForKey(key: 'tool_search' | 'ppt_generate' | 'image_generate' | 'doc_create' | 'email_write', ctx?: { intent?: UserIntent }): Chip[] {
	const base = INTENT_REGISTRY[key]?.chips || [];
	let extra: Chip[] = [];
	if (key === 'tool_search') {
		// 1) 카테고리 랜덤(표시는 실제 카테고리명, '랜덤' 표기 금지)
		const pool = ['video','image','text','audio','code','design','workflow'];
		const pick = pool[Math.floor(Math.random() * pool.length)];
		if (pick) {
			const labelKo = CATEGORY_KO_LABEL[pick] || pick;
			extra.push({ label: `${labelKo}`, send: `${labelKo} ai 툴 추천해줘` });
		}
		// 2) 가격 필터
		extra.push({ label: '가격: 무료', send: '무료 ai 툴 추천해줘' });
		extra.push({ label: '가격: 유료', send: '유료 ai 툴 추천해줘' });
		// 3) API 연동 여부
		extra.push({ label: 'API 연동', send: 'API 제공되는 ai 툴 추천해줘' });
		// 마지막: 내비게이션 칩(프론트에서 파란색 스타일)
		extra.push({ label: 'AI 목록으로 이동', send: '__NAV__/ai-list' });
	}
	// dedupe 후 'AI 목록으로 이동'을 항상 맨끝으로 재정렬
	const merged = dedupeChips([...(extra || []), ...(base || [])]).slice(0, 10);
	const navIdx = merged.findIndex(c => c.send === '__NAV__/ai-list');
	if (navIdx >= 0 && navIdx !== merged.length - 1) {
		const [nav] = merged.splice(navIdx, 1);
		merged.push(nav);
	}
	return merged;
}



