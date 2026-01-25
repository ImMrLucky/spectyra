import { v4 as uuidv4 } from "uuid";
import { getDb } from "../storage/db.js";
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
export function writeVerifiedSavings(
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
  optimizedCost: number
): void {
  const tokensSaved = baselineTokens - optimizedTokens;
  const pctSaved = baselineTokens > 0 ? (tokensSaved / baselineTokens) * 100 : 0;
  const costSaved = baselineCost - optimizedCost;
  
  // Update baseline samples for future estimates
  addBaselineSample(workloadKey, baselineTokens, baselineCost);
  
  // Write ledger row
  const db = getDb();
  db.prepare(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, replay_id, optimized_run_id, baseline_run_id
    ) VALUES (?, datetime('now'), 'verified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    baselineRunId
  );
}

/**
 * Write a shadow_verified savings ledger row (shadow baseline + optimized pair).
 */
export function writeShadowVerifiedSavings(
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
  optimizedCost: number
): void {
  const tokensSaved = baselineTokens - optimizedTokens;
  const pctSaved = baselineTokens > 0 ? (tokensSaved / baselineTokens) * 100 : 0;
  const costSaved = baselineCost - optimizedCost;
  
  // Update baseline samples
  addBaselineSample(workloadKey, baselineTokens, baselineCost);
  
  // Write ledger row
  const db = getDb();
  db.prepare(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, baseline_run_id, optimized_run_id
    ) VALUES (?, datetime('now'), 'shadow_verified', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    optimizedRunId
  );
}

/**
 * Write an estimated savings ledger row for an optimized run without baseline.
 */
export function writeEstimatedSavings(
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  optimizationLevel: number,
  optimizedRunId: string,
  optimizedTokens: number,
  optimizedCost: number
): void {
  // Estimate baseline
  const estimate = estimateBaseline(workloadKey, path, provider, model);
  
  const tokensSaved = estimate.totalTokens - optimizedTokens;
  const pctSaved = estimate.totalTokens > 0 ? (tokensSaved / estimate.totalTokens) * 100 : 0;
  const costSaved = estimate.costUsd - optimizedCost;
  
  // Compute confidence
  const confidence = computeConfidence(workloadKey, "estimated");
  
  // Write ledger row
  const db = getDb();
  db.prepare(`
    INSERT INTO savings_ledger (
      id, created_at, savings_type, workload_key, path, provider, model,
      optimization_level, baseline_tokens, optimized_tokens, tokens_saved,
      pct_saved, baseline_cost_usd, optimized_cost_usd, cost_saved_usd,
      confidence, optimized_run_id
    ) VALUES (?, datetime('now'), 'estimated', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    optimizedRunId
  );
}
