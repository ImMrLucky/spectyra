# Enterprise Security Implementation - Next Steps

## ✅ Completed Phases

### Phase 0: Baseline Repo Audit & Guardrails
- ✅ Auth flow documentation
- ✅ Tenant isolation helpers (`requireOrg`, `requireProject`)

### Phase 1: Strong Tenant Isolation + RBAC
- ✅ `org_settings` and `project_settings` tables
- ✅ RBAC middleware (`requireOrgRole`, `requireScope`)
- ⚠️ **TODO**: Wire RBAC into all org settings endpoints
- ⚠️ **TODO**: Enforce org/project scoping in all storage repos (use `requireOrg`/`requireProject`)

### Phase 2: API Keys v2
- ✅ API key restrictions (expiration, IP ranges, origins)
- ✅ Enhanced validation in middleware
- ⚠️ **TODO**: Add key rotation endpoints (`POST /orgs/:orgId/projects/:projectId/api-keys/:keyId/rotate`)

### Phase 3: Audit Logging
- ✅ `audit_logs` table
- ✅ Audit service (`audit()`, `systemAudit()`)
- ✅ Wired into key operations, bootstrap, login
- ✅ Audit route updated to query `audit_logs` table
- ✅ Export endpoint added
- ⚠️ **TODO**: Wire audit logging into:
  - Settings updates (partially done)
  - Provider key operations (partially done)
  - Member add/remove operations
  - Role changes

### Phase 4: Provider Key Management
- ✅ `provider_credentials` table
- ✅ Envelope encryption service
- ✅ Provider credentials repository
- ✅ Provider key routes
- ✅ BYOK mode enforcement in middleware
- ✅ Vaulted key integration in chat routes
- ⚠️ **TODO**: Test vaulted keys work end-to-end
- ⚠️ **TODO**: Add provider key UI

### Phase 5: Data Handling & Retention
- ✅ Default "no prompt storage" (enforced in `runsRepo.ts`)
- ✅ Retention worker route (`/internal/retention/run`)
- ⚠️ **TODO**: Schedule retention worker (cron job)
- ⚠️ **TODO**: Test retention worker

### Phase 6: Rate Limiting & Security Headers
- ✅ Rate limit middleware (token bucket)
- ✅ Security headers (helmet)
- ✅ CORS hardening
- ✅ Rate limiting wired into chat/agent routes
- ⚠️ **TODO**: Add `helmet` package to `package.json` dependencies
- ⚠️ **TODO**: Test rate limiting works

## 🔄 Remaining Work

### Phase 7: SSO Readiness
**Status**: Partially complete

**Completed**:
- ✅ Domain allowlist check in `requireOrgMembership`
- ✅ SSO enforcement toggle in `org_settings`

**TODO**:
1. **Enforce domain allowlist on org creation**:
   - Check if user's email domain matches `allowed_email_domains` before creating org
   - Return clear error if domain not allowed

2. **SSO provider check**:
   - When `enforce_sso = true`, verify user authenticated via SSO provider
   - Check Supabase user metadata for SSO provider claim
   - Reject non-SSO users with clear message

3. **SCIM readiness stubs**:
   - Create `/scim/v2/Users` endpoint (return 501 for now)
   - Document SCIM availability in Enterprise+ tier

**Files to modify**:
- `apps/api/src/routes/auth.ts` - Add domain check in bootstrap
- `apps/api/src/middleware/auth.ts` - Enhance SSO check (already started)

### Phase 8: CI Security Gates
**Status**: Not started

**TODO**:
1. **Create `.github/workflows/security.yml`**:
   ```yaml
   - Dependency audit (pnpm audit --prod)
   - OSV scan on lockfile
   - CodeQL (JS/TS)
   - Secret scanning (gitleaks)
   - SBOM generation (CycloneDX)
   ```

2. **Configure npm Trusted Publishing**:
   - Set up OIDC for npm publish
   - Publish from CI only

3. **Add Security section to README**:
   - Provenance
   - Scans
   - Reporting email

**Files to create**:
- `.github/workflows/security.yml`
- `.github/workflows/publish.yml` (if not exists)

### Phase 9: Enterprise Admin UI
**Status**: Not started

**TODO**:
1. **Org → Security Settings Page** (`apps/web/src/app/features/settings/security.page.ts`):
   - Data retention days input
   - Toggles: `store_prompts`, `store_responses`, `store_internal_debug`
   - Toggle: `allow_semantic_cache`
   - Toggle: `enforce_sso`
   - Domain allowlist input (comma-separated)
   - Provider key mode selector (BYOK_ONLY, VAULT_ONLY, EITHER)

2. **Org → API Keys Management** (enhance existing):
   - Show expiration dates
   - Show IP restrictions
   - Add rotation button
   - Add description field

3. **Org → Provider Keys Page** (`apps/web/src/app/features/settings/provider-keys.page.ts`):
   - List vaulted keys (masked - show fingerprint only)
   - Add/update provider key form
   - Revoke button
   - BYOK mode selector

4. **Org → Audit Logs Viewer** (`apps/web/src/app/features/audit/audit.page.ts`):
   - Table with filters (action, date range)
   - Export CSV button (OWNER/ADMIN only)
   - Pagination

**Files to create**:
- `apps/web/src/app/features/settings/security.page.ts/html/scss`
- `apps/web/src/app/features/settings/provider-keys.page.ts/html/scss`
- `apps/web/src/app/core/api/settings.service.ts`
- `apps/web/src/app/core/api/provider-keys.service.ts`

### Phase 10: Documentation
**Status**: Not started

**TODO**:
1. **SECURITY.md**:
   - Vulnerability disclosure process
   - Security contact email
   - Reporting process

2. **DATA_HANDLING.md**:
   - What is stored by default (nothing - prompts/responses disabled)
   - What can be enabled (org_settings)
   - Retention policies
   - Data export/deletion

3. **RETENTION.md**:
   - How retention works
   - Default retention period (30 days)
   - How to configure
   - What gets deleted

4. **ENTERPRISE_SECURITY.md**:
   - SSO setup
   - RBAC overview
   - Audit logging
   - Encryption (provider keys)
   - BYOK vs Vault modes
   - Rate limiting
   - IP restrictions

5. **THREAT_MODEL.md**:
   - Lightweight threat model
   - Attack vectors considered
   - Mitigations

**Files to create**:
- `SECURITY.md`
- `docs/DATA_HANDLING.md`
- `docs/RETENTION.md`
- `docs/ENTERPRISE_SECURITY.md`
- `docs/THREAT_MODEL.md`

## Immediate Next Steps (Priority Order)

1. **Add helmet package**:
   ```bash
   cd apps/api
   pnpm add helmet
   ```

2. **Complete Phase 3 audit wiring**:
   - Wire audit into settings updates (already started)
   - Wire audit into member operations
   - Test audit logging works

3. **Complete Phase 4 provider keys**:
   - Test vaulted keys work in chat routes
   - Verify BYOK mode enforcement works

4. **Complete Phase 5 retention**:
   - Test retention worker endpoint
   - Set up cron job (Railway cron or external service)

5. **Complete Phase 7 SSO**:
   - Add domain check in bootstrap
   - Enhance SSO provider verification

6. **Phase 8 CI Security**:
   - Create GitHub Actions workflows
   - Test workflows work

7. **Phase 9 UI**:
   - Create security settings page
   - Create provider keys page
   - Enhance audit logs page

8. **Phase 10 Documentation**:
   - Write all security docs
   - Update main README with security section

## Testing Checklist

- [ ] Run all migrations successfully
- [ ] Verify org_settings created for existing orgs
- [ ] Test RBAC middleware (requireOrgRole)
- [ ] Test API key expiration
- [ ] Test API key IP restrictions
- [ ] Verify audit logs are created
- [ ] Test provider key vaulting (set, get, use in chat)
- [ ] Test BYOK mode enforcement
- [ ] Test data retention (no prompt storage by default)
- [ ] Test retention worker endpoint
- [ ] Test rate limiting (429 responses)
- [ ] Test CORS hardening
- [ ] Test security headers present
- [ ] Test domain allowlist enforcement
- [ ] Test SSO enforcement check

## Environment Variables Needed

```bash
# Provider key encryption
MASTER_KEY=<32-byte base64 key>
MASTER_KEY_ID=v1

# Retention worker
RETENTION_SECRET=<secret-for-cron>

# CORS (optional)
ALLOWED_ORIGINS=https://app.spectyra.com,https://spectyra.com

# Supabase (for owner check and SSO)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OWNER_EMAIL=gkh1974@gmail.com
```

## Migration Order

Run migrations in this order:
1. `20260127000005_sdk_access_control.sql`
2. `20260127000006_enterprise_settings.sql`
3. `20260127000007_api_keys_hardening.sql`
4. `20260127000008_audit_logs.sql`
5. `20260127000009_provider_credentials.sql`
