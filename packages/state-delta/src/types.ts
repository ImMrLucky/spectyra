/**
 * Canonical keyed state — adapters map provider blobs into JSON-serializable slices.
 * Shallow keys only in Phase 4; nested values are treated as opaque (stable-stringify).
 */

export type CanonicalState = Record<string, unknown>;

export type ShallowDiff = {
  added: Record<string, unknown>;
  removed: string[];
  changed: Record<string, { before: unknown; after: unknown }>;
  unchanged: Record<string, unknown>;
};

/** Reversible handle for a blob (local store); pair with prompt-diff UIs later. */
export type RefHandle = `ref:sha256:${string}`;

export type CompiledHopPayload = {
  /** Optional pointer to prior full state (companion-local or session store). */
  priorRef?: RefHandle;
  keysUnchanged: string[];
  delta: {
    set: Record<string, unknown>;
    tombstones: string[];
  };
  /** Large values inlined as refs instead of raw JSON in `set`. */
  valueRefs: Record<string, RefHandle>;
};
