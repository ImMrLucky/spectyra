-- Persisted pricing catalog (optional). API prefers latest row over bundled fallback.
-- Apply via your migration runner or rely on `ensurePricingRegistrySchema()` at API startup.

CREATE TABLE IF NOT EXISTS pricing_registry_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  snapshot_json JSONB NOT NULL,
  ttl_seconds INT NOT NULL,
  source TEXT,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_registry_ingested
  ON pricing_registry_snapshots (ingested_at DESC);

CREATE TABLE IF NOT EXISTS pricing_registry_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT,
  model_id TEXT NOT NULL,
  patch_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_overrides_org ON pricing_registry_overrides (org_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pricing_overrides_org_model
  ON pricing_registry_overrides (COALESCE(org_id, ''), model_id);
