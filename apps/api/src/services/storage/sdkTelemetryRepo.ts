import { query, queryOne } from "./db.js";

export interface SdkTelemetryRunInput {
  orgId: string;
  projectId: string;
  environment: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  optimizedInputTokens: number;
  estimatedCostUsd: number;
  optimizedCostUsd: number;
  estimatedSavingsUsd: number;
  apiKeyId: string | null;
  /** Aggregated SDK diagnostics (JSON). No prompts or provider secrets. */
  diagnostics?: object | null;
}

export async function insertSdkTelemetryRun(input: SdkTelemetryRunInput): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `
    INSERT INTO sdk_run_telemetry (
      org_id, project_id, environment, model,
      input_tokens, output_tokens, optimized_input_tokens,
      estimated_cost_usd, optimized_cost_usd, estimated_savings_usd,
      api_key_id, diagnostics
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
    RETURNING id::text AS id
    `,
    [
      input.orgId,
      input.projectId,
      input.environment.slice(0, 128),
      input.model.slice(0, 512),
      Math.max(0, Math.floor(input.inputTokens)),
      Math.max(0, Math.floor(input.outputTokens)),
      Math.max(0, Math.floor(input.optimizedInputTokens)),
      input.estimatedCostUsd,
      input.optimizedCostUsd,
      input.estimatedSavingsUsd,
      input.apiKeyId,
      input.diagnostics != null ? JSON.stringify(input.diagnostics) : null,
    ],
  );
  if (!row?.id) throw new Error("insertSdkTelemetryRun: no id returned");
  return row.id;
}

export async function upsertProjectUsageDaily(input: SdkTelemetryRunInput): Promise<void> {
  await query(
    `
    INSERT INTO project_usage_daily (
      org_id, project_id, environment, usage_date,
      total_calls, total_input_tokens, total_output_tokens, total_optimized_input_tokens,
      total_cost_usd, total_optimized_cost_usd, total_savings_usd, updated_at
    )
    VALUES (
      $1, $2, $3, (now() AT TIME ZONE 'utc')::date,
      1, $4, $5, $6, $7, $8, $9, now()
    )
    ON CONFLICT (org_id, project_id, environment, usage_date)
    DO UPDATE SET
      total_calls = project_usage_daily.total_calls + 1,
      total_input_tokens = project_usage_daily.total_input_tokens + EXCLUDED.total_input_tokens,
      total_output_tokens = project_usage_daily.total_output_tokens + EXCLUDED.total_output_tokens,
      total_optimized_input_tokens = project_usage_daily.total_optimized_input_tokens + EXCLUDED.total_optimized_input_tokens,
      total_cost_usd = project_usage_daily.total_cost_usd + EXCLUDED.total_cost_usd,
      total_optimized_cost_usd = project_usage_daily.total_optimized_cost_usd + EXCLUDED.total_optimized_cost_usd,
      total_savings_usd = project_usage_daily.total_savings_usd + EXCLUDED.total_savings_usd,
      updated_at = now()
    `,
    [
      input.orgId,
      input.projectId,
      input.environment.slice(0, 128),
      Math.max(0, Math.floor(input.inputTokens)),
      Math.max(0, Math.floor(input.outputTokens)),
      Math.max(0, Math.floor(input.optimizedInputTokens)),
      input.estimatedCostUsd,
      input.optimizedCostUsd,
      input.estimatedSavingsUsd,
    ],
  );
}
