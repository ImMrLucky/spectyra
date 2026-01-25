# Spectyra Application Description

## Overview

**Spectyra** is a Spectral Token & Cost Reduction Engine that reduces LLM token usage and costs by preventing semantic recomputation. It works as middleware between users and LLM providers (OpenAI, Anthropic, Gemini, Grok), intelligently optimizing prompts before sending them to the LLM while maintaining output quality.

The system uses a proprietary "Spectral Core v1" decision engine based on graph theory and spectral analysis to determine when content is semantically stable and can be reused, versus when it needs to be expanded or clarified. The core combines multiple spectral operators (signed Laplacian, random walk gap, heat-trace complexity, curvature analysis) for robust stability assessment.

---

## Core Value Proposition

**"We cut your AI bill by 40–65% on real chat and coding tasks without losing required outputs."**

The app proves savings by running the same workload in two modes:
- **Baseline Mode**: Sends requests as-is to the LLM
- **Optimized Mode**: Applies spectral analysis and optimization transforms before sending to the LLM

Both modes are measured for tokens, cost, and quality, enabling side-by-side comparison.

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

### 2. **Code Path** (`path: "code"`)
For coding assistant workflows:
- Bug fixes
- Code refactoring
- Feature implementation
- Code explanations

**Optimization Strategy:**
- Code slicing (keep only relevant code blocks)
- Patch-only mode (request unified diffs + 3-bullet explanations)
- Context compaction (reference stable explanations)
- Delta prompting (focus on changes)

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
   - `X-PROVIDER-KEY`: Optional header for BYOK (Bring Your Own Key)

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
   - Run record saved to SQLite with:
     - `workload_key`: Deterministic hash grouping comparable runs
     - `prompt_hash`: SHA256 of normalized prompt (server-only)
     - `optimization_level`: Slider level (0-4)
     - Usage tokens, cost, quality results
     - `debug_internal_json`: Moat internals (never exposed to client)

6. **Savings Ledger:**
   - For optimized runs: Writes "estimated" savings row
   - Includes confidence score and band
   - Links to run ID for audit trail

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

4. **System executes both modes:**

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

#### B2. Conversation Paste Mode

**How it works:**
1. User navigates to `/proof` page
2. User pastes a conversation from:
   - ChatGPT, Claude, or any chat interface
   - Plain text format (e.g., "User: ... Assistant: ...")
   - JSON format (array of messages)
3. System automatically parses the conversation:
   - Detects common formats: "User:", "Assistant:", "Human:", "AI:", "You:", "ChatGPT:", etc.
   - Converts to standard message format
   - Shows preview of parsed conversation
4. User configures:
   - Path (talk/code)
   - Provider and model
   - Optimization level (0-4)
5. User clicks "Estimate Savings"
6. System calls `/v1/proof/estimate` endpoint:
   - Runs optimization pipeline (dry-run, no real LLM calls)
   - Estimates baseline tokens/cost
   - Estimates optimized tokens/cost
   - Calculates savings and confidence
7. **Response shows only:**
   - Savings summary (tokens saved, cost saved, % saved)
   - Confidence band (High/Medium/Low)
   - Baseline and optimized estimates
   - **No internal breakdown** (no spectral numbers, no optimizer steps, no REFs)

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

**Conversation Paste:**
```
User → /proof page
  → Paste conversation (plain text or JSON)
  → System parses and shows preview
  → User clicks "Estimate Savings"
  → POST /v1/proof/estimate { path, provider, model, optimization_level, messages }
  → Run optimizer pipeline (dry-run mode)
  → Estimate baseline tokens/cost
  → Estimate optimized tokens/cost
  → Calculate savings
  → Return savings summary (no moat internals)
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

### Database Schema

**`runs` table:**
- Stores individual LLM calls
- Includes: tokens, cost, quality, optimization_level
- `workload_key`: Groups comparable runs
- `debug_internal_json`: Moat internals (server-only)

**`replays` table:**
- Groups baseline + optimized runs
- Links via `replay_id`
- Stores scenario_id, workload_key

**`savings_ledger` table:**
- Customer-facing accounting rows
- Separates verified vs estimated
- Includes confidence scores
- Used for dashboard and exports

**`baseline_samples` table:**
- Welford aggregates per workload_key
- Mean/variance for tokens and cost
- Used for baseline estimation

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

**Always exposed:**
- Usage tokens (input/output/total)
- Cost (USD)
- Savings numbers (tokens saved, %, cost saved)
- Confidence band (High/Medium/Low, not numeric score)
- Quality pass/fail (boolean, no details)

### Admin Debug Access

- Endpoint: `/v1/admin/runs/:id/debug`
- Requires: `X-ADMIN-TOKEN` header
- Returns: `debug_internal_json` with full moat internals
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

- `GET /v1/providers` - List available LLM providers
- `GET /v1/scenarios` - List test scenarios
- `GET /v1/scenarios/:id` - Get scenario details
- `POST /v1/chat` - Real-time chat (baseline or optimized)
- `POST /v1/replay` - Run scenario in proof mode
- `GET /v1/runs` - List run history
- `GET /v1/runs/:id` - Get run details
- `GET /v1/savings/summary` - Overall savings summary
- `GET /v1/savings/timeseries` - Daily/weekly trends
- `GET /v1/savings/by-level` - Breakdown by optimization level
- `GET /v1/savings/by-path` - Breakdown by talk/code
- `GET /v1/savings/export` - CSV/JSON export

### Admin Endpoints

- `GET /v1/admin/runs/:id/debug` - Get moat internals (requires admin token)

---

## Frontend (Angular)

### Authentication

- **Registration** (`/register`): Create account, receive API key (shown once)
- **Login** (`/login`): Enter API key to authenticate
- API key stored in localStorage, automatically included in all API requests
- User email displayed in navigation when logged in

### Pages

1. **Scenarios Page** (`/scenarios`)
   - Lists available test scenarios
   - Filter by path (talk/code)
   - Click to run scenario

2. **Run Page** (`/scenarios/:id/run`)
   - Shows scenario details
   - Optimization level slider (0-4)
   - Provider/model selector
   - "Replay Both" button
   - Displays:
     - Savings card (verified savings, total savings, confidence)
     - Side-by-side comparison (baseline vs optimized)
     - Token/cost table
     - Quality status
     - Advanced debug panel (hidden by default)

3. **Proof Page** (`/proof`) - **New**
   - Paste conversation from ChatGPT, Claude, or any chat interface
   - Supports plain text or JSON format
   - Automatic parsing with preview
   - Configuration: path, provider, model, optimization level
   - Shows estimated savings (no internal breakdown)
   - No real LLM calls (dry-run mode)

4. **Savings Page** (`/savings`)
   - KPI cards (verified, total, tokens, replays)
   - Time series chart (verified vs estimated)
   - Breakdown by level and path
   - Filters (date range, path, provider, model)
   - Export buttons

5. **Runs History** (`/runs`)
   - Table of all runs
   - Filter and sort
   - Link to run details

6. **Settings** (`/settings`)
   - Default provider/model per path
   - Pricing configuration
   - Threshold adjustments

---

## Environment Configuration

### Development
- API URL: `http://localhost:8080/v1`
- Debug mode: Enabled (shows moat internals)

### Production
- API URL: `https://spectyra.up.railway.app/v1`
- Debug mode: Disabled (strips all internals)
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

---

## Technical Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (better-sqlite3)
- **Frontend**: Angular 17 (standalone components)
- **LLM SDKs**: OpenAI, Anthropic, Google Generative AI, Grok
- **Embeddings**: OpenAI text-embedding-3-small
- **Math**: Custom spectral analysis (no external math libs for MVP)
- **Deployment**: Railway (API), Netlify (Frontend)

## Additional Components

### SDK Package (`packages/sdk`)
- NPM package for integrating Spectyra into applications
- `SpectyraClient` interface with `chat()` method
- Supports Spectyra API key and BYOK (provider keys)
- TypeScript types and examples

### Browser Extension (`extensions/browser-extension`)
- Chrome/Edge MV3 extension
- Intercepts LLM API calls (OpenAI, Anthropic, Gemini, Grok)
- Routes through Spectyra automatically
- Shows real-time savings widget overlay
- Session savings tracking
- Configurable optimization level and path

### Local Proxy (`tools/proxy`)
- OpenAI-compatible endpoint
- Routes requests through Spectyra
- For tools that support custom API endpoints

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

---

## User Authentication & API Keys

### Registration Flow
1. User provides email address
2. System creates user account with 7-day free trial
3. System generates first API key (shown once)
4. API key stored in browser localStorage
5. User automatically logged in

### API Key Usage
- **Spectyra API Key**: Authenticates requests to Spectyra API
  - Sent via `X-SPECTYRA-KEY` header
  - Stored in localStorage after registration/login
  - Automatically included in all API requests from frontend
  - Used to identify user account and check trial/subscription status

- **Provider API Keys** (BYOK): User's own LLM provider keys
  - Sent via `X-PROVIDER-KEY` header
  - Never stored server-side
  - Used only for the current request
  - Allows users to use their own provider billing

### API Key Management
- Users can create multiple API keys
- Keys can be named for organization
- Keys can be deleted
- Last used timestamp tracked

---

## Future Enhancements (Not in MVP)

- Shadow baseline sampling (automatic baseline measurement in production)
- VSCode extension for native Copilot integration
- Advanced NLI-based contradiction detection
- Multi-turn conversation state persistence
- Custom scenario creation UI
- A/B testing framework
- Real-time savings notifications
- Response cache (skip LLM calls for highly stable prompts)
- Markov drift detection (semantic state changes)
- Stripe billing integration (7-day trial + subscriptions)
