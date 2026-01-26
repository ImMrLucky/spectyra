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
