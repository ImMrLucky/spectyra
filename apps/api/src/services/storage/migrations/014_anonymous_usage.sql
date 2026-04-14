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
