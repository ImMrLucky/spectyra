# Phase 7: SSO Readiness - COMPLETE ✅

## Completed Tasks

### 1. Domain Allowlist Enforcement ✅

**Location**: `apps/api/src/middleware/auth.ts` - `requireOrgMembership` function

**Implementation**:
- Checks `org_settings.allowed_email_domains` when user accesses organization
- Fetches user email from Supabase Admin API
- Compares user's email domain against allowed domains
- Returns 403 with clear error message if domain not allowed
- Fails open (allows access) if email check fails (for reliability)

**Bootstrap Check**: `apps/api/src/routes/auth.ts` - `bootstrap` endpoint
- Pre-checks domain restrictions before org creation
- Logs warnings if user's domain would be restricted by existing orgs
- Allows org creation (domain restrictions apply after org is created)

### 2. SSO Provider Verification ✅

**Location**: `apps/api/src/middleware/auth.ts` - `requireOrgMembership` function

**Implementation**:
- Checks `org_settings.enforce_sso` flag
- Fetches user metadata from Supabase Admin API
- Verifies user authenticated via SSO provider:
  - Checks `app_metadata.provider` for SSO providers (saml, okta, azure, google, auth0, onelogin)
  - Checks `app_metadata.providers` array
- Returns 403 with clear error message if SSO required but user didn't use SSO
- Fails open (allows access) if SSO check fails (for reliability)

**SSO Providers Detected**:
- SAML
- Okta
- Azure AD
- Google Workspace
- Auth0
- OneLogin

### 3. SCIM Readiness Stubs ✅

**Location**: `apps/api/src/routes/scim.ts` (NEW FILE)

**Implementation**:
- Complete SCIM 2.0 endpoint stubs:
  - `GET /scim/v2/ServiceProviderConfig` - Service provider configuration
  - `GET /scim/v2/ResourceTypes` - Resource types
  - `GET /scim/v2/Schemas` - Schemas
  - `POST /scim/v2/Users` - Create user
  - `GET /scim/v2/Users` - List users
  - `GET /scim/v2/Users/:id` - Get user
  - `PUT /scim/v2/Users/:id` - Update user
  - `PATCH /scim/v2/Users/:id` - Partial update user
  - `DELETE /scim/v2/Users/:id` - Delete user
  - `POST /scim/v2/Groups` - Create group
  - `GET /scim/v2/Groups` - List groups

**Response**: All endpoints return `501 Not Implemented` with message:
> "SCIM support is available in Enterprise+ tier. Contact support@spectyra.com for details."

**Authentication**: All SCIM endpoints require:
- `requireUserSession` (JWT auth)
- `requireOrgRole("ADMIN")` (admin access)

**Route Registration**: Added to `apps/api/src/index.ts`:
```typescript
app.use("/scim", scimRouter);
```

## API Key Rotation Endpoint ✅

**Location**: `apps/api/src/routes/auth.ts`

**Endpoint**: `POST /v1/orgs/:orgId/api-keys/:keyId/rotate`

**Features**:
- Creates new API key with same properties (scopes, expiration, IP restrictions, etc.)
- Revokes old key (soft delete)
- Returns new key (shown only once)
- Requires OWNER/ADMIN role
- Audit logged (`KEY_ROTATED`)

**Helper Functions Added**:
- `getApiKeyById(keyId)` - Get API key by ID
- `createApiKey()` - Enhanced to accept optional parameters (expires_at, IP ranges, etc.)
- `revokeApiKey(keyHashOrId, byId)` - Enhanced to support revocation by ID or hash

## Testing

### Test Domain Allowlist

1. Set `allowed_email_domains` for an org:
   ```bash
   PATCH /v1/orgs/{orgId}/settings
   {
     "allowed_email_domains": ["company.com"]
   }
   ```

2. Try to access org with user from different domain → Should get 403

### Test SSO Enforcement

1. Set `enforce_sso = true` for an org:
   ```bash
   PATCH /v1/orgs/{orgId}/settings
   {
     "enforce_sso": true
   }
   ```

2. Try to access org with non-SSO user → Should get 403

### Test SCIM Endpoints

```bash
# All should return 501
GET /scim/v2/ServiceProviderConfig
GET /scim/v2/Users
POST /scim/v2/Users
```

### Test API Key Rotation

```bash
POST /v1/orgs/{orgId}/api-keys/{keyId}/rotate?projectId={projectId}
Authorization: Bearer <jwt>

# Returns new key (shown only once)
```

## Next Steps

1. **Full SCIM Implementation** (Enterprise+ tier):
   - Implement user provisioning
   - Implement group management
   - Support SCIM 2.0 fully

2. **Enhanced SSO**:
   - Support more SSO providers
   - Custom SSO provider configuration
   - SSO provider metadata storage

3. **Domain Management UI**:
   - Add domain allowlist UI in Security Settings page
   - Add SSO enforcement toggle UI

## Files Modified

- `apps/api/src/middleware/auth.ts` - Enhanced SSO/domain checks
- `apps/api/src/routes/auth.ts` - Domain check in bootstrap, rotation endpoint
- `apps/api/src/routes/scim.ts` - NEW FILE - SCIM stubs
- `apps/api/src/services/storage/orgsRepo.ts` - Enhanced API key functions
- `apps/api/src/index.ts` - Added SCIM router

## Status

✅ **Phase 7: SSO Readiness - COMPLETE**

All requirements met:
- ✅ Domain allowlist enforcement
- ✅ SSO provider verification
- ✅ SCIM readiness stubs
- ✅ API key rotation endpoint
