import DOMPurify from "isomorphic-dompurify";

export function sanitizeHTML(html: string) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export function originFrom(url: string) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return undefined;
  }
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// 현재 한국 표준시(KST, UTC+9) 기준의 Date 객체 반환
export function getKoreanTimeNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60 * 1000);
}

// 주어진 날짜의 한 달 뒤, 동일한 시각을 반환
export function getNextMonthSameTime(baseDate: Date = new Date()): Date {
  const nextMonth = new Date(baseDate);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return nextMonth;
}

// 사용자 계정 생성일 기준으로 첫 초기화 날짜(정확히 한 달 후)를 계산
export function getInitialResetDate(userCreatedAt: Date): Date {
  const resetDate = new Date(userCreatedAt);
  resetDate.setMonth(resetDate.getMonth() + 1);
  return resetDate;
}

// 초기화 날짜가 현재 시각을 지났는지 여부
export function shouldResetUsage(resetDate: Date): boolean {
  const now = new Date();
  return now > resetDate;
}

// UTC 기준 Date를 한국 시간(KST, UTC+9)으로 보정한 Date 반환
export function convertUTCToKorean(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  return new Date(utcMs + 9 * 60 * 60 * 1000);
}

