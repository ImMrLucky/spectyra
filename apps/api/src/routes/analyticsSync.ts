/**
 * Cloud analytics sync — redacted session summaries only (no prompt content).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { query, queryOne } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

export const analyticsSyncRouter = Router();
analyticsSyncRouter.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many analytics sync requests; try again shortly." },
  }),
);
analyticsSyncRouter.use(requireUserSession);

async function requireOrgId(userId: string): Promise<string | null> {
  const row = await queryOne<{ org_id: string }>(
    `SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  return row?.org_id ?? null;
}

/** POST body: full SyncedAnalyticsPayload JSON */
analyticsSyncRouter.post("/sessions", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await requireOrgId(req.auth.userId);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });

    const payload = req.body;
    if (!payload?.sessionId || !payload?.runId) {
      return res.status(400).json({ error: "sessionId and runId required" });
    }

    await query(
      `
      INSERT INTO analytics_sessions_sync (org_id, session_id, run_id, payload, sync_state, updated_at)
      VALUES ($1, $2, $3, $4, 'synced', now())
      ON CONFLICT (org_id, session_id)
      DO UPDATE SET run_id = EXCLUDED.run_id, payload = EXCLUDED.payload, sync_state = 'synced', updated_at = now()
      `,
      [orgId, String(payload.sessionId), String(payload.runId), payload],
    );

    res.status(201).json({ ok: true, sessionId: payload.sessionId });
  } catch (error: any) {
    safeLog("error", "analytics sync POST error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

analyticsSyncRouter.get("/sessions", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await requireOrgId(req.auth.userId);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });

    const limit = Math.min(parseInt(String(req.query.limit || "100"), 10) || 100, 500);
    const result = await query<{ payload: unknown; session_id: string; created_at: string }>(
      `
      SELECT session_id, payload, created_at
      FROM analytics_sessions_sync
      WHERE org_id = $1
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [orgId, limit],
    );

    res.json(result.rows.map((r) => r.payload));
  } catch (error: any) {
    safeLog("error", "analytics list error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

analyticsSyncRouter.get("/sessions/:sessionId", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await requireOrgId(req.auth.userId);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });

    const row = await queryOne<{ payload: unknown }>(
      `SELECT payload FROM analytics_sessions_sync WHERE org_id = $1 AND session_id = $2`,
      [orgId, req.params.sessionId],
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row.payload);
  } catch (error: any) {
    safeLog("error", "analytics get session error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

function emptySummaryResponse() {
  return {
    total_sessions: 0,
    lifetime_savings_usd: 0,
    total_input_tokens_before: 0,
    total_input_tokens_after: 0,
    avg_token_reduction_pct: 0,
  };
}

analyticsSyncRouter.get("/summary", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await requireOrgId(req.auth.userId);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });

    const result = await queryOne<{
      n: number;
      savings: string | null;
      tokens_before: string | null;
      tokens_after: string | null;
    }>(
      `
      SELECT
        COUNT(*)::int AS n,
        COALESCE(SUM((payload->>'estimatedWorkflowSavings')::double precision), 0)::text AS savings,
        COALESCE(SUM((payload->>'totalInputTokensBefore')::double precision), 0)::text AS tokens_before,
        COALESCE(SUM((payload->>'totalInputTokensAfter')::double precision), 0)::text AS tokens_after
      FROM analytics_sessions_sync
      WHERE org_id = $1
      `,
      [orgId],
    );

    const totalSessions = result?.n ?? 0;
    const lifetimeSavingsUsd = parseFloat(result?.savings || "0");
    const totalInputBefore = parseFloat(result?.tokens_before || "0");
    const totalInputAfter = parseFloat(result?.tokens_after || "0");
    const tokenReductionPct =
      totalInputBefore > 0 ? ((totalInputBefore - totalInputAfter) / totalInputBefore) * 100 : 0;

    res.json({
      total_sessions: totalSessions,
      lifetime_savings_usd: lifetimeSavingsUsd,
      total_input_tokens_before: totalInputBefore,
      total_input_tokens_after: totalInputAfter,
      avg_token_reduction_pct: tokenReductionPct,
    });
  } catch (error: any) {
    const msg = error?.message || "";
    if (/does not exist|relation.*analytics_sessions_sync/i.test(msg)) {
      safeLog("warn", "analytics summary: table missing, returning empty summary", {});
      return res.json(emptySummaryResponse());
    }
    safeLog("error", "analytics summary error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});
