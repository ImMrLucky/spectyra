/**
 * Server-side optimization API — for Spectyra's own web dashboard/lab.
 *
 * POST /v1/optimize
 *
 * This endpoint runs the full Spectyra pipeline server-side for:
 *   - Spectyra's web dashboard (Angular) — browser code can't run core IP
 *   - Optimizer Lab demos and internal QA
 *
 * SDK, Desktop, and Local Companion do NOT use this endpoint.
 * They run the full pipeline locally in-process (zero data leaves customer env).
 *
 * Authentication: X-SPECTYRA-API-KEY.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireSpectyraApiKey, type AuthenticatedRequest } from "../middleware/auth.js";
import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationPipelineResult,
  FlowSignals,
} from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize } from "@spectyra/optimization-engine";
import { safeLog } from "../utils/redaction.js";
import { normalizeSpectyraRunMode } from "@spectyra/core-types";

export const serverOptimizeRouter = Router();
serverOptimizeRouter.use(rateLimit(RL_STANDARD));

interface ServerOptimizeRequestBody {
  messages: Array<{ role: string; content: string }>;
  mode?: "on" | "off";
  integrationType?: string;
  provider?: { vendor?: string; model?: string };
  execution?: {
    appName?: string;
    workflowType?: string;
  };
}

interface ServerOptimizeResponseBody {
  optimizedMessages: Array<{ role: string; content: string }>;
  transformsApplied: string[];
  projectedTokenSavings: number;
  flowSignals: FlowSignals | null;
  riskAnnotations: Array<{ transformId: string; risk: string; note: string }>;
  meta: {
    mode: string;
    latencyMs: number;
    timestamp: string;
  };
}

serverOptimizeRouter.post("/optimize", requireSpectyraApiKey, async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now();

  try {
    const body = req.body as ServerOptimizeRequestBody;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(400).json({ error: "messages array is required and must not be empty" });
      return;
    }

    const mode = normalizeSpectyraRunMode(body.mode, "on");

    const canonicalReq: CanonicalRequest = {
      requestId: `sopt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      runId: `run_${Date.now().toString(36)}`,
      mode,
      integrationType: (body.integrationType as CanonicalRequest["integrationType"]) ?? "sdk-wrapper",
      provider: body.provider ? {
        vendor: body.provider.vendor,
        model: body.provider.model,
      } : undefined,
      messages: body.messages.map(m => ({
        role: m.role as CanonicalMessage["role"],
        text: m.content,
      })),
      execution: body.execution ?? {},
      security: {
        telemetryMode: "local",
        promptSnapshotMode: "local_only",
        localOnly: false,
      },
    };

    const features = detectFeatures(canonicalReq);
    const pipeline: OptimizationPipelineResult = optimize({
      request: canonicalReq,
      features,
      licenseStatus: "active", // Server-side (Spectyra's own infra) always runs full pipeline
    });

    const optimizedMessages = pipeline.optimizedRequest.messages.map(m => ({
      role: m.role,
      content: m.text ?? "",
    }));

    const response: ServerOptimizeResponseBody = {
      optimizedMessages,
      transformsApplied: pipeline.transformsApplied,
      projectedTokenSavings: pipeline.projectedTokenSavings,
      flowSignals: pipeline.flowSignals,
      riskAnnotations: pipeline.riskAnnotations,
      meta: {
        mode,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };

    safeLog("info", "Server optimize", {
      mode,
      integrationType: body.integrationType,
      messageCount: body.messages.length,
      transforms: pipeline.transformsApplied.length,
      savings: pipeline.projectedTokenSavings,
      recommendation: pipeline.flowSignals?.recommendation,
      latencyMs: Date.now() - startTime,
      orgId: req.context?.org?.id,
    });

    res.json(response);
  } catch (error: any) {
    safeLog("error", "Server optimize error", {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });

    res.status(500).json({
      error: "Optimization failed",
      message: error.message || "Internal server error",
    });
  }
});
