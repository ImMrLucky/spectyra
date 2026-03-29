/**
 * Trial / Entitlement Gating Middleware
 *
 * Enforces entitlement limits for Spectyra optimization features.
 *
 * Key invariant: provider calls are NEVER blocked. Only Spectyra-specific
 * optimization (mode=on) is gated. Observe mode and pass-through are free.
 */

import { Response, NextFunction } from "express";
import { hasActiveAccess } from "../services/storage/orgsRepo.js";
import { getEntitlement, canRunOptimized } from "../services/entitlement.js";
import { billingAccessOpts, type AuthenticatedRequest } from "./auth.js";

/**
 * Require active access (trial or subscription) for live provider calls.
 * Blocks /v1/chat if trial expired and no subscription.
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
      message: "Your trial has expired. Please subscribe to continue using Spectyra.",
      trial_ended: trialEnded,
      subscription_active: org.subscription_status === "active",
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
 * - on: requires valid license AND available run quota
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

  const allowed = await canRunOptimized(orgId);
  if (!allowed) {
    const entitlement = await getEntitlement(orgId);
    res.status(402).json({
      error: "Optimized run limit reached",
      message:
        entitlement.licenseStatus !== "valid"
          ? "Your trial has expired. Subscribe to continue using optimization."
          : `You've used ${entitlement.optimizedRunsUsed} of ${entitlement.optimizedRunsLimit} optimized runs this period. Upgrade for unlimited.`,
      entitlement,
      upgrade_url: "/usage",
    });
    return;
  }

  next();
}
