-- Allow admin "inactive" access_state (Observe-only real savings; see userAccountRepo).
ALTER TABLE user_account_flags DROP CONSTRAINT IF EXISTS user_account_flags_access_state_check;
ALTER TABLE user_account_flags
  ADD CONSTRAINT user_account_flags_access_state_check
  CHECK (access_state IN ('active', 'paused', 'inactive'));
