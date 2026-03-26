-- Migration 009: Cloud-synced analytics session summaries (no raw prompts).

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
