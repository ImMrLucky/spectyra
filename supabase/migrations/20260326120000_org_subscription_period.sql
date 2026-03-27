-- Monthly entitlement: track Stripe subscription id, current period end, and cancel-at-period-end.
-- Access to Spectyra savings continues until subscription_current_period_end (30-day billing cycle),
-- including after the user schedules cancel or pause in Stripe — we never delete the org.

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN orgs.stripe_subscription_id IS 'Stripe subscription id (sub_...)';
COMMENT ON COLUMN orgs.subscription_current_period_end IS 'End of current paid period; savings active while now() < this (and status allows)';
COMMENT ON COLUMN orgs.cancel_at_period_end IS 'True when user canceled in Stripe but still has access until period end';

ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_subscription_status_check;
ALTER TABLE orgs ADD CONSTRAINT orgs_subscription_status_check
  CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due', 'paused'));
