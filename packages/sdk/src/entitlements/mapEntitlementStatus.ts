import type { EntitlementInfo, PlanType } from "@spectyra/core-types";
import type { SpectyraEntitlementStatus, SpectyraQuotaState, SpectyraQuotaStatus } from "../observability/observabilityTypes.js";

export interface EntitlementsStatusPayload {
  orgId: string;
  entitlement: EntitlementInfo;
  canRunOptimized: boolean;
  savingsObserveOnly: boolean;
  upgradeUrl: string | null;
  /** From org row — drives `payment_failed` / `subscription_inactive` / `account_paused` mapping. */
  subscriptionStatus?: "trial" | "active" | "canceled" | "past_due" | "paused" | null;
  /**
   * When `"deleted"`, maps to `account_deleted` (highest priority). HTTP 404/410 on refresh also maps there.
   * `"active"` is the default for live orgs.
   */
  orgLifecycleStatus?: "active" | "deleted" | null;
}

function mapPlan(p: PlanType): SpectyraQuotaStatus["plan"] {
  if (p === "pro") return "pro";
  if (p === "enterprise") return "enterprise";
  if (p === "starter") return "starter";
  return "free";
}

function detailForState(state: SpectyraQuotaState, upgradeUrl?: string): string {
  switch (state) {
    case "missing_api_key":
      return "Add a Spectyra API key to enable cloud entitlements and savings rollups.";
    case "invalid_api_key":
      return "Spectyra API key was rejected (HTTP 401). Replace the key in your environment.";
    case "payment_failed":
      return "Payment failed or invoice is past due. Fix billing in the Spectyra dashboard to resume optimization.";
    case "subscription_inactive":
      return "Subscription is inactive or canceled. Renew in the Spectyra dashboard to resume optimization.";
    case "account_paused":
      return "Account or subscription is paused. Resume in the Spectyra dashboard to continue savings.";
    case "account_deleted":
      return "Account is closed. Optimization is disabled.";
    case "quota_exhausted":
      return upgradeUrl ?
          "Free tier limit reached. Spectyra optimization paused. Upgrade in dashboard to continue savings."
        : "Free tier limit reached. Spectyra optimization paused.";
    case "inactive_due_to_quota":
      return "Optimization is paused by quota or billing policy until your plan refreshes or you upgrade.";
    case "disabled":
      return "SDK access is disabled for this organization.";
    case "approaching_limit":
      return "Approaching free-tier usage limit for optimized runs.";
    default:
      return "";
  }
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
  const upgradeUrl = payload.upgradeUrl ?? undefined;

  if (payload.orgLifecycleStatus === "deleted") {
    const st: SpectyraQuotaState = "account_deleted";
    const quota: SpectyraQuotaStatus = {
      plan,
      state: st,
      used,
      limit,
      remaining,
      percentUsed,
      upgradeUrl,
      savingsObserveOnly: payload.savingsObserveOnly,
      canRunOptimized: false,
      detail: detailForState(st, upgradeUrl),
    };
    return {
      quota,
      orgId: payload.orgId,
      lastRefreshedAt,
      lastError,
    };
  }

  const sub = payload.subscriptionStatus ?? null;

  let state: SpectyraQuotaState;
  if (!e.sdkEnabled) {
    state = "disabled";
  } else if (sub === "past_due" && !payload.canRunOptimized) {
    state = "payment_failed";
  } else if (sub === "paused" && !payload.canRunOptimized) {
    state = "account_paused";
  } else if (sub === "canceled" && !payload.canRunOptimized) {
    state = "subscription_inactive";
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

  const detail = detailForState(state, upgradeUrl);

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
    detail: detail || undefined,
  };

  return {
    quota,
    orgId: payload.orgId,
    lastRefreshedAt,
    lastError,
  };
}
