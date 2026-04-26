import { countPricingOverrides, getLatestPricingRegistrySnapshot } from "./pricingRegistryRepo.js";

/** Lightweight status for admin dashboard / operator alerts (no full snapshot payload). */
export async function getPricingRegistryOperatorStatus(): Promise<{
  catalogSource: "database" | "bundled";
  stale: boolean;
  version: string | null;
  ingestedAt: string | null;
  overrideCount: number;
}> {
  const [row, overrideCount] = await Promise.all([
    getLatestPricingRegistrySnapshot(),
    countPricingOverrides(),
  ]);
  if (!row) {
    return {
      catalogSource: "bundled",
      stale: false,
      version: null,
      ingestedAt: null,
      overrideCount,
    };
  }
  const ageSec = (Date.now() - new Date(row.ingestedAt).getTime()) / 1000;
  const stale = ageSec > row.ttlSeconds;
  return {
    catalogSource: "database",
    stale,
    version: row.snapshot.version,
    ingestedAt: row.ingestedAt,
    overrideCount,
  };
}
