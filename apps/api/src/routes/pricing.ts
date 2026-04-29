/**
 * GET /v1/pricing/snapshot — machine auth (`X-SPECTYRA-API-KEY`).
 * Serves a normalized, versioned snapshot for in-app SDK cost estimation.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireSpectyraApiKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { canUseSpectyraMachineSdkApis } from "../services/entitlement.js";
import { resolveMachinePricingSnapshot } from "../services/pricing/resolveMachinePricingSnapshot.js";
import { safeLog } from "../utils/redaction.js";

export const pricingRouter = Router();
pricingRouter.use(rateLimit(RL_STANDARD));

pricingRouter.get("/snapshot", requireSpectyraApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.context?.org.id;
    if (!orgId) {
      return res.status(500).json({ error: "Missing org context" });
    }
    const allowed = await canUseSpectyraMachineSdkApis(orgId);
    if (!allowed) {
      return res.status(403).json({
        error: "sdk_pricing_inactive",
        message:
          "Pricing snapshot is unavailable for this organization (inactive trial or subscription, canceled or paused billing, or Spectyra disabled SDK access for the org).",
      });
    }

    const provider =
      typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : undefined;
    const snapshot = await resolveMachinePricingSnapshot(orgId, provider);
    res.json(snapshot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "pricing snapshot error", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /v1/pricing/model?provider=openai&model=gpt-4o-mini — machine auth; one catalog row from resolved snapshot.
 */
pricingRouter.get("/model", requireSpectyraApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.context?.org.id;
    if (!orgId) {
      return res.status(500).json({ error: "Missing org context" });
    }
    const allowed = await canUseSpectyraMachineSdkApis(orgId);
    if (!allowed) {
      return res.status(403).json({
        error: "sdk_pricing_inactive",
        message:
          "Pricing snapshot is unavailable for this organization (inactive trial or subscription, canceled or paused billing, or Spectyra disabled SDK access for the org).",
      });
    }

    const provider =
      typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : "";
    const model = typeof req.query.model === "string" ? req.query.model.trim() : "";
    if (!provider || !model) {
      return res.status(400).json({ error: "Query params provider and model are required" });
    }

    const snapshot = await resolveMachinePricingSnapshot(orgId);
    const entry = snapshot.entries.find((e) => e.provider === provider && e.modelId === model);
    if (!entry) {
      return res.status(404).json({ error: "Model not found in pricing catalog" });
    }
    res.json(entry);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "pricing model error", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});
