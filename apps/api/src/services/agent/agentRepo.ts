/**
 * Agent Repository
 * 
 * Database operations for agent runs and events
 */

import { query } from "../storage/db.js";
import { safeLog } from "../../utils/redaction.js";

export interface CreateAgentRunInput {
  runId: string;
  orgId: string;
  projectId: string | null;
  model: string;
  maxBudgetUsd: number;
  allowedTools: string[];
  permissionMode: string;
  promptMeta: any; // JSONB
  reasons: string[];
}

export interface InsertAgentEventInput {
  runId: string;
  orgId: string;
  event: any; // JSONB
}

/**
 * Create an agent run record
 */
export async function createAgentRun(input: CreateAgentRunInput): Promise<void> {
  const {
    runId,
    orgId,
    projectId,
    model,
    maxBudgetUsd,
    allowedTools,
    permissionMode,
    promptMeta,
    reasons,
  } = input;
  
  try {
    await query(`
      INSERT INTO agent_runs (
        id,
        org_id,
        project_id,
        created_at,
        model,
        max_budget_usd,
        allowed_tools,
        permission_mode,
        prompt_meta,
        reasons
      ) VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        model = EXCLUDED.model,
        max_budget_usd = EXCLUDED.max_budget_usd,
        allowed_tools = EXCLUDED.allowed_tools,
        permission_mode = EXCLUDED.permission_mode,
        prompt_meta = EXCLUDED.prompt_meta,
        reasons = EXCLUDED.reasons
    `, [
      runId,
      orgId,
      projectId,
      model,
      maxBudgetUsd,
      allowedTools,
      permissionMode,
      JSON.stringify(promptMeta),
      reasons,
    ]);
  } catch (error: any) {
    safeLog("error", "Failed to create agent run", { error: error.message, runId });
    throw error;
  }
}

/**
 * Insert an agent event
 */
export async function insertAgentEvent(input: InsertAgentEventInput): Promise<void> {
  const { runId, orgId, event } = input;
  
  try {
    // Verify run exists and belongs to org
    const runCheck = await query(`
      SELECT id FROM agent_runs WHERE id = $1 AND org_id = $2 LIMIT 1
    `, [runId, orgId]);
    
    if (runCheck.rows.length === 0) {
      safeLog("warn", "Agent run not found for event", { runId, orgId });
      // Don't throw - telemetry is best-effort
      return;
    }
    
    await query(`
      INSERT INTO agent_events (run_id, created_at, event)
      VALUES ($1, NOW(), $2)
    `, [runId, JSON.stringify(event)]);
  } catch (error: any) {
    safeLog("error", "Failed to insert agent event", { error: error.message, runId });
    // Don't throw - telemetry is best-effort
  }
}
