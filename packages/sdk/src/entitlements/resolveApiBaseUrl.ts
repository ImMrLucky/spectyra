import type { SpectyraConfig } from "../types.js";

/**
 * Resolves the REST base (including `/v1`) for entitlement + pricing calls.
 */
export function resolveSpectyraApiBaseUrl(config: SpectyraConfig): string {
  const fromEnt = config.entitlements?.baseUrl?.trim();
  if (fromEnt) return fromEnt.replace(/\/$/, "");
  const fromConfig = config.spectyraApiBaseUrl?.trim();
  if (fromConfig) return fromConfig.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.SPECTYRA_API_BASE_URL) {
    return process.env.SPECTYRA_API_BASE_URL.replace(/\/$/, "");
  }
  return "";
}
