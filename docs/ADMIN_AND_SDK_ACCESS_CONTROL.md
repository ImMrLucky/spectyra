# Admin Panel & SDK Access Control

## Overview

This document describes the owner-based admin panel and SDK access control system for Spectyra.

## Owner-Based Admin Access

### Owner Email
- **Owner Email**: `gkh1974@gmail.com` (configurable via `OWNER_EMAIL` env var)
- Only this user can access the admin panel
- Admin access is verified server-side using Supabase user email

### How It Works

1. **Frontend**: Admin link only shows if user email matches owner email
2. **Backend**: `requireOwner` middleware checks user email from Supabase JWT
3. **Access**: If email matches, user can access all admin endpoints

### Admin Endpoints

All admin endpoints use `requireUserSession` + `requireOwner` middleware:
- `GET /v1/admin/orgs` - List all organizations
- `GET /v1/admin/orgs/:id` - Get organization details
- `PATCH /v1/admin/orgs/:id` - Update organization
- `DELETE /v1/admin/orgs/:id` - Delete organization
- `PATCH /v1/admin/orgs/:id/sdk-access` - Toggle SDK access
- `GET /v1/admin/users` - List all users with org memberships
- `GET /v1/admin/runs/:id/debug` - Get debug info for a run

## SDK Access Control

### Database Schema

Added `sdk_access_enabled` column to `orgs` table:
```sql
ALTER TABLE orgs 
ADD COLUMN sdk_access_enabled BOOLEAN NOT NULL DEFAULT true;
```

### How It Works

1. **Default**: New orgs have `sdk_access_enabled = true`
2. **Enforcement**: Agent endpoints (`/v1/agent/*`) check this flag
3. **Control**: Owner can toggle SDK access per organization in admin panel

### Affected Endpoints

When `sdk_access_enabled = false`, these endpoints return 403:
- `POST /v1/agent/options` - Get agent options
- `POST /v1/agent/events` - Send agent events

**Not affected** (always accessible):
- `POST /v1/chat` - Chat optimization (not SDK)
- `GET /v1/auth/*` - Auth endpoints
- `GET /v1/billing/*` - Billing endpoints

### Middleware

`requireSdkAccess` middleware:
- Must be used after `requireSpectyraApiKey`
- Checks `orgs.sdk_access_enabled` for the authenticated org
- Returns 403 with clear message if disabled

## Admin Panel UI

### Features

1. **Organizations Tab**:
   - List all organizations
   - View org details (name, status, stats)
   - Edit org name
   - **Toggle SDK access** (Enable/Disable)
   - Delete organization

2. **Users Tab**:
   - List all users
   - View user email (if available)
   - View user's organization memberships
   - View roles per organization

### Access Control

- Admin link only visible to owner (`gkh1974@gmail.com`)
- Admin page shows "Access denied" if non-owner tries to access
- All admin operations require owner authentication

## User Testing Flow

### For Regular Users

1. **Sign up / Login**: Create account via Supabase auth
2. **Bootstrap**: Create org and get API key
3. **Test SDK**:
   ```bash
   npm install @spectyra/sdk
   ```
   ```javascript
   import { createSpectyra } from '@spectyra/sdk';
   
   const spectyra = createSpectyra({
     mode: "api",
     endpoint: "https://spectyra.up.railway.app/v1",
     apiKey: "your-api-key",
   });
   
   // Test agent options
   const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
   ```

4. **If SDK is disabled**: User gets 403 error with message:
   ```
   {
     "error": "SDK access is disabled for this organization",
     "message": "Please contact support to enable SDK access"
   }
   ```

### For Owner (Admin)

1. **Login**: As `gkh1974@gmail.com`
2. **Access Admin**: Click "Admin" in sidebar (only visible to owner)
3. **Manage Organizations**:
   - View all orgs
   - Select an org to see details
   - Toggle SDK access on/off
   - Edit org name
   - Delete org (danger zone)
4. **Manage Users**:
   - View all users
   - See which orgs each user belongs to
   - See user roles

## Environment Variables

Required for owner check:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin API access
- `OWNER_EMAIL` - Owner email (defaults to `gkh1974@gmail.com`)

## Database Migration

Run the migration to add SDK access control:
```bash
# Migration file: supabase/migrations/20260127000005_sdk_access_control.sql
```

This adds:
- `sdk_access_enabled` column to `orgs` table
- Index for filtering
- Default value: `true` (SDK enabled by default)

## Testing Checklist

### Owner Access
- [ ] Login as `gkh1974@gmail.com`
- [ ] Admin link appears in sidebar
- [ ] Can access `/admin` page
- [ ] Can list organizations
- [ ] Can toggle SDK access
- [ ] Can view users

### Non-Owner Access
- [ ] Login as different user
- [ ] Admin link does NOT appear in sidebar
- [ ] Direct access to `/admin` shows "Access denied"
- [ ] Cannot access admin endpoints (403)

### SDK Access Control
- [ ] Create new org → SDK enabled by default
- [ ] Disable SDK for an org → Agent endpoints return 403
- [ ] Enable SDK for an org → Agent endpoints work
- [ ] Chat endpoints still work when SDK disabled
- [ ] Error message is clear and helpful

## API Examples

### Toggle SDK Access (Owner Only)

```bash
curl -X PATCH https://spectyra.up.railway.app/v1/admin/orgs/{org_id}/sdk-access \
  -H "Authorization: Bearer {supabase_jwt}" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Test SDK with Disabled Access

```javascript
// This will return 403 if SDK access is disabled
const response = await spectyra.agentOptionsRemote(ctx, {
  promptChars: 5000,
  path: "code",
});
// Error: "SDK access is disabled for this organization"
```

## Security Notes

1. **Owner Check**: Done server-side, cannot be bypassed client-side
2. **SDK Access**: Enforced at middleware level, applies to all agent endpoints
3. **Default State**: New orgs have SDK enabled (opt-out model)
4. **Error Messages**: Clear but don't leak sensitive info
