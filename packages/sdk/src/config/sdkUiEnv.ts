import type { SpectyraConfig } from "../types.js";

/**
 * Normalize deployment tier for overlay / debug defaults.
 * Production never picks up SPECTYRA_OVERLAY / SPECTYRA_DEBUG from env alone.
 */
export function isSpectyraProductionEnvironment(config: SpectyraConfig): boolean {
  const raw = config.environment;
  if (raw != null && String(raw).trim() !== "") {
    const e = String(raw).trim().toLowerCase();
    if (e === "production" || e === "prod") return true;
    if (e === "development" || e === "dev" || e === "qa" || e === "staging" || e === "test") {
      return false;
    }
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
    return true;
  }
  return false;
}

/**
 * Savings UI (browser devtools). Explicit opt-in only; never auto-enabled from non-prod NODE_ENV alone.
 */
export function resolveEffectiveOverlay(config: SpectyraConfig): boolean {
  if (config.overlay === false) return false;
  if (config.overlay === true) return true;
  if (typeof process !== "undefined" && process.env?.SPECTYRA_OVERLAY === "true") {
    return !isSpectyraProductionEnvironment(config);
  }
  return false;
}

/**
 * Extra safe console summaries (no prompts, keys, or messages). Env opt-in only outside production.
 */
export function resolveEffectiveDebug(config: SpectyraConfig): boolean {
  if (config.debug === false) return false;
  if (config.debug === true) return true;
  if (typeof process !== "undefined" && process.env?.SPECTYRA_DEBUG === "true") {
    return !isSpectyraProductionEnvironment(config);
  }
  return false;
}

export function resolveSpectyraEnvironmentLabel(config: SpectyraConfig): string {
  if (config.environment != null && String(config.environment).trim() !== "") {
    return String(config.environment).trim();
  }
  if (typeof process !== "undefined" && process.env?.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  if (typeof globalThis !== "undefined" && "document" in globalThis) {
    return "browser";
  }
  return "runtime";
}
