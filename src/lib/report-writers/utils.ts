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

