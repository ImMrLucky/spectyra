import type { SpectyraConfig } from "../types.js";
import { resolveSpectyraCloudApiKey } from "../cloud/resolveSpectyraCloudApiKey.js";
import { createSpectyraLogger } from "../observability/spectyraLogger.js";
import type { SpectyraEntitlementStatus, SpectyraQuotaStatus } from "../observability/observabilityTypes.js";
import type { SpectyraSessionState } from "../observability/spectyraSessionState.js";
import { mapToSpectyraEntitlementStatus } from "./mapEntitlementStatus.js";
import { resolveSpectyraApiBaseUrl } from "./resolveApiBaseUrl.js";
import { fetchEntitlementStatus } from "./fetchEntitlementStatus.js";

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
  return !q.canRunOptimized || q.state === "quota_exhausted" || q.state === "inactive_due_to_quota";
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

  const key = resolveSpectyraCloudApiKey(config);
  const base = resolveSpectyraApiBaseUrl(config);
  if (!key || !base) {
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

  const refresh = async () => {
    let mapped: SpectyraEntitlementStatus;
    try {
      const row = await fetchEntitlementStatus(base, key);
      mapped = mapToSpectyraEntitlementStatus(row);
      log.log("entitlement", "entitlement refreshed", { plan: mapped.quota.plan, state: mapped.quota.state });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      const prev = session.getEntitlement();
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
