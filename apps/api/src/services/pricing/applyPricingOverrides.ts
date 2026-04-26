import type { ModelPricingEntry, PricingComponent, ProviderPricingSnapshot } from "./pricingTypes.js";

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Deep-merge `patch` into a catalog entry (typically `components` price tweaks).
 * Unknown keys on `patch` are shallow-copied onto the entry when string/number/boolean.
 */
export function mergePricingEntryPatch(entry: ModelPricingEntry, patch: Record<string, unknown>): ModelPricingEntry {
  const out: ModelPricingEntry = { ...entry, components: [...entry.components] };
  const compsPatch = patch.components;
  if (Array.isArray(compsPatch)) {
    const byKey = new Map<string, PricingComponent>();
    for (const c of out.components) {
      byKey.set(c.key, { ...c });
    }
    for (const raw of compsPatch) {
      const p = asRecord(raw);
      if (!p) continue;
      const key = typeof p.key === "string" ? p.key : "";
      if (!key) continue;
      const prev = byKey.get(key);
      if (prev) {
        byKey.set(key, { ...prev, ...p } as unknown as PricingComponent);
      } else {
        byKey.set(key, p as unknown as PricingComponent);
      }
    }
    out.components = [...byKey.values()];
  }
  for (const [k, v] of Object.entries(patch)) {
    if (k === "components") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      (out as unknown as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}

/**
 * Apply DB override rows to a snapshot for the requesting org (global `org_id` null + org-specific).
 */
export function applyPricingOverridesToSnapshot(
  snapshot: ProviderPricingSnapshot,
  orgId: string,
  overrides: Array<{ org_id: string | null; model_id: string; patch_json: unknown }>,
): ProviderPricingSnapshot {
  const applicable = overrides.filter((r) => r.org_id == null || r.org_id === orgId);
  if (applicable.length === 0) return snapshot;
  const entries = snapshot.entries.map((e) => ({ ...e }));
  for (const row of applicable) {
    const idx = entries.findIndex((e) => e.modelId === row.model_id);
    if (idx < 0) continue;
    const patch = asRecord(row.patch_json);
    if (!patch) continue;
    entries[idx] = mergePricingEntryPatch(entries[idx]!, patch);
  }
  return { ...snapshot, entries };
}
