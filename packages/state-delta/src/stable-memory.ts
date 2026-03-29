import type { CanonicalState } from "./types.js";
import { shallowDiffState } from "./diff.js";

/**
 * Keys whose values are byte-identical (stable JSON) across two consecutive states.
 */
export function unchangedKeySet(previous: CanonicalState, next: CanonicalState): Set<string> {
  const d = shallowDiffState(previous, next);
  return new Set(Object.keys(d.unchanged));
}

/**
 * Subset of `state` containing only keys that stayed stable vs `previous`.
 */
export function extractStableSlice(previous: CanonicalState, next: CanonicalState): CanonicalState {
  const d = shallowDiffState(previous, next);
  return { ...d.unchanged };
}

/**
 * Keys that are new or changed going from `previous` → `next`.
 */
export function volatileKeySet(previous: CanonicalState, next: CanonicalState): Set<string> {
  const d = shallowDiffState(previous, next);
  return new Set([...Object.keys(d.added), ...Object.keys(d.changed)]);
}
