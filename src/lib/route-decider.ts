export type RouteDecision = {
  route: 'stream' | 'nonstream';
  web: boolean;
  reason: string[];
  ambiguity: number; // 0~1
};

export function decideRouteByRules(textRaw: string, meta?: { hasAttachment?: boolean; length?: number }): RouteDecision {
  const text = String(textRaw || '').trim();
  const q = text.toLowerCase();
  const reasons: string[] = [];

  // Greetings / identity smalltalk → stream, no web
  if (/^(안녕|안녕하세요|하이|헬로|hello|hi|hey|ㅎㅇ|안뇽)$/.test(text)) {
    reasons.push('greeting');
    return { route: 'stream', web: false, reason: reasons, ambiguity: 0.05 };
  }
  if (/(누구|너는|정체|who\s*are\s*you|what\s*are\s*you)/.test(q)) {
    reasons.push('identity-smalltalk');
    return { route: 'stream', web: false, reason: reasons, ambiguity: 0.1 };
  }

  // Realtime / world info cues → stream + web
  const realtime = /(오늘|지금|현재|이번\s*주|날씨|영업시간|뉴스|속보|주가|환율|today|now|news|weather|stock)/.test(q);
  if (realtime) {
    reasons.push('realtime');
    return { route: 'stream', web: true, reason: reasons, ambiguity: 0.15 };
  }

  // Strong rule: Tool detail or tool search → stream only (no web)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { detectToolDetailRequest, detectToolSearchIntent } = require('@/lib/intent-analyzer');
    const det = detectToolDetailRequest(text);
    if (det?.isDetail) {
      reasons.push('tool-detail');
      return { route: 'stream', web: false, reason: reasons, ambiguity: 0.1 };
    }
    if (detectToolSearchIntent(text)) {
      reasons.push('tool-search');
      return { route: 'stream', web: false, reason: reasons, ambiguity: 0.2 };
    }
  } catch {}

  // Document-like cues → nonstream (summary flow)
  const doc = /(문서|보고서|리포트|파일|붙여넣기|요약|정리|회의록|슬라이드|ppt|대본)/.test(q) || !!meta?.hasAttachment || (meta?.length || 0) > 800;
  if (doc) {
    reasons.push('document');
    return { route: 'nonstream', web: false, reason: reasons, ambiguity: 0.15 };
  }

  // AI 개념/모델/서비스 설명 → stream (노션/웹 메모 기반 대화)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { detectAIConceptExplainIntent } = require('@/lib/intent-analyzer');
    if (detectAIConceptExplainIntent(text)) {
      reasons.push('ai-concept');
      return { route: 'stream', web: false, reason: reasons, ambiguity: 0.2 };
    }
  } catch {}

  // 일반 백과사전형/사실형 질문은 스트리밍 + 웹 (브렉시트 등)
  if (/(뭐야|무엇|소개|가이드|란|about)/.test(q)) {
    reasons.push('factoid');
    return { route: 'stream', web: true, reason: reasons, ambiguity: 0.25 };
  }

  // Recommendation / list → stream without web (latency optimization)
  if (/(추천|리스트|목록|top|best|가볼만한|장소|place|spot)/.test(q)) {
    reasons.push('recommendation');
    return { route: 'stream', web: false, reason: reasons, ambiguity: 0.25 };
  }

  // Default: stream, no web
  reasons.push('default');
  return { route: 'stream', web: false, reason: reasons, ambiguity: 0.4 };
}

// ---- 임베딩 + LLM 결합 ----
export type WeightedDecision = RouteDecision & {
  scores: { rule: number; embed?: number; llm?: number };
};

export async function decideRoute(
  textRaw: string,
  opts: {
    openai?: any; // lazily injected OpenAI client
    embeddingsModel?: string;
    llmModel?: string;
    meta?: { hasAttachment?: boolean; length?: number };
    timeoutMs?: number;
  } = {}
): Promise<WeightedDecision> {
  const base = decideRouteByRules(textRaw, opts.meta);
  const scores: any = { rule: 0.45 };
  let route = base.route;
  let web = base.web;
  let reason = [...base.reason];
  let ambiguity = base.ambiguity;

  // 강한 규칙: 뉴스/실시간 또는 문서 요약은 즉시 확정하고 고비용 결정을 생략
  const strongRealtime = reason.includes('realtime');
  const strongDoc = reason.includes('document');
  if (strongRealtime || strongDoc) {
    return { route, web, reason, ambiguity: Math.max(0.05, base.ambiguity * 0.5), scores };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(300, opts.timeoutMs || 900));

  try {
    // 1) Embedding 유사도 (뉴스/문서/팩토이드/추천 프로토타입과 코사인)
    if (opts.openai?.embeddings) {
      const prototypes = {
        news: '오늘/지금/이번주/속보/뉴스/주가/환율/날씨/실시간 요약',
        doc: '문서/파일/붙여넣기/회의록/리포트 요약/정리/포맷',
        fact: '무엇/뭐야/소개/가이드/란/정의/설명 요청',
        rec: '추천/목록/top/best/가볼만한/장소/도구 리스트'
      } as const;
      const model = opts.embeddingsModel || 'text-embedding-3-small';
      const [qEmb, newsEmb, docEmb, factEmb, recEmb] = await Promise.all([
        opts.openai.embeddings.create({ model, input: textRaw }),
        opts.openai.embeddings.create({ model, input: prototypes.news }),
        opts.openai.embeddings.create({ model, input: prototypes.doc }),
        opts.openai.embeddings.create({ model, input: prototypes.fact }),
        opts.openai.embeddings.create({ model, input: prototypes.rec })
      ]);
      const v = (x: any) => x.data[0].embedding as number[];
      const cos = (a: number[], b: number[]) => {
        let s=0, an=0, bn=0; for (let i=0;i<a.length;i++){ const ai=a[i], bi=b[i]; s+=ai*bi; an+=ai*ai; bn+=bi*bi; }
        return s / (Math.sqrt(an)*Math.sqrt(bn) + 1e-8);
      };
      const qe = v(qEmb), sn = cos(qe, v(newsEmb)), sd = cos(qe, v(docEmb)), sf = cos(qe, v(factEmb)), sr = cos(qe, v(recEmb));
      const embedScore = Math.max(sn, sd, sf, sr);
      scores.embed = embedScore;
      // 임베딩으로 뒤집을 땐 충분한 마진이 있을 때만
      const marginOk = embedScore >= 0.35; // 낮은 상관이면 무시
      if (marginOk) {
        if (sn === embedScore) { route = 'stream'; web = true; reason.push('embed-news'); }
        else if (sd === embedScore) { route = 'nonstream'; web = false; reason.push('embed-doc'); }
        else if (sf === embedScore) { route = 'stream'; web = true; reason.push('embed-fact'); }
        else if (sr === embedScore) { route = 'stream'; web = true; reason.push('embed-rec'); }
      }
      ambiguity = Math.max(0.05, 1 - (scores.rule + (scores.embed||0))/2);
    }

    // 2) LLM JSON 분류 (저지연, 실패 시 무시)
    if (opts.openai?.responses) {
      const llmModel = opts.llmModel || 'gpt-4.1-mini';
      const prompt = `다음 사용자 요청의 라우팅을 JSON으로 분류:
text: "${textRaw}"
필드: {"task":"news|doc|fact|rec|chat","needs_web":true|false}
설명 없이 JSON만 출력`;
      const r: any = await opts.openai.responses.create({ model: llmModel, input: prompt }, { signal: controller.signal } as any);
      const out = String((r as any)?.output_text || '').trim();
      let parsed: any = null; try { parsed = JSON.parse(out); } catch {}
      if (parsed && parsed.task) {
        scores.llm = 0.55;
        // LLM이 뒤집을 땐 규칙을 존중: 강한 신호가 없을 때만 반영
        const canFlip = !strongRealtime && !strongDoc;
        if (canFlip) {
          if (parsed.task === 'news') { route = 'stream'; web = true; reason.push('llm-news'); }
          else if (parsed.task === 'doc') { route = 'nonstream'; web = false; reason.push('llm-doc'); }
          else if (parsed.task === 'fact') { route = 'stream'; web = !!parsed.needs_web; reason.push('llm-fact'); }
          else if (parsed.task === 'rec') { route = 'stream'; web = true; reason.push('llm-rec'); }
          else { reason.push('llm-chat'); }
        } else {
          reason.push('llm-ignored-strong-rule');
        }
        ambiguity = Math.max(0.03, 1 - (scores.rule + (scores.embed||0) + (scores.llm||0))/3);
      }
    }
  } catch {}
  finally { clearTimeout(timer); }

  return { route, web, reason, ambiguity, scores };
}


