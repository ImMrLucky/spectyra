-- Add universal mode and security posture fields to runs table.
-- These columns align with @spectyra/core-types for consistent reporting.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_mode TEXT DEFAULT 'on';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS integration_type TEXT DEFAULT 'legacy-remote-gateway';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS telemetry_mode TEXT DEFAULT 'local';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS prompt_snapshot_mode TEXT DEFAULT 'local_only';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS inference_path TEXT DEFAULT 'direct_provider';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS provider_billing_owner TEXT DEFAULT 'customer';
