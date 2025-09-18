// 태그 동의어(간단): 카테고리별 자주 쓰는 기능 키워드 묶음
export const TAG_SYNONYMS: Record<string, string[]> = {
  ppt: ['template','템플릿','deck','슬라이드','발표','outline','발표자 노트','발표 노트','pptx','powerpoint'],
  presentation: ['template','템플릿','deck','슬라이드','발표','outline','pptx','powerpoint'],
  image: ['logo','로고','thumbnail','썸네일','poster','포스터','banner','배너','upscale','업스케일','remove bg','배경 제거'],
  video: ['subtitle','자막','cut','컷편집','trim','타임라인','timeline','b-roll','motion','모션'],
  audio: ['tts','stt','voice','더빙','보이스오버','클린업','노이즈 제거'],
  text: ['번역','translation','요약','summarize','chat','대화','카피','copywriting'],
  workflow: ['zapier','make','n8n','webhook','integration','automation','crm','sheet','sheets']
};

export function expandTags(tags: string[], categoryHint?: string | null): string[] {
  const out = new Set<string>();
  for (const t of tags) out.add(String(t).toLowerCase());
  const hint = String(categoryHint || '').toLowerCase();
  const extra = TAG_SYNONYMS[hint] || [];
  for (const e of extra) out.add(e.toLowerCase());
  return Array.from(out);
}


