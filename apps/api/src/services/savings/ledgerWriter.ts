/**
 * Ledger Writer (Postgres)
 * 
 * Writes savings ledger entries
 */

import { v4 as uuidv4 } from "uuid";
import { query } from "../storage/db.js";
import { addBaselineSample } from "./baselineSampler.js";
import { estimateBaseline } from "./estimateBaseline.js";
import { computeConfidence } from "./confidence.js";

export type SavingsType = "verified" | "shadow_verified" | "estimated";

export interface LedgerRow {
  id: string;
  created_at: string;
  savings_type: SavingsType;
  workload_key: string;
  path: string;
  provider: string;
  model: string;
  optimization_level: number;
  baseline_tokens: number;
  optimized_tokens: number;
  tokens_saved: number;
  pct_saved: number;
  baseline_cost_usd: number;
  optimized_cost_usd: number;
  cost_saved_usd: number;
  confidence: number;
  replay_id?: string;
  optimized_run_id?: string;
  baseline_run_id?: string;
}

/**
 * Write a verified savings ledger row from a replay (baseline + optimized pair).
 */
export async function writeVerifiedSavings(
  replayId: string,
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  optimizationLevel: number,
  baselineRunId: string,
  optimizedRunId: string,
  baselineTokens: number,
  optimizedTokens: number,
  baselineCost: number,
  optimizedCost: number,
  orgId?: string,
  projectId?: string | null
): Promise<void> {
  const tokensSaved = baselineTokens - optimizedTokens;
  const pctSaved = baselineTokens > 0 ? (tokensSaved / baselineTokens) * 100 : 0;
  const costSaved = baselineCost - optimizedCost;
  
  // Update baseline samples for future estimates
  await addBaselineSample(workloadKey, baselineTokens, baselineCost, orgId, projectId);
  
  // Write ledger row
  await query(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, replay_id, optimized_run_id, baseline_run_id,
      org_id, project_id
    ) VALUES ($1, now(), 'verified', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
  `, [
    uuidv4(),
    workloadKey,
    path,
    provider,
    model,
    optimizationLevel,
    baselineTokens,
    optimizedTokens,
    tokensSaved,
    pctSaved,
    baselineCost,
    optimizedCost,
    costSaved,
    1.0, // verified = full confidence
    replayId,
    optimizedRunId,
    baselineRunId,
    orgId || null,
    projectId || null
  ]);
}

/**
 * Write a shadow_verified savings ledger row (shadow baseline + optimized pair).
 */
export async function writeShadowVerifiedSavings(
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  optimizationLevel: number,
  baselineRunId: string,
  optimizedRunId: string,
  baselineTokens: number,
  optimizedTokens: number,
  baselineCost: number,
  optimizedCost: number,
  orgId?: string,
  projectId?: string | null
): Promise<void> {
  const tokensSaved = baselineTokens - optimizedTokens;
  const pctSaved = baselineTokens > 0 ? (tokensSaved / baselineTokens) * 100 : 0;
  const costSaved = baselineCost - optimizedCost;
  
  // Update baseline samples
  await addBaselineSample(workloadKey, baselineTokens, baselineCost, orgId, projectId);
  
  // Write ledger row
  await query(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, baseline_run_id, optimized_run_id,
      org_id, project_id
    ) VALUES ($1, now(), 'shadow_verified', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
  `, [
    uuidv4(),
    workloadKey,
    path,
    provider,
    model,
    optimizationLevel,
    baselineTokens,
    optimizedTokens,
    tokensSaved,
    pctSaved,
    baselineCost,
    optimizedCost,
    costSaved,
    1.0, // shadow_verified = full confidence
    baselineRunId,
    optimizedRunId,
    orgId || null,
    projectId || null
  ]);
}

/**
 * Write an estimated savings ledger row for an optimized run without baseline.
 */
export async function writeEstimatedSavings(
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  optimizationLevel: number,
  optimizedRunId: string,
  optimizedTokens: number,
  optimizedCost: number,
  orgId?: string,
  projectId?: string | null
): Promise<void> {
  // Estimate baseline
  const estimate = await estimateBaseline(workloadKey, path, provider, model, orgId, projectId);
  
  const tokensSaved = estimate.totalTokens - optimizedTokens;
  const pctSaved = estimate.totalTokens > 0 ? (tokensSaved / estimate.totalTokens) * 100 : 0;
  const costSaved = estimate.costUsd - optimizedCost;
  
  // Compute confidence
  const confidence = await computeConfidence(workloadKey, "estimated", orgId, projectId);
  
  // Write ledger row
  await query(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, optimized_run_id,
      org_id, project_id
    ) VALUES ($1, now(), 'estimated', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
  `, [
    uuidv4(),
    workloadKey,
    path,
    provider,
    model,
    optimizationLevel,
    estimate.totalTokens,
    optimizedTokens,
    tokensSaved,
    pctSaved,
    estimate.costUsd,
    optimizedCost,
    costSaved,
    confidence,
    optimizedRunId,
    orgId || null,
    projectId || null
  ]);
}
