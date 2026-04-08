/**
 * Entitlement Service
 *
 * Computes {@link EntitlementInfo} from org state.
 * Used by API routes and the trial gate to determine feature access.
 *
 * Key invariant: provider usage is NEVER blocked by Spectyra license state.
 * Only Spectyra optimization features degrade when entitlements are exhausted.
 */

import type {
  EntitlementInfo,
  PlanType,
  TrialState,
  LicenseStatus,
} from "@spectyra/core-types";
import { queryOne } from "./storage/db.js";
import { isBillingExemptOrgId } from "../billing/billingExempt.js";
import { getOrgById, type HasActiveAccessOpts } from "./storage/orgsRepo.js";
import { isSavingsObserveOnly } from "../billing/savingsEligibility.js";

interface OrgRow {
  id: string;
  plan: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  optimized_runs_used: number;
  optimized_runs_limit: number | null;
  sdk_access_enabled: boolean;
  platform_exempt: boolean;
  observe_only_override: boolean | null;
}

const PLAN_LIMITS: Record<PlanType, { cloudAnalytics: boolean; desktop: boolean; sdk: boolean }> = {
  free:       { cloudAnalytics: false, desktop: true, sdk: true },
  starter:    { cloudAnalytics: true,  desktop: true, sdk: true },
  pro:        { cloudAnalytics: true,  desktop: true, sdk: true },
  enterprise: { cloudAnalytics: true,  desktop: true, sdk: true },
};

function resolvePlan(raw: string | null): PlanType {
  if (raw && raw in PLAN_LIMITS) return raw as PlanType;
  return "free";
}

function resolveTrialState(org: OrgRow): { state: TrialState | null; endsAt: string | null } {
  if (org.subscription_status === "active") {
    return { state: "converted", endsAt: org.trial_ends_at };
  }
  if (org.subscription_status !== "trial" || !org.trial_ends_at) {
    return { state: null, endsAt: null };
  }
  const end = new Date(org.trial_ends_at);
  if (end > new Date()) {
    return { state: "active", endsAt: org.trial_ends_at };
  }
  return { state: "expired", endsAt: org.trial_ends_at };
}

function resolveLicenseStatus(org: OrgRow): LicenseStatus {
  if (org.subscription_status === "active") return "valid";
  if (org.subscription_status === "canceled") return "expired";
  if (org.subscription_status === "trial") {
    const trial = resolveTrialState(org);
    return trial.state === "active" ? "valid" : "expired";
  }
  return "missing";
}

/** Superuser override + billing-derived observe-only for SDK/UI license display. */
function effectiveLicenseStatus(org: OrgRow): LicenseStatus {
  if (org.observe_only_override === true) return "expired";
  if (org.observe_only_override === false) return "valid";
  return resolveLicenseStatus(org);
}

export async function getEntitlement(orgId: string): Promise<EntitlementInfo> {
  const org = await queryOne<OrgRow>(`
    SELECT id, plan, subscription_status, trial_ends_at,
           COALESCE(optimized_runs_used, 0) AS optimized_runs_used,
           optimized_runs_limit,
           sdk_access_enabled,
           COALESCE(platform_exempt, false) AS platform_exempt,
           observe_only_override
    FROM orgs WHERE id = $1
  `, [orgId]);

  if (!org) {
    return {
      plan: "free",
      trialState: null,
      trialEndsAt: null,
      licenseStatus: "missing",
      optimizedRunsLimit: null,
      optimizedRunsUsed: 0,
      cloudAnalyticsEnabled: false,
      desktopAppEnabled: false,
      sdkEnabled: false,
    };
  }

  const plan = resolvePlan(org.plan);
  const limits = PLAN_LIMITS[plan];
  const trial = resolveTrialState(org);

  if (org.platform_exempt || isBillingExemptOrgId(org.id)) {
    return {
      plan: "enterprise",
      trialState: "converted",
      trialEndsAt: null,
      licenseStatus: effectiveLicenseStatus(org),
      optimizedRunsLimit: null,
      optimizedRunsUsed: org.optimized_runs_used,
      cloudAnalyticsEnabled: true,
      desktopAppEnabled: true,
      sdkEnabled: true && org.sdk_access_enabled,
    };
  }

  return {
    plan,
    trialState: trial.state,
    trialEndsAt: trial.endsAt,
    licenseStatus: effectiveLicenseStatus(org),
    /** No per-period cap — only trial/subscription (see `canRunOptimized`). Counts remain for analytics. */
    optimizedRunsLimit: null,
    optimizedRunsUsed: org.optimized_runs_used,
    cloudAnalyticsEnabled: limits.cloudAnalytics,
    desktopAppEnabled: limits.desktop,
    sdkEnabled: limits.sdk && org.sdk_access_enabled,
  };
}

/**
 * Increment optimized-run counter for an org.
 * Resets the counter if the billing period has rolled over (30-day windows).
 */
export async function recordOptimizedRun(orgId: string): Promise<void> {
  await queryOne(`
    UPDATE orgs
    SET optimized_runs_used = CASE
      WHEN billing_period_start IS NULL
           OR billing_period_start < now() - INTERVAL '30 days'
      THEN 1
      ELSE COALESCE(optimized_runs_used, 0) + 1
    END,
    billing_period_start = CASE
      WHEN billing_period_start IS NULL
           OR billing_period_start < now() - INTERVAL '30 days'
      THEN now()
      ELSE billing_period_start
    END
    WHERE id = $1
  `, [orgId]);
}

/**
 * Check whether the org can run optimized (mode=on) calls.
 * Gated by trial/subscription, Observe-only savings mode, and superuser override — not by run counts.
 */
export async function canRunOptimized(
  orgId: string,
  opts?: HasActiveAccessOpts,
): Promise<boolean> {
  const org = await getOrgById(orgId);
  if (!org) return false;
  if (org.observe_only_override === false) return true;
  if (isSavingsObserveOnly(org, opts)) return false;
  const ent = await getEntitlement(orgId);
  return ent.licenseStatus === "valid";
}
