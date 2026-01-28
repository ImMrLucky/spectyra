-- Migration: API Keys Hardening (Phase 2)
-- Adds restrictions and expiration to API keys

ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS allowed_ip_ranges TEXT[] NULL,
ADD COLUMN IF NOT EXISTS allowed_origins TEXT[] NULL,
ADD COLUMN IF NOT EXISTS description TEXT NULL;

-- Index for expired key filtering
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Update getApiKeyByPrefix to exclude expired keys
-- (This is handled in application code, but index helps)

COMMENT ON COLUMN api_keys.expires_at IS 'Key expiration timestamp. NULL means never expires.';
COMMENT ON COLUMN api_keys.allowed_ip_ranges IS 'CIDR ranges allowed to use this key. NULL means no IP restriction.';
COMMENT ON COLUMN api_keys.allowed_origins IS 'CORS origins allowed for browser SDK usage. NULL means no origin restriction.';
COMMENT ON COLUMN api_keys.description IS 'Human-readable description of key purpose.';
