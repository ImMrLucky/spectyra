import type { SpectyraConfig } from "../types.js";

/**
 * Dashboard / machine API key for `POST /v1/telemetry/run` (header `X-SPECTYRA-API-KEY`).
 * Not a provider key. Reads `SPECTYRA_CLOUD_API_KEY` then `SPECTYRA_API_KEY` when unset in config.
 */
export function resolveSpectyraCloudApiKey(config: SpectyraConfig): string | undefined {
  const fromConfig = config.spectyraCloudApiKey?.trim();
  if (fromConfig) return fromConfig;
  if (typeof process === "undefined") return undefined;
  return (
    process.env.SPECTYRA_CLOUD_API_KEY?.trim() ||
    process.env.SPECTYRA_API_KEY?.trim() ||
    undefined
  );
}
