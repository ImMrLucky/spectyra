# Spectyra Application Description

## Overview

**Spectyra** is an **Enterprise AI Inference Cost-Control Gateway** that reduces LLM token usage and costs by 40-65% for teams and organizations. It works as secure middleware between users and LLM providers (OpenAI, Anthropic, Gemini, Grok), intelligently optimizing prompts before sending them to the LLM while maintaining output quality.

The system uses a proprietary "Spectral Core v1" decision engine based on graph theory and spectral analysis to determine when content is semantically stable and can be reused, versus when it needs to be expanded or clarified. The core combines multiple spectral operators (signed Laplacian, random walk gap, heat-trace complexity, curvature analysis) for robust stability assessment.

### Enterprise AI Gateway Platform

Spectyra is an enterprise-grade AI inference cost-control gateway that reduces LLM token usage and costs by 40-65% for teams and organizations. The platform is optimized for developers using coding assistants (GitHub Copilot, Cursor, Claude Code, etc.) and supports multiple integration methods:
- **Hosted Gateway**: Direct API integration (recommended for production)
- **Local Proxy**: For desktop coding tools and IDE integrations
- **SDK (Agent Control Plane)**: For agent frameworks (Claude Agent SDK, LangChain, etc.)
- **SDK (Legacy Chat)**: For custom applications and programmatic integrations
- **Browser Extension**: For web-based LLM tools (optional)

### Current Architecture (2026)

**Database**: PostgreSQL (via Supabase) with Row Level Security (RLS)
- Migrated from SQLite for better multi-tenant support
- Connection pooling for performance
- RLS policies for data isolation

**Authentication**: Dual system
- **Supabase JWT**: For dashboard users (human auth)
- **API Keys**: For machine auth (gateway/SDK)
- HTTP interceptor automatically adds auth headers
- Route guards protect authenticated pages

**Frontend**: Angular 17 with standalone components
- All components use separate `.ts`, `.html`, `.css` files
- Professional SVG icons
- Homepage for unauthenticated users
- Organization/project switcher component

**Backend**: Node.js + Express + TypeScript
- Postgres database with connection pooling
- Dual authentication middleware
- Agent control plane endpoints
- Proof mode endpoints

**Deployment**: Railway (API), Netlify/Vercel (Frontend)

---

## Core Value Proposition

**"We cut your AI bill by 40–65% on real chat and coding tasks without losing required outputs."**

The app proves savings by running the same workload in two modes:
- **Baseline Mode**: Sends requests as-is to the LLM
- **Optimized Mode**: Applies spectral analysis and optimization transforms before sending to the LLM

Both modes are measured for tokens, cost, and quality, enabling side-by-side comparison.

### Target Market: Developer-Focused

**Primary Audience**: Developers using coding assistants
- GitHub Copilot
- Cursor
- Claude Code
- Codeium
- Tabnine
- Other coding tools

**Why Developers?**
- Developers understand API keys and optimization value
- Developers already have provider API accounts
- BYOK model works perfectly (users pay providers directly)
- Code path optimization is our core strength
- Clear value proposition: 40-65% savings on coding workflows

---

## Two User Paths

### 1. **Talk Path** (`path: "talk"`)
For normal chat/Q&A workflows:
- Customer support conversations
- General Q&A
- Content generation
- Information retrieval

**Optimization Strategy:**
- Context compaction (replace stable content with `[[REF:id]]` markers)
- Delta-only prompting (focus on new/changed information)
- Output trimming (remove boilerplate and scaffolding)

### 2. **Code Path** (`path: "code"`) - **Recommended for Developers**
For coding assistant workflows:
- Bug fixes
- Code refactoring
- Feature implementation
- Code explanations
- Code generation
- Code reviews

**Optimization Strategy:**
- Code slicing (keep only relevant code blocks)
- Patch-only mode (request unified diffs + 3-bullet explanations)
- Context compaction (reference stable explanations)
- Delta prompting (focus on changes)
- AST-aware code extraction (function signatures, relevant blocks)

**Default Path**: Code path is the default for developer-focused tools

---

## Agent Control Plane (SDK-First Integration)

### Overview

Spectyra provides an **agent control plane** for runtime control of AI agents (Claude Agent SDK, LangChain, etc.). This enables centralized policy management, budget control, tool gating, and telemetry without requiring a proxy.

### Two Integration Modes

#### A. Local SDK Mode (Default)

**No API calls required.** SDK makes local decisions about agent options.

**How it works:**
1. Import `createSpectyra` from `@spectyra/sdk`
2. Create instance with `mode: "local"`
3. Call `agentOptions(ctx, prompt)` to get agent configuration
4. Use options with Claude Agent SDK or other agent frameworks

**Decision Logic:**
- Prompt length → Model selection (haiku/sonnet/opus)
- Context → Budget allocation
- Path (code/talk) → Tool permissions
- Default tool gate denies dangerous Bash commands

**Benefits:**
- Works offline
- No network latency
- Simple integration
- Good for development and testing

#### B. API Control Plane Mode (Enterprise)

**Centralized policy management.** SDK calls Spectyra API for agent options and streams events.

**How it works:**
1. Create instance with `mode: "api"`, `endpoint`, and `apiKey`
2. Call `agentOptionsRemote(ctx, promptMeta)` to fetch options from API
3. Use options with agent framework
4. Stream events via `sendAgentEvent()` or `observeAgentStream()`

**API Endpoints:**
- `POST /v1/agent/options` - Get agent options based on prompt metadata
- `POST /v1/agent/events` - Send agent event for telemetry

**Benefits:**
- Centralized policy management
- Org/project-scoped decisions
- Telemetry and analytics
- Enterprise control and compliance

### Agent Options

The SDK returns `ClaudeAgentOptions` compatible with Claude Agent SDK:

```typescript
interface ClaudeAgentOptions {
  model?: string;                    // e.g., "claude-3-5-sonnet-latest"
  maxBudgetUsd?: number;             // Budget limit (default: 2.5)
  cwd?: string;                      // Working directory
  allowedTools?: string[];           // Allowed tool names
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  canUseTool?: (toolName: string, toolInput: any) => boolean | Promise<boolean>;
}
```

### Tool Gating

Default `canUseTool` gate:
- **Allows**: Read, Edit, Glob (safe operations)
- **Denies**: Dangerous Bash commands (curl, ssh, rm -rf, etc.)
- Customizable per organization

### Telemetry

Agent events are stored in `agent_events` table:
- Run ID linking
- Event JSONB data
- Timestamp
- Org/project context
- Used for analytics and debugging

---

## Two Operational Modes

### A. Real-Time Mode (Production Usage)

**How it works:**
1. User sends a chat request via `/v1/chat` endpoint
2. System receives:
   - `path`: "talk" or "code"
   - `optimization_level`: 0-4 (slider setting)
   - `messages`: Conversation history
   - `provider`: OpenAI, Anthropic, Gemini, or Grok
   - `model`: Specific model name
   - `mode`: "baseline" or "optimized"
   - `dry_run`: Optional boolean (if true, skips LLM call, returns estimates)
   - `X-SPECTYRA-API-KEY`: Required header for org/project authentication
   - `X-PROVIDER-KEY`: Optional header for ephemeral provider key (BYOK, never stored)

3. **If mode = "baseline":**
   - Request is forwarded directly to LLM provider
   - No optimization applied
   - Response returned as-is

4. **If mode = "optimized":**
   - **Step 1: Unitization**
     - Converts recent messages into semantic units (paragraphs, bullets, code blocks)
     - Each unit gets an ID, kind (fact/constraint/explanation/code/patch), and turn index
   
   - **Step 2: Embedding**
     - Generates vector embeddings for each unit using OpenAI embeddings
     - Stores embeddings for similarity calculations
   
   - **Step 3: Graph Construction**
     - Builds a signed weighted graph where:
       - Nodes = semantic units
       - Edges = similarity (positive weight), contradiction (negative weight), or dependency (code path)
     - **Similarity edges**: 
       - Base: cosine similarity > threshold (0.85)
       - Temporal boost: +0.15 (same turn), +0.08 (adjacent), +0.03 (recent)
       - Kind boost: +0.12 (constraints), +0.08 (facts), +0.05 (explanations)
     - **Contradiction edges**:
       - Numeric conflicts: Relative difference > 15% (weighted by strength)
       - Negation patterns: Detects "not", "never", "can't", etc.
       - Semantic contradictions: Detects opposites (always/never, include/exclude, increase/decrease)
       - Temporal contradictions: Past vs future markers
     - **Dependency edges** (code path only):
       - Patch → code blocks (weight 0.7)
       - Constraint → code blocks (weight 0.5-0.7)
       - Code block references (weight 0.6)
   
   - **Step 4: Spectral Analysis (The Moat - Multi-Operator)**
     - Computes signed Laplacian matrix from the graph
     - Estimates λ₂ (second smallest eigenvalue) using power iteration
     - Calculates contradiction energy
     - **Additional Operators:**
       - **Random Walk Gap**: Measures topic mixing/stability (high gap = well-mixing = safe REUSE)
       - **Heat-Trace Complexity**: Estimates compressibility (lower = more compressible)
       - **Curvature Analysis**: Detects local conflict hotspots (Forman-Ricci-like)
       - **Node Features**: Age, length, kind weight, novelty per unit
     - **Combined Stability Index**:
       - Spectral component: Enhanced with non-linear contradiction penalty and connectivity reward
       - Random walk gap component
       - Heat complexity component (inverted)
       - Curvature component (normalized)
       - Novelty component (inverted)
       - Final: Weighted combination (w1=0.40, w2=0.20, w3=0.15, w4=0.10, w5=0.15)
     - **Adaptive Thresholds** (based on conversation history):
       - If past stability < 0.5: Increase thresholds (more conservative)
       - If contradictions increasing: Increase tHigh by 0.08 (more cautious)
     - Generates recommendation:
       - **REUSE**: stabilityFinal >= tHigh (default 0.70) → Aggressive optimization
       - **EXPAND**: tLow < stabilityFinal < tHigh → Moderate optimization
       - **ASK_CLARIFY**: stabilityFinal <= tLow (default 0.35) OR high contradiction OR low curvature → Return clarifying question (saves tokens)
   
   - **Step 5: Apply Policy Transforms**
     - **Talk Policy** (if path = "talk"):
       - Context compaction: Replace stable units with `[[REF:id]]` + glossary
       - Delta prompting: System instruction to focus on new/changed info
       - Output trimming: Post-process to remove boilerplate
     
     - **Code Policy** (if path = "code"):
       - Code slicing: Keep only most relevant code block
       - Context compaction: Replace stable explanations with REFs
       - Patch mode: Request unified diff + 3-bullet explanation
       - Delta prompting: Focus on changes
       - Output trimming: Enforce patch format, remove scaffolding
   
   - **Step 6: LLM Call**
     - **If `dry_run=true`**: Skips provider call, returns placeholder response with estimated usage
     - **If `dry_run=false`**: Sends optimized prompt to provider
     - Includes `maxOutputTokens` limit (450 for optimized, unlimited for baseline)
     - Receives response text and usage tokens (or estimates if dry-run)
   
   - **Step 7: Post-Processing** (Content-Aware)
     - **Extended boilerplate removal**:
       - "Sure, here's...", "Let me know...", "Hope this helps"
       - "Here's the code", "I've created/made/written"
       - "As I mentioned", "To summarize"
     - **Code block preservation**:
       - Extracts and preserves code blocks during processing
       - Restores code blocks after trimming
       - Shows count of trimmed code blocks
     - **Smart trimming**:
       - Preserves complete sentences (not hard cuts)
       - Preserves function signatures in code
       - Removes redundant phrases
     - **Patch format enforcement**:
       - Keeps unified diff + essential bullets
       - Preserves important warnings/notes
     - Applies aggressive trimming if REUSE recommendation
   
   - **Step 8: Quality Guard**
     - Runs required checks (regex patterns) if scenario provided
     - If quality fails and mode = "optimized":
     - **Auto-retry**: Relaxes optimization (less aggressive trimming, more context)
     - Retries up to 2 times with progressively relaxed settings
     - Stores retry metadata for debugging
   
   - **Step 9: Savings Calculation**
     - For optimized runs without baseline:
     - Estimates baseline tokens/cost from historical samples (Welford aggregation)
     - Computes confidence score (0-1) based on sample size, variance, recency
     - Writes "estimated" savings to ledger
   
   - **Step 10: Response**
     - Returns optimized response text
     - Includes usage tokens and cost
     - Includes savings (if estimated baseline available)
     - Includes confidence band (High/Medium/Low)
     - **No moat internals exposed** (spectral numbers, optimizer steps, REFs)

5. **Storage:**
   - Run record saved to PostgreSQL with:
     - `workload_key`: Deterministic hash grouping comparable runs
     - `prompt_hash`: SHA256 of normalized prompt (server-only)
     - `optimization_level`: Slider level (0-4)
     - Usage tokens, cost, quality results
     - `debug_internal_json`: Moat internals (never exposed to client)
     - `org_id`, `project_id`: Organization/project context
     - `provider_key_fingerprint`: Audit trail (never the actual key)

6. **Savings Ledger:**
   - For optimized runs: Writes "estimated" savings row
   - Includes confidence score and band
   - Links to run ID for audit trail
   - Filtered by org/project for multi-tenant isolation

**Real-Time Flow Example:**
```
User → POST /v1/chat { path: "talk", mode: "optimized", optimization_level: 3, messages: [...] }
  → Unitize messages
  → Embed units
  → Build graph
  → Spectral analysis → REUSE recommendation
  → Apply talk policy (aggressive compaction + delta)
  → Call OpenAI API
  → Post-process output
  → Quality guard (pass)
  → Return response + estimated savings
  → Store run + ledger row
```

---

### B. Proof Mode (Replay/Scenario Testing & Conversation Paste)

**Proof Mode has two sub-modes:**

#### B1. Scenario Replay Mode

**How it works:**
1. User selects a scenario from `/v1/scenarios` endpoint
2. Scenarios are pre-defined test cases with:
   - `id`: Unique identifier
   - `path`: "talk" or "code"
   - `title`: Human-readable name
   - `turns`: Array of messages (conversation history)
   - `required_checks`: Quality validation rules (regex patterns)

3. User triggers replay via `/v1/replay` endpoint with:
   - `scenario_id`: Which scenario to run
   - `provider`: LLM provider
   - `model`: Specific model
   - `optimization_level`: 0-4 slider setting
   - `proof_mode`: "live" (default) or "estimator"

4. **If proof_mode = "live", system executes both modes:**

   **A. Baseline Run:**
   - Creates `replay_id` (UUID) to group baseline + optimized
   - Runs scenario messages through LLM **without optimization**
   - Measures: tokens in/out, cost, quality checks
   - Stores run with `mode: "baseline"`, `replay_id`, `optimization_level`
   - Updates baseline samples (Welford aggregation) for future estimates

   **B. Optimized Run:**
   - Uses same `replay_id`
   - Runs full optimization pipeline (Steps 1-10 from Real-Time Mode)
   - Measures: tokens in/out, cost, quality checks
   - Stores run with `mode: "optimized"`, `replay_id`, `optimization_level`
   - May include retry if quality fails initially

5. **Savings Calculation:**
   - Computes verified savings: `baseline.tokens - optimized.tokens`
   - Computes % saved: `(tokens_saved / baseline.tokens) * 100`
   - Computes cost saved: `baseline.cost - optimized.cost`
   - **Confidence = 1.0** (verified, not estimated)

6. **Ledger Write:**
   - Writes "verified" savings row to `savings_ledger`
   - Links both run IDs
   - Stores all accounting data

7. **Response:**
   - Returns `ReplayResult` with:
     - `baseline`: Run record (redacted - no moat internals)
     - `optimized`: Run record (redacted)
     - `verified_savings`: { tokens_saved, pct_saved, cost_saved_usd }
     - `quality`: { baseline_pass, optimized_pass }

#### B2. Estimator Mode (Scenario Replay without Real LLM Calls)

**How it works:**
1. User selects a scenario or provides messages
2. User selects "Estimator" proof mode (instead of "Live")
3. System calls `/v1/replay` with `proof_mode: "estimator"`
4. System uses token estimation instead of real LLM calls:
   - Estimates baseline tokens/cost using heuristics
   - Estimates optimized tokens/cost using heuristics
   - Calculates savings and confidence
   - Returns placeholder response text: `"[ESTIMATED]..."`
5. **Response shows:**
   - Savings summary (tokens saved, cost saved, % saved)
   - Confidence band (High/Medium/Low)
   - Baseline and optimized estimates
   - "ESTIMATED" badge (vs "VERIFIED" for live mode)
   - **No internal breakdown** (no spectral numbers, no optimizer steps, no REFs)
6. **Key benefit**: Works even if trial expired (no real LLM calls = no provider costs)

#### B3. Conversation Paste Mode (Proof Page)

**How it works:**
1. User navigates to `/proof` page
2. User pastes conversation from ChatGPT, Claude, or any chat interface
3. System supports both plain text and JSON formats
4. System parses conversation into message format
5. User configures: path, provider, model, optimization level
6. System calls `/v1/proof/estimate` endpoint
7. System estimates savings without making real LLM calls
8. **Response shows:**
   - Conversation preview (parsed messages)
   - Savings summary (tokens saved, cost saved, % saved)
   - Confidence band
   - Baseline and optimized estimates
   - Optimization explanation
   - "ESTIMATED" badge
9. **Key benefit**: Test optimization on real conversations without costs

**Proof Mode Flow Examples:**

**Scenario Replay:**
```
User → POST /v1/replay { scenario_id: "talk_support_refund_001", optimization_level: 2 }
  → Load scenario
  → Create replay_id = "abc-123"
  
  → BASELINE:
    → Call LLM directly (no optimization)
    → Store run { id: "run-1", mode: "baseline", replay_id: "abc-123" }
    → Update baseline_samples[workload_key] (Welford)
  
  → OPTIMIZED:
    → Full optimization pipeline
    → Store run { id: "run-2", mode: "optimized", replay_id: "abc-123" }
  
  → Write verified savings to ledger
  → Return comparison result
```

**Estimator Mode:**
```
User → /scenarios/:id/run
  → Select "Estimator" proof mode
  → POST /v1/replay { scenario_id, provider, model, proof_mode: "estimator" }
  → Use token estimation (no real LLM calls)
  → Estimate baseline tokens/cost
  → Estimate optimized tokens/cost
  → Calculate savings
  → Return savings summary with "ESTIMATED" badge (no moat internals)
  → Works even if trial expired (no provider costs)
```

**Conversation Paste Mode:**
```
User → /proof page
  → Paste conversation (plain text or JSON)
  → Configure: path, provider, model, optimization level
  → POST /v1/proof/estimate { path, provider, model, optimization_level, messages }
  → System parses conversation into message format
  → Runs optimizer pipeline in dry-run mode (no LLM call)
  → Estimates baseline and optimized tokens/cost
  → Calculates savings and confidence
  → Returns savings summary with "ESTIMATED" badge
  → Works even if trial expired (no provider costs)
```

---

## Optimization Level Slider (0-4)

Users can adjust optimization aggressiveness via a slider:

### Level 0: Minimal
- No compaction, no slicing, no trimming
- Only delta prompting enabled
- Use case: Testing, debugging

### Level 1: Conservative
- Light compaction (max 4 REFs)
- Moderate trimming
- Use case: Quality-critical scenarios

### Level 2: Balanced (Default)
- Moderate compaction (max 6 REFs)
- Moderate trimming
- Use case: General production use

### Level 3: Aggressive
- Heavy compaction (max 8 REFs)
- Aggressive trimming
- Code slicing enabled
- Use case: High-volume, cost-sensitive

### Level 4: Maximum
- Maximum compaction (max 10 REFs)
- Very aggressive trimming
- Aggressive code slicing
- Use case: Maximum savings, accept some quality risk

**Mapping:**
- `compactionAggressive`: true for levels 3-4
- `trimAggressive`: true for levels 3-4
- `maxRefs`: 4 (L0) → 6 (L1-2) → 8 (L3) → 10 (L4)
- `keepLastTurns`: 3 (normal) → 2 (REUSE)
- `codeSlicerAggressive`: true for levels 3-4

---

## Savings Tracking & Analytics

### Savings Types

1. **Verified Savings** (confidence = 1.0)
   - From replay/scenario runs
   - Paired baseline + optimized measurements
   - Provable and auditable

2. **Shadow Verified Savings** (confidence = 1.0)
   - From shadow baseline sampling (future feature)
   - Paired measurements from production traffic
   - Currently not implemented in MVP

3. **Estimated Savings** (confidence = 0.15 - 0.99)
   - From optimized runs without baseline
   - Baseline estimated from historical samples
   - Confidence based on:
     - Sample size (more samples = higher confidence)
     - Variance (lower variance = higher confidence)
     - Recency (recent samples = higher confidence)
   - Displayed as bands: High (≥0.85), Medium (0.70-0.85), Low (<0.70)

### Savings Ledger

All savings are stored in `savings_ledger` table:
- `savings_type`: "verified" | "shadow_verified" | "estimated"
- `tokens_saved`, `pct_saved`, `cost_saved_usd`
- `confidence`: 0.0 - 1.0
- `workload_key`: Groups comparable runs
- Links to run IDs for audit trail

### Dashboard Features

**Savings Page** (`/savings`):
- **KPI Cards:**
  - Verified Savings (primary metric)
  - Total Savings (includes estimated)
  - Tokens Saved
  - Replays Count

- **Time Series Chart:**
  - Daily/weekly trends
  - Separates verified vs estimated
  - Shows confidence bands

- **Breakdowns:**
  - By optimization level (0-4)
  - By path (talk vs code)
  - By provider/model

- **Filters:**
  - Date range (last 7/30/90 days or custom)
  - Path (both/talk/code)
  - Provider/model

- **Export:**
  - CSV/JSON export of savings ledger
  - Accounting data only (no moat internals)

---

## Data Flow Architecture

### Request Flow (Optimized Mode)

```
User Request
  ↓
API Route (/v1/chat or /v1/replay)
  ↓
Optimizer Pipeline:
  1. Unitize → SemanticUnits[]
  2. Embed → Vectors[][]
  3. Build Graph → SignedGraph
  4. Spectral Analysis → Recommendation
  5. Apply Policy → Optimized Messages
  6. LLM Call → Response
  7. Post-Process → Cleaned Response
  8. Quality Guard → Pass/Fail
  ↓
Storage:
  - Run Record (runs table)
  - Savings Ledger Row (savings_ledger table)
  - Baseline Sample Update (baseline_samples table)
  ↓
Response (Redacted - No Moat Internals)
```

### Database Schema (PostgreSQL via Supabase)

**`orgs` table:**
- Organization entities
- Fields: id (UUID), name, created_at, trial_ends_at, stripe_customer_id, subscription_status
- Trial defaults to 7 days
- Row Level Security (RLS) enabled

**`org_memberships` table:**
- Links Supabase auth users to organizations
- Fields: id (UUID), org_id, user_id (Supabase auth.users.id), role (OWNER/ADMIN/DEV/VIEWER/BILLING)
- Enables multi-user organizations with role-based access

**`projects` table:**
- Project entities (optional grouping within orgs)
- Fields: id (UUID), org_id, name, created_at
- Foreign key to orgs with CASCADE delete

**`api_keys` table:**
- API key authentication (machine auth)
- Fields: id (UUID), org_id, project_id (nullable), name, key_prefix (first 8 chars), key_hash (argon2id), scopes, created_at, last_used_at, revoked_at
- Keys stored as argon2id hash (never plaintext)
- Prefix lookup (first 8 chars) for fast authentication
- Constant-time comparison to prevent timing attacks
- Can be org-level or project-scoped
- Tracked with last_used_at for usage analytics

**`runs` table:**
- Stores individual LLM calls
- Includes: tokens, cost, quality, optimization_level
- Fields: org_id, project_id, provider_key_fingerprint (audit only, never the actual key)
- `workload_key`: Groups comparable runs
- `debug_internal_json`: Moat internals (server-only, never exposed)

**`replays` table:**
- Groups baseline + optimized runs
- Links via `replay_id`
- Stores scenario_id, workload_key, path, optimization_level

**`savings_ledger` table:**
- Customer-facing accounting rows
- Fields: org_id, project_id (for org/project filtering)
- Separates verified vs estimated
- Includes confidence scores
- Used for dashboard and exports

**`baseline_samples` table:**
- Welford aggregates per workload_key
- Mean/variance for tokens and cost
- Used for baseline estimation

**`agent_runs` table:**
- Agent control plane runs (SDK-first integration)
- Fields: id (TEXT, run_id from SDK), org_id, project_id, model, max_budget_usd, allowed_tools, permission_mode, prompt_meta (JSONB), reasons
- Tracks agent runtime decisions and telemetry

**`agent_events` table:**
- Agent event telemetry
- Fields: id (UUID), run_id, created_at, event (JSONB)
- Stores agent stream events for analytics

---

## Quality Assurance

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

### Quality Display

- **Normal UI**: Shows "PASS" or hides failures
- **Debug Panel** (hidden by default): Shows retry info, failure reasons
- **No scary messaging**: Users don't see "missed checks" in main UI

---

## IP Protection & Security

### Public API (No Moat Leakage)

**Never exposed to clients:**
- Spectral numbers (λ₂, stabilityIndex, contradictionEnergy)
- Optimizer internals (REFs used, delta used, code sliced, patch mode)
- Prompt content (only token counts)
- Debug internal JSON
- Provider API keys (ephemeral, never stored, never logged)

**Always exposed:**
- Usage tokens (input/output/total)
- Cost (USD)
- Savings numbers (tokens saved, %, cost saved)
- Confidence band (High/Medium/Low, not numeric score)
- Quality pass/fail (boolean, no details)
- Savings type badge ("VERIFIED" or "ESTIMATED")

### Security Features

**Provider Key Handling:**
- Provider keys sent via `X-PROVIDER-KEY` header
- **Never stored in database** (ephemeral, in-memory only)
- **Never logged** (redacted in all logs via centralized redaction utilities)
- Only fingerprint stored for audit: SHA256(last6 + org_id + salt)
- Constant-time key comparison to prevent timing attacks

**Authentication:**
- Spectyra API keys stored as SHA256 hash (never plaintext)
- Constant-time comparison for key validation
- Org/project context attached to all requests
- Trial/subscription status checked per-request

**Logging:**
- Centralized redaction utilities (`redactSecrets()`, `safeLog()`)
- All logs automatically redact API keys and provider keys
- Request bodies not logged in production
- Headers redacted in error messages

### Admin Debug Access

- Endpoint: `/v1/admin/runs/:id/debug`
- Requires: `X-ADMIN-TOKEN` header
- Returns: `debug_internal_json` with full moat internals (redacted for provider keys)
- **Never used by public UI**

---

## Provider Support

### Direct API Adapters
- **OpenAI**: GPT-4, GPT-3.5, GPT-4o-mini
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Haiku
- **Gemini**: Gemini Pro, Gemini Flash
- **Grok**: Grok models

All providers:
- Support usage token reporting (or estimation fallback)
- Support `maxOutputTokens` parameter
- Unified `ChatProvider` interface

### Embeddings
- **OpenAI**: text-embedding-3-small (default)
- Used for semantic similarity calculations

---

## Example Scenarios

### Talk Scenario: Customer Support Refund
```json
{
  "id": "talk_support_refund_001",
  "path": "talk",
  "turns": [
    {"role": "user", "content": "I need a refund for order #12345"},
    {"role": "assistant", "content": "I can help with that..."},
    {"role": "user", "content": "It was charged twice"}
  ],
  "required_checks": [
    {"name": "includes_next_steps", "type": "regex", "pattern": "next steps|Next steps"},
    {"name": "mentions_timeline", "type": "regex", "pattern": "within \\d+|days"}
  ]
}
```

**Baseline Run:**
- Sends all 3 messages to LLM
- ~2,500 tokens
- Cost: $0.0375
- Quality: PASS

**Optimized Run (Level 2):**
- Spectral analysis: REUSE (stabilityIndex = 0.82)
- Compacts first 2 turns into REFs
- Delta prompting: "Focus on the double charge issue"
- ~1,200 tokens
- Cost: $0.018
- Quality: PASS
- **Savings: 52% tokens, $0.0195 saved**

### Code Scenario: Bug Fix
```json
{
  "id": "code_bugfix_001",
  "path": "code",
  "turns": [
    {"role": "user", "content": "Fix the login bug in auth.js"},
    {"role": "assistant", "content": "Here's the fix:\n```js\n// ... code ...\n```"},
    {"role": "user", "content": "Also handle the edge case where email is null"}
  ],
  "required_checks": [
    {"name": "includes_code", "type": "regex", "pattern": "```"},
    {"name": "handles_null", "type": "regex", "pattern": "null|undefined"}
  ]
}
```

**Baseline Run:**
- Sends all messages + full code context
- ~4,200 tokens
- Cost: $0.063
- Quality: PASS

**Optimized Run (Level 3):**
- Spectral analysis: REUSE (stabilityIndex = 0.75)
- Code slicing: Keeps only relevant auth.js block
- Patch mode: Requests unified diff
- Compacts prior explanation to REFs
- ~1,800 tokens
- Cost: $0.027
- Quality: PASS
- **Savings: 57% tokens, $0.036 saved**

---

## Enhanced Algorithms & Features

### Deterministic Unit IDs
- Semantic units use SHA256 hash of normalized text + kind + role
- Enables stable reuse across sessions
- Supports caching and long-horizon stability tracking

### Enhanced Contradiction Detection
- **Numeric contradictions**: Relative difference calculation with strength weighting
- **Negation patterns**: Extended list with regex word boundaries
- **Semantic contradictions**: Detects opposites (always/never, include/exclude, increase/decrease, active/inactive, valid/invalid)
- **Temporal contradictions**: Detects past vs future markers (was/will, previous/next)
- **Weighted system**: Accumulates weights from multiple sources (0.4 numeric, 0.3 negation, 0.35 semantic, 0.25 temporal)

### Enhanced Similarity Detection
- **Temporal proximity boost**: Same turn (+0.15), adjacent (+0.08), recent (+0.03)
- **Kind similarity boost**: Constraints (+0.12), facts (+0.08), explanations (+0.05)
- **Context-aware**: Combines embedding similarity with conversation structure

### Enhanced Stability Index Calculation
- **Non-linear contradiction penalty**: Exponential penalty when contradiction > 0.3
- **Connectivity reward**: 15% bonus when lambda2 > 0.5
- **Multi-factor stability**: Combines spectral, random walk, heat trace, curvature, and novelty
- **Confidence scoring**: Graph structure quality metrics

### Adaptive Thresholds
- Adjusts REUSE/EXPAND thresholds based on conversation history
- Unstable past → more conservative (higher thresholds)
- Increasing contradictions → more cautious

### AST-Aware Code Slicing
- Extracts function/class/method signatures
- Signature matching for relevance (highest priority)
- Preserves function signatures when trimming
- Recency bonus for code blocks

### Content-Aware Post-Processing
- Extended boilerplate patterns
- Code block preservation during trimming
- Smart sentence preservation (not hard cuts)
- Preserves warnings/notes in patch mode

---

## Key Algorithms

### Spectral Core v1 (The Moat - Multi-Operator)

1. **Unitization**: Chunk messages into semantic units
   - Deterministic IDs: SHA256 hash of normalized text + kind + role
   - Enables stable reuse and caching across sessions

2. **Embedding**: Generate vectors for similarity
   - Uses OpenAI text-embedding-3-small
   - Safe cosine similarity (handles missing embeddings)

3. **Graph Build**: Create signed weighted graph
   - **Similarity edges**: 
     - Base cosine similarity > 0.85
     - Temporal proximity boost (same turn: +0.15, adjacent: +0.08)
     - Kind similarity boost (constraints: +0.12, facts: +0.08)
   - **Contradiction edges**:
     - Numeric conflicts (relative difference > 15%, weighted by strength)
     - Negation patterns (extended list: "not", "never", "can't", "shouldn't", etc.)
     - Semantic contradictions (always/never, include/exclude, increase/decrease, active/inactive, valid/invalid)
     - Temporal contradictions (past vs future markers)
   - **Dependency edges** (code path):
     - Patch → code blocks (0.7)
     - Constraint → code blocks (0.5-0.7)
     - Code references (0.6)

4. **Signed Laplacian**: Compute L = D - W

5. **Eigenvalue Estimation**: Estimate λ₂ using power iteration with orthogonalization

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

### Welford's Algorithm (Baseline Sampling)

For each baseline run:
- Update `n` (sample count)
- Update `mean` incrementally: `mean += (x - mean) / n`
- Update `M2` (variance accumulator): `M2 += (x - mean) * (x - new_mean)`
- Variance = `M2 / (n - 1)`

Used to estimate baseline tokens/cost for optimized runs without paired baseline.

### Confidence Scoring

For estimated savings:
```
sample_conf = 1 - exp(-n/10)        // Rises with sample size
stability_conf = 1 - CV              // CV = std/mean (coefficient of variation)
recency_conf = 1 - days_old/30       // Decays over 30 days

confidence = 0.15 + 0.55*sample_conf + 0.20*stability_conf + 0.10*recency_conf
```

---

## API Endpoints

### Public Endpoints

**Authentication Required** (X-SPECTYRA-API-KEY header or Supabase JWT):
- `GET /v1/providers` - List available LLM providers
- `GET /v1/scenarios` - List test scenarios
- `GET /v1/scenarios/:id` - Get scenario details
- `POST /v1/chat` - Real-time chat (baseline or optimized) - **Requires active trial or subscription**
- `POST /v1/replay` - Run scenario in proof mode (estimator mode allowed even if trial expired)
- `POST /v1/proof/estimate` - Estimate savings from pasted conversation (no real LLM calls, works without subscription)
- `GET /v1/runs` - List run history (filtered by org/project)
- `GET /v1/runs/:id` - Get run details
- `GET /v1/savings/summary` - Overall savings summary (filtered by org/project)
- `GET /v1/savings/timeseries` - Daily/weekly trends (filtered by org/project)
- `GET /v1/savings/by-level` - Breakdown by optimization level (filtered by org/project)
- `GET /v1/savings/by-path` - Breakdown by talk/code (filtered by org/project)
- `GET /v1/savings/export` - CSV/JSON export (filtered by org/project)
- `GET /v1/integrations/snippets` - Get integration code snippets
- `GET /v1/billing/status` - Get org billing status and trial info
- `POST /v1/billing/checkout` - Create Stripe checkout session
- `GET /v1/auth/me` - Get current org/project info (requires Supabase JWT or API key)
- `GET /v1/auth/api-keys` - List API keys (requires Supabase JWT)
- `POST /v1/auth/api-keys` - Create new API key (requires Supabase JWT)
- `DELETE /v1/auth/api-keys/:id` - Revoke API key (requires Supabase JWT)

**Agent Control Plane** (X-SPECTYRA-API-KEY header required):
- `POST /v1/agent/options` - Get agent options for prompt context (SDK-first integration)
- `POST /v1/agent/events` - Send agent event for telemetry

**No Authentication Required**:
- `POST /v1/billing/webhook` - Stripe webhook handler (uses signature verification)
- `POST /v1/auth/register` - Register new organization with Supabase
- `POST /v1/auth/bootstrap` - Bootstrap org/project after first Supabase login (requires Supabase JWT)

### Admin Endpoints

- `GET /v1/admin/runs/:id/debug` - Get moat internals (requires X-ADMIN-TOKEN header)
- `GET /v1/admin/orgs` - List all organizations (requires X-ADMIN-TOKEN header)
- `GET /v1/admin/orgs/:id` - Get organization details (requires X-ADMIN-TOKEN header)
- `PATCH /v1/admin/orgs/:id` - Update organization (requires X-ADMIN-TOKEN header)
- `DELETE /v1/admin/orgs/:id` - Delete organization (requires X-ADMIN-TOKEN header)

---

## Frontend (Angular 17)

### Architecture

- **Standalone Components**: All components use Angular standalone architecture
- **Separate Files**: All components have separate `.ts`, `.html`, and `.css` files
- **HTTP Interceptor**: Automatic authentication header injection for all API requests
- **Route Guards**: Auth guard protects authenticated routes, redirects to login if needed
- **Reactive State**: RxJS observables for session management and state updates

### Authentication System

**Dual Authentication Methods:**

1. **Supabase JWT (Human Auth - Dashboard)**
   - Email/password registration and login
   - JWT tokens stored in Supabase client
   - Automatic token refresh
   - Session persistence across page reloads
   - Used for dashboard access and API key management

2. **API Keys (Machine Auth - Gateway/SDK)**
   - Legacy support for API key login
   - Stored in localStorage
   - Used for programmatic access and SDK integrations

**HTTP Interceptor:**
- Automatically adds `Authorization: Bearer <token>` header for Supabase JWT
- Falls back to `X-SPECTYRA-API-KEY` if no JWT available
- Skips public endpoints (`/auth/register`, `/auth/login`, `/health`)
- Prevents duplicate headers if already set

**Registration Flow:**
1. User provides email, password, organization name, optional project name
2. System creates Supabase user account
3. System creates org with 7-day free trial
4. System creates default project (if provided)
5. System generates first API key (shown once, must be saved)
6. User automatically logged in with Supabase session
7. API key stored in localStorage for gateway/SDK usage

**Bootstrap Flow (First-Time Users):**
- After first Supabase login, if user doesn't have an org yet:
- Shows bootstrap form to create organization
- Calls `/v1/auth/bootstrap` endpoint with org/project name
- Creates org, project, and first API key
- User must save API key (shown once)

**Login Flow:**
- **Supabase Login**: Email/password → Supabase session → Check for org → Bootstrap if needed
- **API Key Login**: Enter API key → Validate → Store in localStorage → Access dashboard

### Pages

1. **Home Page** (`/`)
   - Public landing page for unauthenticated users
   - Hero section with tagline and CTA buttons
   - Key features showcase with professional SVG icons
   - "How It Works" section
   - Call-to-action to sign up or log in
   - Navigation shows Login/Sign Up links when not authenticated

2. **Registration Page** (`/register`)
   - Supabase email/password registration
   - Organization name and optional project name
   - Creates account, org, project, and first API key
   - Shows API key once (must be saved)
   - Displays trial information
   - Link to login page

3. **Login Page** (`/login`)
   - **Dual Auth Tabs**: Email/Password (Supabase) or API Key (legacy)
   - **Supabase Login**: Email/password → checks for org → shows bootstrap if needed
   - **API Key Login**: Enter API key → validate → access dashboard
   - **Bootstrap Flow**: If logged in but no org, shows org creation form
   - **Success State**: Shows trial info, access status, continue button
   - Link to registration page

4. **Proof Scenarios Page** (`/scenarios`)
   - Lists available test scenarios
   - Filter by path (talk/code/all)
   - Click to run scenario
   - Hero subtitle: "Optimize API-based LLM usage for teams. Reduce inference cost by 40-65%."
   - Dismissible banner directing users to Integrations page
   - Protected route (requires authentication)

5. **Integrations Page** (`/integrations`)
   - Three integration methods:
     - **Hosted Gateway**: Direct API integration (code snippets)
     - **Local Proxy**: Desktop coding tools setup
     - **Server SDK**: Programmatic integration (with browser warning)
   - Dynamic code snippets from `/v1/integrations/snippets` API
   - Enterprise-focused messaging
   - Protected route

6. **Connections Page** (`/connections`)
   - Step-by-step guide for connecting coding tools
   - Instructions for installing and configuring proxy
   - Tool-specific configuration (Copilot, Cursor, Claude Code, etc.)
   - Links to documentation
   - Protected route

7. **Projects Page** (`/projects`)
   - Project management (placeholder for future)
   - Enterprise organization structure
   - Protected route

8. **Run Page** (`/scenarios/:id/run`)
   - Shows scenario details
   - Optimization level slider (0-4) with path-specific labels
   - Provider/model selector
   - **Proof Mode Toggle**: "Live" vs "Estimator" (estimator mode works without subscription)
   - "Run Replay" button
   - Displays:
     - Savings card with "VERIFIED" or "ESTIMATED" badge
     - Side-by-side comparison (baseline vs optimized)
     - Token/cost table for each run
     - Output comparison
     - Advanced debug panel (hidden by default, toggleable)
   - Protected route

9. **Proof Mode Page** (`/proof`)
   - Paste conversation from ChatGPT, Claude, or any chat interface
   - Supports plain text or JSON format
   - Configuration: path, provider, model, optimization level
   - Conversation preview after parsing
   - Savings estimates without real LLM calls
   - Shows baseline and optimized estimates
   - Confidence band display
   - Protected route

10. **Gateway Runs Page** (`/runs`)
    - Table of all runs (filtered by org/project)
    - Columns: ID, Scenario, Mode, Provider, Tokens, Cost, Quality, Created, Actions
    - Link to run details
    - Enterprise-focused labeling
    - Protected route

11. **Org Savings Page** (`/savings`)
    - **KPI Cards**: Verified Savings, Total Savings, Tokens Saved, Replays Count
    - **Time Series Chart**: Daily/weekly trends (verified vs estimated)
    - **Breakdowns**: By optimization level and by path (talk/code)
    - **Filters**: Date range (7/30/90 days or custom), path, provider, model
    - **Export Buttons**: Verified savings CSV, All savings CSV
    - All data filtered by authenticated org/project
    - Protected route

12. **Billing Page** (`/billing`)
    - Trial countdown display with days remaining
    - Subscription status (trial/active/canceled/past_due)
    - "Upgrade" button (calls Stripe checkout)
    - Organization information
    - Trial expired messaging with upgrade CTA
    - Protected route

13. **Settings Page** (`/settings`)
    - **API Key Management**:
      - Create new API keys (named, org-level or project-scoped)
      - List all API keys with metadata (name, project, created, last used, status)
      - Revoke API keys (soft delete)
      - Copy newly created keys (shown once)
    - **Organization Info**: Name, status, trial end date
    - **Projects List**: All projects in organization
    - Protected route

14. **Admin Page** (`/admin`)
    - Admin panel for system administrators
    - Admin token authentication
    - List all organizations with stats
    - View organization details (projects, API keys, runs)
    - Edit organization name
    - Delete organizations (danger zone)
    - Protected route (requires admin token)

---

## Environment Configuration

### Backend (API)

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string (Supabase pooler recommended)
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_JWT_SECRET`: Supabase JWT secret for token verification
- `STRIPE_SECRET_KEY`: Stripe secret key for billing
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signature verification
- `ADMIN_TOKEN`: Admin panel access token

**Optional Environment Variables:**
- `PORT`: API server port (default: 8080)
- `NODE_ENV`: Environment (development/production)

### Frontend (Web)

**Required Environment Variables:**
- `apiUrl`: API base URL (e.g., `https://spectyra.up.railway.app/v1`)
- `supabaseUrl`: Supabase project URL
- `supabaseAnonKey`: Supabase anonymous key for client-side auth

### Development
- API URL: `http://localhost:8080/v1`
- Frontend: `http://localhost:4200`
- Debug mode: Enabled (shows moat internals in admin panel)

### Production
- API URL: `https://spectyra.up.railway.app/v1`
- Frontend: Deployed to Netlify/Vercel
- Debug mode: Disabled (strips all internals from public API)
- Build: `ng build --configuration production`

---

## Definition of Done

✅ **Real-Time Mode:**
- Chat endpoint works with baseline and optimized modes
- Optimization pipeline runs end-to-end
- Savings estimated and stored
- Quality guard prevents quality degradation
- Auto-retry on quality failures

✅ **Proof Mode:**
- Replay runs both baseline and optimized
- Verified savings calculated and stored
- Side-by-side comparison in UI
- Quality checks prevent false savings

✅ **Savings Dashboard:**
- Shows verified vs estimated savings
- Confidence bands displayed
- Time series and breakdowns work
- Export functionality

✅ **IP Protection:**
- No moat internals in public API
- Admin debug endpoint protected
- All responses conform to public schemas

✅ **Multi-Provider:**
- Works with OpenAI, Anthropic, Gemini, Grok
- Token usage tracked accurately
- Cost estimation per provider
- Automatic API format conversion in proxy
- BYOK support for all providers

✅ **Developer Tools Integration:**
- Enterprise proxy supports all major coding assistants
- Secure by default (localhost binding, no key logging)
- Multi-provider format handling
- Environment variable configuration
- Auto path detection

✅ **Enterprise Features:**
- Organization/project model
- Secure authentication (hashed API keys)
- Ephemeral provider keys (never stored)
- Trial gating with Stripe billing
- Org/project-scoped data isolation
- Centralized security logging

---

## Technical Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (via Supabase) with Row Level Security (RLS)
- **Frontend**: Angular 17 (standalone components with separate HTML/CSS files)
- **Authentication**: Supabase Auth (JWT) + API Keys (argon2id hashing)
- **LLM SDKs**: OpenAI, Anthropic, Google Generative AI, Grok
- **Embeddings**: OpenAI text-embedding-3-small
- **Math**: Custom spectral analysis (no external math libs for MVP)
- **Deployment**: Railway (API), Netlify/Vercel (Frontend)
- **Proxy**: Express server with multi-provider format conversion
- **Dashboard**: Real-time web UI for savings tracking

## Additional Components

### SDK Package (`packages/sdk`) - **v2.0.0 (SDK-First Agent Control Plane)**

**New SDK Architecture:**
- **Primary API**: `createSpectyra()` factory function
- **Two Integration Modes**:
  - **Local Mode** (default): Works offline, makes local decisions about agent options
  - **API Mode**: Calls Spectyra API for centralized control plane

**Agent Control Plane Features:**
- **Agent Options**: Determine model, budget, tools, permissions based on prompt context
- **Event Streaming**: Send agent events for telemetry and analytics
- **Claude Agent SDK Integration**: Adapter converts Spectyra decisions to Claude Agent format
- **Tool Gating**: Default `canUseTool` gate denies dangerous Bash commands

**API Endpoints:**
- `POST /v1/agent/options` - Get agent options for prompt context
- `POST /v1/agent/events` - Send agent event for telemetry

**Usage Examples:**
- Local mode: `createSpectyra({ mode: "local" })` - No API calls, works offline
- API mode: `createSpectyra({ mode: "api", endpoint, apiKey })` - Centralized control

**Legacy Support:**
- `SpectyraClient` class (deprecated) - Still available for backward compatibility
- Chat optimization via `/v1/chat` endpoint

**Installation:**
```bash
npm install @spectyra/sdk
```

**Best for**: 
- Agent frameworks (Claude Agent SDK, LangChain, etc.)
- Custom applications requiring runtime control
- Enterprise deployments needing centralized policy
- See: `packages/sdk/README.md` for full documentation

### Browser Extension (`extensions/browser-extension`)
- **Target Audience**: Web-based LLM tools (ChatGPT, Claude Web, Gemini Web)
- Chrome/Edge MV3 extension
- Intercepts LLM API calls from web UIs (OpenAI, Anthropic, Gemini, Grok)
- Routes through Spectyra automatically
- Shows real-time savings widget overlay
- Session savings tracking
- Configurable optimization level and path
- **Stealth Mode**: Production-ready with minimal detection footprint
- **Compliance**: Works with user-provided API keys (BYOK model)
- **Note**: For desktop coding tools (Copilot, Cursor, Claude Code), use the Local Proxy instead

### Enterprise Proxy (`tools/proxy`) - **v2.0.0**
- **Target Audience**: Desktop coding assistants (GitHub Copilot, Cursor, Claude Code, Codeium, Tabnine)
- **Enterprise-Grade Security**:
  - Binds to `127.0.0.1` by default (localhost only)
  - No prompt logging by default
  - No key logging ever (redaction utilities)
  - Domain allowlist for outbound requests
  - Environment variable configuration (no file storage)
- **Multi-Provider Support**: OpenAI, Anthropic, Gemini, Grok
- **Automatic Features**:
  - API format conversion (handles different provider formats)
  - Path detection (auto-detects "talk" vs "code" from messages)
  - Provider detection (from model name and endpoint)
- **Endpoints**:
  - OpenAI-compatible: `POST /v1/chat/completions`
  - Anthropic-compatible: `POST /v1/messages`
- **Pass-Through Mode**: Optional fallback to direct provider if Spectyra unavailable
- **Client Headers**: Sends `X-SPECTYRA-CLIENT` and `X-SPECTYRA-CLIENT-VERSION` to Spectyra API
- **Configuration**: Environment variables only (secure, no file storage)
  - `SPECTYRA_API_URL` (required)
  - `SPECTYRA_API_KEY` (required)
  - `OPENAI_API_KEY` (optional, for pass-through)
  - `ANTHROPIC_API_KEY` (optional)
  - `PROXY_PORT` (default: 3001)
  - `SPECTYRA_OPT_LEVEL` (default: 2)
  - `SPECTYRA_RESPONSE_LEVEL` (default: 2)
  - `SPECTYRA_MODE` (default: optimized)
  - `ALLOW_REMOTE_BIND` (default: false)
  - `DEBUG_LOG_PROMPTS` (default: false)
  - `ENABLE_PASSTHROUGH` (default: false)
- **BYOK Support**: Uses user's own provider API keys (ephemeral)
- Runs on localhost:3001 by default
- Works with any tool that supports custom API endpoints
- See: `tools/proxy/README.md` for enterprise usage guide

### CLI Wrapper (`tools/cli`)
- Command-line interface for code workflows
- Commands: `spectyra talk`, `spectyra code`, `spectyra replay`

---

## Key Metrics Tracked

1. **Token Usage**: Input, output, total per run
2. **Cost**: USD per run (provider-specific pricing)
3. **Savings**: Tokens saved, %, cost saved
4. **Quality**: Pass/fail, failure reasons
5. **Confidence**: 0-1 score for estimated savings
6. **Optimization Level**: 0-4 slider setting
7. **Spectral Metrics**: Stability index, λ₂, contradiction energy (debug only)
8. **Retry Info**: Whether retry occurred, reason, first failures (debug only)

## Real-Time Savings Display

### Browser Extension
- **Savings Widget**: Overlay on each optimized request showing savings percentage
- **Popup Stats**: Session totals (calls optimized, tokens saved, cost saved)
- **Auto-updates**: Real-time tracking as requests are processed

### Local Proxy Dashboard
- **Web Dashboard**: http://localhost:3002
- **Real-Time Stats**: Updates every 2 seconds
  - Total requests processed
  - Total tokens saved
  - Total cost saved (USD)
- **Recent Request History**: Last 100 requests with:
  - Model used
  - Savings percentage
  - Tokens saved per request
  - Cost saved per request
  - Timestamp
- **Configuration UI**: Web-based setup for API keys and settings

### SDK/Direct API
- **Response Data**: Savings metrics included in API response
- **Programmatic Access**: Query stats via API endpoints
- **Custom Dashboards**: Build your own using API data

---

## Enterprise Authentication & Organization Model

### Organization-Based Architecture

Spectyra uses an enterprise organization/project model:

- **Organizations**: Top-level entities representing companies or teams
  - Each org has a 7-day free trial
  - Trial can be extended via Stripe subscription
  - Multiple projects can belong to one org

- **Projects**: Sub-divisions within an organization
  - Optional grouping for different teams/products
  - API keys can be scoped to org-level or project-level

- **API Keys**: Authenticate requests to Spectyra API
  - Format: `sk_spectyra_<random>`
  - Stored as SHA256 hash (never plaintext)
  - Can be org-level or project-scoped
  - Tracked with last_used_at timestamp
  - Can be revoked without deletion

### Registration Flow
1. User provides organization name
2. System creates org with 7-day free trial
3. System creates default project
4. System generates first API key (shown once)
5. API key stored in browser localStorage
6. User automatically logged in

### API Key Usage
- **Spectyra API Key**: Authenticates requests to Spectyra API
  - Sent via `X-SPECTYRA-API-KEY` header
  - Identifies org and optional project
  - Stored in localStorage after registration/login
  - Automatically included in all API requests from frontend
  - Used to check trial/subscription status

- **Provider API Keys** (BYOK - Ephemeral): User's own LLM provider keys
  - Sent via `X-PROVIDER-KEY` header
  - **Never stored server-side** (ephemeral, in-memory only)
  - **Never logged** (redacted in all logs)
  - Used only for the current request
  - Only fingerprint stored for audit (SHA256(last6 + org_id + salt))
  - Allows users to use their own provider billing
  - **Supported Providers**: OpenAI, Anthropic, Gemini, Grok
  - **Finding Keys**: See `extensions/browser-extension/FINDING_API_KEYS.md`

### API Key Management
- Organizations can create multiple API keys
- Keys can be named for organization
- Keys can be org-level or project-scoped
- Keys can be revoked (soft delete)
- Last used timestamp tracked

---

## Integration Options

### For Web-Based Tools (ChatGPT, Claude Web, etc.)
👉 **Use Browser Extension**
- Zero code changes
- Automatic interception
- Works with web UIs
- Real-time savings widget
- See: `extensions/browser-extension/README.md`

### For Desktop Coding Tools (Copilot, Cursor, Claude Code, etc.)
👉 **Use Enterprise Proxy** (Recommended)
- **Secure by default**: Binds to localhost, no key logging
- Works with all coding assistants
- Multi-provider support (OpenAI, Anthropic, Gemini, Grok)
- Automatic path detection (talk vs code)
- Automatic API format conversion
- Environment variable configuration (no file storage)
- Optional pass-through fallback mode
- See: `tools/proxy/README.md` for enterprise usage guide

### For Agent Frameworks (Claude Agent SDK, LangChain, etc.)
👉 **Use SDK (Agent Control Plane)**
- **Local Mode**: Works offline, makes local decisions (default)
- **API Mode**: Centralized control plane with telemetry
- Agent options: model selection, budget, tool permissions
- Event streaming for analytics
- One-line integration with Claude Agent SDK
- See: `packages/sdk/README.md`

### For Custom Applications (Chat Optimization)
👉 **Use SDK (Legacy Chat Client)**
- Full programmatic control
- Chat optimization via `/v1/chat` endpoint
- Integrate into your codebase
- Custom workflows
- **Note**: Legacy API, agent control plane is recommended for new integrations
- See: `packages/sdk/README.md`

### For Direct API Integration
👉 **Use Hosted Gateway API**
- Enterprise authentication (X-SPECTYRA-API-KEY)
- Ephemeral provider keys (X-PROVIDER-KEY)
- Maximum flexibility
- Non-JavaScript environments
- Custom HTTP clients
- See: `/integrations` page for code snippets

## Compliance & Privacy

### ✅ 100% Compliant Architecture

**Spectyra uses official provider APIs directly** - this is 100% compliant with all provider Terms of Service.

**How it works:**
```
User Application/Tool
  ↓
Spectyra API (middleware)
  ↓ (uses official provider SDKs)
Provider Official API
  ↓
Optimized Response
```

**Key Safety Features:**
- ✅ **Official SDKs Only**: Uses `openai`, `@anthropic-ai/sdk`, `@google/generative-ai` npm packages
- ✅ **Official API Endpoints**: Calls `api.openai.com`, `api.anthropic.com`, etc.
- ✅ **Direct API Interaction**: No web UI interception (except browser extension)
- ✅ **No Unauthorized Access**: All calls go through official APIs
- ✅ **Follows Provider Guidelines**: Uses APIs as intended by providers

### BYOK (Bring Your Own Key) Model
- Users provide their own provider API keys
- Keys are **never stored server-side**
- Keys used only for the duration of the request
- Users pay providers directly (no markup)
- Spectyra charges for optimization service only
- **Why this is compliant**: Users own the keys, Spectyra uses them to call official APIs

### Integration Method Compliance

#### ✅ Local Proxy (100% Compliant)
- **How**: Tool → Proxy → Spectyra API → Official Provider API
- **Uses**: Official provider SDKs (`openai`, `@anthropic-ai/sdk`, etc.)
- **Calls**: Official API endpoints (`api.openai.com/v1/chat/completions`)
- **Result**: 100% compliant - uses official APIs as intended

#### ✅ SDK / Direct API (100% Compliant)
- **How**: Developer code → Spectyra API → Official Provider API
- **Uses**: Official provider SDKs
- **Calls**: Official API endpoints
- **Result**: 100% compliant - explicit API calls

#### ⚠️ Browser Extension (May Violate ToS)
- **How**: Intercepts web UI requests (ChatGPT.com, Claude.ai, etc.)
- **Issue**: Intercepts web UI backend (not official API)
- **Risk**: May violate provider ToS
- **Recommendation**: Use for web tools only, understand risks
- **Alternative**: Use Local Proxy for desktop tools (safer)

### Backend Implementation

**Spectyra backend uses official SDKs:**

```typescript
// OpenAI
import OpenAI from "openai";
const client = new OpenAI({ apiKey: userKey });
await client.chat.completions.create({ ... });

// Anthropic
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: userKey });
await client.messages.create({ ... });

// Gemini
import { GoogleGenerativeAI } from "@google/generative-ai";
const client = new GoogleGenerativeAI(userKey);
await client.getGenerativeModel({ ... });
```

**This is 100% compliant** because:
- ✅ Uses official provider SDKs
- ✅ Calls official API endpoints
- ✅ Follows provider API guidelines
- ✅ No web UI interaction
- ✅ No unauthorized access

### Privacy
- API keys never stored server-side
- Request data processed for optimization only
- No data collection or tracking
- All processing happens in real-time
- See: `extensions/browser-extension/PRIVACY_AND_DETECTION.md`

### Compliance Documentation
- See: `COMPLIANCE_ARCHITECTURE.md` for detailed compliance analysis
- See: `extensions/browser-extension/TOS_WARNING.md` for ToS warnings
- See: `extensions/browser-extension/COMPLIANT_BYOK_SOLUTION.md` for compliant architecture

## Billing & Subscription

### Trial System

- **7-Day Free Trial**: All new organizations get 7-day trial
- **Trial Enforcement**:
  - `/v1/chat` (live provider calls) **blocked** if trial expired and no subscription
  - `/v1/replay` estimator mode **allowed** even if trial expired (no real LLM calls)
  - `/v1/scenarios` browsing **allowed** (read-only)
  - Returns `402 Payment Required` with billing URL

### Stripe Integration

- **Checkout**: `POST /v1/billing/checkout` creates Stripe checkout session
- **Webhook**: `POST /v1/billing/webhook` handles subscription events
  - `customer.subscription.created` / `updated` → Updates org subscription status
  - `customer.subscription.deleted` → Marks subscription as canceled
- **Status**: `GET /v1/billing/status` returns org billing status
- **Billing UI**: `/billing` page shows trial countdown, subscription status, upgrade button

### Subscription Status

- `trial`: Active trial period
- `active`: Active paid subscription
- `canceled`: Subscription canceled (trial expired)
- `past_due`: Payment failed

---

## Recent Updates & Current Features

### ✅ Completed Features

1. **Database Migration**: SQLite → PostgreSQL (Supabase)
   - Full Postgres schema with RLS policies
   - Connection pooling for performance
   - Multi-tenant data isolation

2. **Dual Authentication System**:
   - Supabase JWT for dashboard users
   - API keys for machine auth (gateway/SDK)
   - HTTP interceptor for automatic header injection
   - Route guards for protected pages

3. **Agent Control Plane**:
   - SDK-first integration with `createSpectyra()`
   - Local and API modes
   - Agent options and event streaming endpoints
   - Claude Agent SDK adapter

4. **Frontend Refactoring**:
   - All components separated into `.ts`, `.html`, `.css` files
   - Professional SVG icons replacing emojis
   - Homepage for unauthenticated users
   - Organization/project switcher component
   - Bootstrap flow for first-time users

5. **Enhanced Pages**:
   - Proof Mode page for conversation paste
   - Connections page for coding tools setup
   - Settings page for API key management
   - Admin panel for system administration

6. **Security Improvements**:
   - Centralized logging with redaction utilities
   - Constant-time key comparison
   - Provider key fingerprinting for audit
   - No secrets in logs or error messages

## Future Enhancements (Not in MVP)

- Shadow baseline sampling (automatic baseline measurement in production)
- Advanced NLI-based contradiction detection
- Multi-turn conversation state persistence
- Custom scenario creation UI
- A/B testing framework
- Real-time savings notifications
- Response cache (skip LLM calls for highly stable prompts)
- Markov drift detection (semantic state changes)
- Usage limits and tiered pricing for Spectyra service (future)
- Project-level billing and quotas
- Multi-user organization management UI
- Role-based access control (RBAC) UI
