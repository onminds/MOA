// 도구 별칭/브랜드/모델명 매핑(간단 버전)
// 키: 정규화된 대표명, 값: 질의에서 탐지할 수 있는 별칭/동의어 집합(소문자)
export const TOOL_ALIASES: Record<string, string[]> = {
  'gamma app': ['gamma', 'gamma app', '감마'],
  'plus ai': ['plus ai', 'plusai', '플러스 ai'],
  'aippt': ['aippt', 'ai ppt', 'ai-ppt', 'ai 프레젠테이션'],
  'presentations.ai': ['presentations.ai', 'presentations ai', '프레젠테이션즈 ai', 'presentations'],
  'prezi ai': ['prezi', 'prezi ai', '프레지'],
  'deepL translator': ['deepl', 'deepl translator', '딥엘'],
  'runway': ['runway', 'runwayml', 'gen-3', 'gen3'],
  'leonardo ai': ['leonardo', 'leonardo ai'],
  'capcut': ['capcut', '캡컷'],
  'colossyan': ['colossyan'],
  'udion': ['udio', '유디오'],
};

export function normalizeToolNameForMatch(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s\.\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findNamedToolsInQuery(query: string): string[] {
  const q = normalizeToolNameForMatch(query);
  const hits: string[] = [];
  for (const [canonical, aliases] of Object.entries(TOOL_ALIASES)) {
    if (aliases.some(a => q.includes(a))) {
      hits.push(canonical);
    }
  }
  return Array.from(new Set(hits));
}


