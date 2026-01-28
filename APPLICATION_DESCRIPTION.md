# Spectyra Application Description - Master Document

**Version:** 2.0 (Enterprise Security Ready)  
**Last Updated:** January 2026  
**Purpose:** Complete reference guide for Spectyra architecture, features, security, user flows, and integration methods

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Core Value Proposition](#core-value-proposition)
3. [System Architecture](#system-architecture)
4. [Enterprise Security & Compliance](#enterprise-security--compliance)
5. [User Interface & Pages](#user-interface--pages)
6. [Integration Methods](#integration-methods)
7. [User Flows](#user-flows)
8. [Savings Calculation & Display](#savings-calculation--display)
9. [Technical Deep Dive](#technical-deep-dive)
10. [API Reference](#api-reference)
11. [Deployment & Operations](#deployment--operations)

---

## Executive Summary

**Spectyra** is an **Enterprise AI Inference Cost-Control Gateway** that reduces LLM token usage and costs by 40-65% for teams and organizations. It works as secure middleware between users and LLM providers (OpenAI, Anthropic, Gemini, Grok), intelligently optimizing prompts before sending them to the LLM while maintaining output quality.

### Key Differentiators

- **Spectral Core v1**: Proprietary multi-operator decision engine based on graph theory and spectral analysis
- **Enterprise-Grade Security**: SOC 2-ready with RBAC, audit logging, data retention, and encryption
- **Developer-Focused**: Optimized for coding workflows with AST-aware code slicing and patch mode
- **BYOK Model**: Users bring their own provider API keys (never stored server-side)
- **SDK-First**: Agent control plane for runtime policy management without requiring a proxy
- **Privacy-First**: No prompt storage by default, configurable retention policies

### Target Market

**Primary Audience**: Developers using coding assistants
- GitHub Copilot, Cursor, Claude Code, Codeium, Tabnine
- Agent frameworks (Claude Agent SDK, LangChain, LangGraph)
- Custom applications with LLM integration

**Why Developers?**
- Developers understand API keys and optimization value
- Developers already have provider API accounts
- BYOK model works perfectly (users pay providers directly)
- Code path optimization is our core strength
- Clear value proposition: 40-65% savings on coding workflows

---

## Core Value Proposition

**"We cut your AI bill by 40–65% on real chat and coding tasks without losing required outputs."**

### How It Works

Spectyra proves savings by running the same workload in two modes:

1. **Baseline Mode**: Sends requests as-is to the LLM (no optimization)
2. **Optimized Mode**: Applies spectral analysis and optimization transforms before sending to the LLM

Both modes are measured for tokens, cost, and quality, enabling side-by-side comparison.

### Optimization Strategies

#### Talk Path (`path: "talk"`)
For normal chat/Q&A workflows:
- **Context Compaction**: Replace stable content with `[[REF:id]]` markers
- **Delta-Only Prompting**: Focus on new/changed information
- **Output Trimming**: Remove boilerplate and scaffolding

#### Code Path (`path: "code"`) - **Recommended for Developers**
For coding assistant workflows:
- **Code Slicing**: Keep only relevant code blocks (AST-aware)
- **Patch-Only Mode**: Request unified diffs + 3-bullet explanations
- **Context Compaction**: Reference stable explanations
- **Delta Prompting**: Focus on changes
- **Function Signature Extraction**: Preserve function signatures when trimming

**Default Path**: Code path is the default for developer-focused tools

### Optimization Levels (0-4 Slider)

- **Level 0 (Minimal)**: No compaction, no slicing, no trimming (testing/debugging)
- **Level 1 (Conservative)**: Light compaction (max 4 REFs), moderate trimming
- **Level 2 (Balanced - Default)**: Moderate compaction (max 6 REFs), moderate trimming
- **Level 3 (Aggressive)**: Heavy compaction (max 8 REFs), aggressive trimming, code slicing enabled
- **Level 4 (Maximum)**: Maximum compaction (max 10 REFs), very aggressive trimming

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐
│   User/Tool     │
│  (SDK/Proxy/    │
│   Extension)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Spectyra API   │
│  (Express/TS)    │
│                 │
│  ┌───────────┐  │
│  │ Optimizer │  │ ← Spectral Core v1
│  │ Pipeline  │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         ▼
┌─────────────────┐
│  LLM Provider   │
│  (OpenAI/       │
│   Anthropic/    │
│   Gemini/Grok)  │
└─────────────────┘
```

### Technology Stack

**Backend:**
- **Runtime**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (via Supabase) with Row Level Security (RLS)
- **Authentication**: Supabase Auth (JWT) + API Keys (argon2id hashing)
- **LLM SDKs**: OpenAI, Anthropic, Google Generative AI, Grok
- **Embeddings**: Local TEI (BAAI/bge-large-en-v1.5) - free, open-source
- **Math**: Custom spectral analysis (no external math libs)
- **Deployment**: Railway (API)

**Frontend:**
- **Framework**: Angular 17 (standalone components)
- **Architecture**: All components use separate `.ts`, `.html`, `.css` files
- **State Management**: RxJS observables
- **Deployment**: Netlify/Vercel

**Database:**
- **Provider**: Supabase (PostgreSQL)
- **Connection**: Connection pooling for performance
- **Security**: Row Level Security (RLS) for multi-tenant isolation
- **Migrations**: Versioned SQL migrations in `supabase/migrations/`

### Database Schema

**Core Tables:**
- `orgs`: Organization entities (trial, subscription status)
- `org_memberships`: Links users to orgs with roles (OWNER/ADMIN/DEV/BILLING/VIEWER)
- `projects`: Optional project grouping within orgs
- `api_keys`: Machine authentication (hashed, scoped, with expiration/IP restrictions)
- `runs`: Individual LLM calls (usage metrics, cost, quality)
- `savings_ledger`: Customer-facing accounting (verified/estimated savings)
- `baseline_samples`: Welford aggregates for baseline estimation
- `agent_runs`: Agent control plane runs (SDK-first integration)
- `agent_events`: Agent event telemetry

**Enterprise Security Tables:**
- `org_settings`: Organization security settings (retention, storage, SSO, domain allowlist)
- `project_settings`: Project-level settings (rate limits, CORS origins)
- `audit_logs`: Complete audit trail for security events
- `provider_credentials`: Encrypted provider API keys (vaulted mode)

### Request Flow (Optimized Mode)

```
User Request
  ↓
API Route (/v1/chat or /v1/replay)
  ↓
Authentication Middleware
  - JWT (dashboard) or API Key (SDK)
  - Resolve org_id and project_id
  - Check trial/subscription status
  ↓
Optimizer Pipeline:
  1. Unitize → SemanticUnits[] (paragraphs, bullets, code blocks)
  2. Embed → Vectors[][] (local TEI embeddings - free)
  3. Build Graph → SignedGraph (similarity, contradiction, dependency edges)
  4. Spectral Analysis → Recommendation (REUSE/EXPAND/ASK_CLARIFY)
  5. Apply Policy → Optimized Messages (context compaction, delta prompting, code slicing)
  6. LLM Call → Response (with maxOutputTokens limit)
  7. Post-Process → Cleaned Response (boilerplate removal, code preservation)
  8. Quality Guard → Pass/Fail (auto-retry on failure)
  ↓
Storage:
  - Run Record (runs table)
  - Savings Ledger Row (savings_ledger table)
  - Baseline Sample Update (baseline_samples table)
  ↓
Response (Redacted - No Moat Internals)
```

---

## Enterprise Security & Compliance

### Security Features Overview

Spectyra implements enterprise-grade security controls designed to meet SOC 2, GDPR, and other compliance requirements:

✅ **Strong Tenant Isolation**: Every request scoped to org/project, enforced server-side  
✅ **RBAC + Scopes**: Role-based access control for humans (JWT) and fine-grained scopes for API keys  
✅ **Audit Logging**: Complete audit trail for all security-relevant events with export capability  
✅ **Provider Key Management**: Encrypted storage (vaulted keys) or BYOK (Bring Your Own Key) mode  
✅ **Data Retention Controls**: Configurable retention policies, "no prompt storage" by default  
✅ **Rate Limiting**: Per-organization/project/API key rate limiting to prevent abuse  
✅ **Security Headers**: Hardened CORS, CSP, and security headers  
✅ **CI Security Gates**: Automated dependency scanning, CodeQL, secret scanning, SBOM generation

### Tenant Isolation

**How It Works:**
1. **Authentication**: User authenticates via JWT (dashboard) or API key (SDK)
2. **Context Resolution**: System resolves `org_id` and `project_id` from authentication
3. **Query Filtering**: All database queries automatically filter by `org_id` (and `project_id` if applicable)
4. **Enforcement**: Middleware ensures no cross-tenant data access

**Implementation:**
- **Request Context**: `req.context.org.id` and `req.context.project.id` set by middleware
- **Database Helpers**: `requireOrg(ctx)` and `requireProject(ctx, orgId)` enforce scoping
- **Storage Repos**: All repository methods filter by org/project

**Verification:**
- Cannot access another org's data by guessing IDs
- Project-scoped API keys cannot access other projects
- All queries include `WHERE org_id = $1` (or equivalent)

### Role-Based Access Control (RBAC)

**Roles (Hierarchical):**
1. **OWNER** (highest): Full access, can manage org settings and billing
2. **ADMIN**: Can manage projects, policies, members, and most settings
3. **DEV**: Can create API keys, manage projects, view runs
4. **BILLING**: Can view usage and billing, cannot modify settings
5. **VIEWER** (lowest): Read-only access to runs and usage

**Role Hierarchy:**
```
OWNER > ADMIN > DEV > BILLING > VIEWER
```

**API Key Scopes:**
- `chat:read`, `chat:write`: Chat optimization
- `agent:read`, `agent:write`: Agent control
- `runs:read`: View runs
- `settings:read`, `settings:write`: Manage settings

### API Key Management

**Features:**
- **Expiration**: Keys can have `expires_at` timestamp
- **IP Restrictions**: Keys can be restricted to specific IP ranges (`allowed_ip_ranges`)
- **Origin Restrictions**: Keys can be restricted to specific origins (`allowed_origins`)
- **Scopes**: Fine-grained permissions per key
- **Revocation**: Keys can be revoked (soft delete)
- **Rotation**: Keys can be rotated (new key, old key revoked)

**Storage:**
- Keys stored as argon2id hash (never plaintext)
- Prefix lookup (first 8 chars) for fast authentication
- Constant-time comparison to prevent timing attacks

### Provider Key Management

**Modes:**
1. **EITHER** (default): Allow both BYOK (header) and vaulted keys
2. **BYOK_ONLY**: Require clients to provide `X-PROVIDER-KEY` header (no storage)
3. **VAULT_ONLY**: Require using encrypted vaulted keys (no BYOK allowed)

**Vaulted Keys:**
- **Encryption**: AES-256-GCM with envelope encryption
- **Storage**: Encrypted in `provider_credentials` table
- **Access**: Decrypted just-in-time for provider calls
- **Rotation**: Support key rotation (new key, old key revoked)
- **Fingerprinting**: Keys are fingerprinted for audit (SHA256(last6 + org_id + salt))

**BYOK (Bring Your Own Key):**
- **Header**: `X-PROVIDER-KEY: sk-...`
- **Ephemeral**: Never stored, used only for the request
- **Privacy**: Maximum privacy, no key storage
- **Never Logged**: Redacted in all logs via centralized redaction utilities

### Audit Logging

**What is Logged:**
- **Authentication**: Login, logout
- **Key Management**: Key created, rotated, revoked
- **Organization**: Org created, settings updated
- **Membership**: Member added, removed, role changed
- **Provider Keys**: Provider key set, revoked
- **Data Export**: Audit log exports
- **Retention**: Retention runs

**Access:**
- Via API: `GET /v1/audit?range=30d&event_type=KEY_CREATED`
- Via UI: Navigate to Audit Logs page, filter by time range and event type
- **Export**: CSV export (OWNER/ADMIN only) via `GET /v1/audit/export`

### Data Retention

**Default Policy:**
- **Retention Period**: 30 days (configurable via `org_settings.data_retention_days`)
- **Default Storage**: No prompts, responses, or debug data stored
- **Automatic Deletion**: Runs older than retention period are deleted daily

**Configuration:**
- `store_prompts`: false (default) - Only prompt hash stored
- `store_responses`: false (default) - Only usage metrics stored
- `store_internal_debug`: false (default) - Debug data discarded
- `data_retention_days`: 30 (configurable)

**Retention Worker:**
- Runs daily via scheduled job (`POST /internal/retention/run`)
- Deletes runs older than `data_retention_days`
- Generates audit log entry for each retention run

### Rate Limiting

**Implementation:**
- **Algorithm**: Token bucket
- **Scope**: Per organization, project, API key, or user
- **Configuration**: Via `project_settings.rate_limit_rps` and `rate_limit_burst`

**Default Limits:**
- **RPS**: 20 requests per second
- **Burst**: 40 requests

**Response:**
- **Status**: 429 Too Many Requests
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### SSO and Access Controls

**Domain Allowlist:**
- Restrict organization membership to specific email domains
- Configure via `org_settings.allowed_email_domains`
- Users with emails from other domains cannot join the organization

**SSO Enforcement:**
- Require users to authenticate via SSO provider
- Configure via `org_settings.enforce_sso`
- When enabled, users must authenticate via configured SSO provider (Supabase SSO)

### Security Headers and CORS

**Security Headers (via `helmet` middleware):**
- **Content-Security-Policy**: Restricts resource loading
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Referrer-Policy**: Controls referrer information
- **Strict-Transport-Security**: Enforces HTTPS

**CORS:**
- **Allowed Origins**: Configurable via `ALLOWED_ORIGINS` environment variable
- **Credentials**: Supported for authenticated requests
- **Methods**: GET, POST, PATCH, DELETE, PUT
- **Headers**: Content-Type, Authorization, X-SPECTYRA-API-KEY, X-PROVIDER-KEY

### CI Security Gates

**Automated Security Checks:**
1. **Dependency Audit**: `pnpm audit --prod` (high/critical vulnerabilities)
2. **OSV Scanner**: Scans lockfile for known vulnerabilities
3. **CodeQL**: Static analysis for security issues
4. **Secret Scanning**: Gitleaks scans for secrets in code
5. **SBOM Generation**: CycloneDX SBOM for releases

**npm Trusted Publishing:**
- SDK packages are published with npm Trusted Publishing (OIDC) for provenance

**Security Documentation:**
- [SECURITY.md](SECURITY.md) - Vulnerability disclosure and security reporting
- [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md) - What data is stored and how
- [docs/RETENTION.md](docs/RETENTION.md) - Data retention policies
- [docs/ENTERPRISE_SECURITY.md](docs/ENTERPRISE_SECURITY.md) - Complete enterprise security guide

---

## User Interface & Pages

### Public Pages

#### 1. Home Page (`/`)
**Purpose**: Public landing page for unauthenticated users

**Features:**
- Hero section with tagline: "Enterprise AI Runtime Control Plane"
- Key features showcase with professional SVG icons
- "How It Works" section (3 steps)
- Call-to-action buttons (Get Started, Sign In)
- Navigation shows Login/Sign Up links when not authenticated

**Behavior:**
- Authenticated users are automatically redirected to `/overview`

#### 2. Registration Page (`/register`)
**Purpose**: User registration and organization creation

**Flow:**
1. User provides email, password, organization name, optional project name
2. System creates Supabase user account
3. System creates org with 7-day free trial
4. System creates default project (if provided)
5. System generates first API key (shown once, must be saved)
6. User automatically logged in with Supabase session
7. API key stored in localStorage for gateway/SDK usage

**Features:**
- Email/password validation
- Organization name required
- Optional project name
- Displays trial information
- Link to login page

#### 3. Login Page (`/login`)
**Purpose**: User authentication

**Dual Auth Tabs:**
- **Email/Password (Supabase)**: Standard login with Supabase JWT
- **API Key (Legacy)**: Direct API key validation for programmatic access

**Supabase Login Flow:**
1. User enters email/password
2. System authenticates with Supabase
3. System checks for org membership
4. If no org: Shows bootstrap form to create organization
5. If org exists: Shows success state with trial info and continue button

**Bootstrap Flow:**
- If logged in but no org, shows org creation form
- Calls `/v1/auth/bootstrap` endpoint with org/project name
- Creates org, project, and first API key
- User must save API key (shown once)

**Success State:**
- Shows trial info, access status, continue button
- Link to registration page

### Protected Pages (Require Authentication)

#### 4. Overview Page (`/overview`)
**Purpose**: Main dashboard for authenticated users

**Features:**
- **Integration Status Card**: Shows which integrations are active (SDK local, SDK remote, API)
- **24h Usage Summary**: Calls, tokens, cost estimate
- **Top Models**: Most used models in last 24h
- **Top Policies**: Most triggered policies in last 24h
- **Recent Runs**: Last 5 runs (agent or chat)
- **Optimization Savings**: Breakdown by optimization type

**Empty States:**
- If no integrations: Shows integration tiles (Claude Agent SDK, Chat APIs, LangGraph/LangChain)
- If no runs: Shows message to get started

#### 5. Scenarios Page (`/scenarios`)
**Purpose**: Browse and run test scenarios

**Features:**
- Lists available test scenarios
- Filter by path (talk/code/all)
- Click scenario to run it
- Hero subtitle: "Optimize API-based LLM usage for teams. Reduce inference cost by 40-65%."
- Dismissible banner directing users to Integrations page

**Scenarios:**
- Pre-defined test cases with conversation history
- Include quality validation rules (regex patterns)
- Support both "talk" and "code" paths

#### 6. Run Page (`/scenarios/:id/run`)
**Purpose**: Run scenario and view results

**Features:**
- Shows scenario details
- **Optimization Level Slider** (0-4) with path-specific labels
- **Provider/Model Selector**: Choose LLM provider and model
- **Proof Mode Toggle**: "Live" vs "Estimator" (estimator mode works without subscription)
- **"Run Replay" Button**: Triggers baseline + optimized runs

**Results Display:**
- **Savings Card**: Shows savings with "VERIFIED" or "ESTIMATED" badge
- **Side-by-Side Comparison**: Baseline vs optimized
- **Token/Cost Table**: Detailed breakdown for each run
- **Output Comparison**: Shows both responses
- **Advanced Debug Panel**: Hidden by default, toggleable (shows moat internals)

#### 7. Proof Mode Page (`/proof`)
**Purpose**: Paste conversations to estimate savings without LLM calls

**Features:**
- Paste conversation from ChatGPT, Claude, or any chat interface
- Supports plain text or JSON format
- **Configuration**: Path, provider, model, optimization level
- **Conversation Preview**: Shows parsed messages after parsing
- **Savings Estimates**: Shows baseline and optimized estimates
- **Confidence Band Display**: High/Medium/Low
- **"ESTIMATED" Badge**: Indicates no real LLM calls were made

**Key Benefit**: Test optimization on real conversations without costs (works even if trial expired)

#### 8. Integrations Page (`/integrations`)
**Purpose**: Integration setup and code snippets

**Features:**
- **Three Integration Methods:**
  1. **Hosted Gateway**: Direct API integration (code snippets)
  2. **Local Proxy**: Desktop coding tools setup
  3. **Server SDK**: Programmatic integration (with browser warning)
- Dynamic code snippets from `/v1/integrations/snippets` API
- Enterprise-focused messaging
- Copy buttons for code snippets

#### 9. Connections Page (`/connections`)
**Purpose**: Step-by-step guide for connecting coding tools

**Features:**
- Instructions for installing and configuring proxy
- Tool-specific configuration (Copilot, Cursor, Claude Code, etc.)
- Links to documentation
- Environment variable setup guide

#### 10. Runs Page (`/runs`)
**Purpose**: View all runs (agent and chat)

**Features:**
- Table of all runs (filtered by org/project)
- **Columns**: ID, Type (agent/chat), Source (sdk-local/sdk-remote/api), Model, Status, Created, Actions
- Link to run details
- Enterprise-focused labeling
- Filtering and pagination

#### 11. Usage Page (`/usage`)
**Purpose**: Usage analytics and billing status

**Features:**
- **Usage Summary**: Total calls, tokens, cost estimate
- **Time Range Selector**: 24h, 7d, 30d, 90d
- **Budget Progress**: Shows budget limits and usage
- **Billing Status**: Trial countdown, subscription status, upgrade button
- **Optimization Savings**: Breakdown by optimization type
- **Project Usage**: Usage breakdown by project
- **Export Button**: CSV export (coming soon)

#### 12. Savings Page (`/savings`) - Redirects to `/usage`
**Purpose**: Legacy route, redirects to Usage page

#### 13. Policies Page (`/policies`)
**Purpose**: Manage runtime policies for agent control

**Features:**
- **Policy Types:**
  - **Budget Policy**: Daily/monthly/per-run limits
  - **Model Routing**: Allowed/denied models and providers
  - **Tool Policy**: Allowed/denied tools, filesystem scope
  - **Data Handling**: Prompt/event transmission, retention
- **Policy List**: Shows all policies with enable/disable toggle
- **Create Policy**: Form to create new policies
- **Simulate Decision**: Test how policies apply to prompts
- **Top Triggered Policies**: Shows most triggered policies in last 24h

#### 14. Projects Page (`/projects`)
**Purpose**: Project management

**Features:**
- Lists all projects in organization
- Create new projects
- Project details (name, created date)
- Enterprise organization structure

#### 15. Settings Page (`/settings`)
**Purpose**: Organization and API key management

**Features:**
- **API Key Management**:
  - Create new API keys (named, org-level or project-scoped)
  - List all API keys with metadata (name, project, created, last used, status)
  - Revoke API keys (soft delete)
  - Copy newly created keys (shown once)
- **Organization Info**: Name, status, trial end date
- **Projects List**: All projects in organization

#### 16. Security Settings Page (`/settings/security`)
**Purpose**: Enterprise security configuration

**Features:**
- **Data Retention**: Configure retention period (days)
- **Storage Toggles**:
  - Store prompts (default: false)
  - Store responses (default: false)
  - Store internal debug (default: false)
- **Semantic Cache**: Enable/disable semantic cache
- **SSO Enforcement**: Require SSO authentication
- **Domain Allowlist**: Restrict org membership to specific email domains
- **IP Ranges**: Configure allowed IP ranges for API keys
- **Provider Key Mode**: EITHER, BYOK_ONLY, or VAULT_ONLY

#### 17. Provider Keys Page (`/settings/provider-keys`)
**Purpose**: Manage provider API keys

**Features:**
- **List Vaulted Keys**: Shows provider, fingerprint, created date (masked)
- **Add Provider Key**: Set/update encrypted vaulted key
- **Revoke Key**: Soft delete provider key
- **Provider Key Mode**: Configure org's provider key mode (EITHER/BYOK_ONLY/VAULT_ONLY)

#### 18. Audit Logs Page (`/audit`)
**Purpose**: View security audit logs

**Features:**
- **Audit Log Table**: Shows all security-relevant events
- **Filters**: Time range, event type
- **Event Types**: LOGIN, LOGOUT, KEY_CREATED, KEY_REVOKED, SETTINGS_UPDATED, etc.
- **Export Button**: CSV export (OWNER/ADMIN only)
- **Event Details**: Click to view full log details

#### 19. Admin Page (`/admin`)
**Purpose**: System administration (owner only)

**Features:**
- **Admin Token Authentication**: Requires `X-ADMIN-TOKEN` header
- **List All Organizations**: Shows all orgs with stats
- **View Organization Details**: Projects, API keys, runs
- **Edit Organization**: Update org name
- **Delete Organizations**: Danger zone (cascades to all data)
- **Access Control**: Only visible to owner (gkh1974@gmail.com)

---

## Integration Methods

### 1. SDK (Agent Control Plane) - **Recommended for Agent Frameworks**

**Best For**: Claude Agent SDK, LangChain, LangGraph, custom agent frameworks

**Two Integration Modes:**

#### A. Local SDK Mode (Default)
**No API calls required.** SDK makes local decisions about agent options.

```typescript
import { createSpectyra } from '@spectyra/sdk';

// Local mode - works offline, no API calls
const spectyra = createSpectyra({ mode: "local" });

// One line integration with Claude Agent SDK
const options = spectyra.agentOptions(ctx, prompt);
const result = await agent.query({ prompt, options });
```

**Benefits:**
- Works offline
- No network latency
- Simple integration
- Good for development and testing

#### B. API Control Plane Mode (Enterprise)
**Centralized policy management.** SDK calls Spectyra API for agent options and streams events.

```typescript
const spectyra = createSpectyra({
  mode: "api",
  endpoint: "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

// Fetch options from remote API
const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
const result = await agent.query({ prompt, options: response.options });

// Stream events for telemetry
for await (const event of agentStream) {
  await spectyra.sendAgentEvent(ctx, event);
}
```

**Benefits:**
- Centralized policy management
- Org/project-scoped decisions
- Telemetry and analytics
- Enterprise control and compliance

**API Endpoints:**
- `POST /v1/agent/options` - Get agent options based on prompt metadata
- `POST /v1/agent/events` - Send agent event for telemetry

**Installation:**
```bash
npm install @spectyra/sdk
```

### 2. Hosted Gateway API - **Recommended for Direct Integration**

**Best For**: Custom applications, non-JavaScript environments, maximum flexibility

**How It Works:**
1. Send requests to Spectyra API endpoint: `POST /v1/chat`
2. Include `X-SPECTYRA-API-KEY` header (your API key)
3. Include `X-PROVIDER-KEY` header (your provider API key - BYOK)
4. Receive optimized response with savings metrics

**Request Format:**
```json
{
  "path": "code",
  "optimization_level": 2,
  "messages": [...],
  "provider": "openai",
  "model": "gpt-4o-mini",
  "mode": "optimized"
}
```

**Response Format:**
```json
{
  "text": "Optimized response...",
  "usage": {
    "input_tokens": 1200,
    "output_tokens": 450,
    "total_tokens": 1650
  },
  "cost": 0.02475,
  "savings": {
    "tokens_saved": 850,
    "pct_saved": 34.0,
    "cost_saved_usd": 0.01275,
    "confidence_band": "high"
  }
}
```

**Code Snippets:**
- Available on `/integrations` page
- Dynamic snippets from `/v1/integrations/snippets` API
- Examples for Python, Node.js, cURL, etc.

### 3. Local Proxy - **Recommended for Desktop Coding Tools**

**Best For**: GitHub Copilot, Cursor, Claude Code, Codeium, Tabnine

**How It Works:**
1. Install proxy: `npm install -g @spectyra/proxy`
2. Configure environment variables (API URL, API key, provider keys)
3. Start proxy: `spectyra-proxy` (runs on localhost:3001)
4. Configure coding tool to use `http://localhost:3001` as API endpoint
5. Proxy automatically routes through Spectyra API

**Features:**
- **Secure by Default**: Binds to localhost, no key logging
- **Multi-Provider Support**: OpenAI, Anthropic, Gemini, Grok
- **Automatic Features**:
  - API format conversion (handles different provider formats)
  - Path detection (auto-detects "talk" vs "code" from messages)
  - Provider detection (from model name and endpoint)
- **Pass-Through Mode**: Optional fallback to direct provider if Spectyra unavailable

**Configuration:**
```bash
export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
export SPECTYRA_API_KEY="sk_spectyra_..."
export OPENAI_API_KEY="sk-..."  # Optional, for pass-through
export SPECTYRA_OPT_LEVEL=2
```

**Endpoints:**
- OpenAI-compatible: `POST /v1/chat/completions`
- Anthropic-compatible: `POST /v1/messages`

**See**: `tools/proxy/README.md` for enterprise usage guide

### 4. Browser Extension - **For Web-Based LLM Tools**

**Best For**: ChatGPT, Claude Web, Gemini Web (web-based tools)

**Features:**
- Chrome/Edge MV3 extension
- Intercepts LLM API calls from web UIs
- Routes through Spectyra automatically
- Shows real-time savings widget overlay
- Session savings tracking
- Configurable optimization level and path

**Note**: May violate provider ToS (intercepts web UI backend). Use Local Proxy for desktop tools (safer).

**See**: `extensions/browser-extension/README.md`

---

## User Flows

### Flow 1: New User Registration

```
1. User visits homepage (/)
   ↓
2. Clicks "Get Started" → /register
   ↓
3. Fills registration form:
   - Email, password
   - Organization name
   - Optional project name
   ↓
4. System creates:
   - Supabase user account
   - Organization with 7-day trial
   - Default project (if provided)
   - First API key
   ↓
5. User sees API key (shown once, must save)
   ↓
6. User automatically logged in
   ↓
7. Redirected to /overview
```

### Flow 2: Existing User Login

```
1. User visits homepage (/)
   ↓
2. Clicks "Sign In" → /login
   ↓
3. Enters email/password
   ↓
4. System authenticates with Supabase
   ↓
5. System checks for org membership
   ↓
6a. If org exists:
    - Shows success state
    - Redirects to /overview
   ↓
6b. If no org:
    - Shows bootstrap form
    - User creates org
    - System creates org, project, API key
    - Redirects to /overview
```

### Flow 3: Running a Scenario (Proof Mode)

```
1. User navigates to /scenarios
   ↓
2. Browses scenarios, filters by path
   ↓
3. Clicks scenario → /scenarios/:id/run
   ↓
4. Configures:
   - Optimization level (0-4 slider)
   - Provider and model
   - Proof mode (Live or Estimator)
   ↓
5. Clicks "Run Replay"
   ↓
6a. If "Live" mode:
    - System runs baseline (no optimization)
    - System runs optimized (full pipeline)
    - Calculates verified savings
    - Shows side-by-side comparison
   ↓
6b. If "Estimator" mode:
    - System estimates baseline tokens/cost
    - System estimates optimized tokens/cost
    - Calculates estimated savings
    - Shows estimates (no real LLM calls)
   ↓
7. User views results:
   - Savings card with badge (VERIFIED/ESTIMATED)
   - Token/cost comparison
   - Output comparison
   - Advanced debug panel (optional)
```

### Flow 4: Pasting Conversation (Proof Mode)

```
1. User navigates to /proof
   ↓
2. Pastes conversation (plain text or JSON)
   ↓
3. System parses conversation into message format
   ↓
4. User configures:
   - Path (talk/code)
   - Provider and model
   - Optimization level
   ↓
5. System calls /v1/proof/estimate
   ↓
6. System estimates savings (no real LLM calls)
   ↓
7. User views:
   - Conversation preview
   - Savings summary (tokens saved, cost saved, % saved)
   - Confidence band
   - Baseline and optimized estimates
   - "ESTIMATED" badge
```

### Flow 5: SDK Integration (Agent Control Plane)

```
1. Developer installs SDK: npm install @spectyra/sdk
   ↓
2. Developer creates Spectyra instance:
   - Local mode: createSpectyra({ mode: "local" })
   - API mode: createSpectyra({ mode: "api", endpoint, apiKey })
   ↓
3. Developer integrates with agent framework:
   - Calls spectyra.agentOptions(ctx, prompt)
   - Uses options with Claude Agent SDK
   ↓
4. Agent runs with Spectyra-controlled options:
   - Model selection
   - Budget limits
   - Tool permissions
   ↓
5. Developer streams events (optional):
   - spectyra.sendAgentEvent(ctx, event)
   - Or: spectyra.observeAgentStream(ctx, stream)
   ↓
6. Events appear in dashboard:
   - /overview shows integration status
   - /runs shows agent runs
   - /usage shows usage analytics
```

### Flow 6: Local Proxy Integration (Coding Tools)

```
1. Developer installs proxy: npm install -g @spectyra/proxy
   ↓
2. Developer configures environment variables:
   - SPECTYRA_API_URL
   - SPECTYRA_API_KEY
   - Provider API keys (optional, for pass-through)
   ↓
3. Developer starts proxy: spectyra-proxy
   ↓
4. Developer configures coding tool:
   - Cursor: Set API endpoint to http://localhost:3001
   - Copilot: Configure proxy settings
   - Claude Code: Set custom endpoint
   ↓
5. Coding tool makes requests:
   - Tool → Proxy → Spectyra API → LLM Provider
   ↓
6. Proxy automatically:
   - Detects path (talk/code)
   - Converts API format
   - Routes through Spectyra
   - Returns optimized response
   ↓
7. Savings appear in dashboard:
   - /usage shows usage and savings
   - /runs shows all runs
```

### Flow 7: Viewing Savings

```
1. User navigates to /usage (or /savings redirects there)
   ↓
2. User selects time range (24h, 7d, 30d, 90d)
   ↓
3. System loads:
   - Usage summary (calls, tokens, cost)
   - Budget progress
   - Billing status
   - Optimization savings breakdown
   - Project usage breakdown
   ↓
4. User views:
   - Total savings (verified + estimated)
   - Tokens saved
   - Cost saved
   - Confidence bands
   ↓
5. User can export data (CSV)
```

---

## Savings Calculation & Display

### Savings Types

#### 1. Verified Savings (confidence = 1.0)
- **Source**: Replay/scenario runs
- **Method**: Paired baseline + optimized measurements
- **Calculation**: `baseline.tokens - optimized.tokens`
- **Confidence**: Always 1.0 (verified, not estimated)
- **Badge**: "VERIFIED"

#### 2. Estimated Savings (confidence = 0.15 - 0.99)
- **Source**: Optimized runs without baseline
- **Method**: Baseline estimated from historical samples (Welford aggregation)
- **Calculation**: `estimated_baseline.tokens - optimized.tokens`
- **Confidence**: Based on:
  - Sample size (more samples = higher confidence)
  - Variance (lower variance = higher confidence)
  - Recency (recent samples = higher confidence)
- **Badge**: "ESTIMATED"
- **Confidence Bands**:
  - **High**: ≥0.85
  - **Medium**: 0.70-0.85
  - **Low**: <0.70

### Savings Ledger

All savings are stored in `savings_ledger` table:
- `savings_type`: "verified" | "shadow_verified" | "estimated"
- `tokens_saved`, `pct_saved`, `cost_saved_usd`
- `confidence`: 0.0 - 1.0
- `workload_key`: Groups comparable runs
- Links to run IDs for audit trail
- Filtered by org/project for multi-tenant isolation

### Baseline Estimation (Welford's Algorithm)

For optimized runs without baseline:
1. System maintains Welford aggregates per `workload_key`:
   - `n`: Sample count
   - `mean`: Mean tokens/cost
   - `M2`: Variance accumulator
2. When baseline run occurs:
   - Update `n`, `mean`, `M2` incrementally
   - Variance = `M2 / (n - 1)`
3. When estimating baseline:
   - Use `mean` as estimated baseline
   - Calculate confidence from sample size, variance, recency

### Confidence Scoring

```
sample_conf = 1 - exp(-n/10)        // Rises with sample size
stability_conf = 1 - CV              // CV = std/mean (coefficient of variation)
recency_conf = 1 - days_old/30       // Decays over 30 days

confidence = 0.15 + 0.55*sample_conf + 0.20*stability_conf + 0.10*recency_conf
```

### Display in UI

#### Savings Card (Run Page)
- Shows savings percentage
- Badge: "VERIFIED" or "ESTIMATED"
- Confidence band (High/Medium/Low)
- Tokens saved, cost saved

#### Usage Page
- **KPI Cards**: Verified Savings, Total Savings, Tokens Saved
- **Time Series Chart**: Daily/weekly trends (verified vs estimated)
- **Breakdowns**: By optimization level, by path (talk/code)
- **Filters**: Date range, path, provider, model
- **Export**: CSV/JSON export of savings ledger

#### Overview Page
- **Optimization Savings**: Breakdown by optimization type
- **24h Usage Summary**: Includes savings metrics

---

## Technical Deep Dive

### Spectral Core v1 (The Moat - Multi-Operator)

**The Core Algorithm:**

1. **Unitization**: Chunk messages into semantic units
   - Deterministic IDs: SHA256 hash of normalized text + kind + role
   - Enables stable reuse and caching across sessions
   - Units have: id, text, kind (fact/constraint/explanation/code/patch), turn index

2. **Embedding**: Generate vectors for similarity
   - Uses local TEI with BAAI/bge-large-en-v1.5 (free, open-source)
   - Safe cosine similarity (handles missing embeddings)
   - Embeddings are cached (Redis/Postgres) to reduce compute
   - Configurable via EMBEDDINGS_PROVIDER env var

3. **Graph Build**: Create signed weighted graph
   - **Nodes**: Semantic units
   - **Similarity edges**: 
     - Base cosine similarity > 0.85
     - Temporal proximity boost (same turn: +0.15, adjacent: +0.08)
     - Kind similarity boost (constraints: +0.12, facts: +0.08)
   - **Contradiction edges**:
     - Numeric conflicts (relative difference > 15%, weighted by strength)
     - Negation patterns (extended list: "not", "never", "can't", etc.)
     - Semantic contradictions (always/never, include/exclude, increase/decrease)
     - Temporal contradictions (past vs future markers)
   - **Dependency edges** (code path):
     - Patch → code blocks (0.7)
     - Constraint → code blocks (0.5-0.7)
     - Code references (0.6)

4. **Signed Laplacian**: Compute L = D - W
   - D: Degree matrix
   - W: Weighted adjacency matrix (signed)

5. **Eigenvalue Estimation**: Estimate λ₂ using power iteration with orthogonalization
   - λ₂: Second smallest eigenvalue (algebraic connectivity)
   - Higher λ₂ = better connectivity = more stable

6. **Multi-Operator Stability Analysis**:
   - **Spectral component**: Enhanced sigmoid with non-linear contradiction penalty and connectivity reward
   - **Random walk gap**: Measures topic mixing (high gap = stable state)
   - **Heat-trace complexity**: Estimates compressibility using Hutchinson estimator
   - **Curvature analysis**: Forman-Ricci-like curvature per node (detects conflict hotspots)
   - **Node features**: Age, length, kind weight, novelty (centroid distance)
   - **Combined stability**: Weighted combination of all operators

7. **Adaptive Thresholds**: Adjusts tHigh/tLow based on conversation history
   - Unstable past → more conservative
   - Increasing contradictions → more cautious

8. **Recommendation**: Map stabilityFinal to REUSE/EXPAND/ASK_CLARIFY
   - **REUSE**: stabilityFinal >= tHigh (default 0.70) → Aggressive optimization
   - **EXPAND**: tLow < stabilityFinal < tHigh → Moderate optimization
   - **ASK_CLARIFY**: stabilityFinal <= tLow (default 0.35) OR high contradiction → Return clarifying question (saves tokens)

### Policy Transforms

#### Talk Policy (if path = "talk")
- **Context Compaction**: Replace stable units with `[[REF:id]]` + glossary
- **Delta Prompting**: System instruction to focus on new/changed info
- **Output Trimming**: Post-process to remove boilerplate

#### Code Policy (if path = "code")
- **Code Slicing**: Keep only most relevant code block (AST-aware)
- **Context Compaction**: Replace stable explanations with REFs
- **Patch Mode**: Request unified diff + 3-bullet explanation
- **Delta Prompting**: Focus on changes
- **Output Trimming**: Enforce patch format, remove scaffolding

### Quality Guard

After optimized response:
1. Runs required checks (regex patterns from scenario)
2. If any check fails:
   - Marks quality.pass = false
   - Stores failure reasons
   - **Auto-retry** (if enabled):
     - Relaxes optimization (less aggressive)
     - Retries up to 2 times
     - Stores retry metadata

### Post-Processing

**Extended Boilerplate Removal:**
- "Sure, here's...", "Let me know...", "Hope this helps"
- "Here's the code", "I've created/made/written"
- "As I mentioned", "To summarize"

**Code Block Preservation:**
- Extracts and preserves code blocks during processing
- Restores code blocks after trimming
- Shows count of trimmed code blocks

**Smart Trimming:**
- Preserves complete sentences (not hard cuts)
- Preserves function signatures in code
- Removes redundant phrases

**Patch Format Enforcement:**
- Keeps unified diff + essential bullets
- Preserves important warnings/notes

---

## API Reference

### Authentication

**Two Methods:**
1. **Supabase JWT**: `Authorization: Bearer <jwt>` (dashboard users)
2. **API Key**: `X-SPECTYRA-API-KEY: sk_spectyra_...` (machine auth)

**Provider Keys (BYOK):**
- `X-PROVIDER-KEY: sk-...` (ephemeral, never stored)

### Core Endpoints

#### Chat Optimization
- `POST /v1/chat` - Real-time chat optimization (requires active trial/subscription)
  - Body: `{ path, optimization_level, messages, provider, model, mode, dry_run? }`
  - Response: `{ text, usage, cost, savings? }`

#### Proof Mode
- `POST /v1/replay` - Run scenario in proof mode
  - Body: `{ scenario_id, provider, model, optimization_level, proof_mode? }`
  - Response: `{ baseline, optimized, verified_savings, quality }`

- `POST /v1/proof/estimate` - Estimate savings from pasted conversation
  - Body: `{ path, provider, model, optimization_level, messages }`
  - Response: `{ savings, confidence_band, baseline_estimate, optimized_estimate }`

#### Agent Control Plane
- `POST /v1/agent/options` - Get agent options for prompt context
  - Body: `{ promptMeta }`
  - Response: `{ options, reasons }`

- `POST /v1/agent/events` - Send agent event for telemetry
  - Body: `{ runId, event }`

#### Usage & Savings
- `GET /v1/usage` - Get usage summary
- `GET /v1/usage/top-models` - Get top models
- `GET /v1/usage/optimizations` - Get optimization savings breakdown
- `GET /v1/savings/summary` - Get savings summary
- `GET /v1/savings/timeseries` - Get savings time series
- `GET /v1/savings/by-level` - Get savings by optimization level
- `GET /v1/savings/by-path` - Get savings by path (talk/code)

#### Runs
- `GET /v1/runs` - List runs (filtered by org/project)
- `GET /v1/runs/:id` - Get run details

#### Scenarios
- `GET /v1/scenarios` - List test scenarios
- `GET /v1/scenarios/:id` - Get scenario details

#### Authentication & Organization
- `GET /v1/auth/me` - Get current org/project info
- `POST /v1/auth/bootstrap` - Bootstrap org/project after first login
- `GET /v1/auth/api-keys` - List API keys
- `POST /v1/auth/api-keys` - Create API key
- `DELETE /v1/auth/api-keys/:id` - Revoke API key
- `POST /v1/orgs/:orgId/api-keys/:keyId/rotate` - Rotate API key

#### Settings
- `GET /v1/orgs/:orgId/settings` - Get org settings
- `PATCH /v1/orgs/:orgId/settings` - Update org settings
- `GET /v1/projects/:projectId/settings` - Get project settings
- `PATCH /v1/projects/:projectId/settings` - Update project settings

#### Provider Keys
- `GET /v1/orgs/:orgId/provider-keys` - List provider keys (masked)
- `POST /v1/orgs/:orgId/provider-keys` - Set/update provider key
- `DELETE /v1/orgs/:orgId/provider-keys/:id` - Revoke provider key
- `PATCH /v1/orgs/:orgId/provider-key-mode` - Update provider key mode

#### Audit Logs
- `GET /v1/audit` - Get audit logs (filtered by time range, event type)
- `GET /v1/audit/export` - Export audit logs as CSV (OWNER/ADMIN only)

#### Billing
- `GET /v1/billing/status` - Get billing status
- `POST /v1/billing/checkout` - Create Stripe checkout session
- `POST /v1/billing/webhook` - Stripe webhook handler

#### Integrations
- `GET /v1/integrations/snippets` - Get integration code snippets

### Response Formats

**Standard Response:**
```json
{
  "text": "Response text...",
  "usage": {
    "input_tokens": 1200,
    "output_tokens": 450,
    "total_tokens": 1650
  },
  "cost": 0.02475,
  "savings": {
    "tokens_saved": 850,
    "pct_saved": 34.0,
    "cost_saved_usd": 0.01275,
    "confidence_band": "high"
  }
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "details": "Additional details (development only)"
}
```

**No Moat Internals Exposed:**
- Spectral numbers (λ₂, stabilityIndex, contradictionEnergy) - **NEVER**
- Optimizer internals (REFs used, delta used, code sliced) - **NEVER**
- Debug internal JSON - **NEVER**
- Provider API keys - **NEVER**

**Always Exposed:**
- Usage tokens (input/output/total) - **YES**
- Cost (USD) - **YES**
- Savings numbers (tokens saved, %, cost saved) - **YES**
- Confidence band (High/Medium/Low, not numeric score) - **YES**
- Quality pass/fail (boolean, no details) - **YES**

---

## Deployment & Operations

### Environment Variables

**Backend (API):**
- `DATABASE_URL`: PostgreSQL connection string (Supabase pooler recommended)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_JWT_SECRET`: Supabase JWT secret for token verification
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for admin operations)
- `STRIPE_SECRET_KEY`: Stripe secret key for billing
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signature verification
- `ADMIN_TOKEN`: Admin panel access token
- `MASTER_KEY`: Base64-encoded 32-byte key for provider key encryption
- `RETENTION_SECRET`: Secret for retention worker endpoint
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `PORT`: API server port (default: 8080)
- `NODE_ENV`: Environment (development/production)

**Frontend (Web):**
- `apiUrl`: API base URL (e.g., `https://spectyra.up.railway.app/v1`)
- `supabaseUrl`: Supabase project URL
- `supabaseAnonKey`: Supabase anonymous key for client-side auth

### Deployment

**API (Railway):**
- Deploy from GitHub repository
- Set environment variables in Railway dashboard
- Automatic deployments on push to main

**Frontend (Netlify/Vercel):**
- Deploy from GitHub repository
- Set environment variables in deployment platform
- Automatic deployments on push to main

### Database Migrations

**Location**: `supabase/migrations/`

**Run Migrations:**
```bash
# Via Supabase CLI
supabase db push

# Or manually via psql
psql $DATABASE_URL -f supabase/migrations/YYYYMMDD_migration_name.sql
```

**Migration Naming**: `YYYYMMDD_description.sql`

### Monitoring

**Logs:**
- API logs: Railway dashboard
- Frontend logs: Netlify/Vercel dashboard
- All logs automatically redact secrets via centralized redaction utilities

**Metrics:**
- Usage metrics: Available via `/v1/usage` endpoint
- Savings metrics: Available via `/v1/savings/*` endpoints
- Audit logs: Available via `/v1/audit` endpoint

### Backup & Recovery

**Database:**
- Supabase handles automatic backups
- Point-in-time recovery available
- Manual backups via Supabase dashboard

**Data Export:**
- Audit logs: CSV export via `/v1/audit/export`
- Savings ledger: CSV export via `/v1/savings/export`
- Run data: Exportable via API (when enabled)

---

## Local Optimization Stack (Embeddings + NLI)

### Overview

Spectyra uses **local, open-source** services for all optimizer-internal computations:
- **Embeddings**: HuggingFace Text Embeddings Inference (TEI) with BGE models
- **NLI (Natural Language Inference)**: FastAPI service with DeBERTa MNLI

**Key Principle**: Spectyra NEVER pays for customer LLM tokens. Customers provide their own API keys for final LLM calls.

### Cost Model

| Component | Cost | Description |
|-----------|------|-------------|
| Embeddings (TEI) | **FREE** | Self-hosted, open-source |
| NLI Service | **FREE** | Self-hosted, open-source |
| Final LLM Calls | **Customer pays** | BYOK or vaulted keys |
| Spectyra API | Infrastructure only | Your hosting costs |

### Provider Key Enforcement

```
ALLOW_ENV_PROVIDER_KEYS=false  # PRODUCTION (default)
ALLOW_ENV_PROVIDER_KEYS=true   # Development/demo only
```

When `ALLOW_ENV_PROVIDER_KEYS=false` (production):
1. Customer must provide key via `X-PROVIDER-KEY` header (BYOK)
2. Or have a vaulted key configured for their organization
3. Otherwise, the request fails with 401

### Configuration Reference

#### Provider Key Enforcement

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_ENV_PROVIDER_KEYS` | `false` | If `true`, allows fallback to env provider keys (dev only) |

#### Embeddings

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDINGS_PROVIDER` | `local` | Provider: `local`, `http`, or `openai` |
| `EMBEDDINGS_HTTP_URL` | `http://localhost:8081` | URL of embedding service (TEI) |
| `EMBEDDINGS_HTTP_TOKEN` | (empty) | Optional auth token |
| `EMBEDDINGS_MODEL` | `BAAI/bge-large-en-v1.5` | Model name |
| `EMBEDDINGS_CACHE_ENABLED` | `true` | Enable embedding cache |
| `EMBEDDINGS_CACHE_TTL_DAYS` | `30` | Cache TTL in days |

#### NLI (Natural Language Inference)

| Variable | Default | Description |
|----------|---------|-------------|
| `NLI_PROVIDER` | `local` | Provider: `local`, `http`, or `disabled` |
| `NLI_HTTP_URL` | `http://localhost:8082` | URL of NLI service |
| `NLI_HTTP_TOKEN` | (empty) | Optional auth token |
| `NLI_MODEL` | `microsoft/deberta-v3-large-mnli` | Model name |
| `NLI_TIMEOUT_MS` | `10000` | Request timeout |

#### Cache

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | (empty) | Redis URL for caching |
| `CACHE_USE_POSTGRES` | `false` | Use Postgres if Redis unavailable |

### Deployment Modes

#### Local Development (Docker Compose)

```bash
cd infra
docker compose up -d
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- Embeddings/TEI (port 8081)
- NLI service (port 8082)

Then run the API:
```bash
export DATABASE_URL="postgres://spectyra:spectyra_dev_password@localhost:5432/spectyra"
export EMBEDDINGS_HTTP_URL="http://localhost:8081"
export NLI_HTTP_URL="http://localhost:8082"
export ALLOW_ENV_PROVIDER_KEYS="true"
pnpm dev:api
```

#### Kubernetes (Production)

```bash
kubectl create namespace spectyra
kubectl apply -f infra/k8s/
```

See `infra/k8s/` for manifests:
- `embeddings-tei-deployment.yaml` - TEI for embeddings
- `nli-deployment.yaml` - NLI service
- `api-deployment.yaml` - Spectyra API
- `secrets-example.yaml` - Secret configuration

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Spectyra API                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Optimizer Pipeline                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │  │
│  │  │  Unitize    │→ │  Embed      │→ │ Build Graph │   │  │
│  │  │  Messages   │  │  (TEI)      │  │ (NLI opt.)  │   │  │
│  │  └─────────────┘  └──────┬──────┘  └──────┬──────┘   │  │
│  │                          │                │          │  │
│  │                          ▼                ▼          │  │
│  │                   ┌─────────────┐  ┌─────────────┐   │  │
│  │                   │  Embedding  │  │  NLI        │   │  │
│  │                   │  Service    │  │  Service    │   │  │
│  │                   │  (FREE)     │  │  (FREE)     │   │  │
│  │                   └─────────────┘  └─────────────┘   │  │
│  └───────────────────────────────────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Customer LLM Provider Call                │  │
│  │       (Using BYOK header or vaulted customer key)      │  │
│  │                   (CUSTOMER PAYS)                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Resource Requirements

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|-------------|-----------|----------------|--------------|
| embeddings | 1 | 4 | 4Gi | 8Gi |
| nli | 1 | 2 | 4Gi | 8Gi |
| api | 250m | 1 | 512Mi | 2Gi |

For smaller deployments, use lighter models:
- Embeddings: `BAAI/bge-small-en-v1.5` (~1GB RAM)
- NLI: `microsoft/deberta-v3-base-mnli` (~1GB RAM)

### Embedding Cache

Embeddings are cached to reduce compute costs:

1. **Redis** (preferred): Fast in-memory cache
2. **PostgreSQL** (fallback): Persisted to `embedding_cache` table
3. **Memory** (last resort): In-process cache (lost on restart)

Cache key: `sha256(normalized_text + model + provider)`

---

## Additional Resources

### Documentation
- [README.md](README.md) - Quick start and overview
- [USER_GUIDE.md](USER_GUIDE.md) - How to use Spectyra
- [SECURITY.md](SECURITY.md) - Security policy and vulnerability reporting
- [docs/DATA_HANDLING.md](docs/DATA_HANDLING.md) - Data handling and storage
- [docs/RETENTION.md](docs/RETENTION.md) - Data retention policies
- [docs/ENTERPRISE_SECURITY.md](docs/ENTERPRISE_SECURITY.md) - Complete enterprise security guide
- [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) - Threat model and mitigations
- [docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) - Environment variable guide
- [infra/README.md](infra/README.md) - Infrastructure deployment guide

### SDK Documentation
- [packages/sdk/README.md](packages/sdk/README.md) - SDK usage and examples

### Integration Guides
- [tools/proxy/README.md](tools/proxy/README.md) - Local proxy setup
- [extensions/browser-extension/README.md](extensions/browser-extension/README.md) - Browser extension setup

### Support
- **Security Issues**: security@spectyra.com
- **Privacy Questions**: privacy@spectyra.com
- **General Support**: support@spectyra.com

---

**Last Updated**: January 2026  
**Version**: 2.1 (Local Optimization Stack)
