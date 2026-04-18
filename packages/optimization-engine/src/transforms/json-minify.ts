import type {
  CanonicalRequest,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function tryMinifyJson(text: string): { minified: string; saved: number } | null {
  try {
    const parsed = JSON.parse(text);
    const compact = JSON.stringify(parsed);
    const saved = text.length - compact.length;
    return saved > 50 ? { minified: compact, saved } : null;
  } catch {
    return null;
  }
}

/** Find matching `}` or `]` for a JSON fragment starting at `start` (handles strings). */
function findMatchingJsonBrace(text: string, start: number): number {
  const open = text[start];
  if (open !== "{" && open !== "[") return -1;
  const closeCh = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === open) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Replace ```json … ``` blocks without global `/[\s\S]*?/` (ReDoS). */
function minifyJsonFencedBlocks(text: string): { result: string; saved: number } {
  let totalSaved = 0;
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (!text.startsWith("```", i)) {
      const next = text.indexOf("```", i);
      const end = next === -1 ? text.length : next;
      out += text.slice(i, end);
      i = end;
      continue;
    }
    let p = i + 3;
    if (text.slice(p, p + 4).toLowerCase() === "json") p += 4;
    while (p < text.length && /\s/.test(text[p]) && text[p] !== "\n") p++;
    if (p >= text.length || text[p] !== "\n") {
      out += text.slice(i, i + 3);
      i += 3;
      continue;
    }
    p++;
    const innerStart = p;
    const closeFence = text.indexOf("\n```", innerStart);
    if (closeFence < 0) {
      out += text.slice(i);
      break;
    }
    const inner = text.slice(innerStart, closeFence);
    const fenceEnd = closeFence + 4;
    const m = tryMinifyJson(inner.trim());
    if (m) {
      totalSaved += m.saved;
      out += "```json\n" + m.minified + "\n```";
    } else {
      out += text.slice(i, fenceEnd);
    }
    i = fenceEnd;
  }
  return { result: out, saved: totalSaved };
}

/** Minify large bare JSON objects/arrays at line starts using bracket matching (no `[\s\S]{500,}?`). */
function minifyBareJsonBlocks(text: string): { result: string; saved: number } {
  let totalSaved = 0;
  const lineStarts: number[] = [];
  if (text.length > 0 && (text[0] === "{" || text[0] === "[")) lineStarts.push(0);
  for (let k = 0; k < text.length - 1; k++) {
    if (text[k] === "\n" && (text[k + 1] === "{" || text[k + 1] === "[")) lineStarts.push(k + 1);
  }

  const replacements: Array<{ start: number; end: number; replacement: string; saved: number }> = [];
  for (const start of lineStarts) {
    const endIdx = findMatchingJsonBrace(text, start);
    if (endIdx < 0 || endIdx - start < 500) continue;
    const candidate = text.slice(start, endIdx + 1);
    const m = tryMinifyJson(candidate.trim());
    if (m && m.saved > 0) replacements.push({ start, end: endIdx + 1, replacement: m.minified, saved: m.saved });
  }

  if (replacements.length === 0) return { result: text, saved: 0 };

  replacements.sort((a, b) => b.saved - a.saved);
  const picked: typeof replacements = [];
  for (const r of replacements) {
    if (picked.some((p) => !(r.end <= p.start || r.start >= p.end))) continue;
    picked.push(r);
  }
  picked.sort((a, b) => b.start - a.start);
  let result = text;
  for (const r of picked) {
    totalSaved += r.saved;
    result = result.slice(0, r.start) + r.replacement + result.slice(r.end);
  }
  return { result, saved: totalSaved };
}

function minifyJsonInMessage(text: string): { result: string; totalSaved: number } {
  const step1 = minifyJsonFencedBlocks(text);
  const step2 = minifyBareJsonBlocks(step1.result);
  return { result: step2.result, totalSaved: step1.saved + step2.saved };
}

export const jsonMinify: OptimizationTransform = {
  id: "json_minify",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest): boolean {
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    if (totalChars < 2000) return false;
    return request.messages.some(m =>
      (m.role === "tool" || m.role === "assistant") && (m.text?.includes("{") || m.text?.includes("["))
    );
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    let totalSaved = 0;
    const messages = request.messages.map(m => {
      if (!m.text || m.text.length < 200) return m;
      if (m.role === "system") return m;
      const { result, totalSaved: saved } = minifyJsonInMessage(m.text);
      totalSaved += saved;
      return saved > 0 ? { ...m, text: result } : m;
    });

    if (totalSaved <= 50) {
      return { request, applied: false, notes: ["json minify: no significant savings"], riskLevel: "low" };
    }

    return {
      request: { ...request, messages },
      applied: true,
      notes: [`json minify: ${totalSaved} chars saved from JSON compaction`],
      estimatedTokenDelta: -Math.ceil(totalSaved / 4),
      riskLevel: "low",
    };
  },
};
