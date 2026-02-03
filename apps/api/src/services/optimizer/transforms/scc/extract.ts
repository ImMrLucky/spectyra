/**
 * Structured extraction from messages for SCC — constraints, failing signals, touched files.
 */

import type { ChatMessage } from "@spectyra/shared";
import type { FailingSignal } from "./normalize.js";
import { normalizeBullet, normalizePath, dedupeOrdered } from "./normalize.js";

/** Patterns that indicate a rule-like constraint (excludes config JSON). */
const CONSTRAINT_PATTERNS = [
  /\b(Do not|Don't|Must|Must not|Never|Always|Target|No\s+[a-z]+)\b/i,
  /\b(Constraints?|constraint)\s*:?\s*$/im,
];

/** Exclude lines that look like config/JSON (key-value, braces). */
function isConfigOrJsonLine(line: string): boolean {
  const t = line.trim();
  if (/^\s*[\{\[]/.test(t) || /\}\s*$/.test(t)) return true;
  if (/^["']?\w+["']?\s*:\s*/.test(t) || /"[^"]*"\s*:\s*/.test(t)) return true;
  return false;
}

function isConstraintLine(line: string): boolean {
  const t = line.trim();
  if (t.length > 300) return false;
  if (isConfigOrJsonLine(t)) return false;
  return CONSTRAINT_PATTERNS.some((re) => re.test(t));
}

/** ES target / optional chaining bans we must preserve. */
const ES_AND_OC_PATTERNS = [
  /\bES2019\b/i,
  /\bno optional chaining\b/i,
  /\boptional chaining\b/i,
  /\bTarget\s+ES\d+\b/i,
];

function isEsOrOcConstraint(line: string): boolean {
  return ES_AND_OC_PATTERNS.some((re) => re.test(line));
}

export interface ExtractedConstraints {
  global: string[];
  localByFile: Record<string, string[]>;
}

/**
 * Extract constraints from messages. Recognizes "Constraints:" blocks,
 * "Do not…", "Must…", "Target…", "No …". Ignores meta-phrase "Add the same constraint…".
 * Ensures ES target + optional chaining bans are kept if present anywhere.
 */
export function extractConstraints(messages: ChatMessage[]): ExtractedConstraints {
  const global: string[] = [];
  const localByFile: Record<string, string[]> = {};
  let currentFile: string | null = null;
  const allLines: string[] = [];
  const esOcLines: string[] = [];

  for (const msg of messages) {
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    for (const line of content.split(/\n/)) {
      const t = line.trim();
      if (!t) continue;
      const normalized = normalizeBullet(t);
      // Meta-instruction: do not treat as a constraint.
      if (/^Add the same constraint\b/i.test(normalized)) {
        continue;
      }
      // Persona fluff: do not treat as a constraint.
      if (/^You are an expert software engineer\b/i.test(normalized)) {
        continue;
      }
      if (isConstraintLine(normalized)) {
        allLines.push(normalized);
        if (isEsOrOcConstraint(normalized)) {
          esOcLines.push(normalized);
        }
      }
      const fileMatch = t.match(/^(?:Checking|File|path=)\s*([^\s:]+)/i) ?? t.match(/^([\w./-]+\.(?:ts|js|tsx|jsx|json))/);
      if (fileMatch) {
        currentFile = normalizePath(fileMatch[1]!);
      }
      if (currentFile && isConstraintLine(normalized)) {
        if (!localByFile[currentFile]) localByFile[currentFile] = [];
        localByFile[currentFile].push(normalized);
      }
    }
  }

  const deduped = dedupeOrdered(allLines);
  const globalOut = [...deduped];
  for (const es of esOcLines) {
    if (!globalOut.some((c) => c === es || c.includes(es.slice(0, 20)))) {
      globalOut.push(es);
    }
  }
  return {
    global: dedupeOrdered(globalOut).slice(0, 20),
    localByFile,
  };
}

const ERROR_IN_FILE = /ERROR\s+in\s+([^\s:]+):(\d+)/i;
const TS_CODE = /(TS\d+):\s*([^\n]+)/g;
const STACK_LINE = /at\s+\S+\s+\(([^)]+):(\d+):\d+\)/;
const STACK_LINE_ASYNC = /at\s+([^\s(]+)\s+\(([^)]+)\)/;

/**
 * Parse tool output for ERROR in <file>:<line>, TS####: ..., and first stack lines.
 */
export function extractFailingSignals(messages: ChatMessage[]): FailingSignal[] {
  const out: FailingSignal[] = [];
  for (const msg of messages) {
    if (msg.role !== "tool") continue;
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    const lines = content.split(/\n/);
    for (const line of lines) {
      const errIn = line.match(ERROR_IN_FILE);
      if (errIn) {
        out.push({
          file: normalizePath(errIn[1]!),
          line: parseInt(errIn[2]!, 10),
          raw: line.slice(0, 120),
        });
        continue;
      }
      let m: RegExpExecArray | null;
      TS_CODE.lastIndex = 0;
      while ((m = TS_CODE.exec(line)) !== null) {
        out.push({
          code: m[1]!,
          message: m[2]!.trim().slice(0, 80),
          raw: line.slice(0, 120),
        });
      }
      const stack = line.match(STACK_LINE);
      if (stack) {
        out.push({
          file: normalizePath(stack[1]!),
          line: parseInt(stack[2]!, 10),
          raw: line.slice(0, 100),
        });
      }
      const stackAsync = line.match(STACK_LINE_ASYNC);
      if (stackAsync && line.trim().startsWith("at ")) {
        out.push({
          raw: line.trim().slice(0, 100),
        });
      }
    }
  }
  return out;
}

/**
 * Extract touched files from tool logs, read_file paths, and "Checking …" lines.
 */
export function extractTouchedFiles(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    const readFile = content.match(/read_file:\s*path=([^\s\n]+)/gi);
    if (readFile) {
      for (const m of readFile) {
        const p = m.replace(/read_file:\s*path=/i, "").trim();
        paths.add(normalizePath(p));
      }
    }
    const checking = content.match(/Checking\s+([^\s\n.,;:)]+\.(?:ts|js|tsx|jsx|json|html|css))/gi);
    if (checking) {
      for (const m of checking) {
        paths.add(normalizePath(m.replace(/Checking\s+/i, "").trim()));
      }
    }
    const filePaths = content.match(/(?:[\w-]+\/)+[\w.-]+\.(?:ts|js|tsx|jsx|json|html|css)/g);
    if (filePaths) {
      filePaths.forEach((p) => paths.add(normalizePath(p)));
    }
    const errorIn = content.match(/ERROR\s+in\s+([^\s:]+)/gi);
    if (errorIn) {
      for (const m of errorIn) {
        paths.add(normalizePath(m.replace(/ERROR\s+in\s+/i, "").trim()));
      }
    }
  }
  return dedupeOrdered([...paths]);
}

/**
 * Return the single latest failing signal (most recent tool error).
 * SCC uses this as the authoritative "latest error" then dedupes the rest.
 */
export function getLatestFailingSignal(messages: ChatMessage[]): FailingSignal | null {
  const all = extractFailingSignals(messages);
  if (all.length === 0) return null;
  return all[all.length - 1]!;
}

/** Patterns that indicate a failing tool block (lint/test/TS error). */
const FAILING_TOOL_PATTERNS = [
  /\bERROR\s+in\s+/i,
  /\bTS\d+:/,
  /\bFAIL\s+/i,
  /\bTypeError\b/,
  /\bAssertionError\b/,
  /at\s+\S+\s+\([^)]+:\d+:\d+\)/,
];

function isFailingToolContent(content: string): boolean {
  return FAILING_TOOL_PATTERNS.some((re) => re.test(content));
}

/**
 * Extract the latest failing tool block (command + output) for verbatim inclusion in SCC.
 * Prefer the last tool message that contains ERROR, TS####, FAIL, TypeError, or stack lines.
 */
export function extractLatestToolFailure(
  messages: ChatMessage[]
): { cmd?: string; output: string } | null {
  let last: { cmd?: string; output: string } | null = null;
  for (const msg of messages) {
    if (msg.role !== "tool") continue;
    const content = (msg.content ?? "").trim();
    if (!content || !isFailingToolContent(content)) continue;
    const cmd = content.match(/^(?:Command:\s*)?(pnpm\s+\w+|npm\s+\w+|yarn\s+\w+)/m)?.[1];
    last = { cmd, output: content };
  }
  return last;
}

/** Strip diff prefix a/ or b/; reject pure diff artifacts like a/tsconfig.js unless real path. */
function cleanPathForConfirmed(path: string): string | null {
  const normalized = normalizePath(path);
  let p = normalized;
  if (p.startsWith("a/") || p.startsWith("b/")) {
    p = p.slice(2);
  }
  if (!p || p.length < 2) return null;
  if (/^[\w.-]+$/.test(p) && !p.includes("/")) return null;
  return normalizePath(p);
}

/**
 * Confirmed touched files only: from tool actions (read_file: path=...) and user "Relevant file again:" blocks.
 * Excludes assistant-hallucinated diff headers (--- a/... / +++ b/...) and loose "Checking ..." paths.
 */
export function extractConfirmedTouchedFiles(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    if (msg.role === "tool") {
      const readFile = content.match(/read_file:\s*path=([^\s\n]+)/gi) ?? content.match(/read_file\s+path=([^\s\n]+)/gi);
      if (readFile) {
        for (const m of readFile) {
          const p = m.replace(/read_file:\s*path=/i, "").replace(/read_file\s+path=/i, "").trim();
          const cleaned = cleanPathForConfirmed(p);
          if (cleaned) paths.add(cleaned);
        }
      }
      const errorIn = content.match(/ERROR\s+in\s+([^\s:]+):/gi);
      if (errorIn) {
        for (const m of errorIn) {
          const p = m.replace(/ERROR\s+in\s+/i, "").replace(/:$/, "").trim();
          const cleaned = cleanPathForConfirmed(p);
          if (cleaned) paths.add(cleaned);
        }
      }
    }
    if (msg.role === "user") {
      const relevantMatch = content.match(/Relevant file again:\s*```[\s\S]*?([^\s\n]+\.(?:ts|js|tsx|jsx|json|html|css))/im);
      if (relevantMatch) {
        const cleaned = cleanPathForConfirmed(relevantMatch[1]!);
        if (cleaned) paths.add(cleaned);
      }
      const appsPaths = content.match(/(?:apps|packages)\/[\w./-]+\.(?:ts|js|tsx|jsx|json)/g);
      if (appsPaths) {
        appsPaths.forEach((p) => {
          const cleaned = cleanPathForConfirmed(p);
          if (cleaned) paths.add(cleaned);
        });
      }
    }
  }
  return dedupeOrdered([...paths]);
}

/**
 * Paths mentioned in assistant/text (e.g. "Checking x/y.ts") — low trust, for debugging only.
 */
export function extractMentionedPaths(messages: ChatMessage[]): string[] {
  const paths = new Set<string>();
  for (const msg of messages) {
    const content = (msg.content ?? "").trim();
    if (!content) continue;
    const checking = content.match(/Checking\s+([^\s\n.,;:)]+\.(?:ts|js|tsx|jsx|json|html|css))/gi);
    if (checking) {
      for (const m of checking) {
        const cleaned = cleanPathForConfirmed(m.replace(/Checking\s+/i, "").trim());
        if (cleaned) paths.add(cleaned);
      }
    }
  }
  return dedupeOrdered([...paths]);
}

/**
 * Focus files: from failing signals (file:line) + user "Relevant file again:" paths. Top 3–7, deduped.
 */
export function extractFocusFiles(messages: ChatMessage[]): string[] {
  const fromSignals = extractFailingSignals(messages)
    .filter((s) => s.file != null)
    .map((s) => normalizePath(s.file!));
  const fromUser: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const content = (msg.content ?? "").trim();
    const relevantMatch = content.match(/Relevant file again:\s*```[\s\S]*?([^\s\n]+\.(?:ts|js|tsx|jsx|json))/im);
    if (relevantMatch) {
      const cleaned = cleanPathForConfirmed(relevantMatch[1]!);
      if (cleaned) fromUser.push(cleaned);
    }
  }
  const combined = dedupeOrdered([...fromSignals, ...fromUser]);
  return combined.slice(0, 7);
}

/** Count failing signals in the last N messages (for instability override). */
export function countRecentFailingSignals(messages: ChatMessage[], window = 12): number {
  const last = messages.slice(-window);
  let count = 0;
  for (const msg of last) {
    if (msg.role !== "tool") continue;
    const content = msg.content ?? "";
    if (isFailingToolContent(content)) count++;
  }
  return count;
}

/** Detect repeating error codes (e.g. TS2345) in tool messages — indicates loop. */
export function detectRepeatingErrorCodes(messages: ChatMessage[]): string[] {
  const codes: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "tool") continue;
    const content = msg.content ?? "";
    const m = content.match(/TS\d+/g);
    if (m) codes.push(...m);
  }
  const seen = new Map<string, number>();
  for (const c of codes) {
    seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([c]) => c);
}
