/**
 * Idempotent DDL for company SDK telemetry + daily rollups (see supabase migration).
 */

import { query } from "./db.js";
import { safeLog } from "../../utils/redaction.js";

export async function ensureSdkTelemetrySchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS sdk_run_telemetry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        environment TEXT NOT NULL DEFAULT 'production',
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        optimized_input_tokens INTEGER NOT NULL,
        estimated_cost_usd NUMERIC(14, 6) NOT NULL DEFAULT 0,
        optimized_cost_usd NUMERIC(14, 6) NOT NULL DEFAULT 0,
        estimated_savings_usd NUMERIC(14, 6) NOT NULL DEFAULT 0,
        api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sdk_run_telemetry_org_created
        ON sdk_run_telemetry (org_id, created_at DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sdk_run_telemetry_project_env
        ON sdk_run_telemetry (project_id, environment, created_at DESC)
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS project_usage_daily (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
        project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        environment TEXT NOT NULL DEFAULT 'production',
        usage_date DATE NOT NULL,
        total_calls INTEGER NOT NULL DEFAULT 0,
        total_input_tokens BIGINT NOT NULL DEFAULT 0,
        total_output_tokens BIGINT NOT NULL DEFAULT 0,
        total_optimized_input_tokens BIGINT NOT NULL DEFAULT 0,
        total_cost_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
        total_optimized_cost_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
        total_savings_usd NUMERIC(18, 6) NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (org_id, project_id, environment, usage_date)
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_project_usage_daily_org_date
        ON project_usage_daily (org_id, usage_date DESC)
    `);

    console.log("✅ SDK telemetry schema ensured");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "ensureSdkTelemetrySchema failed", { error: msg });
    throw e;
  }
}
