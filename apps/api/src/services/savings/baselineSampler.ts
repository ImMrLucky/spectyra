import { getDb } from "../storage/db.js";

/**
 * Welford's online algorithm for computing mean and variance incrementally.
 * Updates baseline_samples table with aggregated statistics per workload_key.
 */
export interface BaselineSample {
  workload_key: string;
  n: number;
  mean_total_tokens: number;
  var_total_tokens: number;
  mean_cost_usd: number;
  var_cost_usd: number;
  M2_tokens: number;
  M2_cost: number;
  updated_at: string;
}

/**
 * Add a baseline sample to the aggregation.
 * Uses Welford's algorithm for online variance calculation.
 */
export function addBaselineSample(workloadKey: string, totalTokens: number, costUsd: number): void {
  const db = getDb();
  
  // Get existing sample or create new
  const existing = db.prepare(`
    SELECT * FROM baseline_samples WHERE workload_key = ?
  `).get(workloadKey) as BaselineSample | undefined;
  
  if (!existing) {
    // First sample
    db.prepare(`
      INSERT INTO baseline_samples (
        workload_key, n, mean_total_tokens, var_total_tokens,
        mean_cost_usd, var_cost_usd, M2_tokens, M2_cost, updated_at
      ) VALUES (?, 1, ?, 0, ?, 0, 0, 0, datetime('now'))
    `).run(workloadKey, totalTokens, costUsd);
    return;
  }
  
  // Welford's algorithm
  const n = existing.n + 1;
  const deltaTokens = totalTokens - existing.mean_total_tokens;
  const deltaCost = costUsd - existing.mean_cost_usd;
  
  const newMeanTokens = existing.mean_total_tokens + deltaTokens / n;
  const newMeanCost = existing.mean_cost_usd + deltaCost / n;
  
  const newM2Tokens = existing.M2_tokens + deltaTokens * (totalTokens - newMeanTokens);
  const newM2Cost = existing.M2_cost + deltaCost * (costUsd - newMeanCost);
  
  // Variance = M2 / (n-1) for sample variance
  const newVarTokens = n > 1 ? newM2Tokens / (n - 1) : 0;
  const newVarCost = n > 1 ? newM2Cost / (n - 1) : 0;
  
  db.prepare(`
    UPDATE baseline_samples
    SET n = ?,
        mean_total_tokens = ?,
        var_total_tokens = ?,
        mean_cost_usd = ?,
        var_cost_usd = ?,
        M2_tokens = ?,
        M2_cost = ?,
        updated_at = datetime('now')
    WHERE workload_key = ?
  `).run(
    n,
    newMeanTokens,
    newVarTokens,
    newMeanCost,
    newVarCost,
    newM2Tokens,
    newM2Cost,
    workloadKey
  );
}

/**
 * Get baseline sample statistics for a workload key.
 */
export function getBaselineSample(workloadKey: string): BaselineSample | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM baseline_samples WHERE workload_key = ?
  `).get(workloadKey) as BaselineSample | undefined;
  
  return row || null;
}

/**
 * Find nearest workload key (same path/provider/model, different bucket).
 * Used as fallback when current workload_key has insufficient samples.
 */
export function findNearestWorkloadKey(
  workloadKey: string,
  path: string,
  provider: string,
  model: string
): BaselineSample | null {
  const db = getDb();
  
  // Try to find any baseline sample with same path/provider/model
  const row = db.prepare(`
    SELECT bs.*
    FROM baseline_samples bs
    JOIN runs r ON r.workload_key = bs.workload_key
    WHERE r.path = ? AND r.provider = ? AND r.model = ?
    ORDER BY bs.n DESC, bs.updated_at DESC
    LIMIT 1
  `).get(path, provider, model) as BaselineSample | undefined;
  
  return row || null;
}
