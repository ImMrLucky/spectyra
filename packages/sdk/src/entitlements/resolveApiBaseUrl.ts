import type { SpectyraConfig } from "../types.js";

/** Spectyra SaaS REST root including `/v1`. Override via `spectyraApiBaseUrl` or `SPECTYRA_API_BASE_URL` for private or staging hosts. */
export const SPECTYRA_DEFAULT_API_BASE_URL = "https://spectyra.ai/v1";

/**
 * Resolves the REST base (including `/v1`) for entitlement, pricing, and cloud telemetry.
 */
export function resolveSpectyraApiBaseUrl(config: SpectyraConfig): string {
  const fromEnt = config.entitlements?.baseUrl?.trim();
  if (fromEnt) return fromEnt.replace(/\/$/, "");
  const fromConfig = config.spectyraApiBaseUrl?.trim();
  if (fromConfig) return fromConfig.replace(/\/$/, "");
  if (typeof process !== "undefined" && process.env?.SPECTYRA_API_BASE_URL) {
    return process.env.SPECTYRA_API_BASE_URL.replace(/\/$/, "");
  }
  return SPECTYRA_DEFAULT_API_BASE_URL;
}
