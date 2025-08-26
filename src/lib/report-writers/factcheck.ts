import { ReportSection, ReportSource } from "./types";

export function basicFactChecks(section: ReportSection, sources: ReportSource[]) {
  // 1) dangling citations
  section.citations = section.citations.filter((n) => n >= 1 && n <= sources.length);

  // 2) year sanity (e.g., 2099 in past claims)
  const years = section.html.match(/\b(19\d{2}|20\d{2})\b/g) || [];
  const now = new Date().getFullYear();
  const improbable = years.filter((y) => Number(y) > now + 1);
  if (improbable.length) {
    section.html += `<p><em>참고: 비현실적인 연도 값 감지(${improbable.join(", ")}). 출처 확인 권장.</em></p>`;
  }

  // 3) percent sanity
  const percents = section.html.match(/\b(\d{1,3})%/g) || [];
  for (const p of percents) {
    const v = Number(p.replace("%", ""));
    if (v > 100) {
      section.html += `<p><em>참고: 100% 초과 값(${v}%) 감지. 맥락/출처 재확인 권장.</em></p>`;
    }
  }
  return section;
}

