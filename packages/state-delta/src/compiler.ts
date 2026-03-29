import { shallowDiffState } from "./diff.js";
import { stableStringify } from "./json-stable.js";
import type { CanonicalState, CompiledHopPayload, RefHandle } from "./types.js";
import type { RefStore } from "./refs.js";

const REF_INLINE_THRESHOLD = 256;

/**
 * Build a minimal hop payload: unchanged keys listed, mutations as set/tombstones,
 * large new values as refs (reversible via `refStore`).
 */
export function compileNextHopPayload(
  previous: CanonicalState,
  next: CanonicalState,
  refStore: RefStore,
  priorStateRef?: RefHandle,
): CompiledHopPayload {
  const d = shallowDiffState(previous, next);
  const keysUnchanged = Object.keys(d.unchanged);
  const set: Record<string, unknown> = { ...d.added };
  const valueRefs: Record<string, RefHandle> = {};

  for (const [k, { after }] of Object.entries(d.changed)) {
    const json = stableStringify(after);
    if (json.length >= REF_INLINE_THRESHOLD) {
      valueRefs[k] = refStore.put(after);
    } else {
      set[k] = after;
    }
  }

  for (const [k, v] of Object.entries(d.added)) {
    const json = stableStringify(v);
    if (json.length >= REF_INLINE_THRESHOLD) {
      delete set[k];
      valueRefs[k] = refStore.put(v);
    }
  }

  return {
    priorRef: priorStateRef,
    keysUnchanged,
    delta: { set, tombstones: d.removed },
    valueRefs,
  };
}
