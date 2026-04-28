import type { SpectyraConfig } from "../types.js";
import type { TelemetryMode } from "@spectyra/core-types";
import { resolveSpectyraCloudApiKey } from "../cloud/resolveSpectyraCloudApiKey.js";

/**
 * Resolves telemetry mode after applying product defaults.
 * - Explicit `config.telemetry.mode` always wins.
 * - In-app default: `cloud_redacted` when a Spectyra cloud API key is configured (dashboard rollups).
 * - `productSurface: "openclaw_compat"` keeps legacy default `local` unless telemetry mode is explicit.
 */
export function resolveEffectiveTelemetryMode(config: SpectyraConfig): TelemetryMode {
  const explicit = config.telemetry?.mode;
  if (explicit === "off" || explicit === "local" || explicit === "cloud_redacted") {
    return explicit;
  }
  if (config.productSurface === "openclaw_compat") {
    return "local";
  }
  return resolveSpectyraCloudApiKey(config) ? "cloud_redacted" : "local";
}
