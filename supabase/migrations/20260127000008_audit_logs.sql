-- Migration: Audit Logs (Phase 3)
-- Creates audit_logs table for enterprise security compliance

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Actor information
  actor_type TEXT NOT NULL CHECK (actor_type IN ('USER', 'API_KEY', 'SYSTEM')),
  actor_id TEXT NOT NULL, -- user_id (UUID) or api_key_id (UUID) or 'system'
  
  -- Action details
  action TEXT NOT NULL, -- e.g., LOGIN, LOGOUT, KEY_CREATED, KEY_REVOKED, SETTINGS_UPDATED, EXPORT_DATA, PROVIDER_KEY_SET, PROVIDER_KEY_REVOKED, RETENTION_APPLIED
  target_type TEXT NULL, -- e.g., 'API_KEY', 'ORG', 'PROJECT', 'PROVIDER_KEY'
  target_id TEXT NULL, -- ID of the target resource
  
  -- Request metadata
  ip INET NULL,
  user_agent TEXT NULL,
  
  -- Additional context
  metadata JSONB NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_audit_logs_org_created ON audit_logs(org_id, created_at DESC);
CREATE INDEX idx_audit_logs_project_created ON audit_logs(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action_created ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_type, actor_id, created_at DESC);

-- RLS Policies
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read audit logs for their orgs (OWNER/ADMIN only in practice, enforced by app)
CREATE POLICY "Users can read their org audit logs"
  ON audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = audit_logs.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (API uses service role)

COMMENT ON TABLE audit_logs IS 'Enterprise audit log for security compliance. Records all security-relevant actions.';
COMMENT ON COLUMN audit_logs.actor_type IS 'Type of actor: USER (Supabase JWT), API_KEY (machine auth), or SYSTEM (automated)';
COMMENT ON COLUMN audit_logs.action IS 'Action performed: LOGIN, LOGOUT, KEY_CREATED, KEY_REVOKED, SETTINGS_UPDATED, EXPORT_DATA, etc.';
COMMENT ON COLUMN audit_logs.metadata IS 'Additional context as JSON (e.g., changed fields, error details)';
