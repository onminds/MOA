export function validateDraft(
  html: string, 
  opts: { 
    denyList?: string[], 
    requiredTerms?: string[] 
  }
): { 
  html: string; 
  flags: { denied: string[], missing: string[] } 
} {
  const { denyList = [], requiredTerms = [] } = opts;
  const flags = { denied: [] as string[], missing: [] as string[] };
  
  // 금지어 검사
  for (const denied of denyList) {
    if (html.toLowerCase().includes(denied.toLowerCase())) {
      flags.denied.push(denied);
    }
  }
  
  // 필수어 검사
  for (const required of requiredTerms) {
    if (!html.toLowerCase().includes(required.toLowerCase())) {
      flags.missing.push(required);
    }
  }
  
  return { html, flags };
}

