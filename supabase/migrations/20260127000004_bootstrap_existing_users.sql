-- Migration: Bootstrap existing Supabase users
-- Creates orgs and memberships for users who were created before bootstrap flow
-- 
-- This migration:
-- 1. Finds all users in auth.users without org_memberships
-- 2. Creates an org for each user (named after their email)
-- 3. Creates a default project
-- 4. Creates org_membership linking user to org as OWNER
--
-- NOTE: This does NOT create API keys. Users must create API keys via /v1/auth/api-keys endpoint
-- after this migration runs.

DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  new_project_id UUID;
  user_count INTEGER := 0;
BEGIN
  -- Loop through all users without org memberships
  FOR user_record IN 
    SELECT 
      id, 
      email,
      COALESCE(
        raw_user_meta_data->>'name',
        raw_user_meta_data->>'full_name',
        email,
        'User ' || id::text
      ) as display_name
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM org_memberships)
  LOOP
    -- Create org with 7-day trial
    INSERT INTO orgs (name, trial_ends_at, subscription_status)
    VALUES (
      COALESCE(user_record.display_name, user_record.email, 'User ' || user_record.id::text),
      NOW() + INTERVAL '7 days',
      'trial'
    )
    RETURNING id INTO new_org_id;
    
    -- Create default project
    INSERT INTO projects (org_id, name)
    VALUES (new_org_id, 'Default Project')
    RETURNING id INTO new_project_id;
    
    -- Create membership as OWNER
    INSERT INTO org_memberships (org_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'OWNER')
    ON CONFLICT (org_id, user_id) DO NOTHING; -- Safety check
    
    user_count := user_count + 1;
    
    RAISE NOTICE 'Bootstrapped user % (%) with org %', 
      user_record.email, 
      user_record.id, 
      new_org_id;
  END LOOP;
  
  RAISE NOTICE 'Migration complete: Bootstrapped % users', user_count;
END $$;

-- Verify migration
SELECT 
  COUNT(*) as total_users,
  COUNT(DISTINCT om.user_id) as users_with_orgs,
  COUNT(*) - COUNT(DISTINCT om.user_id) as users_without_orgs
FROM auth.users u
LEFT JOIN org_memberships om ON om.user_id = u.id;
