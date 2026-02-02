# Spectyra Application Description

**Version:** 2.2  
**Last Updated:** February 2026  
**Purpose:** How the app works from SDK integration through ingestion to optimization—including all algorithms used for optimizing prompts.

---

## Table of Contents

1. [Overview](#1-overview)
2. [End-to-End Flow: Integration → Ingestion → Optimization → Response](#2-end-to-end-flow-integration--ingestion--optimization--response)
3. [Optimization Pipeline: Step-by-Step](#3-optimization-pipeline-step-by-step)
4. [Optimization Algorithms (Deep Dive)](#4-optimization-algorithms-deep-dive)
5. [Paths: Talk vs Code](#5-paths-talk-vs-code)
6. [Reference](#6-reference)

---

## 1. Overview

**Spectyra** is an **Enterprise AI Inference Cost-Control Gateway**. It sits between your application and LLM providers (OpenAI, Anthropic, Gemini, Grok), optimizes prompts to reduce token usage, then forwards the optimized request to the provider using your API key (BYOK). You pay the provider; Spectyra does not store or pay for your LLM calls.

**Core idea:**  
- **Ingestion:** Your app sends messages (and optional metadata) to Spectyra via SDK, proxy, or direct API.  
- **Optimization:** Spectyra unitizes messages, builds a semantic graph, runs spectral analysis, then applies profit-gated transforms (SCC, RefPack, PhraseBook, CodeMap, Policy) so the prompt sent to the LLM is shorter and focused.  
- **Response:** Spectyra calls the provider with the optimized prompt, post-processes the reply, and returns text + usage + savings to you.

The rest of this document walks **integration → ingestion → full optimization flow** and describes **every algorithm** used along the way.

---

## 2. End-to-End Flow: Integration → Ingestion → Optimization → Response

### 2.1 Integration: How Requests Enter Spectyra

Requests reach Spectyra in three main ways.

| Method | Use Case | Entry Point |
|--------|----------|-------------|
| **SDK (Agent Control Plane)** | Agent frameworks (Claude Agent SDK, LangChain, etc.) | `createSpectyra({ mode: "api", endpoint, apiKey })` → `agentOptionsRemote()`, `sendAgentEvent()`; optional `chatRemote()` |
| **Hosted Gateway API** | Custom apps, server-side or serverless | `POST /v1/chat` with `X-SPECTYRA-API-KEY` and `X-PROVIDER-KEY` (BYOK) |
| **Local Proxy** | Desktop coding tools (Cursor, Copilot, etc.) | Proxy runs locally; coding tool points to proxy; proxy calls Spectyra `POST /v1/chat` |

**SDK integration (summary):**

- **Local mode:** `createSpectyra({ mode: "local" })` — no API calls; SDK returns agent options locally.
- **API mode:** `createSpectyra({ mode: "api", endpoint, apiKey })` — SDK calls `POST /v1/agent/options` and `POST /v1/agent/events`; for chat optimization it can call `POST /v1/chat` via `chatRemote()`.

**Gateway / Proxy:**  
Both ultimately send a JSON body to `POST /v1/chat` with `path`, `provider`, `model`, `messages`, `mode` (`baseline` or `optimized`), optional `optimization_level`, optional `conversation_id`, and optional `dry_run`. The API authenticates the request (API key or JWT), resolves the provider key (BYOK header or vaulted key), converts `messages` to the internal `ChatMessage[]` format, and passes them into the optimizer.

### 2.2 Ingestion: Where Messages Become “Input”

**Ingestion** is the moment the API has validated the request and is about to run the optimizer. It happens in these routes:

| Route | Purpose | Ingestion |
|-------|---------|-----------|
| **`POST /v1/chat`** | Live chat optimization | Body: `path`, `provider`, `model`, `messages`, `mode`, `optimization_level`, optional `conversation_id`, `dry_run`. Messages are mapped to `ChatMessage[]` and passed to `runOptimizedOrBaseline()`. |
| **`POST /v1/replay`** | Replay a scenario (baseline + optimized) | Loads scenario messages; runs baseline then optimized; compares. |
| **`POST /v1/proof/estimate`** | Estimate savings without LLM call | Accepts `messages` + path/model/level; runs optimizer in dry-run style to get token estimates. |
| **Optimizer Lab** (`POST /v1/optimizer-lab/run`) | Admin testing/demos | Accepts raw `messages` (or prompt); runs optimized pipeline (often `dry_run: true`) and returns before/after + per-layer metrics. |

So “ingestion” = the validated `ChatMessage[]` (and path, model, conversationId, etc.) that the optimizer receives. No separate “ingestion service”—the route handler is the ingestion boundary.

### 2.3 High-Level Optimization → Response Flow

Once the API has the messages and config:

1. **Optional: Markov state carry** — If `conversation_id` is set, load prior compiled state from cache and prepend it (and last turn) to the incoming messages.
2. **Unitize** — Split messages into semantic units (paragraphs, bullets, code blocks) with stable IDs.
3. **Embed** — Get embeddings for each unit (local TEI or configured provider).
4. **Build graph** — Build signed graph: similarity, contradiction, dependency edges.
5. **Spectral analysis** — Signed Laplacian, λ₂, stability index, contradiction energy → recommendation: REUSE / EXPAND / ASK_CLARIFY.
6. **Optional short-circuit** — If recommendation is ASK_CLARIFY and not dry-run, return a clarifying question (no LLM call).
7. **Spectral-driven budgets** — Compute `keepLastTurns`, `maxRefpackEntries`, aggressiveness for SCC, RefPack, PhraseBook, CodeMap.
8. **PG-SCC (Spectral Context Compiler)** — Compile older context into one state message; keep last N turns verbatim; apply only if profit-gate passes.
9. **RefPack** — Replace repeated stable content with `[[REF:id]]` + glossary; profit-gated.
10. **PhraseBook** — Encode repeated phrases as short symbols; profit-gated.
11. **CodeMap** (code path only) — Compress code blocks to symbols/summaries; profit-gated.
12. **Policy (Talk or Code)** — Context compaction, delta prompting, code slicing (code path), patch mode, etc.; profit-gated.
13. **Markov state carry (persist)** — If `conversation_id` and a state message was produced, cache it for the next request.
14. **Dry-run exit** — If `dry_run`, return optimized messages + metrics; no LLM call.
15. **LLM call** — Send final messages to the provider (your key); get response.
16. **Post-process** — Trim boilerplate, preserve code blocks, enforce patch format if needed.
17. **Quality guard** — Optional checks; retry with relaxed config on failure if enabled.
18. **Response** — Return text, usage, cost, savings (and in lab, per-layer metrics).

The next two sections spell out each step and then each algorithm in detail.

---

## 3. Optimization Pipeline: Step-by-Step

What runs inside `runOptimizedOrBaseline()` when `mode === "optimized"`:

| Step | Name | What it does |
|------|------|---------------|
| 0 | **Markov state (load)** | If `conversationId`: load `stateMsg` + `lastTurn` from cache; prepend to `messages`. |
| 1 | **Unitize** | Split each message into semantic units (paragraphs, bullets, code blocks). Assign deterministic IDs (`u_` + hash). Output: `SemanticUnit[]`. |
| 2 | **Embed** | Call embedder (e.g. TEI) for each unit text → `number[][]`. Attach to units. |
| 3 | **Build graph** | From units: similarity edges (cosine + temporal/kind boosts), contradiction edges (numeric, negation, semantic, optional NLI), dependency edges (code: patch→code, constraint→code). Output: `SignedGraph`. |
| 4 | **Spectral analysis** | Signed Laplacian L = D − W; power iteration for λ₂; contradiction energy; stability index (multi-operator: spectral, random-walk gap, heat-trace, curvature, node features); adaptive thresholds → **recommendation**: REUSE / EXPAND / ASK_CLARIFY. |
| 5 | **Short-circuit** | If recommendation === ASK_CLARIFY and not dry_run: return clarifying question, no LLM call. |
| 6 | **Budgets from spectral** | From stability, contradiction, novelty: compute `keepLastTurns`, `maxRefpackEntries`, `compressionAggressiveness`, `phrasebookAggressiveness`, `codemapDetailLevel`, `stateCompressionLevel`, `maxStateChars`. |
| 7 | **PG-SCC** | Compile older messages into one state message (`[SPECTYRA_STATE_TALK]` or `[SPECTYRA_STATE_CODE]`); keep last N turns verbatim. **Profit gate:** use result only if token reduction ≥ min % and min absolute (e.g. talk: 3%, 40 tokens; code: 2%, 60 tokens). |
| 8 | **RefPack** | Build glossary of stable units (short summaries); replace occurrences in messages with `[[R1]]`, etc. **Profit gate:** same thresholds. |
| 9 | **PhraseBook** | Detect repeated phrases (e.g. ≥18 chars, ≥3 occurrences); add to PHRASEBOOK; replace with `⟦P1⟧`. **Profit gate:** same. |
| 10 | **CodeMap** (code path) | Replace or summarize code blocks with compact symbols/summaries. **Profit gate:** same. |
| 11 | **Policy** | Talk: context compaction, delta prompting, output trimming. Code: code slicing, patch mode, compaction. **Profit gate:** do not use policy output if it increases tokens. |
| 12 | **Markov state (save)** | If `conversationId` and final messages contain a state message: cache it + last turn for next request. |
| 13 | **Dry-run** | If `dry_run`: return `promptFinal`, token counts, per-layer steps; no provider call. |
| 14 | **Provider call** | `provider.chat({ model, messages: messagesFinal, maxOutputTokens })`. |
| 15 | **Post-process** | Remove boilerplate; preserve code blocks; enforce patch format. |
| 16 | **Quality guard** | Run required checks; optionally retry with relaxed config. |
| 17 | **Return** | `responseText`, `usage`, `optimizationReport`, savings, etc. |

---

## 4. Optimization Algorithms (Deep Dive)

### 4.1 Unitization

- **Input:** `ChatMessage[]`, path, `lastTurnIndex`, options (e.g. `maxUnits`, `minChunkChars`, `maxChunkChars`).
- **Output:** `SemanticUnit[]` — each unit has `id`, `text`, `kind` (e.g. paragraph, bullet, code), `role`, `turnIndex`.
- **Algorithm:**
  - Split each message content by structure: paragraphs (blank lines), bullet lists, code fences (```).
  - Assign deterministic ID: `u_` + first 16 chars of `SHA256(normalizedText|kind|role)`; collision handling appends `_2`, `_3`, ...
  - Enforce max units (e.g. last N units by config); trim to `maxChunkChars` per chunk.
- **Purpose:** Stable, reusable “atoms” for embedding, graph, and later replacement (RefPack, SCC).

### 4.2 Embedding

- **Input:** Unit texts.
- **Output:** One vector per unit (e.g. 1024-dim from BGE).
- **Algorithm:** Call embedder (local TEI, HTTP, or OpenAI). Cache key = hash(normalized text + model + provider); cache (Redis/Postgres/memory) to avoid recompute.
- **Purpose:** Similarity edges in the graph and any similarity-based logic in spectral/budgets.

### 4.3 Graph Build

- **Input:** `SemanticUnit[]` with embeddings, path, spectral options.
- **Output:** `SignedGraph` { n, edges }.
- **Edges:**
  - **Similarity:** Cosine similarity above threshold; optional temporal and kind boosts (same turn, adjacent turn, constraint/fact weights).
  - **Contradiction:** Numeric conflicts, negation patterns, semantic pairs (e.g. always/never), temporal conflicts; optionally NLI (MNLI) for entailment/contradiction.
  - **Dependency (code path):** Patch → code, constraint → code, code references; fixed weights (e.g. 0.5–0.7).
- **Purpose:** Signed graph is input to spectral analysis; negative edges drive contradiction energy and stability.

### 4.4 Spectral Analysis (MOAT)

- **Input:** Signed graph, options, optional units and `currentTurn`.
- **Output:** `SpectralResult`: `lambda2`, `contradictionEnergy`, `stabilityIndex`, `recommendation` (REUSE / EXPAND / ASK_CLARIFY), `stableNodeIdx`, `unstableNodeIdx`.
- **Algorithm:**
  - **Signed Laplacian:** L = D − W (degree matrix minus signed adjacency).
  - **λ₂ (algebraic connectivity):** Power iteration with orthogonalization.
  - **Contradiction energy:** Fraction of edge weight that is negative.
  - **Stability index:** Combined from:
    - Spectral component (sigmoid on λ₂, non-linear contradiction penalty, connectivity reward).
    - Random-walk gap (topic mixing).
    - Heat-trace complexity (Hutchinson estimator).
    - Curvature (Forman-Ricci-like) and node features (age, length, kind, novelty).
  - **Adaptive thresholds:** tHigh, tLow from conversation history (e.g. past stability, contradiction trend).
  - **Recommendation:** stability ≥ tHigh → REUSE; tLow < stability < tHigh → EXPAND; stability ≤ tLow or high contradiction → ASK_CLARIFY.
- **Purpose:** Decide whether to compress aggressively (REUSE), moderately (EXPAND), or to ask a clarifying question and skip the LLM call.

### 4.5 Spectral-Driven Budgets

- **Input:** `SpectralResult`, base `keepLastTurns`, base `maxRefs`.
- **Output:** `Budgets`: `keepLastTurns`, `maxRefpackEntries`, `compressionAggressiveness`, `phrasebookAggressiveness`, `codemapDetailLevel`, `stateCompressionLevel`, `maxStateChars`, `retainToolLogs`.
- **Algorithm:** Normalize stability, contradiction, novelty to 0–1. High stability + low novelty + low contradiction → tighter budgets (aggressive compression); low stability or high contradiction → looser (keep more turns, fewer refs, less aggressive phrasebook/codemap). Formula uses linear combinations and clamps.
- **Purpose:** So that SCC, RefPack, PhraseBook, CodeMap, and policy all use one consistent, stability-aware “budget” instead of fixed constants.

### 4.6 PG-SCC (Spectral Context Compiler)

- **Input:** Messages, units, spectral result, budgets.
- **Output:** One system-like state message + “kept” messages (state + last N turns); `droppedCount`.
- **Algorithm:**
  - **Talk:** Extract goal (first user line), constraints (deduped, normalized), facts from older user messages, decisions from older assistant messages; build `[SPECTYRA_STATE_TALK] ... [/SPECTYRA_STATE_TALK]`; keep last N turns verbatim.
  - **Code:** Extract tasks, constraints, failing signals, touched files (deduped); build `[SPECTYRA_STATE_CODE] ... [/SPECTYRA_STATE_CODE]`; keep last N turns (and optionally tool logs).
  - Uses `scc/normalize` (normalizeBullet, dedupeOrdered, normalizePath, dedupeFailingSignals) and `scc/extract` (extractConstraints, extractFailingSignals, extractTouchedFiles).
- **Profit gate:** Estimate tokens before (original) and after (state + last N); use SCC only if pct gain and absolute gain meet TALK_PROFIT_GATE or CODE_PROFIT_GATE.
- **Purpose:** Replace long history with one compact state message so the model still has context with far fewer tokens.

### 4.7 Profit Gates

- **Input:** `beforeMsgs`, `afterMsgs`, options (`minPctGain`, `minAbsGain`), label.
- **Output:** `{ useAfter, before, after, pct, absChange, label }`.
- **Algorithm:** `before` = sum of estimated input tokens (chars/4) for before messages; same for after. `absChange = before - after`; `pct = (absChange / before) * 100`. `useAfter = (pct >= minPctGain) && (absChange >= minAbsGain) && (after <= before)`.
- **Constants:** Talk: min 3% gain, 40 tokens; Code: min 2% gain, 60 tokens.
- **Purpose:** No transform is applied unless it actually saves enough tokens; avoids “optimized” payloads being larger than originals.

### 4.8 RefPack (v2)

- **Input:** Units, spectral (for stable nodes), path, maxEntries, optional full message text.
- **Output:** RefPack (entries: id, summary, originalId), tokensBefore, tokensAfter.
- **Algorithm:** From stable units, build entries with **short summaries (40–80 chars)**. Include only if referenced ≥2 times in message text or block > 300 chars. Dictionary format `id|<summary>`. Replace occurrences in messages with `[[R<id>]]` (outside code fences). Estimate tokens before/after.
- **Purpose:** Replace long repeated blocks (e.g. policy boilerplate) with a short ref + glossary.

### 4.9 PhraseBook (v2)

- **Input:** Messages, aggressiveness, minPhraseLength (default 18), minOccurrences (default 3).
- **Output:** New messages with phrase substitutions, PhraseBook, tokensBefore, tokensAfter, changed.
- **Algorithm:** Detect repeated phrases (length ≥ 18, count ≥ 3); build PHRASEBOOK block; replace with `⟦P<id>⟧` outside code fences. Only add phrases that yield net token savings.
- **Purpose:** Compress repeated wording (e.g. “I’ve looked up your account…”) into short symbols.

### 4.10 CodeMap

- **Input:** Messages, spectral, detailLevel (0–1).
- **Output:** Messages with code blocks replaced/summarized by symbols; tokensBefore, tokensAfter, codeMap, changed.
- **Algorithm:** Identify code blocks; optionally replace or summarize by detail level (e.g. keep signatures, trim body). Build compact code map; inject glossary; replace in text.
- **Purpose:** Shrink code-heavy context while keeping structure visible (code path only).

### 4.11 Policy (Talk / Code)

- **Talk policy:** Context compaction (replace stable units with REFs up to maxRefs), delta prompting (system instruction to focus on new info), output trimming (post-process).
- **Code policy:** Code slicing (keep most relevant block; AST-aware when available), context compaction, patch mode (request diff + short bullets), delta prompting, output trimming.
- **Input:** Messages after RefPack/PhraseBook/CodeMap, units, spectral, policy opts (maxRefs, keepLastTurns, trimAggressive, patchMode, etc.).
- **Output:** `messagesFinal`, debug.
- **Profit gate:** After policy, compare token count to “after CodeMap”; if policy increases tokens, discard policy output and keep pre-policy messages.

### 4.12 Markov State Carry

- **Load:** Key `state:{conversationId}`. Value: `{ stateMsg, lastTurn }`. Prepend to current request messages so the pipeline sees “prior state + last turn + new messages.”
- **Save:** If final messages contain a system message with `[SPECTYRA_STATE_TALK]` or `[SPECTYRA_STATE_CODE]`, set `stateMsg` to that message and `lastTurn` to last few messages; write back to cache.
- **Purpose:** Multi-turn conversations reuse compiled state across requests without re-sending full history.

### 4.13 Post-Process and Quality Guard

- **Post-process:** Strip boilerplate phrases (“Sure, here’s…”, “Hope this helps”, etc.); preserve code blocks; enforce patch format (unified diff + bullets) on code path.
- **Quality guard:** Optional list of required checks (e.g. regex on output). If any fail: set `pass: false`, record failures; optionally retry with relaxed optimizer config (e.g. fewer refs, less trimming) up to a small retry limit.

---

## 5. Paths: Talk vs Code

- **Talk (`path: "talk"`):** Chat/support/Q&A. SCC talk state, RefPack, PhraseBook, talk policy (compaction, delta prompting, trimming). No CodeMap; no patch mode.
- **Code (`path: "code"`):** Coding assistants. SCC code state (with failing signals, touched files), RefPack, PhraseBook, CodeMap, code policy (slicing, patch mode, compaction). Stricter profit gates (e.g. 60 tokens min) and often more “keep last turns” to preserve recent code context.

Optimization level (0–4) adjusts base config (maxRefs, keepLastTurns, trim aggressiveness, code slicing); spectral-driven budgets then refine these per request.

---

## 6. Reference

- **Architecture, security, RBAC, API keys, provider keys, audit, retention:** See existing docs (e.g. SECURITY.md, docs/ENTERPRISE_SECURITY.md, docs/DATA_HANDLING.md).
- **API:** `POST /v1/chat` (gateway), `POST /v1/agent/options`, `POST /v1/agent/events`, `POST /v1/replay`, `POST /v1/proof/estimate`, Optimizer Lab route—see API routes and OpenAPI/schemas if present.
- **SDK:** `packages/sdk` — `createSpectyra()`, `agentOptions()`, `agentOptionsRemote()`, `sendAgentEvent()`, `chatRemote()`.
- **Proxy:** `tools/proxy` — forwards provider-compatible requests to Spectyra and returns optimized response.
- **Optimizer entry:** `apps/api/src/services/optimizer/optimizer.ts` — `runOptimizedOrBaseline()`.  
- **Key algorithm files:**  
  - Unitize: `unitize.ts`  
  - Graph: `buildGraph.ts`, `edgeBuilders/*`  
  - Spectral: `spectral/spectralCore.ts`, `signedLaplacian.ts`, `powerIteration.ts`, `stabilityIndex.ts`, `randomWalk.ts`, `heatTrace.ts`, `curvature.ts`, `nodeFeatures.ts`  
  - Budgets: `budgeting/budgetsFromSpectral.ts`  
  - SCC: `transforms/contextCompiler.ts`, `transforms/scc/*`  
  - Profit gates: `utils/tokenCount.ts`  
  - RefPack: `transforms/refPack.ts`  
  - PhraseBook: `transforms/phraseBook.ts`  
  - CodeMap: `transforms/codeMap.ts`  
  - Policy: `policies/talkPolicy.ts`, `policies/codePolicy.ts`  
  - State: `cache/conversationState.ts`

---

**Last Updated:** February 2026  
**Version:** 2.2 (Flow and algorithms)
