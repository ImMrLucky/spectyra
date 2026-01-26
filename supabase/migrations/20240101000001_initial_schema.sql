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
  subscription_status TEXT NOT NULL DEFAULT 'trial' 
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
