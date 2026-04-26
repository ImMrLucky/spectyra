import { query, queryOne } from "../storage/db.js";
import type { ProviderPricingSnapshot } from "./pricingTypes.js";

export interface PricingRegistryRow {
  snapshot: ProviderPricingSnapshot;
  ttlSeconds: number;
  ingestedAt: string;
}

export function tryParseProviderPricingSnapshot(v: unknown): ProviderPricingSnapshot | null {
  return isSnapshot(v) ? v : null;
}

function isSnapshot(v: unknown): v is ProviderPricingSnapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.version === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.currency === "string" &&
    typeof o.ttlSeconds === "number" &&
    Array.isArray(o.entries)
  );
}

/**
 * Latest ingested row wins. Used by machine + admin pricing routes.
 */
export async function getLatestPricingRegistrySnapshot(): Promise<PricingRegistryRow | null> {
  const row = await queryOne<{
    snapshot_json: unknown;
    ttl_seconds: string;
    ingested_at: string;
  }>(
    `
    SELECT snapshot_json, ttl_seconds::text, ingested_at::text
    FROM pricing_registry_snapshots
    ORDER BY ingested_at DESC
    LIMIT 1
    `,
    [],
  );
  if (!row) return null;
  const snap = row.snapshot_json;
  if (!isSnapshot(snap)) return null;
  return {
    snapshot: snap,
    ttlSeconds: parseInt(row.ttl_seconds, 10) || snap.ttlSeconds,
    ingestedAt: row.ingested_at,
  };
}

export async function insertPricingSnapshot(
  snapshot: ProviderPricingSnapshot,
  ttlSeconds?: number,
  source?: string,
): Promise<void> {
  const ttl = ttlSeconds ?? snapshot.ttlSeconds;
  await query(
    `INSERT INTO pricing_registry_snapshots (version, snapshot_json, ttl_seconds, source)
     VALUES ($1, $2::jsonb, $3, $4)`,
    [snapshot.version, JSON.stringify(snapshot), ttl, source ?? "ingest"],
  );
}

export interface PricingOverrideRow {
  id: string;
  org_id: string | null;
  model_id: string;
  patch_json: unknown;
  updated_at: string;
}

export async function listPricingOverrides(): Promise<PricingOverrideRow[]> {
  const r = await query<PricingOverrideRow>(
    `
    SELECT id::text, org_id, model_id, patch_json, updated_at::text
    FROM pricing_registry_overrides
    ORDER BY updated_at DESC
    `,
    [],
  );
  return r.rows;
}

export async function listPricingOverridesForOrg(orgId: string): Promise<PricingOverrideRow[]> {
  const r = await query<PricingOverrideRow>(
    `
    SELECT id::text, org_id, model_id, patch_json, updated_at::text
    FROM pricing_registry_overrides
    WHERE org_id IS NULL OR org_id = $1
    ORDER BY org_id NULLS LAST, model_id
    `,
    [orgId],
  );
  return r.rows;
}

export async function countPricingOverrides(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM pricing_registry_overrides`,
    [],
  );
  return parseInt(row?.n ?? "0", 10);
}

export async function upsertPricingOverride(
  orgId: string | null,
  modelId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (orgId == null) {
    await query(`DELETE FROM pricing_registry_overrides WHERE model_id = $1 AND org_id IS NULL`, [
      modelId,
    ]);
  } else {
    await query(`DELETE FROM pricing_registry_overrides WHERE model_id = $1 AND org_id = $2`, [
      modelId,
      orgId,
    ]);
  }
  await query(
    `
    INSERT INTO pricing_registry_overrides (org_id, model_id, patch_json)
    VALUES ($1, $2, $3::jsonb)
    `,
    [orgId, modelId, JSON.stringify(patch)],
  );
}

export async function deletePricingOverride(id: string): Promise<boolean> {
  const r = await query(`DELETE FROM pricing_registry_overrides WHERE id = $1::uuid`, [id]);
  return (r.rowCount ?? 0) > 0;
}
