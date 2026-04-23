import type { SpectyraConfig } from "../types.js";

/**
 * Dashboard / machine API key for `POST /v1/telemetry/run` (header `X-SPECTYRA-API-KEY`).
 * Not a provider key. Reads `SPECTYRA_CLOUD_API_KEY` then `SPECTYRA_API_KEY` when unset in config.
 *
 * When not in legacy `mode: "api"`, `config.apiKey` is treated as this key for in-app install flows.
 * In remote gateway mode, `apiKey` is only the legacy gateway credential.
 */
export function resolveSpectyraCloudApiKey(config: SpectyraConfig): string | undefined {
  const fromConfig = config.spectyraCloudApiKey?.trim();
  if (fromConfig) return fromConfig;
  if (config.mode !== "api") {
    const maybe = config.apiKey?.trim();
    if (maybe) return maybe;
  }
  if (typeof process === "undefined") return undefined;
  return (
    process.env.SPECTYRA_CLOUD_API_KEY?.trim() ||
    process.env.SPECTYRA_API_KEY?.trim() ||
    undefined
  );
}
