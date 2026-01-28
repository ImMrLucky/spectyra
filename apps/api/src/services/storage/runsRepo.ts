/**
 * Runs Repository (Postgres)
 * 
 * Manages run records and replays
 */

import { query, queryOne } from "./db.js";
import type { RunRecord, Usage, Savings, QualityCheck, RunDebug } from "@spectyra/shared";

/**
 * Get org settings for data handling controls
 */
async function getOrgSettingsForRun(orgId: string | undefined): Promise<{
  store_prompts: boolean;
  store_responses: boolean;
  store_internal_debug: boolean;
} | null> {
  if (!orgId) return null;
  
  try {
    const { getOrgSettings } = await import("./settingsRepo.js");
    const settings = await getOrgSettings(orgId);
    return {
      store_prompts: settings.store_prompts,
      store_responses: settings.store_responses,
      store_internal_debug: settings.store_internal_debug,
    };
  } catch {
    // If settings don't exist, use defaults (no storage)
    return {
      store_prompts: false,
      store_responses: false,
      store_internal_debug: false,
    };
  }
}

export async function saveRun(run: RunRecord & { 
  replayId?: string; 
  optimizationLevel?: number;
  workloadKey?: string;
  promptHash?: string;
  isShadow?: boolean;
  debugInternal?: any;
  orgId?: string;
  projectId?: string | null;
  providerKeyFingerprint?: string | null;
}): Promise<void> {
  // Enterprise Security: Check org settings for data storage controls
  const orgSettings = await getOrgSettingsForRun(run.orgId);
  
  // Apply storage controls
  const promptFinal = orgSettings?.store_prompts ? JSON.stringify(run.promptFinal) : null;
  const responseText = orgSettings?.store_responses ? run.responseText : null;
  const debugInternalJson = orgSettings?.store_internal_debug && run.debugInternal 
    ? JSON.stringify(run.debugInternal) 
    : null;

  await query(`
    INSERT INTO runs (
      id, scenario_id, conversation_id, replay_id, mode, path, optimization_level, provider, model,
      workload_key, prompt_hash, prompt_final, response_text,
      usage_input_tokens, usage_output_tokens, usage_total_tokens, usage_estimated,
      cost_usd,
      savings_tokens_saved, savings_pct_saved, savings_cost_saved_usd,
      quality_pass, quality_failures, is_shadow,
      debug_refs_used, debug_delta_used, debug_code_sliced, debug_patch_mode, debug_retry,
      debug_spectral_n_nodes, debug_spectral_n_edges, debug_spectral_stability_index,
      debug_spectral_lambda2, debug_spectral_contradiction_energy,
      debug_spectral_stable_unit_ids, debug_spectral_unstable_unit_ids,
      debug_spectral_recommendation, debug_internal_json,
      org_id, project_id, provider_key_fingerprint,
      created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
      $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
    )
  `, [
    run.id,
    run.scenarioId || null,
    run.conversationId || null,
    run.replayId || null,
    run.mode,
    run.path,
    run.optimizationLevel ?? 2,
    run.provider,
    run.model,
    run.workloadKey || null,
    run.promptHash || null,
    promptFinal, // May be null if store_prompts = false
    responseText, // May be null if store_responses = false
    run.usage.input_tokens,
    run.usage.output_tokens,
    run.usage.total_tokens,
    run.usage.estimated ? 1 : 0,
    run.costUsd,
    run.savings?.tokensSaved || null,
    run.savings?.pctSaved || null,
    run.savings?.costSavedUsd || null,
    run.quality.pass ? 1 : 0,
    JSON.stringify(run.quality.failures),
    run.isShadow ? 1 : 0,
    run.debug.refsUsed ? JSON.stringify(run.debug.refsUsed) : null,
    run.debug.deltaUsed ? 1 : 0,
    run.debug.codeSliced ? 1 : 0,
    run.debug.patchMode ? 1 : 0,
    run.debug.retry ? 1 : 0,
    run.debug.spectral?.nNodes || null,
    run.debug.spectral?.nEdges || null,
    run.debug.spectral?.stabilityIndex || null,
    run.debug.spectral?.lambda2 || null,
    run.debug.spectral?.contradictionEnergy || null,
    run.debug.spectral?.stableUnitIds ? JSON.stringify(run.debug.spectral.stableUnitIds) : null,
    run.debug.spectral?.unstableUnitIds ? JSON.stringify(run.debug.spectral.unstableUnitIds) : null,
    run.debug.spectral?.recommendation || null,
    debugInternalJson, // May be null if store_internal_debug = false
    run.orgId || null,
    run.projectId || null,
    run.providerKeyFingerprint || null,
    run.createdAt,
  ]);
}

export async function saveReplay(
  replayId: string, 
  scenarioId: string | undefined, 
  workloadKey: string, 
  path: string, 
  optimizationLevel: number, 
  provider: string, 
  model: string, 
  baselineRunId: string, 
  optimizedRunId: string
): Promise<void> {
  await query(`
    INSERT INTO replays (
      replay_id, scenario_id, workload_key, path, optimization_level, provider, model,
      baseline_run_id, optimized_run_id, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
    ON CONFLICT (replay_id) DO NOTHING
  `, [replayId, scenarioId || null, workloadKey, path, optimizationLevel, provider, model, baselineRunId, optimizedRunId]);
}

export async function getRuns(limit: number = 50, orgId?: string, projectId?: string | null): Promise<RunRecord[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  
  if (orgId) {
    conditions.push(`org_id = $${paramIndex++}`);
    params.push(orgId);
  }
  
  if (projectId !== undefined && projectId !== null) {
    conditions.push(`project_id = $${paramIndex++}`);
    params.push(projectId);
  } else if (projectId === null && orgId) {
    conditions.push(`project_id IS NULL`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(limit);
  
  const result = await query<any>(`
    SELECT * FROM runs
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex}
  `, params);
  
  return result.rows.map(row => mapRowToRunRecord(row));
}

export async function getRun(id: string): Promise<RunRecord | null> {
  const row = await queryOne<any>(`
    SELECT * FROM runs WHERE id = $1
  `, [id]);
  
  if (!row) return null;
  
  return mapRowToRunRecord(row);
}

/**
 * Map database row to RunRecord
 */
function mapRowToRunRecord(row: any): RunRecord {
  return {
    id: row.id,
    scenarioId: row.scenario_id || undefined,
    conversationId: row.conversation_id || undefined,
    mode: row.mode as "baseline" | "optimized",
    path: row.path as "talk" | "code",
    provider: row.provider,
    model: row.model,
    promptFinal: JSON.parse(row.prompt_final || "{}"),
    responseText: row.response_text,
    usage: {
      input_tokens: row.usage_input_tokens,
      output_tokens: row.usage_output_tokens,
      total_tokens: row.usage_total_tokens,
      estimated: row.usage_estimated === 1,
    },
    costUsd: row.cost_usd,
    savings: row.savings_tokens_saved ? {
      tokensSaved: row.savings_tokens_saved,
      pctSaved: row.savings_pct_saved,
      costSavedUsd: row.savings_cost_saved_usd,
    } : undefined,
    quality: {
      pass: row.quality_pass === 1,
      failures: JSON.parse(row.quality_failures || "[]"),
    },
    debug: {
      refsUsed: row.debug_refs_used ? JSON.parse(row.debug_refs_used) : undefined,
      deltaUsed: row.debug_delta_used === 1,
      codeSliced: row.debug_code_sliced === 1,
      patchMode: row.debug_patch_mode === 1,
      retry: row.debug_retry === 1,
      spectral: row.debug_spectral_n_nodes ? {
        nNodes: row.debug_spectral_n_nodes,
        nEdges: row.debug_spectral_n_edges,
        stabilityIndex: row.debug_spectral_stability_index,
        lambda2: row.debug_spectral_lambda2 || undefined,
        contradictionEnergy: row.debug_spectral_contradiction_energy || undefined,
        stableUnitIds: JSON.parse(row.debug_spectral_stable_unit_ids || "[]"),
        unstableUnitIds: JSON.parse(row.debug_spectral_unstable_unit_ids || "[]"),
        recommendation: row.debug_spectral_recommendation as any,
      } : undefined,
    },
    createdAt: row.created_at,
  };
}
