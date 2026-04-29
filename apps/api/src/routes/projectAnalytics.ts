/**
 * Project-level analytics for company SDK telemetry (JWT dashboard).
 * Mounted at /v1/projects — routes are /:projectId/... (not /projects/:id/...).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { query, queryOne } from "../services/storage/db.js";
import { getProjectById } from "../services/storage/orgsRepo.js";
import { safeLog } from "../utils/redaction.js";

export const projectAnalyticsRouter = Router();
projectAnalyticsRouter.use(rateLimit(RL_STANDARD));
projectAnalyticsRouter.use(requireUserSession);

async function resolveOrgId(req: AuthenticatedRequest): Promise<string | null> {
  if (req.auth?.orgId) return req.auth.orgId;
  if (!req.auth?.userId) return null;
  const row = await queryOne<{ org_id: string }>(
    `SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1`,
    [req.auth.userId],
  );
  return row?.org_id ?? null;
}

async function assertProjectInOrg(
  orgId: string,
  projectId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const p = await getProjectById(projectId);
  if (!p) return { ok: false, status: 404, error: "Project not found" };
  if (p.org_id !== orgId) return { ok: false, status: 403, error: "Project not in your organization" };
  return { ok: true };
}

/** GET /v1/projects/:projectId/monitor/rollup?days=30 */
projectAnalyticsRouter.get("/:projectId/monitor/rollup", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const projectId = req.params.projectId;
    const gate = await assertProjectInOrg(orgId, projectId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || "30"), 10) || 30));

    const totals = await queryOne<{ total_events: string; total_spend: string }>(
      `
      WITH ev AS (
        SELECT ev
        FROM sdk_monitor_event_batches b,
        LATERAL jsonb_array_elements(b.payload) ev
        WHERE b.org_id = $1::uuid AND b.project_id = $2::uuid
          AND b.created_at >= (now() AT TIME ZONE 'utc') - ($3::int * interval '1 day')
      )
      SELECT COUNT(*)::text AS total_events,
        COALESCE(SUM(
          CASE
            WHEN (ev->'actualCostUsd') IS NOT NULL AND NULLIF(trim(ev->>'actualCostUsd'), '') IS NOT NULL
            THEN (ev->>'actualCostUsd')::numeric
            ELSE 0::numeric
          END
        ), 0)::text AS total_spend
      FROM ev
      `,
      [orgId, projectId, days],
    );

    const byProv = await query<{ provider: string; events: string; tokens: string }>(
      `
      WITH ev AS (
        SELECT ev
        FROM sdk_monitor_event_batches b,
        LATERAL jsonb_array_elements(b.payload) ev
        WHERE b.org_id = $1::uuid AND b.project_id = $2::uuid
          AND b.created_at >= (now() AT TIME ZONE 'utc') - ($3::int * interval '1 day')
      )
      SELECT COALESCE(ev->>'provider', 'unknown') AS provider,
        COUNT(*)::text AS events,
        COALESCE(SUM(
          COALESCE(NULLIF(trim(ev->>'inputTokens'), '')::bigint, 0) +
          COALESCE(NULLIF(trim(ev->>'outputTokens'), '')::bigint, 0)
        ), 0)::text AS tokens
      FROM ev
      GROUP BY 1
      ORDER BY COUNT(*) DESC
      `,
      [orgId, projectId, days],
    );

    res.json({
      days,
      total_events: parseInt(totals?.total_events ?? "0", 10) || 0,
      total_actual_spend_usd: parseFloat(totals?.total_spend ?? "0") || 0,
      by_provider: byProv.rows.map((r) => ({
        provider: r.provider,
        events: parseInt(r.events, 10) || 0,
        tokens: parseInt(r.tokens, 10) || 0,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "monitor rollup error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});

/** GET /v1/projects/:projectId/monitor/batches?limit=15 */
projectAnalyticsRouter.get("/:projectId/monitor/batches", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const projectId = req.params.projectId;
    const gate = await assertProjectInOrg(orgId, projectId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const lim = Math.min(50, Math.max(1, parseInt(String(req.query.limit || "15"), 10) || 15));

    const rows = await query<{ id: string; created_at: string; event_count: number; payload: unknown }>(
      `
      SELECT id::text, created_at::text, event_count, payload
      FROM sdk_monitor_event_batches
      WHERE org_id = $1::uuid AND project_id = $2::uuid
      ORDER BY created_at DESC
      LIMIT $3
      `,
      [orgId, projectId, lim],
    );

    res.json({
      batches: rows.rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        event_count: r.event_count,
        events: r.payload,
      })),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "monitor batches list error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});

/** GET /v1/projects/:projectId/summary */
projectAnalyticsRouter.get("/:projectId/summary", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const projectId = req.params.projectId;
    const gate = await assertProjectInOrg(orgId, projectId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const totals = await queryOne<{
      total_calls: string;
      total_savings: string;
      avg_pct: string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS total_calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS total_savings,
        CASE WHEN SUM(input_tokens) > 0 THEN
          (100.0 * SUM(input_tokens - optimized_input_tokens) / NULLIF(SUM(input_tokens), 0))::text
        END AS avg_pct
      FROM sdk_run_telemetry
      WHERE org_id = $1::uuid AND project_id = $2::uuid
      `,
      [orgId, projectId],
    );

    const byEnv = await query<{ environment: string; calls: string; savings: string }>(
      `
      SELECT environment,
        COUNT(*)::text AS calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS savings
      FROM sdk_run_telemetry
      WHERE org_id = $1::uuid AND project_id = $2::uuid
      GROUP BY environment
      ORDER BY calls DESC
      `,
      [orgId, projectId],
    );

    const recent = await query<{
      id: string;
      environment: string;
      model: string;
      input_tokens: number;
      output_tokens: number;
      optimized_input_tokens: number;
      estimated_savings_usd: string;
      created_at: string;
      diagnostics: unknown | null;
    }>(
      `
      SELECT id::text, environment, model, input_tokens, output_tokens, optimized_input_tokens,
        estimated_savings_usd::text, created_at::text, diagnostics
      FROM sdk_run_telemetry
      WHERE org_id = $1::uuid AND project_id = $2::uuid
      ORDER BY created_at DESC
      LIMIT 25
      `,
      [orgId, projectId],
    );

    res.json({
      total_calls: parseInt(totals?.total_calls ?? "0", 10) || 0,
      total_savings_usd: parseFloat(totals?.total_savings ?? "0") || 0,
      avg_savings_percent: totals?.avg_pct != null ? parseFloat(totals.avg_pct) : 0,
      environment_breakdown: byEnv.rows.map((r) => ({
        environment: r.environment,
        calls: parseInt(r.calls, 10) || 0,
        savings_usd: parseFloat(r.savings) || 0,
      })),
      recent_runs: recent.rows,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "project summary error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});

/** GET /v1/projects/:projectId/timeseries?range=30d */
projectAnalyticsRouter.get("/:projectId/timeseries", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const projectId = req.params.projectId;
    const gate = await assertProjectInOrg(orgId, projectId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const range = String(req.query.range || "30d");
    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);

    const rows = await query<{
      usage_date: string;
      total_calls: number;
      total_input_tokens: string;
      total_output_tokens: string;
      total_optimized_input_tokens: string;
      total_cost_usd: string;
      total_optimized_cost_usd: string;
      total_savings_usd: string;
    }>(
      `
      SELECT usage_date::text,
        total_calls,
        total_input_tokens::text,
        total_output_tokens::text,
        total_optimized_input_tokens::text,
        total_cost_usd::text,
        total_optimized_cost_usd::text,
        total_savings_usd::text
      FROM project_usage_daily
      WHERE org_id = $1::uuid AND project_id = $2::uuid AND usage_date >= $3::date
      ORDER BY usage_date ASC
      `,
      [orgId, projectId, since.toISOString().slice(0, 10)],
    );

    res.json(
      rows.rows.map((r) => ({
        date: r.usage_date,
        total_calls: r.total_calls,
        total_input_tokens: parseInt(r.total_input_tokens, 10),
        total_output_tokens: parseInt(r.total_output_tokens, 10),
        total_optimized_input_tokens: parseInt(r.total_optimized_input_tokens, 10),
        total_cost_usd: parseFloat(r.total_cost_usd),
        total_optimized_cost_usd: parseFloat(r.total_optimized_cost_usd),
        total_savings_usd: parseFloat(r.total_savings_usd),
      })),
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "project timeseries error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});

/** GET /v1/projects/:projectId/environments/:env */
projectAnalyticsRouter.get("/:projectId/environments/:env", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) return res.status(401).json({ error: "Not authenticated" });
    const orgId = await resolveOrgId(req);
    if (!orgId) return res.status(404).json({ error: "Organization not found" });
    const projectId = req.params.projectId;
    const env = decodeURIComponent(req.params.env).slice(0, 128);
    const gate = await assertProjectInOrg(orgId, projectId);
    if (!gate.ok) return res.status(gate.status).json({ error: gate.error });

    const totals = await queryOne<{
      total_calls: string;
      total_savings: string;
    }>(
      `
      SELECT COUNT(*)::text AS total_calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS total_savings
      FROM sdk_run_telemetry
      WHERE org_id = $1::uuid AND project_id = $2::uuid AND environment = $3
      `,
      [orgId, projectId, env],
    );

    const byModel = await query<{ model: string; calls: string; savings: string }>(
      `
      SELECT model, COUNT(*)::text AS calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS savings
      FROM sdk_run_telemetry
      WHERE org_id = $1::uuid AND project_id = $2::uuid AND environment = $3
      GROUP BY model
      ORDER BY calls DESC
      LIMIT 20
      `,
      [orgId, projectId, env],
    );

    const series = await query<{
      usage_date: string;
      total_calls: number;
      total_savings_usd: string;
    }>(
      `
      SELECT usage_date::text, total_calls, total_savings_usd::text
      FROM project_usage_daily
      WHERE org_id = $1::uuid AND project_id = $2::uuid AND environment = $3
      ORDER BY usage_date DESC
      LIMIT 90
      `,
      [orgId, projectId, env],
    );

    res.json({
      environment: env,
      total_calls: parseInt(totals?.total_calls ?? "0", 10) || 0,
      total_savings_usd: parseFloat(totals?.total_savings ?? "0") || 0,
      model_usage: byModel.rows.map((r) => ({
        model: r.model,
        calls: parseInt(r.calls, 10) || 0,
        savings_usd: parseFloat(r.savings) || 0,
      })),
      daily: series.rows,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    safeLog("error", "project environment detail error", { error: msg });
    res.status(500).json({ error: msg || "Internal server error" });
  }
});
