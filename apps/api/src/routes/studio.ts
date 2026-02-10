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

/**
 * Public Studio route (no auth).
 *
 * POST /v1/studio/run
 *
 * Anyone can use Spectyra Studio in Scenario mode (dry-run).
 * Live mode is allowed ONLY with BYOK (`X-PROVIDER-KEY`) so Spectyra never pays provider tokens.
 *
 * Security posture:
 * - IP-based token bucket limiter (in-memory MVP)
 * - stricter payload size caps than the global 10mb JSON body limit
 */
export const studioPublicRouter = Router();

type TokenBucket = { tokens: number; lastRefillMs: number };
const publicBuckets = new Map<string, TokenBucket>();
const PUBLIC_BURST = 12; // short burst
const PUBLIC_RPS = 2; // steady-state requests/sec per IP
const PUBLIC_MAX_PRIMARY_CHARS = 250_000;
const PUBLIC_MAX_SECONDARY_CHARS = 250_000;

function publicRateLimitKey(req: any): string {
  // Express's req.ip honors trust proxy settings if configured.
  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function publicAllowRequest(key: string): boolean {
  const now = Date.now();
  const bucket = publicBuckets.get(key) ?? { tokens: PUBLIC_BURST, lastRefillMs: now };
  const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
  bucket.tokens = Math.min(PUBLIC_BURST, bucket.tokens + elapsedSec * PUBLIC_RPS);
  bucket.lastRefillMs = now;
  if (bucket.tokens < 1) {
    publicBuckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  publicBuckets.set(key, bucket);
  return true;
}

studioPublicRouter.post("/studio/run", async (req, res) => {
  try {
    const key = publicRateLimitKey(req);
    if (!publicAllowRequest(key)) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message: "Too many Studio requests from this IP. Please retry in a moment.",
      });
    }

    const body = req.body as StudioRunRequest;
    if (!body || !body.scenarioId) {
      return res.status(400).json({ error: "Missing required field: scenarioId" });
    }
    if (!body.inputs || typeof body.inputs.primary !== "string") {
      return res.status(400).json({ error: "Missing required field: inputs.primary" });
    }

    const primary = body.inputs.primary ?? "";
    const secondary = body.inputs.secondary ?? "";
    if (primary.length > PUBLIC_MAX_PRIMARY_CHARS) {
      return res.status(413).json({ error: "inputs.primary too large" });
    }
    if (typeof secondary === "string" && secondary.length > PUBLIC_MAX_SECONDARY_CHARS) {
      return res.status(413).json({ error: "inputs.secondary too large" });
    }

    const adv: any = body.inputs.advanced ?? {};
    const liveProviderRun = adv && adv.liveProviderRun === true;
    const byokProviderKey = String(req.headers["x-provider-key"] || "").trim() || undefined;

    // Never allow anonymous live runs without BYOK, even if env fallback is enabled.
    if (liveProviderRun && !byokProviderKey) {
      return res.status(401).json({
        error: "Provider key required",
        message: "Live mode requires BYOK. Provide your provider API key via X-PROVIDER-KEY header.",
      });
    }

    const out = await runStudioScenario(body, {
      byokKey: byokProviderKey,
    });

    return res.json(out);
  } catch (err: any) {
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    return res.status(statusCode).json({ error: "Studio run failed", message: String(err?.message || err) });
  }
});

