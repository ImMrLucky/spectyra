/**
 * Deterministic JSON for hashing and wire-size estimates.
 */

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value)) ?? "null";
}

function sortKeysDeep(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) {
    out[k] = sortKeysDeep(o[k]);
  }
  return out;
}
