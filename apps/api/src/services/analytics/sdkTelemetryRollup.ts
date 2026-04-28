import { query, queryOne } from "../storage/db.js";
import { safeLog } from "../../utils/redaction.js";

export interface SdkTelemetryRollupRow {
  environment?: string;
  model?: string;
  calls: number;
  estimated_savings_usd: number;
  input_tokens_before: number;
  input_tokens_after: number;
  output_tokens: number;
  /** Weighted input reduction % for this row's bucket. */
  input_token_reduction_pct: number;
}

export interface SdkTelemetryOrgRollup {
  total_calls: number;
  total_estimated_savings_usd: number;
  total_input_tokens_before: number;
  total_input_tokens_after: number;
  total_output_tokens: number;
  /** Weighted across all ingested calls: Σ(before−after) / Σ(before). */
  overall_input_token_reduction_pct: number;
  avg_estimated_savings_usd_per_call: number;
  /** Sum of per-call messageTurnCount hints (conversation depth proxy). */
  aggregate_message_turns: number;
  aggregate_repeated_context_tokens_avoided: number;
  aggregate_repeated_tool_output_tokens_avoided: number;
  aggregate_compressible_units_hint: number;
  aggregate_transform_count: number;
  runs_with_stuck_loop_signal: number;
  by_environment: SdkTelemetryRollupRow[];
  by_model: SdkTelemetryRollupRow[];
}

export function emptySdkTelemetryOrgRollup(): SdkTelemetryOrgRollup {
  return {
    total_calls: 0,
    total_estimated_savings_usd: 0,
    total_input_tokens_before: 0,
    total_input_tokens_after: 0,
    total_output_tokens: 0,
    overall_input_token_reduction_pct: 0,
    avg_estimated_savings_usd_per_call: 0,
    aggregate_message_turns: 0,
    aggregate_repeated_context_tokens_avoided: 0,
    aggregate_repeated_tool_output_tokens_avoided: 0,
    aggregate_compressible_units_hint: 0,
    aggregate_transform_count: 0,
    runs_with_stuck_loop_signal: 0,
    by_environment: [],
    by_model: [],
  };
}

function parseRollupRow(r: {
  calls: string;
  savings: string | null;
  inp: string | null;
  opt: string | null;
  outp: string | null;
}): Omit<SdkTelemetryRollupRow, "environment" | "model"> {
  const calls = parseInt(r.calls, 10) || 0;
  const inp = parseFloat(r.inp || "0") || 0;
  const opt = parseFloat(r.opt || "0") || 0;
  const saved = Math.max(0, inp - opt);
  return {
    calls,
    estimated_savings_usd: parseFloat(r.savings || "0") || 0,
    input_tokens_before: inp,
    input_tokens_after: opt,
    output_tokens: parseFloat(r.outp || "0") || 0,
    input_token_reduction_pct: inp > 0 ? (100 * saved) / inp : 0,
  };
}

/**
 * Aggregates org-wide SDK POST /v1/telemetry/run rows for the analytics dashboard.
 */
export async function fetchSdkTelemetryOrgRollup(orgId: string): Promise<SdkTelemetryOrgRollup> {
  const empty = emptySdkTelemetryOrgRollup();
  try {
    const totals = await queryOne<{
      total_calls: string;
      savings: string | null;
      inp: string | null;
      opt: string | null;
      outp: string | null;
      msg_turns: string | null;
      rep_ctx: string | null;
      rep_tool: string | null;
      compr: string | null;
      transforms: string | null;
      stuck: string | null;
    }>(
      `
      SELECT
        COUNT(*)::text AS total_calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS savings,
        COALESCE(SUM(input_tokens), 0)::text AS inp,
        COALESCE(SUM(optimized_input_tokens), 0)::text AS opt,
        COALESCE(SUM(output_tokens), 0)::text AS outp,
        COALESCE(SUM(
          CASE
            WHEN jsonb_typeof(diagnostics->'messageTurnCount') = 'number'
              THEN (diagnostics->>'messageTurnCount')::double precision
            WHEN (diagnostics->>'messageTurnCount') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (diagnostics->>'messageTurnCount')::double precision
            ELSE 0
          END
        ), 0)::text AS msg_turns,
        COALESCE(SUM(
          CASE
            WHEN jsonb_typeof(diagnostics->'repeatedContextTokensAvoided') = 'number'
              THEN (diagnostics->>'repeatedContextTokensAvoided')::double precision
            WHEN (diagnostics->>'repeatedContextTokensAvoided') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (diagnostics->>'repeatedContextTokensAvoided')::double precision
            ELSE 0
          END
        ), 0)::text AS rep_ctx,
        COALESCE(SUM(
          CASE
            WHEN jsonb_typeof(diagnostics->'repeatedToolOutputTokensAvoided') = 'number'
              THEN (diagnostics->>'repeatedToolOutputTokensAvoided')::double precision
            WHEN (diagnostics->>'repeatedToolOutputTokensAvoided') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (diagnostics->>'repeatedToolOutputTokensAvoided')::double precision
            ELSE 0
          END
        ), 0)::text AS rep_tool,
        COALESCE(SUM(
          CASE
            WHEN jsonb_typeof(diagnostics->'compressibleUnitsHint') = 'number'
              THEN (diagnostics->>'compressibleUnitsHint')::double precision
            WHEN (diagnostics->>'compressibleUnitsHint') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (diagnostics->>'compressibleUnitsHint')::double precision
            ELSE 0
          END
        ), 0)::text AS compr,
        COALESCE(SUM(
          CASE
            WHEN jsonb_typeof(diagnostics->'transformCount') = 'number'
              THEN (diagnostics->>'transformCount')::double precision
            WHEN (diagnostics->>'transformCount') ~ '^[0-9]+(\\.[0-9]+)?$'
              THEN (diagnostics->>'transformCount')::double precision
            ELSE 0
          END
        ), 0)::text AS transforms,
        COALESCE(SUM(
          CASE
            WHEN COALESCE(diagnostics#>>'{flow,isStuckLoop}', 'false') IN ('true', '1')
              THEN 1 ELSE 0
          END
        ), 0)::text AS stuck
      FROM sdk_run_telemetry
      WHERE org_id::text = $1
      `,
      [orgId],
    );

    if (!totals || (parseInt(totals.total_calls, 10) || 0) === 0) {
      return empty;
    }

    const tc = parseInt(totals.total_calls, 10) || 0;
    const inp = parseFloat(totals.inp || "0") || 0;
    const opt = parseFloat(totals.opt || "0") || 0;
    const saved = Math.max(0, inp - opt);
    const savings = parseFloat(totals.savings || "0") || 0;

    const byEnv = await query<{
      environment: string;
      calls: string;
      savings: string | null;
      inp: string | null;
      opt: string | null;
      outp: string | null;
    }>(
      `
      SELECT environment,
        COUNT(*)::text AS calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS savings,
        COALESCE(SUM(input_tokens), 0)::text AS inp,
        COALESCE(SUM(optimized_input_tokens), 0)::text AS opt,
        COALESCE(SUM(output_tokens), 0)::text AS outp
      FROM sdk_run_telemetry
      WHERE org_id::text = $1
      GROUP BY environment
      ORDER BY COUNT(*) DESC
      LIMIT 50
      `,
      [orgId],
    );

    const byModel = await query<{
      model: string;
      calls: string;
      savings: string | null;
      inp: string | null;
      opt: string | null;
      outp: string | null;
    }>(
      `
      SELECT model,
        COUNT(*)::text AS calls,
        COALESCE(SUM(estimated_savings_usd), 0)::text AS savings,
        COALESCE(SUM(input_tokens), 0)::text AS inp,
        COALESCE(SUM(optimized_input_tokens), 0)::text AS opt,
        COALESCE(SUM(output_tokens), 0)::text AS outp
      FROM sdk_run_telemetry
      WHERE org_id::text = $1
      GROUP BY model
      ORDER BY COUNT(*) DESC
      LIMIT 40
      `,
      [orgId],
    );

    return {
      total_calls: tc,
      total_estimated_savings_usd: savings,
      total_input_tokens_before: inp,
      total_input_tokens_after: opt,
      total_output_tokens: parseFloat(totals.outp || "0") || 0,
      overall_input_token_reduction_pct: inp > 0 ? (100 * saved) / inp : 0,
      avg_estimated_savings_usd_per_call: tc > 0 ? savings / tc : 0,
      aggregate_message_turns: parseFloat(totals.msg_turns || "0") || 0,
      aggregate_repeated_context_tokens_avoided: parseFloat(totals.rep_ctx || "0") || 0,
      aggregate_repeated_tool_output_tokens_avoided: parseFloat(totals.rep_tool || "0") || 0,
      aggregate_compressible_units_hint: parseFloat(totals.compr || "0") || 0,
      aggregate_transform_count: parseFloat(totals.transforms || "0") || 0,
      runs_with_stuck_loop_signal: parseInt(totals.stuck || "0", 10) || 0,
      by_environment: byEnv.rows.map((r) => ({
        environment: r.environment,
        ...parseRollupRow(r),
      })),
      by_model: byModel.rows.map((r) => ({
        model: r.model,
        ...parseRollupRow(r),
      })),
    };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|relation.*sdk_run_telemetry/i.test(msg)) {
      safeLog("warn", "sdk telemetry rollup: table missing", {});
      return empty;
    }
    safeLog("warn", "sdk telemetry rollup failed", { error: msg });
    return empty;
  }
}
