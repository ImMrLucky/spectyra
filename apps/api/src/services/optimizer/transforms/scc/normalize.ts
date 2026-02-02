/**
 * SCC normalization utilities — deterministic, compact output.
 */

/**
 * Normalize a bullet line: strip leading "- " / "* " / "• ", collapse whitespace, trim.
 */
export function normalizeBullet(line: string): string {
  const t = line.replace(/\s+/g, " ").trim();
  const stripped = t.replace(/^[-*•]\s*/, "").trim();
  return stripped || t;
}

/**
 * Dedupe array while preserving first occurrence order.
 */
export function dedupeOrdered<T>(lines: T[], key?: (x: T) => string): T[] {
  const seen = new Set<string>();
  const keyFn = key ?? ((x: T) => String(x));
  return lines.filter((x) => {
    const k = keyFn(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Normalize a file path: strip trailing punctuation, collapse slashes, trim.
 */
export function normalizePath(p: string): string {
  return p
    .replace(/[.,;:!?)]+$/, "")
    .replace(/\\/g, "/")
    .replace(/\/+/g, "/")
    .trim();
}

export interface FailingSignal {
  file?: string;
  line?: number;
  code?: string;
  message?: string;
  /** Raw snippet for dedupe key when structured fields are missing */
  raw?: string;
}

/**
 * Dedupe failing signals by (file, line, code) or by normalized raw; preserve order.
 */
export function dedupeFailingSignals(items: FailingSignal[]): FailingSignal[] {
  const key = (s: FailingSignal) => {
    if (s.file != null && s.line != null && s.code != null) {
      return `${normalizePath(s.file)}:${s.line}:${s.code}`;
    }
    return (s.raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  };
  return dedupeOrdered(items, key);
}
