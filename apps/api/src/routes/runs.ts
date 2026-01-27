import { Router } from "express";
import { getRuns, getRun } from "../services/storage/runsRepo.js";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { query, queryOne } from "../services/storage/db.js";

export const runsRouter = Router();

// Apply authentication middleware (Supabase JWT for dashboard)
runsRouter.use(requireUserSession);

/**
 * GET /v1/runs
 * 
 * Get all runs (chat + agent) for the authenticated org
 * Returns unified list with type indicator
 */
runsRouter.get("/", async (req: AuthenticatedRequest, res) => {
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

    const limit = parseInt(req.query.limit as string || "50", 10);
    const projectId = req.query.project_id as string | undefined;
    const cursor = req.query.cursor as string | undefined;
    
    // Get chat runs
    const chatRuns = await getRuns(limit, membership.org_id, projectId || null);
    
    // Get agent runs
    const agentRunsQuery = projectId
      ? `SELECT * FROM agent_runs WHERE org_id = $1 AND project_id = $2 ORDER BY created_at DESC LIMIT $3`
      : `SELECT * FROM agent_runs WHERE org_id = $1 ORDER BY created_at DESC LIMIT $2`;
    
    const agentRunsParams = projectId
      ? [membership.org_id, projectId, limit]
      : [membership.org_id, limit];
    
    const agentRunsResult = await query(agentRunsQuery, agentRunsParams);
    
    // Get event counts for agent runs
    const agentRunIds = agentRunsResult.rows.map((r: any) => r.id);
    let eventCounts: { [runId: string]: number } = {};
    
    if (agentRunIds.length > 0) {
      const eventCountsResult = await query(`
        SELECT run_id, COUNT(*) as count
        FROM agent_events
        WHERE run_id = ANY($1)
        GROUP BY run_id
      `, [agentRunIds]);
      
      eventCounts = eventCountsResult.rows.reduce((acc: any, row: any) => {
        acc[row.run_id] = parseInt(row.count);
        return acc;
      }, {});
    }
    
    // Transform agent runs to unified format
    const agentRuns = agentRunsResult.rows.map((row: any) => ({
      id: row.id,
      type: 'agent' as const,
      source: 'sdk-remote' as const, // TODO: Determine from prompt_meta or other field
      model: row.model,
      budget: row.max_budget_usd,
      status: 'completed', // TODO: Track status
      start_time: row.created_at,
      end_time: row.created_at, // TODO: Track actual end time
      events_count: eventCounts[row.id] || 0,
      policy_triggers_count: row.reasons?.length || 0,
      allowed_tools: row.allowed_tools || [],
      permission_mode: row.permission_mode,
      prompt_meta: row.prompt_meta,
      reasons: row.reasons || [],
      org_id: row.org_id,
      project_id: row.project_id,
    }));
    
    // Transform chat runs to unified format with Core Moat v1 metrics
    const unifiedChatRuns = await Promise.all(chatRuns.map(async (run) => {
      // Get full run record to access debug_internal_json
      let debugInternal: any = null;
      try {
        const fullRunRow = await queryOne<any>(`
          SELECT debug_internal_json FROM runs WHERE id = $1
        `, [run.id]);
        
        if (fullRunRow?.debug_internal_json) {
          debugInternal = JSON.parse(fullRunRow.debug_internal_json);
        }
      } catch (e) {
        // Ignore errors - debugInternal is optional
      }

      // Extract Core Moat v1 optimizations
      const optimizationsApplied: string[] = [];
      const tokenBreakdown: any = {};
      
      if (debugInternal?.refpack?.entriesCount > 0) {
        optimizationsApplied.push('refpack');
        tokenBreakdown.refpack = {
          before: debugInternal.refpack.tokensBefore || 0,
          after: debugInternal.refpack.tokensAfter || 0,
          saved: debugInternal.refpack.tokensSaved || 0,
        };
      }
      
      if (debugInternal?.phrasebook?.applied) {
        optimizationsApplied.push('phrasebook');
        tokenBreakdown.phrasebook = {
          before: debugInternal.phrasebook.tokensBefore || 0,
          after: debugInternal.phrasebook.tokensAfter || 0,
          saved: debugInternal.phrasebook.tokensSaved || 0,
        };
      }
      
      if (debugInternal?.codemap?.applied) {
        optimizationsApplied.push('codemap');
        tokenBreakdown.codemap = {
          before: debugInternal.codemap.tokensBefore || 0,
          after: debugInternal.codemap.tokensAfter || 0,
          saved: debugInternal.codemap.tokensSaved || 0,
        };
      }

      return {
        id: run.id,
        type: 'chat' as const,
        source: 'api' as const,
        model: `${run.provider}/${run.model}`,
        budget: null,
        status: run.quality.pass ? 'completed' : 'failed',
        start_time: run.createdAt,
        end_time: run.createdAt,
        events_count: 0,
        policy_triggers_count: 0,
        tokens: run.usage.total_tokens,
        cost: run.costUsd,
        quality: run.quality.pass,
        mode: run.mode,
        path: run.path,
        optimizations_applied: optimizationsApplied,
        token_breakdown: Object.keys(tokenBreakdown).length > 0 ? tokenBreakdown : undefined,
        savings: run.savings,
      };
    }));
    
    // Combine and sort by time
    const allRuns = [...unifiedChatRuns, ...agentRuns].sort((a, b) => {
      return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
    }).slice(0, limit);
    
    res.json(allRuns);
  } catch (error: any) {
    safeLog("error", "Get runs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

runsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
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

    const { id } = req.params;
    const run = await getRun(id);
    
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    // Get debug_internal_json for Core Moat v1 metrics
    const runRow = await queryOne<any>(`
      SELECT debug_internal_json FROM runs WHERE id = $1
    `, [id]);
    
    let debugInternal: any = null;
    if (runRow?.debug_internal_json) {
      try {
        debugInternal = JSON.parse(runRow.debug_internal_json);
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Extract Core Moat v1 optimizations
    const optimizationsApplied: string[] = [];
    const tokenBreakdown: any = {};
    
    if (debugInternal?.refpack?.entriesCount > 0) {
      optimizationsApplied.push('refpack');
      tokenBreakdown.refpack = {
        before: debugInternal.refpack.tokensBefore || 0,
        after: debugInternal.refpack.tokensAfter || 0,
        saved: debugInternal.refpack.tokensSaved || 0,
      };
    }
    
    if (debugInternal?.phrasebook?.applied) {
      optimizationsApplied.push('phrasebook');
      tokenBreakdown.phrasebook = {
        before: debugInternal.phrasebook.tokensBefore || 0,
        after: debugInternal.phrasebook.tokensAfter || 0,
        saved: debugInternal.phrasebook.tokensSaved || 0,
      };
    }
    
    if (debugInternal?.codemap?.applied) {
      optimizationsApplied.push('codemap');
      tokenBreakdown.codemap = {
        before: debugInternal.codemap.tokensBefore || 0,
        after: debugInternal.codemap.tokensAfter || 0,
        saved: debugInternal.codemap.tokensSaved || 0,
      };
    }

    // Return run with Core Moat v1 metrics
    res.json({
      ...run,
      optimizations_applied: optimizationsApplied,
      token_breakdown: Object.keys(tokenBreakdown).length > 0 ? tokenBreakdown : undefined,
    });
  } catch (error: any) {
    safeLog("error", "Get run error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
