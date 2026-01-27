# UI Route Audit - Enterprise UI Overhaul

## Current Routes Analysis

### Public Routes (KEEP)
- **`/` (HomePage)** → **KEEP & UPGRADE** to Overview for authenticated users
  - Current: Landing page for unauthenticated
  - New: Overview dashboard for authenticated, landing for unauthenticated
  - Action: Split into two states

- **`/register`** → **KEEP**
  - Purpose: User registration
  - Status: Already collects org name, works well

- **`/login`** → **KEEP**
  - Purpose: User authentication
  - Status: Supports Supabase JWT + API key, bootstrap flow works

### Protected Routes - Analysis

#### KEEP & UPGRADE (Core Enterprise Features)

1. **`/runs`** → **KEEP & MAJOR UPGRADE**
   - Current: Basic runs list
   - New: Enterprise runs page with:
     - List view: run_id, type (agent/chat), source (sdk-local/sdk-remote/api), model, budget, status, timeline
     - Detail page: Summary, Timeline (agent events), Tool usage, Policy decisions, Artifacts
   - Action: Complete rebuild

2. **`/integrations`** → **KEEP & MAJOR REBUILD**
   - Current: Basic integration snippets
   - New: Scenario-based launcher with:
     - Cards: Claude Agent SDK (VM), Chat APIs, LangGraph/LangChain, Server gateway, On-prem
     - Quickstart + Detailed guides per scenario
     - Copy buttons, Verify Integration flow
   - Action: Complete rebuild

3. **`/projects`** → **KEEP & UPGRADE**
   - Current: Placeholder
   - New: Real enterprise project management:
     - Environments (dev/staging/prod) or tags
     - Project-level budgets
     - Project-level policies
     - Scoped API keys
   - Action: Build from scratch

4. **`/settings`** → **KEEP & UPGRADE**
   - Current: API keys, org info, projects list
   - New: Full enterprise settings:
     - Org profile
     - Members & roles (Owner/Admin/Member)
     - API keys (create/revoke)
     - Data handling settings (prompts, events, retention)
   - Action: Enhance existing

5. **`/admin`** → **KEEP**
   - Current: Admin panel for system administrators
   - Status: Already enterprise-ready, minimal changes needed

#### MERGE (Consolidate Related Features)

6. **`/savings`** → **MERGE into `/usage`**
   - Current: Savings analytics (verified/estimated, breakdowns)
   - New: Part of Usage & Billing page
   - Action: Merge savings data into Usage & Billing

7. **`/billing`** → **MERGE into `/usage`**
   - Current: Trial countdown, subscription status, Stripe checkout
   - New: Part of Usage & Billing page
   - Action: Merge billing into Usage & Billing

8. **`/connections`** → **MERGE into `/integrations`**
   - Current: Step-by-step guide for connecting coding tools
   - New: Part of Integrations page (detailed guides section)
   - Action: Merge content into Integrations

#### DELETE (Filler/Non-Enterprise)

9. **`/scenarios`** → **DELETE**
   - Current: List of proof scenarios for testing
   - Reason: Filler page - proof scenarios are not a production workflow
   - Action: Remove route, can keep scenario data for internal testing

10. **`/scenarios/:id/run`** → **DELETE**
    - Current: Run proof scenario with baseline vs optimized comparison
    - Reason: Filler page - not a production workflow
    - Action: Remove route, functionality can be moved to Runs if needed

11. **`/proof`** → **DELETE**
    - Current: Paste conversation and estimate savings
    - Reason: Filler page - not a production workflow
    - Action: Remove route

### New Routes Required

1. **`/overview`** → **CREATE**
   - Purpose: Enterprise dashboard (replaces home for authenticated users)
   - Features:
     - Integration Status card
     - Last 24h usage
     - Top models used
     - Top policies triggered
     - Recent runs (latest 5)
   - Action: Create new page

2. **`/policies`** → **CREATE**
   - Purpose: Central policy governance
   - Features:
     - Budget policies
     - Model routing policies
     - Tool policies (agentic)
     - Data handling policies
     - Policy version history
     - Simulate decision tool
   - Action: Create new page

3. **`/usage`** → **CREATE**
   - Purpose: Usage & Billing (merges savings + billing)
   - Features:
     - Usage totals by day/week/month
     - Usage by project
     - Budget progress
     - Cost estimates
     - Export CSV
     - Billing/subscription management
   - Action: Create new page, merge savings + billing

4. **`/audit`** → **CREATE**
   - Purpose: Audit logs for enterprise compliance
   - Features:
     - Key creation/rotation
     - Policy changes
     - Membership changes
     - Integration setting changes
     - Run deletion
     - Security events
   - Action: Create new page

## Navigation Structure (New)

### Top-Level Navigation
```
Overview          → /overview (or / for authenticated)
Runs              → /runs
Policies          → /policies
Integrations      → /integrations
Projects          → /projects
Usage & Billing   → /usage
Audit Logs        → /audit
Settings          → /settings
Admin             → /admin (admin only)
```

## Implementation Priority

1. **Phase 1: Route Cleanup**
   - Delete filler routes (scenarios, proof)
   - Merge routes (savings+billing → usage, connections → integrations)
   - Update navigation

2. **Phase 2: Core Pages**
   - Overview page
   - Upgrade Runs page
   - Create Policies page

3. **Phase 3: Integration & Enterprise**
   - Rebuild Integrations page
   - Upgrade Projects page
   - Create Usage & Billing page
   - Create Audit Logs page
   - Upgrade Settings page

4. **Phase 4: Polish**
   - Update copy across app
   - Design system consistency
   - Empty states
   - Verification flows

## Backend API Requirements

### Existing APIs (Verify/Enhance)
- ✅ `GET /v1/runs` - Exists, may need enhancements
- ✅ `GET /v1/runs/:id` - Exists, may need enhancements
- ✅ `POST /v1/agent/options` - Exists
- ✅ `POST /v1/agent/events` - Exists

### New APIs Needed
- ⚠️ `GET /v1/policies` - Need to create
- ⚠️ `POST /v1/policies` - Need to create
- ⚠️ `PUT /v1/policies/:id` - Need to create
- ⚠️ `GET /v1/usage?range=30d&groupBy=project` - Need to create (can enhance existing savings endpoints)
- ⚠️ `GET /v1/audit?range=30d` - Need to create
- ⚠️ `GET /v1/integrations/status` - Need to create
