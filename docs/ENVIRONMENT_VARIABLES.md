# Environment Variables Guide
  
## Where to Set Environment Variables
  
### Local Development
  
**File:** `apps/api/.env`
  
Create this file in the `apps/api/` directory (it’s gitignored for security).
  
### Production (Railway)
  
1. Go to Railway Dashboard
2. Select your API service
3. Click **Variables** tab
4. Add/update each variable
5. Railway will automatically restart your service
  
---
  
## Required Environment Variables
  
```bash
# Database connection (Supabase PostgreSQL, pooler recommended)
DATABASE_URL=postgresql://postgres.PROJECT_REF:<db-password>@aws-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
  
# Supabase configuration
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_JWT_SECRET=<your-supabase-jwt-secret>  # Optional (JWKS verification is recommended)
  
# Owner/admin controls
OWNER_EMAIL=<your-owner-email>
ADMIN_TOKEN=<set-a-long-random-token>
  
# Provider key vaulting (required if you use vaulted keys)
# Generate: openssl rand -base64 32
MASTER_KEY=<32-byte-base64-key>
MASTER_KEY_ID=v1
  
# Retention worker (if enabled)
# Generate: openssl rand -hex 32
RETENTION_SECRET=<secret-for-cron>
```
  
## Notes
  
- Never commit secrets to git (including “temporary” `.env` files).
- If any secrets were ever pushed to a public repo, **rotate them** and purge them from git history.
