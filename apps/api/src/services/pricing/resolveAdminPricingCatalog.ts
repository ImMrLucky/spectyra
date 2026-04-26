import { getBundledProviderPricingSnapshot } from "./bundledPricingSnapshot.js";
import { countPricingOverrides, getLatestPricingRegistrySnapshot } from "./pricingRegistryRepo.js";
import type { ProviderPricingSnapshot } from "./pricingTypes.js";

export interface AdminPricingRegistryMeta {
  source: "database" | "bundled";
  /** True when DB row age exceeds its TTL (refresh job may be stuck). */
  stale: boolean;
  ingestedAt?: string;
  overrideCount: number;
}

export async function resolveAdminPricingCatalog(providerFilter?: string): Promise<{
  snapshot: ProviderPricingSnapshot;
  registry: AdminPricingRegistryMeta;
}> {
  const overrideCount = await countPricingOverrides();
  const row = await getLatestPricingRegistrySnapshot();
  if (row) {
    const p = providerFilter?.trim().toLowerCase();
    const snapshot = {
      ...row.snapshot,
      entries: p ? row.snapshot.entries.filter((e) => e.provider === p) : row.snapshot.entries,
    };
    const ageSec = (Date.now() - new Date(row.ingestedAt).getTime()) / 1000;
    const stale = ageSec > row.ttlSeconds;
    return {
      snapshot,
      registry: { source: "database", stale, ingestedAt: row.ingestedAt, overrideCount },
    };
  }
  return {
    snapshot: getBundledProviderPricingSnapshot(providerFilter),
    registry: { source: "bundled", stale: false, overrideCount },
  };
}
