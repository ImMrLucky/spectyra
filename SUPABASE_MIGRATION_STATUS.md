# Supabase + Postgres Migration Status

## ✅ Completed

### Phase 0: Supabase Setup
- ✅ Created `supabase/config.toml`
- ✅ Created `supabase/migrations/` directory
- ✅ Created `supabase/seed.sql`
- ✅ Added `.env.example` files with Supabase variables

### Phase 1: Postgres Schema
- ✅ Created migration `20240101000001_initial_schema.sql` with all tables:
  - orgs, org_memberships, projects, api_keys, runs, savings_ledger, baseline_samples, replays, conversation_state
- ✅ Created migration `20240101000002_enable_rls.sql` with RLS policies

### Phase 2: Postgres Storage Layer
- ✅ Replaced `better-sqlite3` with `pg` in `db.ts`
- ✅ Updated `orgsRepo.ts` to use Postgres (async/await, argon2id hashing)
- ✅ Updated `runsRepo.ts` to use Postgres
- ✅ Updated `savingsRepo.ts` to use Postgres
- ✅ Updated `ledgerWriter.ts` to use Postgres
- ✅ Updated `baselineSampler.ts` to use Postgres
- ✅ Updated `estimateBaseline.ts` and `confidence.ts` to async
- ✅ Updated all routes to use async functions
- ✅ Updated package.json (removed better-sqlite3, added pg, argon2, jose)

### Phase 3: Authentication
- ✅ Added Supabase JWT verification middleware (`requireUserSession`)
- ✅ Added org membership middleware (`requireOrgMembership`)
- ✅ Updated API key auth to use argon2id hashing
- ✅ Added API key prefix lookup (first 12 chars)
- ✅ Added scopes support to API keys
- ✅ Provider key override handling (ephemeral) - already implemented

### Phase 4: Angular Integration (Partial)
- ✅ Added `@supabase/supabase-js` to package.json
- ✅ Created `SupabaseService`
- ✅ Updated `ApiClientService` to use Supabase JWT for dashboard calls
- ✅ Updated environment files with Supabase config
- ⏳ Login page needs update to use Supabase
- ⏳ Org/project bootstrap flow needed

## 🔄 In Progress

### Phase 4: Angular Integration
- Update login page to use Supabase auth (email/password or magic link)
- Create org/project bootstrap flow on first login
- Add org/project switcher component

## 📋 Remaining Tasks

### Phase 4 (Complete Angular Integration)
1. Update login page to use SupabaseService
2. Create org/project bootstrap API endpoint (creates org + project + first API key)
3. Add org/project switcher UI component
4. Update settings page to show/manage API keys

### Phase 5 (Deployment)
1. Update Railway deployment config
2. Add migration instructions
3. Test end-to-end flow

## 🔧 Configuration Needed

### Environment Variables (API)
- `DATABASE_URL` - Postgres connection string from Supabase
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for server-side operations)
- `SUPABASE_JWT_SECRET` - JWT secret (optional, JWKS preferred)

### Environment Variables (Web)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anon key (safe for client-side)

## 📝 Notes

- API key authentication still works for gateway usage (`/v1/chat`, `/v1/replay`)
- Dashboard calls (`/v1/runs`, `/v1/savings/*`) now require Supabase JWT
- Hybrid approach: Machine auth (API keys) + Human auth (Supabase JWT)
