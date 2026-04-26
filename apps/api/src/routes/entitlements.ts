/**
 * Entitlement routes for machine auth (X-SPECTYRA-API-KEY).
 * Used by @spectyra/sdk for upgrade-without-redeploy.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireSpectyraApiKey, billingAccessOpts, type AuthenticatedRequest } from "../middleware/auth.js";
import { getEntitlement, canRunOptimized } from "../services/entitlement.js";
import { getOrgById } from "../services/storage/orgsRepo.js";
import { isSavingsObserveOnly } from "../billing/savingsEligibility.js";
import { safeLog } from "../utils/redaction.js";

export const entitlementsRouter = Router();
entitlementsRouter.use(rateLimit(RL_STANDARD));

function resolveUpgradeUrl(): string | null {
  const d = process.env.SPECTYRA_DASHBOARD_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!d?.trim()) return null;
  return `${d.replace(/\/$/, "")}/account/billing`;
}

/**
 * GET /v1/entitlements/status
 * Returns org entitlement, whether optimized runs are allowed, and a dashboard link when set.
 */
entitlementsRouter.get("/status", requireSpectyraApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.context?.org.id;
    if (!orgId) {
      return res.status(500).json({ error: "Missing org context" });
    }
    const [ent, canRun, org] = await Promise.all([
      getEntitlement(orgId),
      canRunOptimized(orgId, billingAccessOpts(req)),
      getOrgById(orgId),
    ]);
    res.json({
      orgId,
      entitlement: ent,
      canRunOptimized: canRun,
      savingsObserveOnly: isSavingsObserveOnly(org, billingAccessOpts(req)),
      upgradeUrl: resolveUpgradeUrl(),
      subscriptionStatus: org?.subscription_status ?? null,
      /** Tombstoned orgs should use `"deleted"` when the row still exists for diagnostics; default live. */
      orgLifecycleStatus: org ? ("active" as const) : null,
    });
  } catch (e: any) {
    safeLog("error", "entitlements status error", { error: e?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
