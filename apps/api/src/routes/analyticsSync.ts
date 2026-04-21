/**
 * Cloud analytics sync — redacted session summaries only (no prompt content).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { query, queryOne } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

export const analyticsSyncRouter = Router();
analyticsSyncRouter.use(rateLimit(RL_STANDARD));
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

/** Human-readable product lane for `SyncedAnalyticsPayload.integrationType`. */
function productLabelForIntegrationType(integrationType: string): string {
  switch (integrationType) {
    case "local-companion":
      return "OpenClaw · Local Companion";
    case "sdk-wrapper":
      return "In-app SDK (session sync)";
    case "openclaw-jsonl":
      return "OpenClaw (JSONL)";
    case "observe-preview":
      return "Observe preview";
    case "claude-hooks":
      return "Claude Code hooks";
    case "claude-jsonl":
      return "Claude (JSONL)";
    case "openai-tracing":
      return "OpenAI tracing";
    case "generic-jsonl":
      return "Generic JSONL";
    case "unknown":
      return "Unknown source (legacy sync)";
    default:
      return integrationType;
  }
}

function summarizeBySourceRow(
  integrationType: string,
  n: number,
  savingsRaw: string | null,
  beforeRaw: string | null,
  afterRaw: string | null,
) {
  const lifetimeSavingsUsd = parseFloat(savingsRaw || "0");
  const totalInputBefore = parseFloat(beforeRaw || "0");
  const totalInputAfter = parseFloat(afterRaw || "0");
  const tokenReductionPct =
    totalInputBefore > 0 ? ((totalInputBefore - totalInputAfter) / totalInputBefore) * 100 : 0;
  return {
    integration_type: integrationType,
    product_label: productLabelForIntegrationType(integrationType),
    total_sessions: n,
    lifetime_savings_usd: lifetimeSavingsUsd,
    total_input_tokens_before: totalInputBefore,
    total_input_tokens_after: totalInputAfter,
    avg_token_reduction_pct: tokenReductionPct,
  };
}

function emptySummaryResponse() {
  return {
    total_sessions: 0,
    lifetime_savings_usd: 0,
    total_input_tokens_before: 0,
    total_input_tokens_after: 0,
    avg_token_reduction_pct: 0,
    by_source: [] as ReturnType<typeof summarizeBySourceRow>[],
  };
}

analyticsSyncRouter.get("/summary", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await requireOrgId(req.auth.userId);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });

    const grouped = await query<{
      integration_type: string;
      n: string;
      savings: string | null;
      tokens_before: string | null;
      tokens_after: string | null;
    }>(
      `
      SELECT
        COALESCE(NULLIF(BTRIM(payload->>'integrationType'), ''), 'unknown') AS integration_type,
        COUNT(*)::text AS n,
        COALESCE(SUM((payload->>'estimatedWorkflowSavings')::double precision), 0)::text AS savings,
        COALESCE(SUM((payload->>'totalInputTokensBefore')::double precision), 0)::text AS tokens_before,
        COALESCE(SUM((payload->>'totalInputTokensAfter')::double precision), 0)::text AS tokens_after
      FROM analytics_sessions_sync
      WHERE org_id = $1
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      `,
      [orgId],
    );

    let totalSessions = 0;
    let lifetimeSavingsUsd = 0;
    let totalInputBefore = 0;
    let totalInputAfter = 0;
    const bySource = grouped.rows.map((r) => {
      const n = parseInt(r.n, 10) || 0;
      const s = parseFloat(r.savings || "0");
      const b = parseFloat(r.tokens_before || "0");
      const a = parseFloat(r.tokens_after || "0");
      totalSessions += n;
      lifetimeSavingsUsd += s;
      totalInputBefore += b;
      totalInputAfter += a;
      return summarizeBySourceRow(r.integration_type, n, r.savings, r.tokens_before, r.tokens_after);
    });

    const tokenReductionPct =
      totalInputBefore > 0 ? ((totalInputBefore - totalInputAfter) / totalInputBefore) * 100 : 0;

    res.json({
      total_sessions: totalSessions,
      lifetime_savings_usd: lifetimeSavingsUsd,
      total_input_tokens_before: totalInputBefore,
      total_input_tokens_after: totalInputAfter,
      avg_token_reduction_pct: tokenReductionPct,
      by_source: bySource,
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
