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
