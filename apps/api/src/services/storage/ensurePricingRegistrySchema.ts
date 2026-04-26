/**
 * Idempotent DDL for persisted provider pricing snapshots (optional; falls back to bundled catalog).
 */

import { query } from "./db.js";
import { safeLog } from "../../utils/redaction.js";

export async function ensurePricingRegistrySchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS pricing_registry_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version TEXT NOT NULL,
        snapshot_json JSONB NOT NULL,
        ttl_seconds INT NOT NULL,
        source TEXT,
        ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_registry_ingested
      ON pricing_registry_snapshots (ingested_at DESC)
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS pricing_registry_overrides (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id TEXT,
        model_id TEXT NOT NULL,
        patch_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_pricing_overrides_org ON pricing_registry_overrides (org_id)
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_overrides_org_model
      ON pricing_registry_overrides (COALESCE(org_id, ''), model_id)
    `);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "ensurePricingRegistrySchema failed", { error: msg });
    throw e;
  }
}
