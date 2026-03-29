import { stableStringify } from "./json-stable.js";
import type { CanonicalState, ShallowDiff } from "./types.js";

function shallowEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Top-level key diff between two canonical states (no deep merge).
 */
export function shallowDiffState(previous: CanonicalState, next: CanonicalState): ShallowDiff {
  const prevKeys = new Set(Object.keys(previous));
  const nextKeys = new Set(Object.keys(next));
  const added: Record<string, unknown> = {};
  const removed: string[] = [];
  const changed: ShallowDiff["changed"] = {};
  const unchanged: Record<string, unknown> = {};

  for (const k of nextKeys) {
    if (!prevKeys.has(k)) {
      added[k] = next[k];
      continue;
    }
    const b = previous[k];
    const a = next[k];
    if (shallowEqual(b, a)) unchanged[k] = a;
    else changed[k] = { before: b, after: a };
  }
  for (const k of prevKeys) {
    if (!nextKeys.has(k)) removed.push(k);
  }
  return { added, removed, changed, unchanged };
}
