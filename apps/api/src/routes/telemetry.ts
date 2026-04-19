/**
 * SDK run telemetry ingestion (machine auth).
 * POST /v1/telemetry/run  (this router is mounted at /v1/telemetry)
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireSpectyraApiKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { getProjectByOrgAndIdentifier } from "../services/storage/orgsRepo.js";
import { insertSdkTelemetryRun, upsertProjectUsageDaily } from "../services/storage/sdkTelemetryRepo.js";
import { recordOptimizedRun, getEntitlement } from "../services/entitlement.js";
import { safeLog } from "../utils/redaction.js";

export const telemetryRouter = Router();
telemetryRouter.use(rateLimit(RL_STANDARD));

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

telemetryRouter.post("/run", requireSpectyraApiKey, async (req: AuthenticatedRequest, res) => {
  try {
    const org = req.context?.org;
    if (!org?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const ent = await getEntitlement(org.id);
    if (!ent.sdkEnabled) {
      return res.status(403).json({ error: "SDK telemetry is not enabled for this organization" });
    }
    const apiKeyProjectId = req.context?.project?.id ?? req.auth?.projectId ?? null;
    const b = req.body as Record<string, unknown>;

    const projectField =
      (b.project as string) ||
      (b.projectId as string) ||
      (b.project_id as string) ||
      "";
    const environment = String(b.environment ?? b.env ?? "production").slice(0, 128);
    const model = String(b.model ?? "").trim();
    if (!model) {
      return res.status(400).json({ error: "model is required" });
    }

    const inputTokens = num(b.inputTokens ?? b.input_tokens);
    const outputTokens = num(b.outputTokens ?? b.output_tokens);
    const optimizedTokens = num(
      b.optimizedTokens ?? b.optimized_tokens ?? b.optimizedInputTokens ?? b.optimized_input_tokens,
    );
    const estimatedCost = num(b.estimatedCost ?? b.estimated_cost);
    const optimizedCost = num(b.optimizedCost ?? b.optimized_cost);
    const savings = num(b.savings ?? b.estimated_savings ?? b.estimatedSavings);

    let projectId: string | null = apiKeyProjectId;
    if (projectField) {
      const resolved = await getProjectByOrgAndIdentifier(org.id, projectField);
      if (!resolved) {
        return res.status(404).json({ error: "Project not found for this organization" });
      }
      if (apiKeyProjectId && resolved.id !== apiKeyProjectId) {
        return res.status(403).json({ error: "API key is scoped to a different project" });
      }
      projectId = resolved.id;
    }
    if (!projectId) {
      return res.status(400).json({
        error: "project is required",
        hint: "Use a project-scoped API key, or include project (name or id) in the JSON body.",
      });
    }

    const payload = {
      orgId: org.id,
      projectId,
      environment,
      model,
      inputTokens,
      outputTokens,
      optimizedInputTokens: optimizedTokens,
      estimatedCostUsd: estimatedCost,
      optimizedCostUsd: optimizedCost,
      estimatedSavingsUsd: savings,
      apiKeyId: req.context?.apiKeyId ?? null,
    };

    const id = await insertSdkTelemetryRun(payload);
    await upsertProjectUsageDaily(payload);

    if (savings > 0) {
      void recordOptimizedRun(org.id).catch((e) =>
        safeLog("warn", "recordOptimizedRun after telemetry failed", { err: String(e) }),
      );
    }

    res.status(201).json({ ok: true, id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "telemetry run ingest error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});
