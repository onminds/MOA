export function sanitizeText(text: string): string {
  try {
    if (!text) return '';
    let out = String(text);

    // Remove fenced code blocks
    out = out.replace(/```[\s\S]*?```/g, '');

    // Strip markdown headings at line start (e.g., #, ##)
    out = out.replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1');

    // Remove bold/italic markers and backticks
    out = out
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1');

    // Replace markdown table pipes with spaces on table-like lines
    out = out.replace(/^\s*\|.*\|\s*$/gm, (m) => m.replace(/\|/g, ' '));

    // Secrets masking
    out = out.replace(/\bsk-[A-Za-z0-9]{16,}\b/g, '[redacted]');
    out = out.replace(/\bAKIA[0-9A-Z]{16}\b/g, '[redacted]');

    // Mask likely API keys (generic long tokens)
    out = out.replace(/\b[a-zA-Z0-9_-]{24,}\b/g, (m) => m.length > 28 ? '[redacted]' : m);

    // Email masking
    out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '***@***');

    // Whitespace normalization
    out = out.replace(/[ \t]+\n/g, '\n').trim();

    return out;
  } catch {
    return text;
  }
}



