# Data Handling and Storage

## Overview

Spectyra is designed with privacy and compliance in mind. By default, we **do not store** prompts, responses, or internal debug data. Only usage metrics and cost data are stored.

## What is Stored by Default

### Always Stored (Required for Service)

- **Organization and Project Metadata**: Names, IDs, creation dates
- **User Accounts**: Email addresses, authentication tokens (managed by Supabase)
- **API Keys**: Hashed API keys (never plaintext), metadata (name, scopes, expiration)
- **Usage Metrics**: Token counts, cost estimates, optimization savings
- **Run Metadata**: Run IDs, timestamps, provider used, cost, savings percentage
- **Audit Logs**: Security-relevant events (login, key management, settings changes)

### Not Stored by Default (Privacy-First)

- **Prompts**: Full prompt content is NOT stored unless explicitly enabled
- **Responses**: Full LLM response text is NOT stored unless explicitly enabled
- **Internal Debug Data**: Optimization debug information is NOT stored unless explicitly enabled

## Configurable Storage Options

Organizations can enable storage of sensitive data via `org_settings`:

### `store_prompts` (default: `false`)
- When enabled: Full prompt content is stored in `runs.prompt_final`
- When disabled: Only prompt hash is stored (for deduplication)
- Use case: Required for replay mode and debugging

### `store_responses` (default: `false`)
- When enabled: Full LLM response text is stored in `runs.response_text`
- When disabled: Only usage metrics are stored
- Use case: Required for response analysis and quality checks

### `store_internal_debug` (default: `false`)
- When enabled: Internal optimization debug data is stored in `runs.debug_internal_json`
- When disabled: Debug data is discarded
- Use case: Required for troubleshooting optimization issues

## Data Retention

### Default Retention Period
- **30 days**: Runs older than 30 days are automatically deleted (configurable via `org_settings.data_retention_days`)
- **Audit Logs**: Retained according to compliance requirements (configurable)
- **Aggregate Metrics**: May be retained longer for analytics (anonymized)

### Retention Worker
- Runs daily via scheduled job (`/internal/retention/run`)
- Deletes runs older than `org_settings.data_retention_days`
- Generates audit log entry for each retention run
- Respects `store_prompts`, `store_responses`, `store_internal_debug` settings

## Data Encryption

### At Rest
- **Provider API Keys**: Encrypted using AES-256-GCM with envelope encryption
- **Database**: All data encrypted at rest by database provider (Supabase/PostgreSQL)
- **Backups**: Encrypted backups with retention policies

### In Transit
- **HTTPS/TLS**: All API communication uses TLS 1.2+
- **Database Connections**: Encrypted database connections

## Data Export and Deletion

### Export
- **Audit Logs**: Exportable as CSV via `/v1/audit/export` (OWNER/ADMIN only)
- **Run Data**: Exportable via API (when enabled)
- **Organization Data**: Exportable via admin panel

### Deletion
- **Runs**: Automatically deleted per retention policy
- **API Keys**: Revoked (soft delete) or permanently deleted
- **Provider Keys**: Revoked (soft delete) or permanently deleted
- **Organization**: Deletion available via admin panel (cascades to all data)

## Compliance Considerations

### GDPR
- **Right to Access**: Users can export their data
- **Right to Erasure**: Users can request data deletion
- **Data Minimization**: Default "no prompt storage" aligns with data minimization principle
- **Purpose Limitation**: Data stored only for stated purposes

### SOC 2
- **Access Controls**: RBAC and API key scopes
- **Audit Logging**: Complete audit trail
- **Data Retention**: Configurable retention policies
- **Encryption**: At rest and in transit

### HIPAA (if applicable)
- **No PHI Storage**: By default, no sensitive data is stored
- **Encryption**: All data encrypted at rest and in transit
- **Access Controls**: Strict access controls and audit logging

## Best Practices

### For Privacy-Conscious Organizations
1. **Keep defaults**: Don't enable `store_prompts`, `store_responses`, or `store_internal_debug` unless necessary
2. **Short retention**: Set `data_retention_days` to minimum required (e.g., 7-30 days)
3. **Regular cleanup**: Review and delete old data regularly
4. **Audit logging**: Enable audit logging for compliance

### For Organizations Needing Full Data
1. **Enable selectively**: Only enable storage options you need
2. **Long retention**: Set appropriate `data_retention_days` for your compliance needs
3. **Regular exports**: Export data regularly for backup
4. **Access controls**: Use RBAC to limit who can access stored data

## Data Location

- **Primary Database**: Supabase/PostgreSQL (location depends on Supabase region)
- **Backups**: Encrypted backups in same region
- **CDN/Cache**: No sensitive data cached

## Third-Party Services

- **Supabase**: Authentication and database (see Supabase privacy policy)
- **Stripe**: Payment processing (see Stripe privacy policy)
- **No LLM Providers**: We do not share data with LLM providers (BYOK mode)

## Questions?

For questions about data handling, contact:
- **Email**: privacy@spectyra.com
- **Documentation**: [docs/ENTERPRISE_SECURITY.md](ENTERPRISE_SECURITY.md)
