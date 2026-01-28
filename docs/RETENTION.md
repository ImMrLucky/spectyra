# Data Retention Policies

## Overview

Spectyra implements configurable data retention policies to help organizations comply with data protection regulations (GDPR, CCPA, etc.) and reduce storage costs.

## Default Retention Period

**30 days**: By default, run records older than 30 days are automatically deleted.

This can be configured per organization via `org_settings.data_retention_days` (minimum: 1 day, maximum: 3650 days / 10 years).

## What Gets Deleted

### Automatically Deleted
- **Run Records**: All run data older than `data_retention_days` is deleted
- **Prompts**: Deleted if `store_prompts = true` (otherwise never stored)
- **Responses**: Deleted if `store_responses = true` (otherwise never stored)
- **Debug Data**: Deleted if `store_internal_debug = true` (otherwise never stored)

### Never Deleted (Unless Explicitly Requested)
- **Audit Logs**: Retained according to compliance requirements (configurable)
- **Organization Metadata**: Names, IDs, creation dates
- **User Accounts**: Authentication data (managed by Supabase)
- **API Keys**: Metadata (hashed keys are never deleted, only revoked)
- **Aggregate Metrics**: May be retained for analytics (anonymized)

## Retention Worker

The retention worker runs daily to enforce retention policies:

- **Endpoint**: `POST /internal/retention/run`
- **Authentication**: Protected by `X-RETENTION-SECRET` header
- **Process**:
  1. Iterates through all organizations
  2. Checks `org_settings.data_retention_days` for each org
  3. Deletes runs older than the retention period
  4. Generates audit log entry (`RETENTION_APPLIED`) for each org processed

### Scheduling

The retention worker should be scheduled to run daily. Options:

1. **Railway Cron**: Add a cron job in Railway dashboard
2. **External Cron Service**: Use a service like cron-job.org
3. **GitHub Actions**: Schedule via GitHub Actions (for self-hosted)

Example cron schedule: `0 2 * * *` (runs daily at 2 AM UTC)

## Configuration

### Per-Organization Settings

```typescript
interface OrgSettings {
  data_retention_days: number;  // Default: 30
  store_prompts: boolean;        // Default: false
  store_responses: boolean;     // Default: false
  store_internal_debug: boolean; // Default: false
}
```

### Setting Retention Period

Via API:
```bash
PATCH /v1/orgs/{orgId}/settings
{
  "data_retention_days": 90  // Keep runs for 90 days
}
```

Via UI:
- Navigate to Settings → Security
- Set "Retention Period (days)"
- Save settings

### Minimum and Maximum

- **Minimum**: 1 day (for testing/compliance)
- **Maximum**: 3650 days (10 years)
- **Default**: 30 days

## Retention Behavior

### What Happens During Retention

1. **Runs older than retention period are deleted**:
   - All columns in `runs` table are deleted
   - Related data (if any) is cascaded
   - No recovery possible after deletion

2. **Audit log entry is created**:
   - Action: `RETENTION_APPLIED`
   - Metadata: `{ count: number_of_runs_deleted, retention_days: number }`
   - Actor: `SYSTEM`

3. **Aggregate metrics are preserved**:
   - Savings ledger entries are not deleted
   - Usage statistics may be aggregated and retained

### Retention and Storage Settings

Retention respects storage settings:

- If `store_prompts = false`: Prompts were never stored, so nothing to delete
- If `store_responses = false`: Responses were never stored, so nothing to delete
- If `store_internal_debug = false`: Debug data was never stored, so nothing to delete

**Example**: If `store_prompts = false` and `data_retention_days = 30`:
- Run metadata (cost, tokens, savings) is deleted after 30 days
- Prompts were never stored, so nothing to delete

## Compliance Considerations

### GDPR
- **Right to Erasure**: Retention policies help enforce data deletion
- **Data Minimization**: Short retention periods align with data minimization
- **Storage Limitation**: Retention ensures data is not kept longer than necessary

### SOC 2
- **Data Lifecycle**: Retention policies demonstrate data lifecycle management
- **Audit Trail**: Retention runs are logged for audit purposes

### Industry Standards
- **Financial Services**: May require longer retention (7+ years)
- **Healthcare**: May require specific retention periods per regulation
- **General Business**: 30-90 days is typical

## Best Practices

### For Compliance
1. **Set appropriate retention**: Match your compliance requirements
2. **Document retention policy**: Document why you chose a specific period
3. **Regular audits**: Review retention logs regularly
4. **Export before deletion**: Export data before retention deletes it (if needed)

### For Cost Optimization
1. **Short retention**: Use minimum retention period (e.g., 7-30 days)
2. **Disable storage**: Keep `store_prompts`, `store_responses`, `store_internal_debug` disabled
3. **Aggregate metrics**: Use aggregate metrics instead of storing full data

### For Debugging
1. **Long retention**: Set longer retention (e.g., 90 days) for debugging
2. **Enable storage**: Enable `store_prompts` and `store_internal_debug` for troubleshooting
3. **Export before deletion**: Export runs before they're deleted

## Manual Deletion

### Delete Specific Runs
- Use API: `DELETE /v1/runs/{runId}` (if implemented)
- Use Admin Panel: Delete runs manually (if available)

### Delete All Runs for Organization
- Not recommended: Use retention policy instead
- If needed: Contact support for bulk deletion

## Monitoring

### Retention Logs
- Check audit logs for `RETENTION_APPLIED` events
- Review retention counts to ensure policies are working

### Alerts
- Set up alerts if retention worker fails
- Monitor retention worker execution

## Questions?

For questions about retention policies, contact:
- **Email**: support@spectyra.com
- **Documentation**: [docs/ENTERPRISE_SECURITY.md](ENTERPRISE_SECURITY.md)
