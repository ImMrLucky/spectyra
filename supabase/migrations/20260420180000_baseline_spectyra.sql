-- Spectyra database baseline (squashed).
-- Replaces historical incremental migrations with one apply for new environments.
-- For existing production DBs: prefer a schema diff / manual review rather than re-applying from empty.
--
-- Includes: core multi-tenant schema, billing columns, enterprise settings, SDK telemetry,
-- anonymous usage, platform_roles, license keys, RLS policies, and optional auth.users bootstrap.

-- Migration: Initial Postgres Schema for Spectyra
-- Replaces SQLite schema with Postgres + RLS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for hashing (we'll use argon2 via Node.js, but keep for compatibility)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ORGANIZATIONS & MEMBERSHIPS
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due'))
);

CREATE INDEX idx_orgs_stripe_customer_id ON orgs(stripe_customer_id);
CREATE INDEX idx_orgs_created_at ON orgs(created_at DESC);

-- Organization memberships (links Supabase auth users to orgs)
CREATE TABLE IF NOT EXISTS org_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Supabase auth.users.id
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'DEV', 'VIEWER', 'BILLING')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX idx_org_memberships_org_id ON org_memberships(org_id);
CREATE INDEX idx_org_memberships_user_id ON org_memberships(user_id);
CREATE INDEX idx_org_memberships_role ON org_memberships(role);

-- ============================================================================
-- PROJECTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_org_id ON projects(org_id);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- ============================================================================
-- API KEYS (Machine Auth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL, -- First 8 chars for fast lookup
  key_hash TEXT NOT NULL, -- argon2id hash (stored as text)
  scopes TEXT[] NOT NULL DEFAULT '{}', -- Array of scope strings
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  UNIQUE(key_prefix)
);

CREATE INDEX idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_revoked ON api_keys(revoked_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at DESC);

-- ============================================================================
-- REPLAYS (groups baseline + optimized runs)
-- ============================================================================

CREATE TABLE IF NOT EXISTS replays (
  replay_id TEXT PRIMARY KEY,
  scenario_id TEXT,
  workload_key TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('talk', 'code')),
  optimization_level INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  baseline_run_id TEXT NOT NULL, -- References runs.id
  optimized_run_id TEXT NOT NULL, -- References runs.id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_replays_created_at ON replays(created_at DESC);
CREATE INDEX idx_replays_workload_key ON replays(workload_key);
CREATE INDEX idx_replays_path_level ON replays(path, optimization_level);
CREATE INDEX idx_replays_scenario_id ON replays(scenario_id);

-- ============================================================================
-- RUNS (individual LLM API calls)
-- ============================================================================

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  conversation_id TEXT,
  replay_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('baseline', 'optimized')),
  path TEXT NOT NULL CHECK (path IN ('talk', 'code')),
  optimization_level INTEGER DEFAULT 2 CHECK (optimization_level BETWEEN 0 AND 4),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  workload_key TEXT,
  prompt_hash TEXT,
  prompt_final TEXT,
  response_text TEXT NOT NULL,
  usage_input_tokens INTEGER NOT NULL,
  usage_output_tokens INTEGER NOT NULL,
  usage_total_tokens INTEGER NOT NULL,
  usage_estimated INTEGER DEFAULT 0,
  cost_usd REAL NOT NULL,
  savings_tokens_saved INTEGER,
  savings_pct_saved REAL,
  savings_cost_saved_usd REAL,
  quality_pass INTEGER DEFAULT 0,
  quality_failures TEXT,
  is_shadow INTEGER DEFAULT 0,
  debug_refs_used TEXT,
  debug_delta_used INTEGER DEFAULT 0,
  debug_code_sliced INTEGER DEFAULT 0,
  debug_patch_mode INTEGER DEFAULT 0,
  debug_retry INTEGER DEFAULT 0,
  debug_spectral_n_nodes INTEGER,
  debug_spectral_n_edges INTEGER,
  debug_spectral_stability_index REAL,
  debug_spectral_lambda2 REAL,
  debug_spectral_contradiction_energy REAL,
  debug_spectral_stable_unit_ids TEXT,
  debug_spectral_unstable_unit_ids TEXT,
  debug_spectral_recommendation TEXT,
  debug_internal_json TEXT,
  -- Org/Project tracking
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  provider_key_fingerprint TEXT, -- SHA256(last6 + org_id + salt) for audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_runs_scenario ON runs(scenario_id);
CREATE INDEX idx_runs_conversation ON runs(conversation_id);
CREATE INDEX idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX idx_runs_replay_id ON runs(replay_id);
CREATE INDEX idx_runs_path_level ON runs(path, optimization_level);
CREATE INDEX idx_runs_workload_key ON runs(workload_key);
CREATE INDEX idx_runs_mode_shadow ON runs(mode, is_shadow);
CREATE INDEX idx_runs_org_id ON runs(org_id, created_at DESC);
CREATE INDEX idx_runs_project_id ON runs(project_id, created_at DESC);
CREATE INDEX idx_runs_provider_model ON runs(provider, model);

-- ============================================================================
-- SAVINGS LEDGER (customer-facing accounting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS savings_ledger (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  savings_type TEXT NOT NULL CHECK (savings_type IN ('verified', 'shadow_verified', 'estimated')),
  workload_key TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('talk', 'code')),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  optimization_level INTEGER NOT NULL CHECK (optimization_level BETWEEN 0 AND 4),
  baseline_tokens REAL NOT NULL,
  optimized_tokens REAL NOT NULL,
  tokens_saved REAL NOT NULL,
  pct_saved REAL NOT NULL,
  baseline_cost_usd REAL NOT NULL,
  optimized_cost_usd REAL NOT NULL,
  cost_saved_usd REAL NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  replay_id TEXT,
  optimized_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  baseline_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  -- Org/Project tracking
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_ledger_created_at ON savings_ledger(created_at DESC);
CREATE INDEX idx_ledger_type ON savings_ledger(savings_type);
CREATE INDEX idx_ledger_path_level ON savings_ledger(path, optimization_level);
CREATE INDEX idx_ledger_provider_model ON savings_ledger(provider, model);
CREATE INDEX idx_ledger_workload_key ON savings_ledger(workload_key);
CREATE INDEX idx_ledger_org_id ON savings_ledger(org_id, created_at DESC);
CREATE INDEX idx_ledger_project_id ON savings_ledger(project_id, created_at DESC);

-- ============================================================================
-- BASELINE SAMPLES (Welford aggregation per workload_key)
-- ============================================================================

CREATE TABLE IF NOT EXISTS baseline_samples (
  workload_key TEXT PRIMARY KEY,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  n INTEGER NOT NULL DEFAULT 0,
  mean_total_tokens REAL NOT NULL DEFAULT 0,
  var_total_tokens REAL NOT NULL DEFAULT 0,
  mean_cost_usd REAL NOT NULL DEFAULT 0,
  var_cost_usd REAL NOT NULL DEFAULT 0,
  M2_tokens REAL NOT NULL DEFAULT 0,
  M2_cost REAL NOT NULL DEFAULT 0,
  -- Org/Project tracking (optional, for multi-tenant baseline tracking)
  org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX idx_baseline_samples_updated ON baseline_samples(updated_at DESC);
CREATE INDEX idx_baseline_samples_org_id ON baseline_samples(org_id);
CREATE INDEX idx_baseline_samples_project_id ON baseline_samples(project_id);

-- ============================================================================
-- CONVERSATION STATE (for multi-turn conversations)
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_state (
  conversation_id TEXT PRIMARY KEY,
  path TEXT NOT NULL CHECK (path IN ('talk', 'code')),
  units TEXT NOT NULL, -- JSON array of SemanticUnit
  last_turn INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversation_state_updated_at ON conversation_state(updated_at DESC);

-- Migration: Enable Row Level Security (RLS) and Policies
-- Enforces org membership-based access control

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE replays ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Check if user is member of org
-- ============================================================================

CREATE OR REPLACE FUNCTION is_org_member(p_user_id UUID, p_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_memberships
    WHERE user_id = p_user_id AND org_id = p_org_id
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================================
-- RLS POLICIES: Organizations
-- ============================================================================

-- Users can read orgs they are members of
CREATE POLICY "Users can read their orgs"
  ON orgs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = orgs.id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Service role can do everything (API uses service role)
-- No policy needed - service role bypasses RLS

-- ============================================================================
-- RLS POLICIES: Org Memberships
-- ============================================================================

-- Users can read their own memberships
CREATE POLICY "Users can read their memberships"
  ON org_memberships FOR SELECT
  USING (user_id = auth.uid());

-- Users can read memberships in orgs they belong to
CREATE POLICY "Users can read org memberships"
  ON org_memberships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships om
      WHERE om.org_id = org_memberships.org_id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Projects
-- ============================================================================

-- Users can read projects in orgs they are members of
CREATE POLICY "Users can read their org projects"
  ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = projects.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: API Keys
-- ============================================================================

-- Users can read API keys in orgs they are members of
CREATE POLICY "Users can read their org API keys"
  ON api_keys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = api_keys.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Runs
-- ============================================================================

-- Users can read runs in orgs they are members of
CREATE POLICY "Users can read their org runs"
  ON runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = runs.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Savings Ledger
-- ============================================================================

-- Users can read savings ledger in orgs they are members of
CREATE POLICY "Users can read their org savings"
  ON savings_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = savings_ledger.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Baseline Samples
-- ============================================================================

-- Users can read baseline samples in orgs they are members of
CREATE POLICY "Users can read their org baseline samples"
  ON baseline_samples FOR SELECT
  USING (
    org_id IS NULL OR EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = baseline_samples.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- ============================================================================
-- RLS POLICIES: Replays
-- ============================================================================

-- Users can read replays if they can read the associated runs
-- (Replays don't have org_id directly, so we check via runs)
CREATE POLICY "Users can read replays via runs"
  ON replays FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM runs
      WHERE runs.replay_id = replays.replay_id
      AND EXISTS (
        SELECT 1 FROM org_memberships
        WHERE org_memberships.org_id = runs.org_id
        AND org_memberships.user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- RLS POLICIES: Conversation State
-- ============================================================================

-- Conversation state is org-agnostic for now
-- Allow all authenticated users to read (can be scoped later if needed)
CREATE POLICY "Users can read conversation state"
  ON conversation_state FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- NOTE: Service Role Bypass
-- ============================================================================
-- The API uses Supabase Service Role key which bypasses RLS.
-- This is intentional - the API enforces access control at the application level
-- using the JWT claims and org membership checks in middleware.
-- RLS provides defense-in-depth and allows direct Supabase client access if needed.

-- Migration: Agent Runs and Events
-- Supports SDK-first agentic integration with telemetry

-- ============================================================================
-- AGENT RUNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY, -- Use text run_id from SDK (UUID format)
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT NOT NULL,
  max_budget_usd REAL NOT NULL,
  allowed_tools TEXT[] NOT NULL DEFAULT '{}',
  permission_mode TEXT NOT NULL,
  prompt_meta JSONB,
  reasons TEXT[] NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_agent_runs_org_created ON agent_runs(org_id, created_at DESC);
CREATE INDEX idx_agent_runs_project_created ON agent_runs(project_id, created_at DESC) WHERE project_id IS NOT NULL;

-- ============================================================================
-- AGENT EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event JSONB NOT NULL
);

CREATE INDEX idx_agent_events_run_created ON agent_events(run_id, created_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- Users can read agent runs for their orgs
CREATE POLICY "Users can read their org agent runs"
  ON agent_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM org_memberships
      WHERE org_memberships.org_id = agent_runs.org_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Users can read agent events for their org runs
CREATE POLICY "Users can read their org agent events"
  ON agent_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM agent_runs
      JOIN org_memberships ON org_memberships.org_id = agent_runs.org_id
      WHERE agent_runs.id = agent_events.run_id
      AND org_memberships.user_id = auth.uid()
    )
  );

-- Service role can do everything (API uses service role)
-- No policy needed - service role bypasses RLS

-- Migration: Bootstrap existing Supabase users
-- Creates orgs and memberships for users who were created before bootstrap flow
-- 
-- This migration:
-- 1. Finds all users in auth.users without org_memberships
-- 2. Creates an org for each user (named after their email)
-- 3. Creates a default project
-- 4. Creates org_membership linking user to org as OWNER
--
-- NOTE: This does NOT create API keys. Users must create API keys via /v1/auth/api-keys endpoint
-- after this migration runs.

DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  new_project_id UUID;
  user_count INTEGER := 0;
BEGIN
  -- Loop through all users without org memberships
  FOR user_record IN 
    SELECT 
      id, 
      email,
      COALESCE(
        raw_user_meta_data->>'name',
        raw_user_meta_data->>'full_name',
        email,
        'User ' || id::text
      ) as display_name
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM org_memberships)
  LOOP
    -- Create org (included-usage model: active, no calendar trial)
    INSERT INTO orgs (name, trial_ends_at, subscription_status)
    VALUES (
      COALESCE(user_record.display_name, user_record.email, 'User ' || user_record.id::text),
      NULL,
      'active'
    )
    RETURNING id INTO new_org_id;
    
    -- Create default project
    INSERT INTO projects (org_id, name)
    VALUES (new_org_id, 'Default Project')
    RETURNING id INTO new_project_id;
    
    -- Create membership as OWNER
    INSERT INTO org_memberships (org_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'OWNER')
    ON CONFLICT (org_id, user_id) DO NOTHING; -- Safety check
    
    user_count := user_count + 1;
    
    RAISE NOTICE 'Bootstrapped user % (%) with org %', 
      user_record.email, 
      user_record.id, 
      new_org_id;
  END LOOP;
  
  RAISE NOTICE 'Migration complete: Bootstrapped % users', user_count;
END $$;

-- Verify migration
SELECT 
  COUNT(*) as total_users,
  COUNT(DISTINCT om.user_id) as users_with_orgs,
  COUNT(*) - COUNT(DISTINCT om.user_id) as users_without_orgs
FROM auth.users u
LEFT JOIN org_memberships om ON om.user_id = u.id;

-- Migration: SDK Access Control
-- Adds SDK access control to organizations

-- Add SDK access flag to orgs table
ALTER TABLE orgs 
ADD COLUMN IF NOT EXISTS sdk_access_enabled BOOLEAN NOT NULL DEFAULT true;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_orgs_sdk_access ON orgs(sdk_access_enabled) WHERE sdk_access_enabled = true;

-- Add comment
COMMENT ON COLUMN orgs.sdk_access_enabled IS 'Controls whether this organization can use the SDK (agent endpoints)';

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

-- Lightweight savings breakdown columns for runs
-- Allows UI to show "Refpack saved X, PhraseBook saved Y, CodeMap saved Z"
-- without storing full prompt_final, response_text, or debug_internal_json.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_saved INTEGER;

ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_saved INTEGER;

ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_saved INTEGER;

COMMENT ON COLUMN runs.refpack_tokens_saved IS 'Lightweight: tokens saved by RefPack (no full prompt storage needed)';
COMMENT ON COLUMN runs.phrasebook_tokens_saved IS 'Lightweight: tokens saved by PhraseBook';
COMMENT ON COLUMN runs.codemap_tokens_saved IS 'Lightweight: tokens saved by CodeMap';

-- Monthly entitlement: track Stripe subscription id, current period end, and cancel-at-period-end.
-- Access to Spectyra savings continues until subscription_current_period_end (30-day billing cycle),
-- including after the user schedules cancel or pause in Stripe — we never delete the org.

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orgs.stripe_subscription_id IS 'Stripe subscription id (sub_...)';
COMMENT ON COLUMN orgs.subscription_current_period_end IS 'End of current paid period; savings active while now() < this (and status allows)';
COMMENT ON COLUMN orgs.cancel_at_period_end IS 'True when user canceled in Stripe but still has access until period end';

ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_subscription_status_check;
ALTER TABLE orgs ADD CONSTRAINT orgs_subscription_status_check
  CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due', 'paused'));

-- Account access flags (admin pause / self-service observe-only in cloud API)
-- Paused users: JWT still valid; GET routes work; mutating requests return 403 (see API middleware).

CREATE TABLE IF NOT EXISTS user_account_flags (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_state TEXT NOT NULL DEFAULT 'active' CHECK (access_state IN ('active', 'paused')),
  paused_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_account_flags_state ON user_account_flags (access_state);

COMMENT ON TABLE user_account_flags IS 'Cloud dashboard account state; paused = read-only API (Observe) for JWT users.';

-- Grace period: full app/savings access until this timestamp after admin "pause" (then read-only Observe).
ALTER TABLE user_account_flags
  ADD COLUMN IF NOT EXISTS pause_savings_until TIMESTAMPTZ;

COMMENT ON COLUMN user_account_flags.pause_savings_until IS
  'While paused: user keeps full API access until this time (typically paused_at + 30 days); Stripe billing paused separately.';

-- Best-effort backfill for rows paused before this column existed
UPDATE user_account_flags
SET pause_savings_until = paused_at + interval '30 days'
WHERE access_state = 'paused'
  AND paused_at IS NOT NULL
  AND pause_savings_until IS NULL;

-- Per-organization cap on distinct users (rows in org_memberships).
-- Backfill so existing orgs are not below current membership count.

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS seat_limit INTEGER;

UPDATE orgs o
SET seat_limit = GREATEST(
  5,
  COALESCE(
    (SELECT count(*)::int FROM org_memberships m WHERE m.org_id = o.id),
    0
  )
)
WHERE seat_limit IS NULL;

ALTER TABLE orgs ALTER COLUMN seat_limit SET NOT NULL;
ALTER TABLE orgs ALTER COLUMN seat_limit SET DEFAULT 5;

ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_seat_limit_check;
ALTER TABLE orgs ADD CONSTRAINT orgs_seat_limit_check CHECK (seat_limit >= 1);

COMMENT ON COLUMN orgs.seat_limit IS 'Max users (org_memberships rows) for this org; Stripe subscription quantity updates this when set.';

-- Enforce cap for any insert path (API, scripts, or future Supabase policies).
CREATE OR REPLACE FUNCTION org_memberships_enforce_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  lim INTEGER;
  cnt INTEGER;
BEGIN
  SELECT seat_limit INTO lim FROM orgs WHERE id = NEW.org_id FOR UPDATE;
  IF lim IS NULL THEN
    lim := 5;
  END IF;
  SELECT count(*)::int INTO cnt FROM org_memberships WHERE org_id = NEW.org_id;
  IF cnt >= lim THEN
    RAISE EXCEPTION 'Seat limit reached for this organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS org_memberships_check_seat_limit ON org_memberships;
CREATE TRIGGER org_memberships_check_seat_limit
  BEFORE INSERT ON org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION org_memberships_enforce_seat_limit();

-- Superuser tri-state: NULL = billing-driven observe vs full savings; TRUE = force observe; FALSE = force real savings (comp).
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS observe_only_override BOOLEAN;

COMMENT ON COLUMN orgs.observe_only_override IS 'NULL: use trial/subscription; TRUE: Observe-only savings; FALSE: real savings (superuser comp).';

-- Attribution on runs (API key + optional human email when JWT present on same request path).
ALTER TABLE runs ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS account_email TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_api_key_id ON runs(api_key_id) WHERE api_key_id IS NOT NULL;

COMMENT ON COLUMN runs.api_key_id IS 'Spectyra API key used for this run (machine auth).';
COMMENT ON COLUMN runs.account_email IS 'Human account email when available (e.g. paired JWT or admin attribution).';

-- Admin "inactive": Observe-only real savings without JWT read-only (see API userAccountRepo).
ALTER TABLE user_account_flags DROP CONSTRAINT IF EXISTS user_account_flags_access_state_check;
ALTER TABLE user_account_flags
  ADD CONSTRAINT user_account_flags_access_state_check
  CHECK (access_state IN ('active', 'paused', 'inactive'));

-- Anonymous OpenClaw / local-companion usage (no auth.users linkage).

CREATE TABLE IF NOT EXISTS anonymous_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  app_version TEXT,
  platform TEXT,
  source TEXT DEFAULT 'openclaw',
  notes JSONB
);

CREATE INDEX IF NOT EXISTS idx_anonymous_installations_last_seen ON anonymous_installations(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS anonymous_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  app_version TEXT,
  properties JSONB
);

CREATE INDEX IF NOT EXISTS idx_anonymous_usage_events_installation ON anonymous_usage_events(installation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_events_name ON anonymous_usage_events(event_name, created_at DESC);

-- SDK company telemetry (per LLM call) + daily aggregation for project / environment dashboards.
-- Complements legacy `runs` (studio) without requiring NOT NULL studio columns.

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
);

CREATE INDEX IF NOT EXISTS idx_sdk_run_telemetry_org_created
  ON sdk_run_telemetry (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sdk_run_telemetry_project_env
  ON sdk_run_telemetry (project_id, environment, created_at DESC);

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
);

CREATE INDEX IF NOT EXISTS idx_project_usage_daily_org_date
  ON project_usage_daily (org_id, usage_date DESC);

-- --- from apps/api storage migrations (Postgres; inlined for baseline) ---

CREATE TABLE IF NOT EXISTS platform_roles (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('superuser', 'admin', 'exempt')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by_email TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_roles_role ON platform_roles(role);

INSERT INTO platform_roles (email, role, created_by_email)
VALUES ('gkh1974@gmail.com', 'superuser', 'migration_bootstrap')
ON CONFLICT (email) DO NOTHING;

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS platform_exempt BOOLEAN NOT NULL DEFAULT false;

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

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS optimized_runs_used INTEGER DEFAULT 0;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS optimized_runs_limit INTEGER DEFAULT 100;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ DEFAULT now();

ALTER TABLE runs ADD COLUMN IF NOT EXISTS run_mode TEXT DEFAULT 'on';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS integration_type TEXT DEFAULT 'legacy-remote-gateway';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS telemetry_mode TEXT DEFAULT 'local';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS prompt_snapshot_mode TEXT DEFAULT 'local_only';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS inference_path TEXT DEFAULT 'direct_provider';
ALTER TABLE runs ADD COLUMN IF NOT EXISTS provider_billing_owner TEXT DEFAULT 'customer';

CREATE TABLE IF NOT EXISTS analytics_sessions_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  sync_state TEXT NOT NULL DEFAULT 'synced',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_sessions_org_id ON analytics_sessions_sync(org_id);
CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created ON analytics_sessions_sync(org_id, created_at DESC);

UPDATE orgs SET optimized_runs_limit = NULL WHERE optimized_runs_limit IS NOT NULL;
ALTER TABLE orgs ALTER COLUMN optimized_runs_limit DROP DEFAULT;
ALTER TABLE orgs ALTER COLUMN optimized_runs_limit SET DEFAULT NULL;

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_admin_observe_lock_user_id UUID;

COMMENT ON COLUMN orgs.billing_admin_observe_lock_user_id IS
  'When set, observe_only_override was applied by admin inactive for this user; cleared when user is reactivated.';

-- One-time data migration: legacy trial / odd billing states → included-usage model (active, no trial end),
-- and ensure the platform superuser keeps full access (JWT + API-key org).
--
-- Prerequisites: Supabase Postgres where `auth.users` exists (standard Spectyra deploy).
-- If you use a standalone Postgres clone without `auth`, run steps (1) and (3) only, then set
-- `orgs.platform_exempt = true` manually for the superuser’s org UUID.
--
-- Does NOT change rows that already have `stripe_subscription_id` set (real or test Stripe subs).

-- 1) Platform role: superuser console + JWT billing bypass (see apps/api/src/middleware/auth.ts billingAccessOpts)
INSERT INTO platform_roles (email, role, created_by_email)
VALUES ('gkh1974@gmail.com', 'superuser', 'migration_usage_tier_2026')
ON CONFLICT (email) DO UPDATE
SET
  role = EXCLUDED.role,
  updated_at = now(),
  created_by_email = EXCLUDED.created_by_email;

-- 2) Org-level exempt for API-key / SDK traffic (JWT platform role is not attached on X-SPECTYRA-API-KEY requests).
UPDATE orgs o
SET platform_exempt = true
FROM org_memberships om
JOIN auth.users u ON u.id = om.user_id
WHERE o.id = om.org_id
  AND lower(u.email::text) = lower('gkh1974@gmail.com')
  AND lower(om.role::text) = 'owner';

-- 3) Everyone else (no Stripe subscription row): free-tier shape — no calendar trial
UPDATE orgs
SET
  subscription_status = 'active',
  trial_ends_at = NULL
WHERE stripe_subscription_id IS NULL;
