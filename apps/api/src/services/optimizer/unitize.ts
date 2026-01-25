import crypto from "node:crypto";
import type { PathKind, SemanticUnit, SemanticUnitKind } from "./spectral/types";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface UnitizeOptions {
  maxUnits: number;              // e.g. 50
  minChunkChars: number;         // e.g. 40
  maxChunkChars: number;         // e.g. 900
  includeSystem: boolean;        // usually false
}

export interface UnitizeInput {
  path: PathKind;
  messages: ChatMessage[];
  lastTurnIndex: number; // integer turn counter (increment per user message or per call)
  opts: UnitizeOptions;
}

/**
 * Generate deterministic ID from text content, kind, and role
 * Format: "u_" + first 16 chars of SHA256 hash
 */
function makeDeterministicId(text: string, kind: SemanticUnitKind, role: ChatMessage["role"]): string {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  const input = `${normalized}|${kind}|${role}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `u_${hash.slice(0, 16)}`;
}

/**
 * Generate ID with collision handling
 */
function makeId(units: SemanticUnit[], text: string, kind: SemanticUnitKind, role: ChatMessage["role"]): string {
  let baseId = makeDeterministicId(text, kind, role);
  let id = baseId;
  let suffix = 2;
  
  // Check for collisions and append suffix if needed
  const existingIds = new Set(units.map(u => u.id));
  while (existingIds.has(id)) {
    id = `${baseId}_${suffix}`;
    suffix++;
  }
  
  return id;
}

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

function splitParagraphs(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  // split on blank lines; keep meaningful paragraphs
  return t
    .split(/\n\s*\n/g)
    .map(x => x.trim())
    .filter(Boolean);
}

function splitBullets(text: string): string[] {
  // splits bullets like "- ", "* ", "1. "
  const lines = normalizeText(text).split("\n");
  const chunks: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const s = buf.join("\n").trim();
    if (s) chunks.push(s);
    buf = [];
  };

  for (const line of lines) {
    const isBullet = /^\s*([-*]|\d+\.)\s+/.test(line);
    if (isBullet && buf.length) flush();
    buf.push(line);
  }
  flush();
  return chunks.map(x => x.trim()).filter(Boolean);
}

function detectCodeBlocks(text: string): { kind: "fenced" | "inline"; lang?: string; content: string }[] {
  const blocks: { kind: "fenced" | "inline"; lang?: string; content: string }[] = [];
  const t = normalizeText(text);

  // fenced ```lang ... ```
  const fenceRe = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(t)) !== null) {
    blocks.push({ kind: "fenced", lang: m[1], content: m[2].trim() });
  }

  // inline `code`
  const inlineRe = /`([^`]{10,})`/g;
  while ((m = inlineRe.exec(t)) !== null) {
    blocks.push({ kind: "inline", content: m[1].trim() });
  }

  return blocks;
}

function clampChunks(chunks: string[], opts: UnitizeOptions): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    const s = c.trim();
    if (!s) continue;
    if (s.length < opts.minChunkChars) continue;

    if (s.length <= opts.maxChunkChars) out.push(s);
    else {
      // split long chunk into maxChunkChars windows
      for (let i = 0; i < s.length; i += opts.maxChunkChars) {
        const part = s.slice(i, i + opts.maxChunkChars).trim();
        if (part.length >= opts.minChunkChars) out.push(part);
      }
    }
  }
  return out;
}

function inferKind(path: PathKind, role: ChatMessage["role"], text: string): SemanticUnitKind {
  const t = text.toLowerCase();

  // code path: code blocks/diffs are central
  if (path === "code") {
    if (/^\s*(diff --git|@@\s+-\d+,\d+\s+\+\d+,\d+|index\s+[0-9a-f]+)/m.test(text)) return "patch";
    if (text.includes("```") || /^\s*(function|class|import|export|const|let|var)\b/m.test(text)) return "code";
    if (role === "user" && (t.includes("must") || t.includes("should") || t.includes("require"))) return "constraint";
    return role === "assistant" ? "explanation" : "fact";
  }

  // talk path
  if (role === "user" && (t.includes("must") || t.includes("should") || t.includes("require"))) return "constraint";
  if (role === "assistant") return "explanation";
  return "fact";
}

function chooseTalkChunks(text: string): string[] {
  // Prefer bullet-splitting if it looks like bullets, else paragraphs
  const bulletish = /^\s*([-*]|\d+\.)\s+/m.test(text);
  const chunks = bulletish ? splitBullets(text) : splitParagraphs(text);
  return chunks.length ? chunks : [normalizeText(text)];
}

function chooseCodeChunks(text: string): string[] {
  // Extract fenced code blocks as separate chunks, plus remaining prose
  const blocks = detectCodeBlocks(text);
  const chunks: string[] = [];

  // Include each fenced code block as its own chunk
  for (const b of blocks) {
    if (b.kind === "fenced") chunks.push(`CODE_BLOCK:\n${b.content}`);
  }

  // Remove fenced blocks from prose
  const prose = normalizeText(text).replace(/```(\w+)?\n[\s\S]*?```/g, "").trim();
  if (prose) {
    // split prose into paragraphs/bullets
    chunks.push(...chooseTalkChunks(prose));
  }

  return chunks.length ? chunks : [normalizeText(text)];
}

/**
 * Convert messages into semantic units (no embeddings yet).
 * Embeddings are added later by the optimizer via EmbeddingService.
 */
export function unitizeMessages(input: UnitizeInput): SemanticUnit[] {
  const { path, messages, lastTurnIndex, opts } = input;

  const units: SemanticUnit[] = [];
  for (const msg of messages) {
    if (!opts.includeSystem && msg.role === "system") continue;
    const content = normalizeText(msg.content);
    if (!content) continue;

    const rawChunks = path === "code" ? chooseCodeChunks(content) : chooseTalkChunks(content);
    const chunks = clampChunks(rawChunks, opts);

    for (const chunk of chunks) {
      const kind = inferKind(path, msg.role, chunk);
      units.push({
        id: makeId(units, chunk, kind, msg.role),
        kind,
        text: chunk,
        stabilityScore: 0.5,          // will be updated by spectral pass / reuse later
        createdAtTurn: lastTurnIndex
      });
    }
  }

  // Keep only most recent maxUnits
  return units.slice(-opts.maxUnits);
}
