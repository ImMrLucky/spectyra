/**
 * Baseline Sampler (Postgres)
 * 
 * Welford's online algorithm for computing mean and variance incrementally.
 * Updates baseline_samples table with aggregated statistics per workload_key.
 */

import { query, queryOne } from "../storage/db.js";

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
  org_id?: string | null;
  project_id?: string | null;
}

/**
 * Add a baseline sample to the aggregation.
 * Uses Welford's algorithm for online variance calculation.
 */
export async function addBaselineSample(
  workloadKey: string, 
  totalTokens: number, 
  costUsd: number,
  orgId?: string,
  projectId?: string | null
): Promise<void> {
  // Get existing sample or create new
  const existing = await queryOne<BaselineSample>(`
    SELECT * FROM baseline_samples WHERE workload_key = $1
  `, [workloadKey]);
  
  if (!existing) {
    // First sample
    await query(`
      INSERT INTO baseline_samples (
        workload_key, n, mean_total_tokens, var_total_tokens,
        mean_cost_usd, var_cost_usd, M2_tokens, M2_cost, updated_at,
        org_id, project_id
      ) VALUES ($1, 1, $2, 0, $3, 0, 0, 0, now(), $4, $5)
    `, [workloadKey, totalTokens, costUsd, orgId || null, projectId || null]);
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
  
  await query(`
    UPDATE baseline_samples
    SET n = $1,
        mean_total_tokens = $2,
        var_total_tokens = $3,
        mean_cost_usd = $4,
        var_cost_usd = $5,
        M2_tokens = $6,
        M2_cost = $7,
        updated_at = now()
    WHERE workload_key = $8
  `, [
    n,
    newMeanTokens,
    newVarTokens,
    newMeanCost,
    newVarCost,
    newM2Tokens,
    newM2Cost,
    workloadKey
  ]);
}

/**
 * Get baseline sample statistics for a workload key.
 */
export async function getBaselineSample(workloadKey: string): Promise<BaselineSample | null> {
  const result = await queryOne<BaselineSample>(`
    SELECT * FROM baseline_samples WHERE workload_key = $1
  `, [workloadKey]);
  
  return result;
}

/**
 * Find nearest workload key (same path/provider/model, different bucket).
 * Used as fallback when current workload_key has insufficient samples.
 */
export async function findNearestWorkloadKey(
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  orgId?: string,
  projectId?: string | null
): Promise<BaselineSample | null> {
  // Build conditions
  const conditions: string[] = ["r.path = $1", "r.provider = $2", "r.model = $3"];
  const params: any[] = [path, provider, model];
  let paramIndex = 4;
  
  if (orgId) {
    conditions.push(`bs.org_id = $${paramIndex++}`);
    params.push(orgId);
  }
  
  if (projectId !== undefined && projectId !== null) {
    conditions.push(`bs.project_id = $${paramIndex++}`);
    params.push(projectId);
  } else if (projectId === null && orgId) {
    conditions.push(`bs.project_id IS NULL`);
  }
  
  const whereClause = conditions.join(" AND ");
  
  // Try to find any baseline sample with same path/provider/model
  const result = await queryOne<BaselineSample>(`
    SELECT bs.*
    FROM baseline_samples bs
    JOIN runs r ON r.workload_key = bs.workload_key
    WHERE ${whereClause}
    ORDER BY bs.n DESC, bs.updated_at DESC
    LIMIT 1
  `, params);
  
  return result;
}
