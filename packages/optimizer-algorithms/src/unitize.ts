import crypto from "node:crypto";
import type { PathKind, SemanticUnit, SemanticUnitKind, ChatMsg } from "./types.js";

export interface UnitizeOptions {
  maxUnits: number;
  minChunkChars: number;
  maxChunkChars: number;
  includeSystem: boolean;
}

export interface UnitizeInput {
  path: PathKind;
  messages: ChatMsg[];
  lastTurnIndex: number;
  opts: UnitizeOptions;
}

function makeDeterministicId(text: string, kind: SemanticUnitKind, role: ChatMsg["role"]): string {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  const input = `${normalized}|${kind}|${role}`;
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `u_${hash.slice(0, 16)}`;
}

function makeId(units: SemanticUnit[], text: string, kind: SemanticUnitKind, role: ChatMsg["role"]): string {
  let baseId = makeDeterministicId(text, kind, role);
  let id = baseId;
  let suffix = 2;
  const existingIds = new Set(units.map(u => u.id));
  while (existingIds.has(id)) { id = `${baseId}_${suffix}`; suffix++; }
  return id;
}

function normalizeText(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

function splitParagraphs(text: string): string[] {
  const t = normalizeText(text);
  if (!t) return [];
  return t.split(/\n\s*\n/g).map(x => x.trim()).filter(Boolean);
}

function splitBullets(text: string): string[] {
  const lines = normalizeText(text).split("\n");
  const chunks: string[] = [];
  let buf: string[] = [];
  const flush = () => { const s = buf.join("\n").trim(); if (s) chunks.push(s); buf = []; };
  for (const line of lines) {
    if (/^\s*([-*]|\d+\.)\s+/.test(line) && buf.length) flush();
    buf.push(line);
  }
  flush();
  return chunks.map(x => x.trim()).filter(Boolean);
}

function detectCodeBlocks(text: string): { kind: "fenced" | "inline"; lang?: string; content: string }[] {
  const blocks: { kind: "fenced" | "inline"; lang?: string; content: string }[] = [];
  const t = normalizeText(text);
  const fenceRe = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(t)) !== null) blocks.push({ kind: "fenced", lang: m[1], content: m[2].trim() });
  const inlineRe = /`([^`]{10,})`/g;
  while ((m = inlineRe.exec(t)) !== null) blocks.push({ kind: "inline", content: m[1].trim() });
  return blocks;
}

function clampChunks(chunks: string[], opts: UnitizeOptions): string[] {
  const out: string[] = [];
  for (const c of chunks) {
    const s = c.trim();
    if (!s || s.length < opts.minChunkChars) continue;
    if (s.length <= opts.maxChunkChars) out.push(s);
    else {
      for (let i = 0; i < s.length; i += opts.maxChunkChars) {
        const part = s.slice(i, i + opts.maxChunkChars).trim();
        if (part.length >= opts.minChunkChars) out.push(part);
      }
    }
  }
  return out;
}

function inferKind(path: PathKind, role: ChatMsg["role"], text: string): SemanticUnitKind {
  const t = text.toLowerCase();
  if (path === "code") {
    if (/^\s*(diff --git|@@\s+-\d+,\d+\s+\+\d+,\d+|index\s+[0-9a-f]+)/m.test(text)) return "patch";
    if (text.includes("```") || /^\s*(function|class|import|export|const|let|var)\b/m.test(text)) return "code";
    if (role === "user" && (t.includes("must") || t.includes("should") || t.includes("require"))) return "constraint";
    return role === "assistant" ? "explanation" : "fact";
  }
  if (role === "user" && (t.includes("must") || t.includes("should") || t.includes("require"))) return "constraint";
  if (role === "assistant") return "explanation";
  return "fact";
}

function chooseTalkChunks(text: string): string[] {
  const bulletish = /^\s*([-*]|\d+\.)\s+/m.test(text);
  const chunks = bulletish ? splitBullets(text) : splitParagraphs(text);
  return chunks.length ? chunks : [normalizeText(text)];
}

function chooseCodeChunks(text: string): string[] {
  const blocks = detectCodeBlocks(text);
  const chunks: string[] = [];
  for (const b of blocks) {
    if (b.kind === "fenced") chunks.push(`CODE_BLOCK:\n${b.content}`);
  }
  const prose = normalizeText(text).replace(/```(\w+)?\n[\s\S]*?```/g, "").trim();
  if (prose) chunks.push(...chooseTalkChunks(prose));
  return chunks.length ? chunks : [normalizeText(text)];
}

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
        stabilityScore: 0.5,
        createdAtTurn: lastTurnIndex,
      });
    }
  }
  return units.slice(-opts.maxUnits);
}
