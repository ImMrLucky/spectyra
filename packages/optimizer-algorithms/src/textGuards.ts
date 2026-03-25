import type { TextSegment } from "./types.js";

export function splitByFencedCode(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let currentIndex = 0;
  const fenceRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    if (matchStart > currentIndex) {
      const textContent = text.substring(currentIndex, matchStart);
      if (textContent.length > 0) segments.push({ type: "text", content: textContent });
    }
    segments.push({ type: "code", content: match[0], lang: match[1] || undefined });
    currentIndex = matchEnd;
  }
  if (currentIndex < text.length) {
    const textContent = text.substring(currentIndex);
    if (textContent.length > 0) segments.push({ type: "text", content: textContent });
  }
  if (segments.length === 0) segments.push({ type: "text", content: text });
  return segments;
}

export function replaceOnlyOutsideCodeFences(text: string, replacerFn: (text: string) => string): string {
  const segments = splitByFencedCode(text);
  return segments.map(segment => segment.type === "code" ? segment.content : replacerFn(segment.content)).join("");
}

export function isInsideCodeFence(text: string, substring: string): boolean {
  const segments = splitByFencedCode(text);
  for (const segment of segments) {
    if (segment.type === "code" && segment.content.includes(substring)) return true;
  }
  return false;
}

export function extractCodeBlockContents(text: string): Array<{ lang?: string; content: string }> {
  const segments = splitByFencedCode(text);
  const codeBlocks: Array<{ lang?: string; content: string }> = [];
  for (const segment of segments) {
    if (segment.type === "code") {
      const fenceMatch = segment.content.match(/```(\w+)?\n([\s\S]*?)```/);
      if (fenceMatch) codeBlocks.push({ lang: segment.lang, content: fenceMatch[2].trim() });
    }
  }
  return codeBlocks;
}
