import { ChatMessage } from "../unitize";

export interface CodeSlicerInput {
  messages: ChatMessage[];
  aggressive: boolean;
}

export interface CodeSlicerOutput {
  messages: ChatMessage[];
  changed: boolean;
}

function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

function extractFencedBlocks(text: string): { lang: string; body: string; raw: string }[] {
  const out: { lang: string; body: string; raw: string }[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({ lang: (m[1] ?? "").trim(), body: (m[2] ?? "").trim(), raw: m[0] });
  }
  return out;
}

function trimMiddle(code: string, maxLines: number): string {
  const lines = code.split("\n");
  if (lines.length <= maxLines) return code;
  const head = Math.ceil(maxLines * 0.6);
  const tail = Math.floor(maxLines * 0.4);
  return [
    ...lines.slice(0, head),
    `// ... trimmed ${lines.length - head - tail} lines ...`,
    ...lines.slice(lines.length - tail)
  ].join("\n");
}

function pickMostRelevantBlock(blocks: { lang: string; body: string }[], query: string) {
  const q = query.toLowerCase();
  let bestIdx = 0;
  let bestScore = -1;

  // If query mentions a function/class name, prefer the block containing it.
  const nameMatch = q.match(/\b([a-zA-Z_]\w{2,})\b/g) ?? [];
  const nameSet = new Set(nameMatch);

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i].body.toLowerCase();
    let score = 0;
    for (const n of nameSet) {
      if (b.includes(n.toLowerCase() + "(") || b.includes("class " + n.toLowerCase())) score += 3;
      else if (b.includes(n.toLowerCase())) score += 1;
    }
    // short blocks are preferred if tie
    score -= Math.max(0, blocks[i].body.length - 1200) / 1200;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return blocks[bestIdx];
}

/**
 * MVP code slicing:
 * - On aggressive mode, keep only the most relevant fenced code block from prior messages
 * - Trim very large code blocks
 * - Keep the last user message intact
 */
export function applyCodeSlicing(input: CodeSlicerInput): CodeSlicerOutput {
  const { messages, aggressive } = input;
  if (!aggressive) return { messages, changed: false };

  const userQ = lastUserMessage(messages);

  // Collect all fenced blocks across history
  const allBlocks: { lang: string; body: string; fromIdx: number }[] = [];
  messages.forEach((m, idx) => {
    const blocks = extractFencedBlocks(m.content);
    for (const b of blocks) allBlocks.push({ lang: b.lang, body: b.body, fromIdx: idx });
  });

  if (allBlocks.length === 0) return { messages, changed: false };

  const chosen = pickMostRelevantBlock(allBlocks, userQ);
  const trimmed = trimMiddle(chosen.body, 180);

  // Replace earlier code-heavy messages with a single compact code context system note
  const codeContext = `Relevant code context (trimmed):\n\`\`\`${chosen.lang || ""}\n${trimmed}\n\`\`\``;

  const compacted: ChatMessage[] = [];
  // Keep system messages + last 2 messages (for local coherence)
  const lastTwo = messages.slice(-2);

  for (const m of messages) {
    if (m.role === "system") compacted.push(m);
  }
  compacted.push({ role: "system", content: codeContext });
  compacted.push(...lastTwo);

  return { messages: compacted, changed: true };
}
