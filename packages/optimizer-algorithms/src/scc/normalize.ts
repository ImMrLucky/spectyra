export function normalizeBullet(line: string): string {
  const t = line.replace(/\s+/g, " ").trim();
  const stripped = t.replace(/^[-*•]\s*/, "").trim();
  return stripped || t;
}

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

export function dedupeUserSentencesKeepLast(lines: string[]): string[] {
  const lastIdx = new Map<string, number>();
  lines.forEach((line, i) => { const k = line.trim(); if (k) lastIdx.set(k, i); });
  const order = [...lastIdx.entries()].sort((a, b) => a[1]! - b[1]!);
  return order.map(([s]) => s);
}

export function normalizePath(p: string): string {
  return p.replace(/[.,;:!?)]+$/, "").replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

export interface FailingSignal {
  file?: string;
  line?: number;
  code?: string;
  message?: string;
  raw?: string;
}

export function dedupeFailingSignals(items: FailingSignal[]): FailingSignal[] {
  const key = (s: FailingSignal) => {
    if (s.file != null && s.line != null && s.code != null) return `${normalizePath(s.file)}:${s.line}:${s.code}`;
    return (s.raw ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  };
  return dedupeOrdered(items, key);
}
