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
