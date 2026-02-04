/**
 * Spectyra Studio API Route (v1)
 *
 * POST /v1/admin/studio/run
 *
 * Thin wrapper around the Optimizer dry-run pipeline to produce Raw vs Spectyra
 * side-by-side results for a selected scenario.
 */

import { Router } from "express";
import { requireUserSession, requireOwner, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import type { StudioRunRequest } from "../types/studio.js";
import { runStudioScenario } from "../services/optimizer/studioRunner.js";

export const studioRouter = Router();

// Owner/admin only (same posture as admin endpoints)
studioRouter.use(requireUserSession, requireOwner, optionalProviderKey);

studioRouter.post("/studio/run", async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as StudioRunRequest;
    if (!body || !body.scenarioId) {
      return res.status(400).json({ error: "Missing required field: scenarioId" });
    }
    if (!body.inputs || typeof body.inputs.primary !== "string") {
      return res.status(400).json({ error: "Missing required field: inputs.primary" });
    }
    const out = await runStudioScenario(body, {
      orgId: req.context?.org?.id,
      projectId: req.context?.project?.id ?? null,
      byokKey: req.context?.providerKeyOverride,
    });
    return res.json(out);
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return res.status(statusCode).json({ error: "Studio run failed", message: String(err?.message || err) });
  }
});

