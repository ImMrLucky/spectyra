# Admin Panel & SDK Access Control

## Overview

This document describes the owner-based admin panel and SDK access control system for Spectyra.

## Owner-Based Admin Access

### Owner Email
- **Owner Email**: `<your-owner-email>` (set via `OWNER_EMAIL` env var)
- Only this user can access the admin panel
- Admin access is verified server-side using Supabase user email

### How It Works

1. **Frontend**: Admin UI can be hidden unless explicitly enabled (do not hardcode personal emails client-side)
2. **Backend**: `requireOwner` middleware checks user email from Supabase JWT against `OWNER_EMAIL`
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
   - List all users (from org memberships; auth-only accounts without a membership do not appear — delete those by user id via API or Supabase Dashboard if needed)
   - View user email (if available), access state (active / paused)
   - **Pause** / **Reactivate**:
     - **Stripe**: For each org where the user is **OWNER** and `stripe_subscription_id` is set, the API calls Stripe `pause_collection` so **no new invoices** are collected while paused. On reactivate, collection is resumed.
     - **30-day savings grace**: `pause_savings_until` is set to **30 days** after pause. Until that time, the user keeps **full cloud API access** (including mutating routes and savings features). After the grace date, mutating JWT requests return `403` with `account_paused` (read-only “Observe”) until an admin reactivates.
     - Platform `superuser` / `admin` rows **bypass** pause for staff operations.
   - **Delete user**: Removes `org_memberships`, `platform_roles` row for that email, `user_account_flags`, deletes **sole-member orgs** entirely (same data removal as org delete), then deletes the user in **Supabase Auth**. Deleting a user **only** in Supabase Dashboard does **not** remove Spectyra org data or memberships; use this flow or clean Postgres manually.

### Admin API (owner or platform superuser)

- `PATCH /v1/admin/users/:userId/access` — body `{ "access_state": "active" | "paused" }`
- `DELETE /v1/admin/users/:userId` — full delete (cannot remove the last platform superuser; cannot target yourself)

### Access Control

- Admin routes use `requireOwner`: **`OWNER_EMAIL`** match **or** platform **`superuser`** (e.g. `gkh1974@gmail.com` in `platform_roles`).
- Admin link visibility in the web app may still follow owner UI rules; the API always enforces owner/superuser as above.
- All admin operations require authenticated owner/superuser

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

1. **Login**: As the configured owner (`OWNER_EMAIL`)
2. **Access Admin**: Click "Admin" in sidebar (only visible to owner)
3. **Manage Organizations**:
   - View all orgs
   - Select an org to see details
   - Toggle SDK access on/off
   - Edit org name
   - Delete org (danger zone)
4. **Manage Users** (pause, reactivate, delete — see Users Tab above):
   - View all users, orgs, and roles
   - Pause / reactivate cloud access (Observe read-only when paused)
   - Delete user (full app + auth cleanup)

## Environment Variables

Required for owner check:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin API access
- `OWNER_EMAIL` - Owner email (required)

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
- [ ] Login as the configured owner (`OWNER_EMAIL`)
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
