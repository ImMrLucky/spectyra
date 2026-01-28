-- Migration: Enterprise Settings (Phase 1)
-- Creates org_settings and project_settings tables for enterprise security controls

-- ============================================================================
-- ORGANIZATION SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_settings (
  org_id UUID PRIMARY KEY REFERENCES orgs(id) ON DELETE CASCADE,
  
  -- Data retention and storage controls
  data_retention_days INTEGER NOT NULL DEFAULT 30,
  store_prompts BOOLEAN NOT NULL DEFAULT false,
  store_responses BOOLEAN NOT NULL DEFAULT false,
  store_internal_debug BOOLEAN NOT NULL DEFAULT false,
  
  -- Feature toggles
  allow_semantic_cache BOOLEAN NOT NULL DEFAULT true,
  
  -- Security controls
  allowed_ip_ranges TEXT[] NULL,
  enforce_sso BOOLEAN NOT NULL DEFAULT false,
  allowed_email_domains TEXT[] NULL,
  
  -- Provider key mode (BYOK controls)
  provider_key_mode TEXT NOT NULL DEFAULT 'EITHER' 
    CHECK (provider_key_mode IN ('BYOK_ONLY', 'VAULT_ONLY', 'EITHER')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_settings_org_id ON org_settings(org_id);

-- ============================================================================
-- PROJECT SETTINGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS project_settings (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  
  -- CORS and origin controls (for SDK browser usage)
  allowed_origins TEXT[] NULL,
  
  -- Rate limiting
  rate_limit_rps INTEGER NOT NULL DEFAULT 20,
  rate_limit_burst INTEGER NOT NULL DEFAULT 40,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_settings_project_id ON project_settings(project_id);

-- ============================================================================
-- TRIGGERS: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_org_settings_updated_at
  BEFORE UPDATE ON org_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_settings_updated_at
  BEFORE UPDATE ON project_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;

-- Users can read settings for their orgs
CREATE POLICY "Users can read their org settings"
  ON org_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = org_settings.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Users can read settings for their projects
CREATE POLICY "Users can read their project settings"
  ON project_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      JOIN org_memberships om ON om.org_id = p.org_id
      WHERE p.id = project_settings.project_id
      AND om.user_id = auth.uid()
    )
  );

-- Service role bypasses RLS (API uses service role)

-- ============================================================================
-- INITIALIZE SETTINGS FOR EXISTING ORGS
-- ============================================================================

-- Create default settings for existing orgs
INSERT INTO org_settings (org_id)
SELECT id FROM orgs
WHERE id NOT IN (SELECT org_id FROM org_settings)
ON CONFLICT (org_id) DO NOTHING;

-- Create default settings for existing projects
INSERT INTO project_settings (project_id)
SELECT id FROM projects
WHERE id NOT IN (SELECT project_id FROM project_settings)
ON CONFLICT (project_id) DO NOTHING;
