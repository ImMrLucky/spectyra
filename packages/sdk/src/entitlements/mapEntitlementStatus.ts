import type { EntitlementInfo, PlanType } from "@spectyra/core-types";
import type { SpectyraEntitlementStatus, SpectyraQuotaState, SpectyraQuotaStatus } from "../observability/observabilityTypes.js";

export interface EntitlementsStatusPayload {
  orgId: string;
  entitlement: EntitlementInfo;
  canRunOptimized: boolean;
  savingsObserveOnly: boolean;
  upgradeUrl: string | null;
}

function mapPlan(p: PlanType): SpectyraQuotaStatus["plan"] {
  if (p === "pro") return "pro";
  if (p === "enterprise") return "enterprise";
  if (p === "starter") return "starter";
  return "free";
}

/**
 * Map server `GET /v1/entitlements/status` to SDK-facing `SpectyraEntitlementStatus`.
 */
export function mapToSpectyraEntitlementStatus(
  payload: EntitlementsStatusPayload,
  lastError?: string,
  lastRefreshedAt: string = new Date().toISOString(),
): SpectyraEntitlementStatus {
  const e = payload.entitlement;
  const plan = mapPlan(e.plan);
  const used = e.optimizedRunsUsed;
  const limit = e.optimizedRunsLimit;
  const remaining = limit == null ? null : Math.max(0, limit - used);
  const percentUsed = limit == null || limit === 0 ? null : (used / limit) * 100;

  let state: SpectyraQuotaState;
  if (!e.sdkEnabled) {
    state = "disabled";
  } else if (limit != null && used >= limit) {
    state = "quota_exhausted";
  } else if (!payload.canRunOptimized) {
    state = "inactive_due_to_quota";
  } else if (percentUsed != null && percentUsed >= 80) {
    state = "approaching_limit";
  } else if (plan === "free") {
    state = "active_free";
  } else {
    state = "active_paid";
  }

  const upgradeUrl = payload.upgradeUrl ?? undefined;

  const quota: SpectyraQuotaStatus = {
    plan,
    state,
    used,
    limit,
    remaining,
    percentUsed,
    upgradeUrl,
    savingsObserveOnly: payload.savingsObserveOnly,
    canRunOptimized: payload.canRunOptimized,
  };

  return {
    quota,
    orgId: payload.orgId,
    lastRefreshedAt,
    lastError,
  };
}
