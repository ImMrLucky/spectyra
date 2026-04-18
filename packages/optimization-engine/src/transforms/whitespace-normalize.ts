/**
 * Whitespace normalization transform.
 *
 * Collapses excessive whitespace in message text. Always safe to apply.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

/** Collapse horizontal whitespace and excessive newlines (linear; no regex on library text). */
function normalizeWhitespaceRaw(text: string): string {
  let t = "";
  let inHSpaces = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === " " || c === "\t") {
      if (!inHSpaces) {
        t += " ";
        inHSpaces = true;
      }
    } else if (c === "\n") {
      inHSpaces = false;
      if (t.length > 0 && t[t.length - 1] === " ") t = t.slice(0, -1);
      t += "\n";
    } else {
      inHSpaces = false;
      t += c;
    }
  }

  let u = "";
  let nlRun = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "\n") {
      nlRun++;
    } else {
      if (nlRun > 0) {
        const outCount = nlRun >= 3 ? 2 : nlRun;
        u += "\n".repeat(outCount);
        nlRun = 0;
      }
      u += t[i];
    }
  }
  if (nlRun > 0) u += "\n".repeat(nlRun >= 3 ? 2 : nlRun);
  return u.trim();
}

/**
 * Split text into alternating prose / code-fence segments, normalize only the
 * prose segments, and reassemble. Code fences (``` blocks) are preserved as-is.
 */
/** Split on ```…``` fences — same segments as `split(/(```[\s\S]*?```)/g)` without ReDoS-prone regex. */
function splitPreservingMarkdownFences(text: string): string[] {
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    const fenceAt = text.indexOf("```", i);
    if (fenceAt < 0) {
      parts.push(text.slice(i));
      break;
    }
    parts.push(text.slice(i, fenceAt));
    const close = text.indexOf("```", fenceAt + 3);
    if (close < 0) {
      parts.push(text.slice(fenceAt));
      break;
    }
    parts.push(text.slice(fenceAt, close + 3));
    i = close + 3;
  }
  return parts;
}

function normalizeWhitespace(text: string): string {
  const parts = splitPreservingMarkdownFences(text);
  return parts
    .map((segment, idx) => (idx % 2 === 0 ? normalizeWhitespaceRaw(segment) : segment))
    .join("");
}

export const whitespaceNormalize: OptimizationTransform = {
  id: "whitespace_normalize",

  applies(_features: FeatureDetectionResult[], _request: CanonicalRequest): boolean {
    return true;
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    let totalDelta = 0;
    const messages: CanonicalMessage[] = request.messages.map(m => {
      if (!m.text) return m;
      const normalized = normalizeWhitespace(m.text);
      totalDelta += m.text.length - normalized.length;
      return { ...m, text: normalized };
    });

    return {
      request: { ...request, messages },
      applied: totalDelta > 0,
      notes: totalDelta > 0 ? [`removed ${totalDelta} chars of whitespace`] : [],
      estimatedTokenDelta: -Math.ceil(totalDelta / 4),
      riskLevel: "low",
    };
  },
};
