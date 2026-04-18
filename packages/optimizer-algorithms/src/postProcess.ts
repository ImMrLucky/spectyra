/**
 * Output post-processing: strips boilerplate, compresses scaffolding,
 * enforces patch formatting, and applies hard caps.
 */

import type { PathKind } from "./types.js";

export interface PostProcessInput {
  path: PathKind;
  text: string;
  trimLevel: "none" | "moderate" | "aggressive";
  preserveCodeBlocks?: boolean;
}

const LEADING_OPENERS = [
  "sure",
  "absolutely",
  "of course",
  "certainly",
  "definitely",
  "happy to help",
] as const;

const TRAILING_PHRASES = [
  "let me know",
  "if you have any questions",
  "hope this helps",
  "feel free to ask",
  "don't hesitate",
] as const;

/** Strip leading opener word + following punctuation/spaces (linear; no ReDoS). */
function stripLeadingOpener(t: string): string {
  const lower = t.toLowerCase();
  for (const word of LEADING_OPENERS) {
    if (!lower.startsWith(word)) continue;
    let i = word.length;
    if (i >= t.length) return "";
    if (!/[\s,.-]/.test(t[i])) continue;
    while (i < t.length && /[\s,.-]/.test(t[i])) i++;
    return t.slice(i).trimStart();
  }
  return t;
}

/** Remove first trailing-disclaimer block (leftmost phrase match, like the former regex). */
function stripTrailingDisclaimer(t: string): string {
  const lower = t.toLowerCase();
  let earliest = t.length;
  for (const phrase of TRAILING_PHRASES) {
    const idx = lower.indexOf(phrase);
    if (idx < 0) continue;
    let start = idx;
    while (start > 0 && (t[start - 1] === " " || t[start - 1] === "\t")) start--;
    if (start > 0 && t[start - 1] === "\n") {
      let s2 = start - 1;
      while (s2 > 0 && (t[s2 - 1] === " " || t[s2 - 1] === "\t")) s2--;
      start = s2;
    }
    earliest = Math.min(earliest, start);
  }
  if (earliest >= t.length) return t;
  return t.slice(0, earliest).trimEnd();
}

function stripHeresPrefix(t: string): string {
  const lower = t.toLowerCase();
  if (!lower.startsWith("here")) return t;
  let i = 4;
  if (i < lower.length && lower[i] === "'") i++;
  if (i < lower.length && lower[i] === "s") i++;
  while (i < t.length && /\s/.test(t[i])) i++;
  const rest = t.slice(i).toLowerCase();
  for (const w of ["the ", "your ", "a "] as const) {
    if (rest.startsWith(w)) return t.slice(i + w.length);
  }
  return t;
}

function stripICreatedPrefix(t: string): string {
  const lower = t.toLowerCase();
  const prefixes: Array<{ p: string; verbs: string[] }> = [
    { p: "i've ", verbs: ["created ", "made ", "written ", "prepared"] },
    { p: "i'll ", verbs: ["created ", "made ", "written ", "prepared"] },
    { p: "i'd ", verbs: ["created ", "made ", "written ", "prepared"] },
    { p: "i ", verbs: ["created ", "made ", "written ", "prepared"] },
  ];
  for (const { p, verbs } of prefixes) {
    if (!lower.startsWith(p)) continue;
    const after = lower.slice(p.length);
    for (const verb of verbs) {
      if (after.startsWith(verb)) return t.slice(p.length + verb.length);
    }
  }
  return t;
}

function stripCommonBoilerplate(s: string): string {
  let t = s;
  t = stripLeadingOpener(t);
  t = stripTrailingDisclaimer(t);
  t = stripHeresPrefix(t);
  t = stripICreatedPrefix(t);
  return t.trim();
}

function extractCodeBlocks(text: string): { blocks: string[]; textWithoutCode: string } {
  const blocks: string[] = [];
  const placeholder = "<<<CODE_BLOCK_PLACEHOLDER>>>";
  const re = /```[\s\S]*?```/g;
  let match;
  while ((match = re.exec(text)) !== null) blocks.push(match[0]);
  const textWithoutCode = text.replace(re, placeholder);
  return { blocks, textWithoutCode };
}

function compressLongScaffold(s: string, aggressive: boolean, preserveCode: boolean): string {
  let t = s.trim();
  const { blocks, textWithoutCode } = preserveCode
    ? extractCodeBlocks(t)
    : { blocks: [] as string[], textWithoutCode: t };

  let processed = textWithoutCode;

  if (/Step\s+\d+/i.test(processed) && processed.length > (aggressive ? 900 : 1400)) {
    const cut = aggressive ? 850 : 1200;
    let head = processed.slice(0, cut).trim();
    if (!head.endsWith(".") && !head.endsWith(")") && !head.endsWith(":")) head += "…";
    processed = head;
  }

  if (aggressive) {
    processed = processed.replace(/\n{3,}/g, "\n\n");
    processed = processed.replace(/As (?:I mentioned|mentioned earlier|stated before),?\s*/gi, "");
    processed = processed.replace(/To (?:summarize|recap|reiterate),?\s*/gi, "");
  }

  if (preserveCode && blocks.length > 0) {
    const maxBlocks = aggressive ? 1 : 2;
    const keptBlocks = blocks.slice(0, maxBlocks);
    processed = processed.replace(
      /<<<CODE_BLOCK_PLACEHOLDER>>>/g,
      () => keptBlocks.shift() || "",
    );
    if (blocks.length > maxBlocks) {
      processed += `\n\n// ... (${blocks.length - maxBlocks} more code blocks trimmed)`;
    }
  }

  return processed.trim();
}

/**
 * Same segments as `text.split(/[.!?]+\s+/)` without a regex on uncontrolled input (ReDoS).
 * Linear time; treats a run of .!? followed by at least one whitespace as a boundary.
 */
function splitOnSentenceDelimiters(text: string): string[] {
  const parts: string[] = [];
  let segmentStart = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "." || ch === "!" || ch === "?") {
      let punctEnd = i;
      while (punctEnd + 1 < text.length) {
        const n = text[punctEnd + 1];
        if (n === "." || n === "!" || n === "?") punctEnd++;
        else break;
      }
      let wsEnd = punctEnd + 1;
      while (wsEnd < text.length && /\s/.test(text[wsEnd])) wsEnd++;
      if (wsEnd > punctEnd + 1) {
        parts.push(text.slice(segmentStart, i));
        segmentStart = wsEnd;
        i = wsEnd;
        continue;
      }
    }
    i++;
  }
  parts.push(text.slice(segmentStart));
  return parts;
}

function enforcePatchFormatIfPresent(text: string, aggressive: boolean): string {
  const diffMatch = text.match(/```diff[\s\S]*?```/i);
  if (!diffMatch) return text;

  const diffBlock = diffMatch[0];
  const after = text.slice(text.indexOf(diffBlock) + diffBlock.length).trim();

  const bullets = after.split("\n").filter(l => /^\s*[-*]\s+/.test(l)).slice(0, aggressive ? 3 : 5);
  const warnings = after.split("\n").filter(l => /(?:warning|note|important|caution):/i.test(l)).slice(0, 2);
  const extra = [...bullets, ...warnings].filter((v, i, a) => a.indexOf(v) === i);
  const extraText = extra.length ? "\n\n" + extra.join("\n") : "";

  return (diffBlock + extraText).trim();
}

export function postProcessOutput(input: PostProcessInput): string {
  const { path, trimLevel, preserveCodeBlocks = true } = input;
  let t = input.text ?? "";
  if (!t.trim()) return t;
  if (trimLevel === "none") return t.trim();

  const aggressive = trimLevel === "aggressive";
  t = stripCommonBoilerplate(t);

  if (path === "code") {
    t = enforcePatchFormatIfPresent(t, aggressive);
    t = compressLongScaffold(t, aggressive, preserveCodeBlocks);
  } else {
    t = compressLongScaffold(t, aggressive, false);
    if (aggressive && t.length > 900) {
      const sentences = splitOnSentenceDelimiters(t);
      let kept = "";
      for (const sentence of sentences) {
        if ((kept + sentence).length > 900) break;
        kept += sentence + ". ";
      }
      t = kept.trim() || t.slice(0, 900).trim() + "…";
    }
  }

  return t.trim();
}
