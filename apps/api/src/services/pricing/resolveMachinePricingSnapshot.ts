import { getBundledProviderPricingSnapshot } from "./bundledPricingSnapshot.js";
import { getLatestPricingRegistrySnapshot, listPricingOverridesForOrg } from "./pricingRegistryRepo.js";
import { applyPricingOverridesToSnapshot } from "./applyPricingOverrides.js";
import type { ProviderPricingSnapshot } from "./pricingTypes.js";

function filterByProvider(s: ProviderPricingSnapshot, providerFilter?: string): ProviderPricingSnapshot {
  const p = providerFilter?.trim().toLowerCase();
  if (!p) return s;
  return {
    ...s,
    entries: s.entries.filter((e) => e.provider === p),
  };
}

/**
 * Prefer latest DB snapshot when present; otherwise bundled catalog.
 * Applies global + org-specific `pricing_registry_overrides` for `orgId`.
 */
export async function resolveMachinePricingSnapshot(
  orgId: string,
  providerFilter?: string,
): Promise<ProviderPricingSnapshot> {
  const row = await getLatestPricingRegistrySnapshot();
  const base = row?.snapshot ?? getBundledProviderPricingSnapshot(undefined);
  const oRows = await listPricingOverridesForOrg(orgId);
  const merged = applyPricingOverridesToSnapshot(
    base,
    orgId,
    oRows.map((r) => ({ org_id: r.org_id, model_id: r.model_id, patch_json: r.patch_json })),
  );
  return filterByProvider(merged, providerFilter);
}
