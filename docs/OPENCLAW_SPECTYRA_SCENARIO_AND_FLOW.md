# How Spectyra Works

A plain-language guide for business partners and stakeholders.
Token counts in this document are illustrative; real results depend on the model, task, and conversation length.

---

## How LLM billing works (the basics)

When any application calls an LLM (like OpenAI's GPT-4), it sends a JSON request containing a `messages` array -- the full conversation history. The LLM provider charges for:

- **Input tokens** -- every token in that messages array
- **Output tokens** -- every token the model writes back

The critical detail: **the model has no memory.** On every single call, the application must re-send the entire conversation from the beginning. That means:

```text
Call 1:  Send    2,000 tokens  -->  Billed for  2,000
Call 2:  Send    5,000 tokens  -->  Billed for  5,000
Call 3:  Send   12,000 tokens  -->  Billed for 12,000
Call 4:  Send   25,000 tokens  -->  Billed for 25,000
                                    -----
         Total billed input:        44,000 tokens
```

Each call includes everything from every prior call, plus the new content. You pay the provider to re-read the same paragraphs over and over.

---

## What Spectyra does

Spectyra sits between the application and the LLM provider. It intercepts the messages array, removes the repetitive and redundant parts, and forwards a shorter version to the provider.

```text
Your app --> Spectyra --> LLM Provider (OpenAI, Anthropic, etc.)
                |
                +-- Reads the messages
                +-- Removes duplicates, trims bloat, compresses old history
                +-- Sends the shorter version to the provider
                +-- Passes the provider's response back unchanged
```

Same example with Spectyra in the middle:

```text
Call 1:  App sends  2,000  --> Spectyra sends  2,000  (nothing to cut yet)
Call 2:  App sends  5,000  --> Spectyra sends  3,500  (removed repeated content)
Call 3:  App sends 12,000  --> Spectyra sends  7,000  (compressed old turns)
Call 4:  App sends 25,000  --> Spectyra sends 13,000  (replaced verbose history)
                                               ------
         Total billed input:                   25,500 tokens (vs 44,000)
```

In this example, input costs are reduced by roughly 42%.

---

## Local savings page (OpenClaw companion)

Open **http://127.0.0.1:4111/dashboard** while `spectyra-companion` is running. Plain English:

| What you see | Meaning |
|----------------|---------|
| **Estimated savings ($)** | Rough **dollars** from sending a **smaller input** to the model (fewer input tokens × typical price). Not your exact invoice — close enough to see the trend. |
| **Input tokens before → after** | How big the prompt was **before** vs **after** Spectyra trimmed it. This is where most money is saved. |
| **Reply tokens** | How much the **model wrote back** (output). Shown when the API reports usage (works with streaming when the provider includes it). |
| **Other scores** | **Conversation steadiness**, **repeated content**, **loop warnings** — help you see churn in the thread; not all are dollar amounts. |

If savings stay at **$0**, common causes are: **Observe** mode (preview only), **no license** yet (projected savings only), or nothing safe to trim on those calls.

---

## Concrete before and after (one call)

**Without Spectyra** -- what gets sent on Call 4:

```text
[system]    You are a helpful assistant.
[user]      What are 3 business ideas?                   <-- old, already answered
[assistant] Here are 3 ideas: 1) ... 2) ... 3) ...      <-- old, redundant
[user]      Tell me more about idea 2.                   <-- old
[assistant] Idea 2 is about ... [500 words]              <-- old, verbose
[user]      OK narrow it down to just the SaaS one.      <-- old
[assistant] Sure, focusing on SaaS: ... [400 words]      <-- old, overlaps above
[user]      Write me an MVP plan for it.                 <-- CURRENT REQUEST
```

**With Spectyra** -- what actually gets sent to the provider:

```text
[system]    Context: User chose a SaaS tool idea.
            Key requirements: budget $5k, launch by June.
            (compact summary of everything above, ~200 words)
[user]      Write me an MVP plan for it.                 <-- CURRENT REQUEST
```

Same question. Same model. Same API key. Half the tokens billed.

---

## What Spectyra is NOT

| Common concern | Reality |
|----------------|---------|
| Is it a different AI? | No. Same model, same provider, same billing account. |
| Does it change what I asked for? | No. Your latest message goes through word-for-word. It trims old history. |
| Does chat inference go through Spectyra cloud? | No. Optimization runs on your machine; the LLM provider bills your API key as usual. |
| Do we need a Spectyra account? | Yes. A Spectyra account (email/password) and Spectyra API key connect usage to your org for analytics, plans, and billing — the normal OpenClaw path uses `spectyra-companion setup` to sign in and provision the key. |
| Does it replace our agent (OpenClaw)? | No. OpenClaw still runs the workflow. Spectyra only processes the LLM call payload. |

---

## What exactly does Spectyra change?

Three categories of change, from safest to most nuanced:

### 1. Removing duplicate text

If the same paragraph appears in message 3 and message 7, the model does not benefit from reading it twice. Removing the second copy is the same as what a person would do cleaning up a document. The information is still there once.

**Risk of worse outcomes:** None. The information is preserved.

### 2. Truncating long tool output

A 500-line stack trace or a 2,000-line log dump typically has 5-10 lines that matter (the error message, the file, the line number). The rest is framework boilerplate. Spectyra keeps the important head and tail; it cuts the repetitive middle.

**Risk of worse outcomes:** Very low. Without truncation, that same log might push the conversation past the model's context window entirely -- which is worse (the model would lose the beginning of the conversation).

### 3. Compressing old history into a summary

On long conversations, older turns are replaced with a short structured summary that carries the key facts: decisions made, constraints stated, and current status.

**When this helps (common):** The model does not need to re-read 30 old turns to answer "write me an MVP plan." It needs the decisions (we picked the SaaS idea), the constraints (budget is $5k, launch by June), and the current request. A 200-word summary carrying those facts can be better for the model than 5,000 words of meandering conversation -- less noise, clearer signal.

**When this could hurt (uncommon):** If the latest question refers to something specific from 20 messages ago and the summary did not preserve that exact detail. This is the same risk as when a person summarizes meeting notes and leaves out one point someone later asks about.

**Why it usually does not make things worse:**

- Recent turns (the last few) are always kept word-for-word -- only old, stable history is compressed
- The summary is built from rules that specifically extract constraints, decisions, and key facts -- not random sentences
- If compression would increase the token count, it is automatically reverted

---

## Quality safeguards

Spectyra does not guarantee word-for-word identical outputs. When you shorten context, the model might produce slightly different text -- the same as if you manually deleted old paragraphs from a chat. That is the fundamental tradeoff.

What Spectyra does instead:

| Safeguard | How it works |
|-----------|-------------|
| Only cut what is redundant | Algorithms target duplicated text, repeated tool output, and verbose old history -- not latest instructions or active constraints. |
| Profit gates | Each step checks: did this actually save tokens? If a step would increase size or save almost nothing, it is automatically reverted. |
| Final size guard | If the optimized prompt is somehow larger than the original, the entire optimization is discarded and the original is sent. |
| Conservative defaults | Recent messages (last few turns) are always kept verbatim. Only older history gets compressed. |
| Observe mode | Run in a mode where Spectyra measures what it would save but sends the original unchanged. See the numbers with zero risk. |

---

## Physical flow diagram

```text
+-------------+     +------------------------------+     +-----------------+
|  Your App   |     | Spectyra                      |     |  LLM Provider   |
|  (OpenClaw, |     | (Local Companion or Cloud)     |     |  (OpenAI, etc.) |
|   SDK, etc.)|     |                               |     |                 |
+------+------+     +---------------+---------------+     +--------+--------+
       |                            |                               ^
       |  POST /v1/chat/completions |                               |
       |  { model, messages, ... }  |                               |
       | --------------------------->                               |
       |                            |                               |
       |                (1) Read the messages                       |
       |                (2) Run optimization pipeline               |
       |                (3) Forward shorter messages                |
       |                            | ------------------------------>
       |                            |                               |
       |  <--------------------------                               |
       |    Response passed back unchanged                          |
       |                            |                               |
```

---

## What the optimization pipeline does (detail)

The pipeline runs 16 steps in a fixed order. Each step only applies when its conditions are met. Steps that do not apply are skipped.

| Step | What it does |
|-----:|-------------|
| 1 | Normalize whitespace (outside code blocks) |
| 2 | Remove consecutive duplicate messages |
| 3 | Shorten assistant text that repeats what the user said |
| 4 | Remove duplicate system messages |
| 5 | Truncate very long tool output (logs, traces) |
| 6 | Minify JSON inside code blocks |
| 7 | Compress long error stack traces |
| 8 | Focus on the most relevant code block (code tasks) |
| 9 | Replace old history with a compact structured summary (when it saves tokens) |
| 10 | Add concise "answer only the new part" guidance (when applicable) |
| 11 | Add "output as a diff" guidance (code tasks, when applicable) |
| 12 | Replace repeated stable content with short references |
| 13 | Encode repeated phrases as short symbols |
| 14 | Build structural code maps (code tasks) |
| 15 | Summarize older stable conversation turns |
| 16 | Trim conversation to fit the model's context window |

Every step is subject to profit gates: if a step does not save enough tokens, it is reverted.

---

## Full walkthrough: building a REST API (every savings mechanism)

This section traces a realistic 8-step coding task through the entire Spectyra pipeline, showing which algorithms fire at each step and where every token is saved.

**Scenario:** A developer asks their AI agent (OpenClaw) to build a Node.js REST API with user authentication. The task involves writing code, hitting errors, reading logs, iterating, and refining -- the kind of multi-step flow that generates long, repetitive conversations.

### The 8 steps (what the developer asks)

```text
Step 1: "Set up a Node/Express project with TypeScript"
Step 2: "Add a /users endpoint with CRUD operations"
Step 3: "Add JWT authentication middleware"
Step 4: (Agent runs code, gets a build error, sends stack trace)
Step 5: "Fix the TypeScript error and add password hashing"
Step 6: (Agent runs tests, sends 200-line test output log)
Step 7: "Add input validation with Zod schemas"
Step 8: "Refactor: split routes into separate files"
```

### Without Spectyra: what gets sent on each call

Every call sends the full conversation from the beginning. Here is what the messages array looks like by Step 8:

```text
messages[] = [
  system    "You are a helpful coding assistant."
  user      "Set up a Node/Express project..."              (Step 1)
  assistant [400 words: full project scaffold, package.json, tsconfig, index.ts]
  user      "Add a /users endpoint with CRUD..."            (Step 2)
  assistant [600 words: full users.ts file, 4 route handlers]
  user      "Add JWT authentication middleware..."           (Step 3)
  assistant [500 words: full auth.ts, middleware, types]
  tool      [350-line build error stack trace]               (Step 4)
  user      "Fix the TypeScript error and add hashing..."   (Step 5)
  assistant [700 words: rewritten auth.ts + users.ts with bcrypt]
  tool      [200-line test output with pass/fail results]    (Step 6)
  user      "Add input validation with Zod schemas..."      (Step 7)
  assistant [500 words: full validation.ts + updated routes]
  user      "Refactor: split routes into separate files"     (Step 8)
]
```

**Cumulative input tokens sent to the provider (illustrative):**

| Call | Content added | Cumulative input | Cost at $3/M input |
|------|-------------|-----------------|---------------------|
| 1 | System + first question | 2,000 | $0.006 |
| 2 | + Step 1 answer + Step 2 question | 5,500 | $0.017 |
| 3 | + Step 2 answer + Step 3 question | 9,000 | $0.027 |
| 4 | + Step 3 answer + stack trace | 16,000 | $0.048 |
| 5 | + Step 4 question | 17,500 | $0.053 |
| 6 | + Step 5 answer + test output | 25,000 | $0.075 |
| 7 | + Step 6 question + answer | 30,000 | $0.090 |
| 8 | + Step 7 answer + Step 8 question | 35,000 | $0.105 |
| | **Total input billed** | **140,000** | **$0.420** |

The developer paid $0.42 in input tokens alone, with most of that being old code the model has already written and read multiple times.

### With Spectyra: what happens at each step

Below is a step-by-step trace through the optimization pipeline. Not every algorithm fires on every call -- each one has conditions that must be met. Early calls (short conversations) see minimal savings. Later calls (long, repetitive conversations) see large savings.

---

**Step 1 -- "Set up a Node/Express project"** (2,000 tokens)

Pipeline result: almost nothing fires. The conversation is too short.

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | Minor trailing spaces in system message | ~10 |
| All others | No | Not enough history to compress | 0 |

**Sent to provider: ~1,990 tokens** (essentially unchanged -- and that is correct; there is nothing to optimize yet)

---

**Step 2 -- "Add CRUD endpoint"** (5,500 tokens)

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | Cleans formatting | ~20 |
| Assistant self-quote dedup | Yes | Step 1 answer quoted the user's words back | ~80 |
| All others | No | Still a short conversation | 0 |

**Sent to provider: ~5,400 tokens** (small savings)

---

**Step 3 -- "Add JWT auth"** (9,000 tokens)

The conversation now has three substantial code blocks from prior assistant replies.

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | Formatting cleanup | ~30 |
| Assistant self-quote dedup | Yes | Model re-quoted user instructions | ~120 |
| JSON minify | Yes | package.json in Step 1 answer had pretty-printed JSON | ~80 |
| Code slicer | Yes | Focuses on auth-related code; trims unrelated scaffold | ~200 |

**Sent to provider: ~8,570 tokens** (5% reduction)

---

**Step 4 -- Build error with 350-line stack trace** (16,000 tokens)

This is where tool output truncation makes a major difference.

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | Formatting | ~40 |
| Dedup consecutive | Yes | Stack trace repeats "at Module._compile" 30+ times | ~300 |
| Tool output truncate | Yes | 350-line trace reduced to ~40 lines (error + relevant frames) | ~2,400 |
| Error stack compressor | Yes | Remaining stack frames compressed to key file:line pairs | ~400 |
| Code slicer | Yes | Old scaffold code not relevant to the error | ~350 |

**Sent to provider: ~12,510 tokens** (22% reduction)

---

**Step 5 -- "Fix the error and add hashing"** (17,500 tokens)

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | | ~40 |
| Assistant self-quote dedup | Yes | Model quoted error message back in previous reply | ~200 |
| Tool output truncate | Yes | Old stack trace still in history | ~2,400 |
| Error stack compressor | Yes | | ~400 |
| Code slicer | Yes | Focus on auth.ts and users.ts; trim scaffold | ~500 |
| Spectral SCC | Yes | Graph detects Step 1 scaffold is stable and fully superseded | ~800 |

**Sent to provider: ~13,160 tokens** (25% reduction)

---

**Step 6 -- 200-line test output** (25,000 tokens)

Two large tool outputs now in history, plus growing code blocks.

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | | ~50 |
| Dedup consecutive | Yes | Test output has repeated "PASS" boilerplate | ~200 |
| Assistant self-quote dedup | Yes | | ~250 |
| Tool output truncate | Yes | Both tool messages (build error + test log) truncated | ~4,000 |
| Error stack compressor | Yes | | ~400 |
| JSON minify | Yes | package.json, tsconfig still in old turns | ~100 |
| Code slicer | Yes | Focus on test-relevant code blocks | ~600 |
| Spectral SCC | Yes | Steps 1-3 compressed to structured state summary | ~2,500 |
| Refpack | Yes | Repeated identifiers across code blocks | ~300 |
| Phrasebook | Yes | Common import patterns repeated | ~200 |

**Sent to provider: ~16,400 tokens** (34% reduction)

---

**Step 7 -- "Add Zod validation"** (30,000 tokens)

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | | ~50 |
| Dedup consecutive | Yes | | ~200 |
| Assistant self-quote dedup | Yes | | ~300 |
| System dedup | Yes | Duplicate system context from prior SCC state | ~150 |
| Tool output truncate | Yes | Both old tool outputs | ~4,000 |
| Error stack compressor | Yes | | ~400 |
| JSON minify | Yes | | ~100 |
| Code slicer | Yes | Focus on validation-relevant blocks | ~800 |
| Spectral SCC | Yes | Steps 1-5 compressed; only recent code kept verbatim | ~4,000 |
| Delta prompting | Yes | Injects "answer only the new parts" guidance | ~0 (adds ~30 tokens but saves output tokens) |
| Patch mode | Yes | Injects "output changes as diffs" guidance | ~0 (saves output tokens, not input) |
| Refpack | Yes | Repeated identifiers across code blocks | ~400 |
| Phrasebook | Yes | Common import/export patterns | ~250 |
| Codemap | Yes | Builds structural map of exports/imports across files | ~200 |
| Stable turn summarize | Yes | Additional compression of older stable turns | ~500 |

**Sent to provider: ~18,650 tokens** (38% reduction)

Note: Delta prompting and Patch mode save zero input tokens -- they add a small system instruction. Their savings come from the model's output: instead of writing 500 words of full code, the model outputs a 100-word diff. This reduces **output token billing** significantly.

---

**Step 8 -- "Refactor: split routes into files"** (35,000 tokens)

The longest call. Every savings mechanism is now in play.

| Algorithm | Fires? | Why | Tokens saved |
|-----------|--------|-----|-------------|
| Whitespace normalize | Yes | | ~60 |
| Dedup consecutive | Yes | | ~200 |
| Assistant self-quote dedup | Yes | Model quoted user's refactoring requirements | ~350 |
| System dedup | Yes | | ~150 |
| Tool output truncate | Yes | Two old tool outputs in history | ~4,000 |
| Error stack compressor | Yes | | ~400 |
| JSON minify | Yes | Config files in history | ~120 |
| Code slicer | Yes | Focus on route files; trim unrelated validation code | ~1,000 |
| Spectral SCC | Yes | Steps 1-6 compressed to ~400-word state | ~6,000 |
| Delta prompting | Yes | "Only output the changed parts" | (output savings) |
| Patch mode | Yes | "Use diff format" | (output savings) |
| Refpack | Yes | Repeated route/handler/middleware identifiers | ~500 |
| Phrasebook | Yes | Common TypeScript patterns | ~300 |
| Codemap | Yes | Structural map of all files being refactored | ~250 |
| Stable turn summarize | Yes | Additional old-turn compression | ~600 |
| Context window trim | Yes | Final trim to stay within model's window | ~200 |

**Sent to provider: ~20,870 tokens** (40% reduction)

---

### Running total: all 8 calls compared

| Call | Without Spectyra | With Spectyra | Tokens saved | % saved |
|------|-----------------|---------------|-------------|---------|
| 1 | 2,000 | 1,990 | 10 | 0.5% |
| 2 | 5,500 | 5,400 | 100 | 2% |
| 3 | 9,000 | 8,570 | 430 | 5% |
| 4 | 16,000 | 12,510 | 3,490 | 22% |
| 5 | 17,500 | 13,160 | 4,340 | 25% |
| 6 | 25,000 | 16,400 | 8,600 | 34% |
| 7 | 30,000 | 18,650 | 11,350 | 38% |
| 8 | 35,000 | 20,870 | 14,130 | 40% |
| **Total** | **140,000** | **97,550** | **42,450** | **30%** |

**At $3 per million input tokens:**
- Without Spectyra: $0.420
- With Spectyra: $0.293
- **Saved: $0.127 on one 8-step task**

### Where the savings come from (breakdown by category)

| Category | Tokens saved | Share |
|----------|-------------|-------|
| Spectral SCC (history compression) | 13,300 | 31% |
| Tool output truncation | 12,800 | 30% |
| Code slicer (focus relevant blocks) | 3,450 | 8% |
| Error stack compression | 2,400 | 6% |
| Assistant self-quote dedup | 1,300 | 3% |
| Refpack (repeated identifiers) | 1,200 | 3% |
| Stable turn summarize | 1,100 | 3% |
| Dedup consecutive | 900 | 2% |
| Phrasebook (pattern encoding) | 750 | 2% |
| Codemap (structural map) | 450 | 1% |
| All others (whitespace, JSON, etc.) | 4,800 | 11% |
| **Total** | **42,450** | **100%** |

**Top 3 savings drivers:**
1. Spectral SCC (31%) -- replacing old, settled history with a compact state summary
2. Tool output truncation (30%) -- compressing stack traces and logs to just the important lines
3. Code slicer (8%) -- focusing on the code blocks relevant to the current question

### Additional Cloud API savings (beyond the local pipeline)

When using the Spectyra Cloud API instead of the local companion, three additional mechanisms save even more:

**1. Semantic caching -- skip the LLM call entirely**

If two different users (or the same user in a different session) ask a semantically similar question with similar context, Spectyra's semantic hash matches them to the same cache key. The cached response is returned instantly.

```text
User A: "How do I add JWT auth to Express?"
  --> LLM called, response cached (key abc123)

User B: "Add JWT authentication to my Express app"
  --> Semantic hash matches key abc123
  --> Cached response returned instantly
  --> Zero tokens billed, ~50ms vs ~3s
```

This does not apply to every call (the context must be sufficiently similar), but when it hits, savings are 100% -- no provider call at all.

**2. Output post-processing -- fewer output tokens billed**

After the model responds, Spectyra can:
- Strip boilerplate text ("Sure, here is the code..." preamble)
- Compress long scaffolds in the output (e.g., a 200-line generated file with mostly boilerplate)
- Enforce diff/patch format when appropriate

This reduces **output** token billing, which is typically 3-4x more expensive per token than input.

**3. Quality guard with intelligent retry**

If the model's first response fails a quality check (e.g., missing a required function), Spectyra automatically retries with relaxed settings (less aggressive compression, more context kept). This avoids the developer needing to manually re-prompt, which would mean paying for yet another full-context call.

```text
Without quality guard:
  Call 1: Model misses a requirement    --> Developer re-prompts
  Call 2: Full context re-sent          --> Another 35,000 tokens billed

With quality guard:
  Call 1: Model misses a requirement    --> Spectyra auto-retries
  Call 1 retry: Relaxed settings        --> Same call, no extra user prompt
  Total: 1 user-visible call instead of 2
```

### Savings across scale

One 8-step task saves $0.13. Here is what that looks like at scale:

| Scale | Tasks/month | Input tokens saved | Monthly savings |
|-------|------------|-------------------|-----------------|
| Solo developer | 50 | 2.1M | $6 |
| Small team (5 devs) | 250 | 10.6M | $32 |
| Mid-size team (20 devs) | 1,000 | 42.5M | $128 |
| Enterprise (100 devs) | 5,000 | 212M | $637 |
| Heavy usage (100 devs, longer tasks) | 5,000 | 500M+ | $1,500+ |

These are conservative estimates using only input token savings at $3/M. With output token savings (from delta/patch mode), semantic caching hits, and reduced retry costs, actual savings are typically higher.

---

## The bottom line

**How Spectyra saves money:**
Every LLM call re-sends the full conversation history, and you pay per token. Spectyra shortens that history by removing duplicates and compressing old turns the model has already processed. Recent messages and the current request are untouched. The model still answers -- you pay for a shorter input.

**How Spectyra handles quality:**
Outputs are not guaranteed to be byte-identical, but the information the model needs for the current task is preserved. If you want to verify, observe-only mode measures savings without applying any changes, so you can compare side by side.

**One sentence:**
"Every time an app calls an LLM, it re-sends the entire conversation. We remove the parts that are redundant or already captured, so the provider bills for less. Same model, same task, fewer tokens."

---

## PDF export

A printable copy is kept next to this file: **OPENCLAW_SPECTYRA_SCENARIO_AND_FLOW.pdf**.

Regenerate after editing (requires Pandoc and Tectonic):

```bash
pandoc docs/OPENCLAW_SPECTYRA_SCENARIO_AND_FLOW.md \
  -o docs/OPENCLAW_SPECTYRA_SCENARIO_AND_FLOW.pdf \
  --pdf-engine=tectonic
```
