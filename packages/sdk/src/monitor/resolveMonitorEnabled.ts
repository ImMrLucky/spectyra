import type { SpectyraConfig } from "../types.js";

/**
 * In-app monitoring is **on by default**. Off only when explicitly disabled via
 * `features.monitor === false` or `monitor.enabled === false`.
 */
export function resolveMonitorEnabledInApp(config: SpectyraConfig): boolean {
  if (config.monitor?.enabled === false) return false;
  if (config.features?.monitor === false) return false;
  return true;
}
