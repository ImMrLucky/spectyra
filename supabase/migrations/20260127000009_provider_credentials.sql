-- Migration: Provider Credentials (Phase 4)
-- Creates provider_credentials table with encrypted storage for BYOK mode

CREATE TABLE IF NOT EXISTS provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Provider information
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'anthropic', 'google', 'azure', 'aws')),
  
  -- Encrypted key storage (envelope encryption)
  key_ciphertext TEXT NOT NULL, -- JSON: {iv, ciphertext, tag, kid}
  key_kid TEXT NOT NULL, -- Key ID for rotation
  key_fingerprint TEXT NOT NULL, -- SHA256(last6 + org_id + salt) for audit
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  
  -- Enforce one active key per provider per scope
  CONSTRAINT unique_active_provider_credential 
    UNIQUE NULLS NOT DISTINCT (org_id, project_id, provider, revoked_at)
);

-- Indexes
CREATE INDEX idx_provider_credentials_org ON provider_credentials(org_id, provider, revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_provider_credentials_project ON provider_credentials(project_id, provider, revoked_at) WHERE project_id IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX idx_provider_credentials_fingerprint ON provider_credentials(key_fingerprint);

-- RLS Policies
ALTER TABLE provider_credentials ENABLE ROW LEVEL SECURITY;

-- Users can read provider credentials for their orgs (OWNER/ADMIN only in practice)
CREATE POLICY "Users can read their org provider credentials"
  ON provider_credentials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = provider_credentials.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (API uses service role)

COMMENT ON TABLE provider_credentials IS 'Encrypted storage for provider API keys (BYOK mode). Keys are encrypted at rest using envelope encryption.';
COMMENT ON COLUMN provider_credentials.key_ciphertext IS 'AES-256-GCM encrypted key: JSON {iv, ciphertext, tag, kid}';
COMMENT ON COLUMN provider_credentials.key_kid IS 'Key ID for rotation (references master key used for encryption)';
COMMENT ON COLUMN provider_credentials.key_fingerprint IS 'SHA256(last6 + org_id + salt) for audit trail without exposing key';
