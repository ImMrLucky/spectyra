# Enterprise Security Implementation - Completion Checklist

## ✅ Completed (Backend Infrastructure)

### Phase 0: Baseline ✅
- ✅ Auth flow documentation
- ✅ Tenant isolation helpers

### Phase 1: Tenant Isolation + RBAC ✅
- ✅ `org_settings` and `project_settings` tables
- ✅ RBAC middleware (`requireOrgRole`, `requireScope`)
- ✅ Settings repository

### Phase 2: API Keys v2 ✅
- ✅ API key restrictions (expiration, IP ranges, origins)
- ✅ Enhanced validation in middleware

### Phase 3: Audit Logging ✅
- ✅ `audit_logs` table
- ✅ Audit service
- ✅ Wired into key operations, bootstrap, login
- ✅ Audit route queries `audit_logs` table
- ✅ Export endpoint (CSV)

### Phase 4: Provider Key Management ✅
- ✅ `provider_credentials` table
- ✅ Envelope encryption service
- ✅ Provider credentials repository
- ✅ Provider key routes
- ✅ BYOK mode enforcement
- ✅ Vaulted key integration in chat/replay routes

### Phase 5: Data Handling & Retention ✅
- ✅ Default "no prompt storage" (enforced in `runsRepo.ts`)
- ✅ Retention worker route

### Phase 6: Rate Limiting & Security Headers ✅
- ✅ Rate limit middleware
- ✅ Security headers (helmet)
- ✅ CORS hardening
- ✅ Rate limiting wired into chat/agent routes

### Phase 7: SSO Readiness ✅ (Partial)
- ✅ Domain allowlist check in `requireOrgMembership`
- ✅ SSO enforcement toggle in `org_settings`

## 🔄 Remaining Tasks

### Immediate (Critical for Production)

1. **Install helmet package**:
   ```bash
   cd apps/api
   pnpm add helmet
   ```

2. **Add API key rotation endpoint**:
   - `POST /v1/orgs/:orgId/projects/:projectId/api-keys/:keyId/rotate`
   - Creates new key, revokes old one
   - Returns new key (once)

3. **Enforce org/project scoping in storage repos**:
   - Audit all `*Repo.ts` files
   - Add `requireOrg(ctx)` checks
   - Add `requireProject(ctx, orgId)` for project-scoped queries
   - Ensure no queries can access other orgs' data

4. **Wire audit logging into remaining operations**:
   - Settings updates (partially done)
   - Member add/remove
   - Role changes
   - Project create/delete

5. **Test vaulted provider keys**:
   - Set provider key via API
   - Use in chat route (without X-PROVIDER-KEY header)
   - Verify it works

6. **Schedule retention worker**:
   - Set up cron job (Railway cron or external service)
   - Test retention worker endpoint

### Phase 7: SSO (Complete Domain Enforcement)

**TODO**:
- [ ] Add domain check in bootstrap (before org creation)
- [ ] Enhance SSO provider verification (check Supabase user metadata)
- [ ] Add SCIM stub endpoints (return 501)

### Phase 8: CI Security Gates

**TODO**:
- [ ] Create `.github/workflows/security.yml`:
  - Dependency audit (`pnpm audit --prod`)
  - OSV scan
  - CodeQL
  - Secret scanning (gitleaks)
  - SBOM generation
- [ ] Configure npm Trusted Publishing
- [ ] Add Security section to README

### Phase 9: Enterprise Admin UI

**TODO**:
- [ ] Security Settings page:
  - Data retention controls
  - Storage toggles
  - SSO settings
  - Provider key mode
- [ ] API Keys management (enhance existing):
  - Show expiration
  - Show IP restrictions
  - Rotation button
- [ ] Provider Keys page:
  - List vaulted keys
  - Add/update form
  - Revoke button
- [ ] Audit Logs viewer:
  - Table with filters
  - Export button

### Phase 10: Documentation

**TODO**:
- [ ] `SECURITY.md` - Vulnerability disclosure
- [ ] `docs/DATA_HANDLING.md` - What is stored
- [ ] `docs/RETENTION.md` - Retention policies
- [ ] `docs/ENTERPRISE_SECURITY.md` - Full guide
- [ ] `docs/THREAT_MODEL.md` - Threat model

## Priority Order

1. **Install helmet** (blocks server start)
2. **Test core features** (audit, provider keys, retention)
3. **Enforce tenant isolation** (critical security)
4. **Add rotation endpoint** (enterprise requirement)
5. **Complete SSO enforcement** (enterprise requirement)
6. **CI security gates** (compliance)
7. **UI pages** (usability)
8. **Documentation** (adoption)

## Environment Variables Required

```bash
# Provider key encryption (REQUIRED for vaulted keys)
MASTER_KEY=<32-byte base64 key>
# Generate: openssl rand -base64 32

# Retention worker (REQUIRED for cron)
RETENTION_SECRET=<secret-for-cron>

# CORS (optional, for production)
ALLOWED_ORIGINS=https://app.spectyra.com

# Supabase (already configured)
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
OWNER_EMAIL=gkh1974@gmail.com
```

## Testing Commands

```bash
# Install helmet
cd apps/api && pnpm add helmet

# Run migrations (in order)
# Apply via Supabase dashboard or CLI

# Test audit logging
curl -H "Authorization: Bearer <jwt>" https://api/v1/audit

# Test provider key vaulting
curl -X POST -H "Authorization: Bearer <jwt>" \
  https://api/v1/orgs/<orgId>/provider-keys \
  -d '{"provider": "openai", "key": "sk-..."}'

# Test retention worker
curl -X POST -H "X-Retention-Secret: <secret>" \
  https://api/internal/retention/run
```
