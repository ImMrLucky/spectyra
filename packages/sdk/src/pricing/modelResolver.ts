import type { ModelPricingEntry } from "./types.js";

/**
 * Resolve a pricing entry for provider + model (exact, stripped suffix, prefix, default).
 */
export function resolveModelPricingEntry(
  entries: readonly ModelPricingEntry[],
  provider: string,
  modelId: string,
  warnings: string[],
): ModelPricingEntry | null {
  const p = provider.toLowerCase();
  const m = modelId.trim();
  const exact = entries.find(
    e => e.provider === p && e.modelId.toLowerCase() === m.toLowerCase(),
  );
  if (exact) return exact;

  const stripped = stripVersionSuffix(m);
  if (stripped !== m) {
    const v = entries.find(e => e.provider === p && e.modelId.toLowerCase() === stripped.toLowerCase());
    if (v) {
      warnings.push(`pricing: stripped model id fallback '${stripped}' for '${m}'`);
      return v;
    }
  }

  const prefix = entries.find(
    e => e.provider === p && m.startsWith(e.modelId) && e.modelId.length >= 4,
  );
  if (prefix) {
    warnings.push(`pricing: prefix fallback matched entry '${prefix.modelId}' for model '${m}'`);
    return prefix;
  }

  const def = entries.find(e => e.provider === p && (e.modelId === "*" || e.modelId === "default"));
  if (def) {
    warnings.push(`pricing: provider default entry used for model '${m}'`);
    return def;
  }
  return null;
}

function stripVersionSuffix(modelId: string): string {
  const parts = modelId.split("-");
  if (parts.length < 2) return modelId;
  const last = parts[parts.length - 1] ?? "";
  if (/^[\d._]+$/.test(last) && last.length > 0) {
    return parts.slice(0, -1).join("-");
  }
  return modelId;
}
