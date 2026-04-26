import type { SpectyraConfig } from "../types.js";
import { resolveSpectyraCloudApiKey } from "../cloud/resolveSpectyraCloudApiKey.js";
import { createSpectyraLogger } from "../observability/spectyraLogger.js";
import type { SpectyraEntitlementStatus, SpectyraQuotaStatus } from "../observability/observabilityTypes.js";
import type { SpectyraSessionState } from "../observability/spectyraSessionState.js";
import { mapToSpectyraEntitlementStatus } from "./mapEntitlementStatus.js";
import { resolveSpectyraApiBaseUrl } from "./resolveApiBaseUrl.js";
import { EntitlementHttpError, fetchEntitlementStatus } from "./fetchEntitlementStatus.js";

function entitlementsDefaultEnabled(config: SpectyraConfig): boolean {
  if (config.entitlements?.enabled === true) return true;
  if (config.entitlements?.enabled === false) return false;
  const k = resolveSpectyraCloudApiKey(config);
  const b = resolveSpectyraApiBaseUrl(config);
  return Boolean(k && b);
}

function intervalMs(config: SpectyraConfig): number {
  return config.entitlements?.refreshIntervalMs ?? 120_000;
}

function shouldFreezeFromQuota(q: SpectyraQuotaStatus): boolean {
  if (!q.canRunOptimized) return true;
  const healthy = q.state === "active_free" || q.state === "active_paid" || q.state === "approaching_limit";
  return !healthy;
}

function lastQuotaKey(q: SpectyraQuotaStatus): string {
  return JSON.stringify({
    plan: q.plan,
    state: q.state,
    used: q.used,
    limit: q.limit,
    can: q.canRunOptimized,
  });
}

export function startEntitlementRuntime(
  config: SpectyraConfig,
  session: SpectyraSessionState,
): { stop: () => void; refresh: () => Promise<void> } {
  const log = createSpectyraLogger(config);
  if (!entitlementsDefaultEnabled(config)) {
    return {
      stop: () => {},
      refresh: async () => {},
    };
  }

  let lastQuota: string | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;

  const apply = (ent: SpectyraEntitlementStatus) => {
    session.setEntitlement(ent);
    session.metricsFrozen = shouldFreezeFromQuota(ent.quota);
    const k = lastQuotaKey(ent.quota);
    if (k !== lastQuota) {
      lastQuota = k;
      try {
        config.onQuota?.(ent.quota);
      } catch (e) {
        log.error("onQuota callback failed", { error: String(e) });
      }
    }
    try {
      config.onEntitlementChange?.(ent);
    } catch (e) {
      log.error("onEntitlementChange callback failed", { error: String(e) });
    }
  };

  const applyMissingApiKey = () => {
    apply({
      quota: {
        plan: "free",
        state: "missing_api_key",
        used: 0,
        limit: null,
        remaining: null,
        percentUsed: null,
        canRunOptimized: false,
        detail:
          "Spectyra cloud API key or API base URL is missing. Set spectyraCloudApiKey / SPECTYRA_CLOUD_API_KEY and spectyraApiBaseUrl (or your deployment’s discovery env) while entitlements are enabled.",
      },
      lastRefreshedAt: new Date().toISOString(),
      lastError:
        "Entitlements are enabled but no Spectyra API key or base URL was resolved. Optimization stays off until credentials are configured.",
    });
  };

  const refresh = async () => {
    const key = resolveSpectyraCloudApiKey(config);
    const base = resolveSpectyraApiBaseUrl(config);
    if (!key || !base) {
      applyMissingApiKey();
      log.warn("Entitlements: missing API key or base URL; applied synthetic missing_api_key state");
      return;
    }

    let mapped: SpectyraEntitlementStatus;
    try {
      const row = await fetchEntitlementStatus(base, key);
      mapped = mapToSpectyraEntitlementStatus(row);
      log.log("entitlement", "entitlement refreshed", { plan: mapped.quota.plan, state: mapped.quota.state });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const prev = session.getEntitlement();
      if (e instanceof EntitlementHttpError) {
        if (e.status === 401 || e.status === 403) {
          const st = e.status === 401 ? ("invalid_api_key" as const) : ("disabled" as const);
          mapped = {
            orgId: prev?.orgId,
            quota: {
              plan: prev?.quota.plan ?? "free",
              state: st,
              used: prev?.quota.used ?? 0,
              limit: prev?.quota.limit ?? null,
              remaining: prev?.quota.remaining ?? null,
              percentUsed: prev?.quota.percentUsed ?? null,
              upgradeUrl: prev?.quota.upgradeUrl,
              savingsObserveOnly: prev?.quota.savingsObserveOnly,
              canRunOptimized: false,
              detail:
                e.status === 401 ?
                  "Spectyra API key was rejected (HTTP 401). Replace the key in your environment."
                : "SDK access denied (HTTP 403). Check org SDK access in the Spectyra dashboard.",
            },
            lastRefreshedAt: new Date().toISOString(),
            lastError: err,
          };
        } else if (e.status === 404 || e.status === 410) {
          mapped = {
            orgId: prev?.orgId,
            quota: {
              plan: prev?.quota.plan ?? "free",
              state: "account_deleted",
              used: prev?.quota.used ?? 0,
              limit: prev?.quota.limit ?? null,
              remaining: prev?.quota.remaining ?? null,
              percentUsed: prev?.quota.percentUsed ?? null,
              upgradeUrl: prev?.quota.upgradeUrl,
              savingsObserveOnly: prev?.quota.savingsObserveOnly,
              canRunOptimized: false,
              detail:
                "Organization or API key is no longer valid (HTTP 404/410). Optimization is disabled.",
            },
            lastRefreshedAt: new Date().toISOString(),
            lastError: err,
          };
        } else {
          mapped = {
            orgId: prev?.orgId,
            quota:
              prev?.quota ?? {
                plan: "free",
                state: "active_free",
                used: 0,
                limit: null,
                remaining: null,
                percentUsed: null,
                canRunOptimized: true,
              },
            lastRefreshedAt: new Date().toISOString(),
            lastError: err,
          } satisfies SpectyraEntitlementStatus;
        }
      } else {
        mapped = {
          orgId: prev?.orgId,
          quota:
            prev?.quota ?? {
              plan: "free",
              state: "active_free",
              used: 0,
              limit: null,
              remaining: null,
              percentUsed: null,
              canRunOptimized: true,
            },
          lastRefreshedAt: new Date().toISOString(),
          lastError: err,
        } satisfies SpectyraEntitlementStatus;
      }
      log.warn("entitlement refresh failed; keeping last state", { error: err });
    }
    apply(mapped);
  };

  void refresh().catch(() => {});

  if (typeof setInterval !== "undefined") {
    const ms = intervalMs(config);
    if (ms > 0) {
      timer = setInterval(() => {
        void refresh().catch(() => {});
      }, ms);
    }
  }

  return {
    stop: () => {
      if (timer) clearInterval(timer);
    },
    refresh,
  };
}

export { entitlementsDefaultEnabled, shouldFreezeFromQuota };
