/**
 * Cached Spectyra Cloud billing status for the linked org.
 * Used to gate real local optimizations (trial/subscription) without relaying prompts through Spectyra.
 */

import { loadConfig, type CompanionConfig } from "./config.js";
import { loadDesktopConfig, getValidSupabaseAccessToken } from "./desktopSession.js";
import { fetchSpectyraV1 } from "./spectyraCloudFetch.js";

const TTL_MS = 45_000;
const ERROR_STALE_KEEP_MS = 10 * 60_000;

type Cache = { allows: boolean; at: number };

let cache: Cache | null = null;

function parseAllows(body: Record<string, unknown>): boolean {
  if (body.has_access === true) return true;
  if (body.org_platform_exempt === true) return true;
  if (body.platform_billing_exempt === true) return true;
  return false;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const token = await getValidSupabaseAccessToken(loadDesktopConfig());
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  const snap = loadConfig();
  const key = snap.spectyraApiKey?.trim() || snap.licenseKey?.trim();
  if (!key) return null;
  return { "X-SPECTYRA-API-KEY": key };
}

async function fetchAndUpdateCache(): Promise<void> {
  const prev = cache;
  try {
    const headers = await authHeaders();
    if (!headers) {
      cache = { allows: false, at: Date.now() };
      return;
    }
    const r = await fetchSpectyraV1("billing/status", { headers });
    if (!r.ok) {
      if (prev && Date.now() - prev.at < ERROR_STALE_KEEP_MS) {
        return;
      }
      cache = { allows: false, at: Date.now() };
      return;
    }
    const body = (await r.json()) as Record<string, unknown>;
    cache = { allows: parseAllows(body), at: Date.now() };
  } catch {
    if (prev && Date.now() - prev.at < ERROR_STALE_KEEP_MS) {
      return;
    }
    cache = { allows: false, at: Date.now() };
  }
}

/**
 * Refresh billing cache when stale. No-op when account is not linked or billing is bypassed.
 */
export async function refreshBillingEntitlement(): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.spectyraAccountLinked) {
    cache = null;
    return;
  }
  if (process.env.SPECTYRA_BYPASS_ACCOUNT_CHECK === "true") {
    cache = { allows: true, at: Date.now() };
    return;
  }
  if (cache && Date.now() - cache.at < TTL_MS) return;
  await fetchAndUpdateCache();
}

/**
 * For linked orgs: last known `has_access`-style result, or `null` if unknown / not linked.
 */
export function getCachedBillingAllowsRealSavings(): boolean | null {
  const cfg = loadConfig();
  if (!cfg.spectyraAccountLinked) return null;
  if (process.env.SPECTYRA_BYPASS_ACCOUNT_CHECK === "true") return true;
  if (!cache) return null;
  return cache.allows;
}

/**
 * License material to pass into the local optimization engine: only when billing allows real savings.
 */
export async function resolveLicenseKeyForOptimize(cfg: CompanionConfig): Promise<string | undefined> {
  if (!cfg.spectyraAccountLinked) return undefined;
  if (process.env.SPECTYRA_BYPASS_ACCOUNT_CHECK === "true") {
    return cfg.licenseKey?.trim() || cfg.spectyraApiKey;
  }
  await refreshBillingEntitlement();
  const allows = cache?.allows ?? false;
  if (!allows) return undefined;
  return cfg.licenseKey?.trim() || cfg.spectyraApiKey;
}
