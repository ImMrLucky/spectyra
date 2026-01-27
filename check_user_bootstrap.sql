-- Check if a user has been bootstrapped (has org_membership)
-- Replace 'a3f5b20c-a01e-43c0-93fa-f4e2cfe25cd6' with your actual user ID

-- Check user in auth.users (Supabase Auth)
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE id = 'a3f5b20c-a01e-43c0-93fa-f4e2cfe25cd6';

-- Check if user has org membership (bootstrap status)
SELECT 
  om.id as membership_id,
  om.org_id,
  om.role,
  om.created_at as membership_created_at,
  o.name as org_name,
  o.trial_ends_at,
  o.subscription_status
FROM org_memberships om
JOIN orgs o ON o.id = om.org_id
WHERE om.user_id = 'a3f5b20c-a01e-43c0-93fa-f4e2cfe25cd6';

-- If the second query returns no rows, the user needs to bootstrap
