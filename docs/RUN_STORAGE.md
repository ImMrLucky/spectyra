# Run Storage: What We Store and What the UI Needs

## Summary

**You do not need to store full prompt/response/debug data to show savings.** We store lightweight metrics by default; heavy fields are optional and org-controlled.

---

## What Is Stored Per Run

### Always stored (lightweight – for dashboard and billing)

| Column | Purpose |
|--------|---------|
| `id`, `scenario_id`, `conversation_id`, `replay_id` | Identity and grouping |
| `mode`, `path`, `optimization_level`, `provider`, `model` | Run context |
| `workload_key`, `prompt_hash` | Dedup / replay (hashes only, not content) |
| `usage_input_tokens`, `usage_output_tokens`, `usage_total_tokens` | Token usage |
| `cost_usd` | Cost |
| `savings_tokens_saved`, `savings_pct_saved`, `savings_cost_saved_usd` | **Aggregate savings** |
| `quality_pass`, `quality_failures` | Quality result |
| `is_shadow`, `org_id`, `project_id`, `created_at` | Audit and filtering |
| **Savings breakdown (new)** | **Per-optimization metrics for UI** (see below) |

### Optional (heavy – only if org enables)

Controlled by `org_settings`:

| Column | Org setting | When to enable |
|--------|-------------|-----------------|
| `prompt_final` | `store_prompts` (default **false**) | Replay, debugging prompts |
| `response_text` | `store_responses` (default **false**) | Response analysis, quality debugging |
| `debug_internal_json` | `store_internal_debug` (default **false**) | Full optimizer internals |

**Recommendation:** Keep all three **false** for normal use. The dashboard can show savings and per-optimization breakdown using only the lightweight columns.

---

## What the UI Displays

### Runs list

- Run ID, type, source, model, status, time  
- **Optimizations applied:** refpack, phrasebook, codemap (badges)  
- **Tokens saved:** total (from `savings_tokens_saved` or breakdown sum)

### Run detail

- Same summary fields  
- **Usage:** tokens, cost, cost saved, quality, mode, path  
- **Optimizations applied:** for each of refpack/phrasebook/codemap: tokens before, after, saved  

All of the above can be served from:

- Existing aggregate columns: `savings_tokens_saved`, `savings_pct_saved`, `savings_cost_saved_usd`
- New **savings breakdown columns** (see migration): small integers per optimization, no need for `debug_internal_json` for the dashboard.

---

## Savings Breakdown Columns (lightweight)

We persist a small, fixed set of integers per run so the UI can show “Refpack saved X, PhraseBook saved Y, CodeMap saved Z” without ever storing the full debug blob:

- `refpack_tokens_before`, `refpack_tokens_after`, `refpack_tokens_saved`
- `phrasebook_tokens_before`, `phrasebook_tokens_after`, `phrasebook_tokens_saved`
- `codemap_tokens_before`, `codemap_tokens_after`, `codemap_tokens_saved`

Filled at save time from the optimizer’s metrics. No prompt text, no response text, no large JSON.

**Deployment:** Run migration `20260128000010_runs_savings_breakdown.sql` before deploying the API that writes these columns; otherwise `saveRun` will fail with “column does not exist”.

---

## Default Behavior (no “full run data”)

With defaults (`store_prompts=false`, `store_responses=false`, `store_internal_debug=false`):

- **Stored:** IDs, timestamps, provider/model, token counts, cost, aggregate savings, quality result, and the new savings breakdown columns.
- **Not stored:** Full prompt content, full response text, full `debug_internal_json`.

So we do **not** “save all prompt run data” just to show savings; we only store what’s needed for the dashboard and billing.
