-- One-time data migration: legacy trial / odd billing states → included-usage model (active, no trial end),
-- and ensure the platform superuser keeps full access (JWT + API-key org).
--
-- Prerequisites: Supabase Postgres where `auth.users` exists (standard Spectyra deploy).
-- If you use a standalone Postgres clone without `auth`, run steps (1) and (3) only, then set
-- `orgs.platform_exempt = true` manually for the superuser’s org UUID.
--
-- Does NOT change rows that already have `stripe_subscription_id` set (real or test Stripe subs).

-- 1) Platform role: superuser console + JWT billing bypass (see apps/api/src/middleware/auth.ts billingAccessOpts)
INSERT INTO platform_roles (email, role, created_by_email)
VALUES ('gkh1974@gmail.com', 'superuser', 'migration_usage_tier_2026')
ON CONFLICT (email) DO UPDATE
SET
  role = EXCLUDED.role,
  updated_at = now(),
  created_by_email = EXCLUDED.created_by_email;

-- 2) Org-level exempt for API-key / SDK traffic (JWT platform role is not attached on X-SPECTYRA-API-KEY requests).
UPDATE orgs o
SET platform_exempt = true
FROM org_memberships om
JOIN auth.users u ON u.id = om.user_id
WHERE o.id = om.org_id
  AND lower(u.email::text) = lower('gkh1974@gmail.com')
  AND lower(om.role::text) = 'owner';

-- 3) Everyone else (no Stripe subscription row): free-tier shape — no calendar trial
UPDATE orgs
SET
  subscription_status = 'active',
  trial_ends_at = NULL
WHERE stripe_subscription_id IS NULL;
