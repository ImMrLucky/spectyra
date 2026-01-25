-- Runs table
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  scenario_id TEXT,
  conversation_id TEXT,
  replay_id TEXT,
  mode TEXT NOT NULL,
  path TEXT NOT NULL,
  optimization_level INTEGER DEFAULT 2,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_scenario ON runs(scenario_id);
CREATE INDEX IF NOT EXISTS idx_runs_conversation ON runs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_runs_created ON runs(created_at);
CREATE INDEX IF NOT EXISTS idx_runs_replay ON runs(replay_id);
CREATE INDEX IF NOT EXISTS idx_runs_path_level ON runs(path, optimization_level);
CREATE INDEX IF NOT EXISTS idx_runs_workload_key ON runs(workload_key);
CREATE INDEX IF NOT EXISTS idx_runs_mode_shadow ON runs(mode, is_shadow);

-- Replays table (groups baseline + optimized runs)
CREATE TABLE IF NOT EXISTS replays (
  replay_id TEXT PRIMARY KEY,
  scenario_id TEXT,
  workload_key TEXT NOT NULL,
  path TEXT NOT NULL,
  optimization_level INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  baseline_run_id TEXT NOT NULL,
  optimized_run_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (baseline_run_id) REFERENCES runs(id),
  FOREIGN KEY (optimized_run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_replays_created ON replays(created_at);
CREATE INDEX IF NOT EXISTS idx_replays_path_level ON replays(path, optimization_level);
CREATE INDEX IF NOT EXISTS idx_replays_workload_key ON replays(workload_key);

-- Baseline samples table (Welford aggregation per workload_key)
CREATE TABLE IF NOT EXISTS baseline_samples (
  workload_key TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  n INTEGER NOT NULL DEFAULT 0,
  mean_total_tokens REAL NOT NULL DEFAULT 0,
  var_total_tokens REAL NOT NULL DEFAULT 0,
  mean_cost_usd REAL NOT NULL DEFAULT 0,
  var_cost_usd REAL NOT NULL DEFAULT 0,
  M2_tokens REAL NOT NULL DEFAULT 0,
  M2_cost REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_baseline_samples_updated ON baseline_samples(updated_at);

-- Savings ledger (auditable savings records)
CREATE TABLE IF NOT EXISTS savings_ledger (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  savings_type TEXT NOT NULL,
  workload_key TEXT NOT NULL,
  path TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  optimization_level INTEGER NOT NULL,
  baseline_tokens REAL NOT NULL,
  optimized_tokens REAL NOT NULL,
  tokens_saved REAL NOT NULL,
  pct_saved REAL NOT NULL,
  baseline_cost_usd REAL NOT NULL,
  optimized_cost_usd REAL NOT NULL,
  cost_saved_usd REAL NOT NULL,
  confidence REAL NOT NULL,
  replay_id TEXT,
  optimized_run_id TEXT,
  baseline_run_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_savings_ledger_created ON savings_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_savings_ledger_type ON savings_ledger(savings_type);
CREATE INDEX IF NOT EXISTS idx_savings_ledger_workload ON savings_ledger(workload_key);
CREATE INDEX IF NOT EXISTS idx_savings_ledger_path_level ON savings_ledger(path, optimization_level);

-- Conversation state table
CREATE TABLE IF NOT EXISTS conversation_state (
  conversation_id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  units TEXT NOT NULL, -- JSON array of SemanticUnit
  last_turn INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
