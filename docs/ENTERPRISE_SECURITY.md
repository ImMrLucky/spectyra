# Enterprise Security Guide

## Overview

Spectyra implements enterprise-grade security controls designed to meet SOC 2, GDPR, and other compliance requirements. This guide covers all security features and how to configure them.

## Table of Contents

1. [Tenant Isolation](#tenant-isolation)
2. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
3. [API Key Management](#api-key-management)
4. [Provider Key Management](#provider-key-management)
5. [Audit Logging](#audit-logging)
6. [Data Retention](#data-retention)
7. [Rate Limiting](#rate-limiting)
8. [SSO and Access Controls](#sso-and-access-controls)
9. [Security Headers and CORS](#security-headers-and-cors)
10. [CI Security Gates](#ci-security-gates)

## Tenant Isolation

### Strong Isolation

Every request in Spectyra is scoped to an organization and optionally a project. This is enforced server-side and cannot be bypassed.

### How It Works

1. **Authentication**: User authenticates via JWT (dashboard) or API key (SDK)
2. **Context Resolution**: System resolves `org_id` and `project_id` from authentication
3. **Query Filtering**: All database queries automatically filter by `org_id` (and `project_id` if applicable)
4. **Enforcement**: Middleware ensures no cross-tenant data access

### Implementation

- **Request Context**: `req.context.org.id` and `req.context.project.id` set by middleware
- **Database Helpers**: `requireOrg(ctx)` and `requireProject(ctx, orgId)` enforce scoping
- **Storage Repos**: All repository methods filter by org/project

### Verification

- Cannot access another org's data by guessing IDs
- Project-scoped API keys cannot access other projects
- All queries include `WHERE org_id = $1` (or equivalent)

## Role-Based Access Control (RBAC)

### Roles

Spectyra defines five roles with hierarchical permissions:

1. **OWNER** (highest): Full access, can manage org settings and billing
2. **ADMIN**: Can manage projects, policies, members, and most settings
3. **DEV**: Can create API keys, manage projects, view runs
4. **BILLING**: Can view usage and billing, cannot modify settings
5. **VIEWER** (lowest): Read-only access to runs and usage

### Role Hierarchy

```
OWNER > ADMIN > DEV > BILLING > VIEWER
```

A role can perform all actions of roles below it.

### API Key Scopes

API keys have fine-grained scopes (not roles):

- `chat:read`, `chat:write`: Chat optimization
- `agent:read`, `agent:write`: Agent control
- `runs:read`: View runs
- `settings:read`, `settings:write`: Manage settings

### Enforcement

- **Middleware**: `requireOrgRole(minRole)` for dashboard routes
- **Scopes**: `requireScope(scopes[])` for API key routes
- **Database**: Role stored in `org_memberships.role`

## API Key Management

### Features

- **Expiration**: Keys can have `expires_at` timestamp
- **IP Restrictions**: Keys can be restricted to specific IP ranges (`allowed_ip_ranges`)
- **Origin Restrictions**: Keys can be restricted to specific origins (`allowed_origins`)
- **Scopes**: Fine-grained permissions per key
- **Revocation**: Keys can be revoked (soft delete)
- **Rotation**: Keys can be rotated (new key, old key revoked)

### Creating API Keys

Via API:
```bash
POST /v1/auth/api-keys
{
  "name": "Production Key",
  "project_id": "optional-project-id",
  "expires_at": "2025-12-31T23:59:59Z",
  "allowed_ip_ranges": ["192.168.1.0/24"],
  "scopes": ["chat:read", "chat:write"]
}
```

Via UI:
- Navigate to Settings → API Keys
- Click "Create API Key"
- Configure restrictions and scopes
- Save the key (shown only once)

### Key Rotation

```bash
POST /v1/orgs/{orgId}/projects/{projectId}/api-keys/{keyId}/rotate
```

Returns new key (shown only once), old key is automatically revoked.

## Provider Key Management

### Modes

Spectyra supports three provider key modes:

1. **EITHER** (default): Allow both BYOK (header) and vaulted keys
2. **BYOK_ONLY**: Require clients to provide `X-PROVIDER-KEY` header (no storage)
3. **VAULT_ONLY**: Require using encrypted vaulted keys (no BYOK allowed)

### Vaulted Keys

- **Encryption**: AES-256-GCM with envelope encryption
- **Storage**: Encrypted in `provider_credentials` table
- **Access**: Decrypted just-in-time for provider calls
- **Rotation**: Support key rotation (new key, old key revoked)
- **Fingerprinting**: Keys are fingerprinted for audit

### BYOK (Bring Your Own Key)

- **Header**: `X-PROVIDER-KEY: sk-...`
- **Ephemeral**: Never stored, used only for the request
- **Privacy**: Maximum privacy, no key storage

### Managing Provider Keys

Via API:
```bash
# Set vaulted key
POST /v1/orgs/{orgId}/provider-keys
{
  "provider": "openai",
  "key": "sk-...",
  "project_id": "optional-project-id"
}

# List keys (masked)
GET /v1/orgs/{orgId}/provider-keys

# Revoke key
DELETE /v1/orgs/{orgId}/provider-keys/{credentialId}

# Update mode
PATCH /v1/orgs/{orgId}/provider-key-mode
{
  "provider_key_mode": "VAULT_ONLY"
}
```

Via UI:
- Navigate to Settings → Provider Keys
- Add/update/revoke keys
- Configure provider key mode

## Audit Logging

### What is Logged

All security-relevant events are logged:

- **Authentication**: Login, logout
- **Key Management**: Key created, rotated, revoked
- **Organization**: Org created, settings updated
- **Membership**: Member added, removed, role changed
- **Provider Keys**: Provider key set, revoked
- **Data Export**: Audit log exports
- **Retention**: Retention runs

### Audit Log Structure

```typescript
{
  id: string;
  org_id: string;
  project_id: string | null;
  actor_type: 'USER' | 'API_KEY' | 'SYSTEM';
  actor_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: JSONB;
  created_at: timestamp;
}
```

### Accessing Audit Logs

Via API:
```bash
GET /v1/audit?range=30d&event_type=KEY_CREATED
```

Via UI:
- Navigate to Audit Logs
- Filter by time range and event type
- Export as CSV (OWNER/ADMIN only)

### Export

```bash
GET /v1/audit/export?from=2025-01-01&to=2025-01-31
```

Returns CSV file with all audit logs in the date range.

## Data Retention

### Default Policy

- **Retention Period**: 30 days (configurable)
- **Default Storage**: No prompts, responses, or debug data stored
- **Automatic Deletion**: Runs older than retention period are deleted daily

### Configuration

```typescript
{
  data_retention_days: 30,
  store_prompts: false,
  store_responses: false,
  store_internal_debug: false
}
```

### Retention Worker

- Runs daily via scheduled job
- Deletes runs older than `data_retention_days`
- Generates audit log entry for each run

See [docs/RETENTION.md](RETENTION.md) for details.

## Rate Limiting

### Implementation

- **Algorithm**: Token bucket
- **Scope**: Per organization, project, API key, or user
- **Configuration**: Via `project_settings.rate_limit_rps` and `rate_limit_burst`

### Default Limits

- **RPS**: 20 requests per second
- **Burst**: 40 requests

### Response

When rate limit is exceeded:
- **Status**: 429 Too Many Requests
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Configuration

```bash
PATCH /v1/projects/{projectId}/settings
{
  "rate_limit_rps": 50,
  "rate_limit_burst": 100
}
```

## SSO and Access Controls

### Domain Allowlist

Restrict organization membership to specific email domains:

```typescript
{
  allowed_email_domains: ["company.com", "subsidiary.com"]
}
```

Users with emails from other domains cannot join the organization.

### SSO Enforcement

Require users to authenticate via SSO provider:

```typescript
{
  enforce_sso: true
}
```

When enabled, users must authenticate via configured SSO provider (Supabase SSO).

### Configuration

Via API:
```bash
PATCH /v1/orgs/{orgId}/settings
{
  "allowed_email_domains": ["company.com"],
  "enforce_sso": true
}
```

Via UI:
- Navigate to Settings → Security
- Configure domain allowlist and SSO enforcement

## Security Headers and CORS

### Security Headers

Spectyra uses `helmet` middleware to set security headers:

- **Content-Security-Policy**: Restricts resource loading
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Referrer-Policy**: Controls referrer information
- **Strict-Transport-Security**: Enforces HTTPS

### CORS

- **Allowed Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Credentials**: Supported for authenticated requests
- **Methods**: GET, POST, PATCH, DELETE, PUT
- **Headers**: Content-Type, Authorization, X-SPECTYRA-API-KEY, X-PROVIDER-KEY

### Configuration

```bash
# Environment variable
ALLOWED_ORIGINS=https://app.spectyra.com,https://spectyra.com
```

## CI Security Gates

### Automated Security Checks

Spectyra runs automated security checks on every PR and release:

1. **Dependency Audit**: `pnpm audit --prod` (high/critical vulnerabilities)
2. **OSV Scanner**: Scans lockfile for known vulnerabilities
3. **CodeQL**: Static analysis for security issues
4. **Secret Scanning**: Gitleaks scans for secrets in code
5. **SBOM Generation**: CycloneDX SBOM for releases

### Workflow

See `.github/workflows/security.yml` for full configuration.

### npm Trusted Publishing

SDK packages are published with npm Trusted Publishing (OIDC) for provenance.

## Compliance

### SOC 2

- ✅ Access controls (RBAC, API key scopes)
- ✅ Audit logging
- ✅ Data retention policies
- ✅ Encryption (at rest and in transit)
- ✅ Security headers and CORS

### GDPR

- ✅ Data minimization (no prompt storage by default)
- ✅ Right to erasure (retention policies)
- ✅ Right to access (data export)
- ✅ Encryption
- ✅ Access controls

### HIPAA (if applicable)

- ✅ No PHI storage by default
- ✅ Encryption
- ✅ Access controls
- ✅ Audit logging

## Best Practices

### For Organizations

1. **Enable audit logging**: Required for compliance
2. **Set retention policies**: Match your compliance requirements
3. **Use RBAC**: Assign appropriate roles to users
4. **Rotate keys regularly**: Rotate API keys and provider keys
5. **Review audit logs**: Regularly review audit logs for anomalies
6. **Enable SSO**: Use SSO for enterprise authentication
7. **Restrict IPs**: Use IP restrictions for API keys when possible

### For Developers

1. **Never commit secrets**: Use environment variables
2. **Use scoped API keys**: Create keys with minimum required scopes
3. **Set expiration**: Set expiration dates for API keys
4. **Monitor usage**: Monitor API key usage via audit logs
5. **Follow secure coding**: Follow secure coding practices

## Support

For security questions or concerns:
- **Email**: security@spectyra.com
- **Documentation**: [Security Policy](../.github/SECURITY.md)
