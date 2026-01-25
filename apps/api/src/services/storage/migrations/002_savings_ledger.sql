-- Migration 002: Production Savings Ledger + IP-Safe Accounting
-- Adds workload_key, prompt_hash, savings_ledger, baseline_samples
-- Ensures all runs have proper accounting fields

PRAGMA foreign_keys=ON;

-- A1) Update runs table - add production accounting fields
-- Note: If columns already exist, SQLite will error; migration runner should handle gracefully

-- Add workload_key and prompt_hash (if not exists)
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we check in migration runner
ALTER TABLE runs ADD COLUMN workload_key TEXT;
ALTER TABLE runs ADD COLUMN prompt_hash TEXT;
ALTER TABLE runs ADD COLUMN is_shadow INTEGER DEFAULT 0 CHECK (is_shadow IN (0,1));
ALTER TABLE runs ADD COLUMN debug_internal_json TEXT;

-- Ensure we have proper accounting columns (may already exist from previous migrations)
-- These should already exist, but ensure they're present:
-- input_tokens, output_tokens, total_tokens, cost_usd, path, optimization_level, provider, model

-- A2) Update replays table - add workload_key
ALTER TABLE replays ADD COLUMN workload_key TEXT;

-- A3) Create baseline_samples table (Welford aggregates)
CREATE TABLE IF NOT EXISTS baseline_samples (
  workload_key TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  n INTEGER NOT NULL,
  mean_total_tokens REAL NOT NULL,
  m2_total_tokens REAL NOT NULL,
  mean_cost_usd REAL NOT NULL,
  m2_cost_usd REAL NOT NULL
);

-- A4) Create savings_ledger table (customer-facing accounting)
CREATE TABLE IF NOT EXISTS savings_ledger (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  savings_type TEXT NOT NULL CHECK (savings_type IN ('verified','shadow_verified','estimated')),
  workload_key TEXT NOT NULL,
  path TEXT NOT NULL CHECK (path IN ('talk','code')),
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
  optimized_run_id TEXT,
  baseline_run_id TEXT,
  FOREIGN KEY (optimized_run_id) REFERENCES runs(id) ON DELETE SET NULL,
  FOREIGN KEY (baseline_run_id) REFERENCES runs(id) ON DELETE SET NULL
);

-- A5) Create indexes for performance
-- Runs indexes
CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_replay_id ON runs(replay_id);
CREATE INDEX IF NOT EXISTS idx_runs_workload_key ON runs(workload_key);
CREATE INDEX IF NOT EXISTS idx_runs_path_level ON runs(path, optimization_level);
CREATE INDEX IF NOT EXISTS idx_runs_provider_model ON runs(provider, model);
CREATE INDEX IF NOT EXISTS idx_runs_mode_shadow ON runs(mode, is_shadow);

-- Replays indexes
CREATE INDEX IF NOT EXISTS idx_replays_created_at ON replays(created_at);
CREATE INDEX IF NOT EXISTS idx_replays_workload_key ON replays(workload_key);
CREATE INDEX IF NOT EXISTS idx_replays_path_level ON replays(path, optimization_level);

-- Baseline samples index
CREATE INDEX IF NOT EXISTS idx_baseline_samples_updated ON baseline_samples(updated_at);

-- Ledger indexes
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON savings_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON savings_ledger(savings_type);
CREATE INDEX IF NOT EXISTS idx_ledger_path_level ON savings_ledger(path, optimization_level);
CREATE INDEX IF NOT EXISTS idx_ledger_provider_model ON savings_ledger(provider, model);
CREATE INDEX IF NOT EXISTS idx_ledger_workload_key ON savings_ledger(workload_key);
