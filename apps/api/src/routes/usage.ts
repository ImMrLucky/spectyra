/**
 * Usage Routes
 * 
 * Merges savings + billing into unified usage & billing view
 */

import { Router } from "express";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { query, queryOne } from "../services/storage/db.js";
import { getSavingsSummary, getSavingsTimeseries } from "../services/storage/savingsRepo.js";

export const usageRouter = Router();

// Apply authentication middleware
usageRouter.use(requireUserSession);

/**
 * GET /v1/usage
 * 
 * Get usage data for the authenticated org
 * Merges savings data with usage tracking
 */
usageRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const range = req.query.range as string || "30d";
    const groupBy = req.query.groupBy as string | undefined;

    // Calculate date range
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Get runs for usage calculation
    const runsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as calls,
        SUM(usage_total_tokens) as tokens,
        SUM(cost_usd) as cost
      FROM runs
      WHERE org_id = $1 AND created_at >= $2
      ${groupBy === 'project' ? 'GROUP BY DATE(created_at), project_id' : 'GROUP BY DATE(created_at)'}
      ORDER BY date DESC
    `;

    const runsResult = await query(runsQuery, [membership.org_id, sinceDate.toISOString()]);

    // Get agent runs
    const agentRunsQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as calls
      FROM agent_runs
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    const agentRunsResult = await query(agentRunsQuery, [membership.org_id, sinceDate.toISOString()]);

    // Combine and format
    const usageData = runsResult.rows.map((row: any) => ({
      period: row.date,
      calls: parseInt(row.calls) || 0,
      tokens: parseInt(row.tokens) || 0,
      cost_estimate_usd: parseFloat(row.cost) || 0,
    }));

    res.json(usageData);
  } catch (error: any) {
    safeLog("error", "Get usage error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/usage/top-models
 * 
 * Get top models used (for Overview page)
 */
usageRouter.get("/top-models", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const range = req.query.range as string || "24h";
    const days = range === "24h" ? 1 : range === "7d" ? 7 : 30;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Get top models from runs
    const result = await query(`
      SELECT 
        model,
        COUNT(*) as count
      FROM runs
      WHERE org_id = $1 AND created_at >= $2
      GROUP BY model
      ORDER BY count DESC
      LIMIT 10
    `, [membership.org_id, sinceDate.toISOString()]);

    res.json(result.rows.map((row: any) => ({
      model: row.model,
      count: parseInt(row.count),
    })));
  } catch (error: any) {
    safeLog("error", "Get top models error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/usage/budgets
 * 
 * Get budget progress (for Usage page)
 */
usageRouter.get("/budgets", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // TODO: Implement budget policies and tracking
    // For now, return empty array
    res.json([]);
  } catch (error: any) {
    safeLog("error", "Get budgets error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/usage/optimizations
 * 
 * Get aggregate savings by optimization type (Core Moat v1)
 */
usageRouter.get("/optimizations", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const range = req.query.range as string || "30d";
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Get runs with debug_internal_json
    const runsResult = await query(`
      SELECT debug_internal_json
      FROM runs
      WHERE org_id = $1 AND created_at >= $2 AND debug_internal_json IS NOT NULL
    `, [membership.org_id, sinceDate.toISOString()]);

    // Aggregate savings by optimization type
    const aggregations: {
      refpack: { tokensSaved: number; runs: number };
      phrasebook: { tokensSaved: number; runs: number };
      codemap: { tokensSaved: number; runs: number };
    } = {
      refpack: { tokensSaved: 0, runs: 0 },
      phrasebook: { tokensSaved: 0, runs: 0 },
      codemap: { tokensSaved: 0, runs: 0 },
    };

    for (const row of runsResult.rows) {
      try {
        const debugInternal = JSON.parse(row.debug_internal_json);
        
        if (debugInternal.refpack?.tokensSaved) {
          aggregations.refpack.tokensSaved += debugInternal.refpack.tokensSaved || 0;
          aggregations.refpack.runs++;
        }
        
        if (debugInternal.phrasebook?.tokensSaved) {
          aggregations.phrasebook.tokensSaved += debugInternal.phrasebook.tokensSaved || 0;
          aggregations.phrasebook.runs++;
        }
        
        if (debugInternal.codemap?.tokensSaved) {
          aggregations.codemap.tokensSaved += debugInternal.codemap.tokensSaved || 0;
          aggregations.codemap.runs++;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }

    res.json([
      {
        optimization: 'refpack',
        name: 'RefPack',
        tokens_saved: aggregations.refpack.tokensSaved,
        runs_count: aggregations.refpack.runs,
      },
      {
        optimization: 'phrasebook',
        name: 'PhraseBook',
        tokens_saved: aggregations.phrasebook.tokensSaved,
        runs_count: aggregations.phrasebook.runs,
      },
      {
        optimization: 'codemap',
        name: 'CodeMap',
        tokens_saved: aggregations.codemap.tokensSaved,
        runs_count: aggregations.codemap.runs,
      },
    ].filter(item => item.tokens_saved > 0));
  } catch (error: any) {
    safeLog("error", "Get optimizations savings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
