/**
 * Code slicer: on aggressive mode, keeps only the most relevant fenced code
 * block from prior messages and trims very large blocks.
 */

import type { ChatMsg } from "./types.js";

export interface CodeSlicerInput {
  messages: ChatMsg[];
  aggressive: boolean;
}

export interface CodeSlicerOutput {
  messages: ChatMsg[];
  changed: boolean;
  metadata?: {
    blocksFound: number;
    blocksKept: number;
    linesRemoved: number;
  };
}

function extractSignatures(code: string): Set<string> {
  const signatures = new Set<string>();
  for (const match of code.matchAll(/(?:function|const|let|var)\s+([a-zA-Z_]\w*)\s*(?:=\s*)?(?:async\s*)?\(/g)) {
    signatures.add(match[1].toLowerCase());
  }
  for (const match of code.matchAll(/class\s+([a-zA-Z_]\w*)/g)) {
    signatures.add(match[1].toLowerCase());
  }
  for (const match of code.matchAll(/(?:async\s+)?([a-zA-Z_]\w*)\s*\([^)]*\)\s*{/g)) {
    signatures.add(match[1].toLowerCase());
  }
  return signatures;
}

function lastUserMessage(messages: ChatMsg[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function extractFencedBlocks(text: string): { lang: string; body: string; raw: string; signatures: Set<string> }[] {
  const out: { lang: string; body: string; raw: string; signatures: Set<string> }[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const body = (m[2] ?? "").trim();
    out.push({ lang: (m[1] ?? "").trim(), body, raw: m[0], signatures: extractSignatures(body) });
  }
  return out;
}

function trimMiddle(code: string, maxLines: number): string {
  const lines = code.split("\n");
  if (lines.length <= maxLines) return code;

  const signatureLines: number[] = [];
  lines.forEach((line, idx) => {
    if (/^\s*(function|const|class|async|export)/i.test(line)) signatureLines.push(idx);
  });

  if (signatureLines.length > 0) {
    const kept: string[] = [];
    let lastKept = -1;
    for (const sigIdx of signatureLines) {
      if (kept.length >= maxLines * 0.7) break;
      if (lastKept >= 0 && sigIdx - lastKept > 2) {
        kept.push(`// ... ${sigIdx - lastKept - 1} lines ...`);
      }
      const end = Math.min(lines.length, sigIdx + 4);
      kept.push(...lines.slice(sigIdx, end));
      lastKept = end - 1;
    }
    if (kept.length < maxLines && lastKept < lines.length - 1) {
      kept.push(`// ... ${lines.length - lastKept - 1} more lines ...`);
    }
    return kept.join("\n");
  }

  const head = Math.ceil(maxLines * 0.6);
  const tail = Math.floor(maxLines * 0.4);
  return [
    ...lines.slice(0, head),
    `// ... trimmed ${lines.length - head - tail} lines ...`,
    ...lines.slice(lines.length - tail),
  ].join("\n");
}

function pickMostRelevantBlock(blocks: { lang: string; body: string }[], query: string) {
  const q = query.toLowerCase();
  let bestIdx = 0;
  let bestScore = -1;
  const nameMatch = q.match(/\b([a-zA-Z_]\w{2,})\b/g) ?? [];
  const nameSet = new Set(nameMatch);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].body.toLowerCase();
    let score = 0;
    for (const n of nameSet) {
      if (b.includes(n.toLowerCase() + "(") || b.includes("class " + n.toLowerCase())) score += 3;
      else if (b.includes(n.toLowerCase())) score += 1;
    }
    score -= Math.max(0, blocks[i].body.length - 1200) / 1200;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return blocks[bestIdx];
}

export function applyCodeSlicing(input: CodeSlicerInput): CodeSlicerOutput {
  const { messages, aggressive } = input;
  if (!aggressive) return { messages, changed: false };

  const userQ = lastUserMessage(messages);
  const allBlocks: { lang: string; body: string; signatures: Set<string>; fromIdx: number }[] = [];
  messages.forEach((m, idx) => {
    for (const b of extractFencedBlocks(m.content)) allBlocks.push({ ...b, fromIdx: idx });
  });

  if (allBlocks.length === 0) return { messages, changed: false };

  const chosen = pickMostRelevantBlock(allBlocks, userQ);
  const originalLines = chosen.body.split("\n").length;
  const trimmed = trimMiddle(chosen.body, 180);
  const trimmedLines = trimmed.split("\n").length;

  const codeContext = `Relevant code context (${trimmedLines}/${originalLines} lines):\n\`\`\`${chosen.lang || ""}\n${trimmed}\n\`\`\``;

  const compacted: ChatMsg[] = [];
  const lastTwo = messages.slice(-2);

  for (const m of messages) {
    if (m.role === "system") compacted.push(m);
  }
  compacted.push({ role: "system", content: codeContext });
  compacted.push(...lastTwo);

  return {
    messages: compacted,
    changed: true,
    metadata: { blocksFound: allBlocks.length, blocksKept: 1, linesRemoved: originalLines - trimmedLines },
  };
}
