# Bootstrap Existing User Account

If you created your Supabase account before the bootstrap flow was implemented, you need to manually bootstrap your account to create an organization and link it to your user.

## Option 1: Use the Frontend (Easiest)

1. **Log in** to your app at the login page
2. After login, if you see a bootstrap form, fill it out:
   - Organization Name (required)
   - Project Name (optional)
3. Click "Create Organization"
4. **Save your API key** - it's only shown once!

If the bootstrap form doesn't appear, check the browser console for errors when calling `/v1/auth/me`.

## Option 2: Use cURL (Manual API Call)

Get your JWT token from the Supabase login response, then run:

```bash
curl -X POST https://your-api-url.com/v1/auth/bootstrap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "org_name": "My Organization",
    "project_name": "Default Project"
  }'
```

Replace:
- `YOUR_JWT_TOKEN_HERE` with your access token from the login response
- `https://your-api-url.com` with your actual API URL (e.g., `https://spectyra.up.railway.app`)

**Example:**
```bash
curl -X POST https://spectyra.up.railway.app/v1/auth/bootstrap \
  -H "Authorization: Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6IjMzNGVjNzRhLTZjYjMtNDc1Mi1hZmIzLTFhNDI3Y2NjMjQ1OSIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "org_name": "My Company",
    "project_name": "Default Project"
  }'
```

## Option 3: Use Browser DevTools

1. **Log in** to your app
2. Open **Browser DevTools** (F12)
3. Go to **Console** tab
4. Get your JWT token:
   ```javascript
   // If using Supabase client
   const { data: { session } } = await supabase.auth.getSession();
   console.log(session.access_token);
   ```
5. Go to **Network** tab
6. Find the request to `/v1/auth/me` - it should return `{ error: "Organization not found", needs_bootstrap: true }`
7. Or manually call bootstrap:
   ```javascript
   fetch('https://your-api-url.com/v1/auth/bootstrap', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${session.access_token}`,
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       org_name: 'My Organization',
       project_name: 'Default Project'
     })
   })
   .then(r => r.json())
   .then(console.log);
   ```

## Option 4: Create a Migration Script (For Multiple Users)

If you have multiple existing users, create a migration script:

```sql
-- Migration: Bootstrap existing Supabase users
-- This creates orgs and memberships for users who don't have them yet

-- For each user in auth.users without an org_membership:
DO $$
DECLARE
  user_record RECORD;
  new_org_id UUID;
  new_project_id UUID;
BEGIN
  FOR user_record IN 
    SELECT id, email FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM org_memberships)
  LOOP
    -- Create org
    INSERT INTO orgs (name, trial_ends_at, subscription_status)
    VALUES (
      COALESCE(user_record.email, 'User ' || user_record.id::text),
      NOW() + INTERVAL '7 days',
      'trial'
    )
    RETURNING id INTO new_org_id;
    
    -- Create default project
    INSERT INTO projects (org_id, name)
    VALUES (new_org_id, 'Default Project')
    RETURNING id INTO new_project_id;
    
    -- Create membership
    INSERT INTO org_memberships (org_id, user_id, role)
    VALUES (new_org_id, user_record.id, 'OWNER');
    
    RAISE NOTICE 'Bootstrapped user % with org %', user_record.email, new_org_id;
  END LOOP;
END $$;
```

**Note:** This migration doesn't create API keys. Users will need to create API keys via the `/v1/auth/api-keys` endpoint after bootstrap.

## Verify Bootstrap Worked

After bootstrapping, verify:

```sql
-- Check your membership
SELECT 
  om.*,
  o.name as org_name,
  o.trial_ends_at
FROM org_memberships om
JOIN orgs o ON o.id = om.org_id
WHERE om.user_id = 'a3f5b20c-a01e-43c0-93fa-f4e2cfe25cd6';
```

Or call `/v1/auth/me` with your JWT token - it should return your org info instead of `needs_bootstrap: true`.

## Troubleshooting

### "Organization already exists for this user"
- You're already bootstrapped! Check `org_memberships` table.

### "Not authenticated" (401)
- Your JWT token expired. Log in again to get a new token.

### Bootstrap form doesn't appear
- Check browser console for errors
- Verify `/v1/auth/me` returns `needs_bootstrap: true`
- Check that `hasSession = true` in the login component
