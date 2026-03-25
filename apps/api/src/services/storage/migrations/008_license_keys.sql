-- Migration 008: License Keys
-- Offline-capable license keys for Desktop App and Local Companion.
-- Separate from API keys: these validate entitlement status without
-- requiring network access on every launch.

CREATE TABLE IF NOT EXISTS license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_validated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_license_keys_org_id ON license_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_prefix ON license_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_license_keys_active
  ON license_keys(org_id) WHERE revoked_at IS NULL;

-- Track optimized-run usage per billing period for entitlement enforcement.
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS optimized_runs_used INTEGER DEFAULT 0;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS optimized_runs_limit INTEGER DEFAULT 100;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ DEFAULT now();
