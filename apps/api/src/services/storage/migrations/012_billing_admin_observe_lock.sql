-- Locks observe-only savings when owner is set to "inactive" in admin (see userAccountRepo).
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS billing_admin_observe_lock_user_id UUID;

COMMENT ON COLUMN orgs.billing_admin_observe_lock_user_id IS
  'When set, observe_only_override was applied by admin inactive for this user; cleared when user is reactivated.';
