/**
 * Trial / Entitlement Gating Middleware
 *
 * Enforces entitlement limits for Spectyra optimization features.
 *
 * Key invariant: provider calls are NEVER blocked. Only Spectyra-specific
 * optimization (mode=on) is gated. Observe mode and pass-through are free.
 */

import { Response, NextFunction } from "express";
import { hasActiveAccess, orgHasPaidStripeSubscription } from "../services/storage/orgsRepo.js";
import { getEntitlement, canRunOptimized } from "../services/entitlement.js";
import { billingAccessOpts, type AuthenticatedRequest } from "./auth.js";
import {
  isBillingExemptEmail,
  isBillingExemptOrgId,
} from "../billing/billingExempt.js";
import { isSavingsObserveOnly } from "../billing/savingsEligibility.js";

/**
 * Sets `req.context.savingsObserveOnly` from org billing + superuser override.
 * Does not block requests — use so chat/replay stay available in Observe-only mode.
 */
export function attachSavingsObserveContext(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.context?.org) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  req.context.savingsObserveOnly = isSavingsObserveOnly(req.context.org, billingAccessOpts(req));
  next();
}

/**
 * Require active access (free tier, time-limited legacy trial, or paid subscription) for live provider calls.
 * Blocks /v1/chat when the org has no access under billing rules.
 */
export function requireActiveAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.context) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const org = req.context.org;
  if (!org) {
    res.status(401).json({ error: "Organization not found" });
    return;
  }

  if (!hasActiveAccess(org, billingAccessOpts(req))) {
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const trialEnded = trialEnd ? trialEnd < new Date() : false;

    res.status(402).json({
      error: "Payment Required",
      message:
        "This workspace does not have active Spectyra access. Upgrade on Billing or add a paid plan to continue.",
      trial_ended: trialEnded,
      subscription_active: orgHasPaidStripeSubscription(org),
      billing_url: "/billing",
    });
    return;
  }

  next();
}

/**
 * Allow estimator/demo mode even if trial expired.
 * Used for /v1/replay with proof_mode=estimator.
 */
export function allowEstimatorMode(
  _req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  next();
}

/**
 * Entitlement-aware gate for optimized runs (mode=on).
 *
 * - observe / off: always allowed (no provider cost to Spectyra)
 * - on: requires valid license (usage tier / legacy trial / paid subscription), not run-count quotas
 *
 * Returns entitlement info in 402 response so client can show upgrade CTA.
 */
export async function requireOptimizedRunQuota(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const orgId = req.context?.org?.id ?? req.auth?.orgId;
  if (!orgId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const mode = (req.body?.runMode ?? req.body?.run_mode ?? "on") as string;

  if (mode !== "on") {
    next();
    return;
  }

  const org = req.context?.org;
  const bopts = billingAccessOpts(req);
  if (
    org &&
    (org.platform_exempt ||
      isBillingExemptOrgId(org.id) ||
      (bopts.userEmail && isBillingExemptEmail(bopts.userEmail)) ||
      bopts.platformBillingExempt)
  ) {
    next();
    return;
  }

  const allowed = await canRunOptimized(orgId, billingAccessOpts(req));
  if (!allowed) {
    const entitlement = await getEntitlement(orgId);
    res.status(402).json({
      error: "Payment Required",
      message:
        "Optimized runs (mode = on) require an active plan. Choose Developer Pro, Team Pro, or Enterprise on Billing after you have used your included tokens.",
      entitlement,
      upgrade_url: "/usage",
    });
    return;
  }

  next();
}
