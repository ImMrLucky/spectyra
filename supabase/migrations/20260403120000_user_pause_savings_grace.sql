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
