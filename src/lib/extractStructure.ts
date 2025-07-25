export function extractStructure(text: string): string[] {
  return text
    .split('\n')
    .filter(line =>
      line.match(/^(\d{1,2}[\.\)]|[가-하]\.|\[[^\]]+\])/)
    )
    .map((t, i) => `- ${i + 1}. ${t}`);
} 