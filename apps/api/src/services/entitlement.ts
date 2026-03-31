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

interface OrgRow {
  id: string;
  plan: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  optimized_runs_used: number;
  optimized_runs_limit: number | null;
  sdk_access_enabled: boolean;
  platform_exempt: boolean;
}

const PLAN_LIMITS: Record<PlanType, { optimizedRuns: number | null; cloudAnalytics: boolean; desktop: boolean; sdk: boolean }> = {
  free:       { optimizedRuns: 100,  cloudAnalytics: false, desktop: true, sdk: true },
  starter:    { optimizedRuns: 5000, cloudAnalytics: true,  desktop: true, sdk: true },
  pro:        { optimizedRuns: null, cloudAnalytics: true,  desktop: true, sdk: true },
  enterprise: { optimizedRuns: null, cloudAnalytics: true,  desktop: true, sdk: true },
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

export async function getEntitlement(orgId: string): Promise<EntitlementInfo> {
  const org = await queryOne<OrgRow>(`
    SELECT id, plan, subscription_status, trial_ends_at,
           COALESCE(optimized_runs_used, 0) AS optimized_runs_used,
           optimized_runs_limit,
           sdk_access_enabled,
           COALESCE(platform_exempt, false) AS platform_exempt
    FROM orgs WHERE id = $1
  `, [orgId]);

  if (!org) {
    return {
      plan: "free",
      trialState: null,
      trialEndsAt: null,
      licenseStatus: "missing",
      optimizedRunsLimit: 0,
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
      licenseStatus: "valid",
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
    licenseStatus: resolveLicenseStatus(org),
    optimizedRunsLimit: org.optimized_runs_limit ?? limits.optimizedRuns,
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
 * Check whether the org can run another optimized (mode=on) call.
 */
export async function canRunOptimized(orgId: string): Promise<boolean> {
  const ent = await getEntitlement(orgId);
  if (ent.licenseStatus !== "valid") return false;
  if (ent.optimizedRunsLimit === null) return true;
  return ent.optimizedRunsUsed < ent.optimizedRunsLimit;
}
