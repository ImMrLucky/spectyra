# Where optimization and token numbers are calculated (backend)

**❗ CRITICAL: PG-SCC IS THE ONLY COMPRESSION LAYER.** RefPack and Glossary are DEPRECATED for SCC paths and must not run when SCC is produced. See [PG_SCC_SPEC.md](PG_SCC_SPEC.md).

---

## Why optimized can be *larger* than original

The optimizer **adds** new content (system messages) and **replaces** some body text with short refs. If the added dictionaries are big and the replacements are small, **total size can go up**.

1. **RefPack** replaces repeated chunks with `[[R1]]`, `[[R2]]` but **adds** a REFPACK system message:  
   `REFPACK { 1: "summary...", 2: "summary...", ... }`  
   Each summary is 140–180 chars. So we add a lot of text; we only save what we actually replace in the conversation. Net can be positive (more tokens).

2. **PhraseBook** replaces repeated phrases with `⟦P1⟧` but **adds** a PHRASEBOOK system message listing every phrase in full. Again: we add the dictionary; we save only the in-body duplicates. Net can be positive.

3. **Policies** (talk/code) can add instructions (e.g. delta prompting, scaffolding) without removing much, so total length can increase.

4. **No transforms** (low aggressiveness): we might still run policy and add instructions; no compression, so “after” can be longer.

The lab shows **real** before/after: it estimates tokens from the **actual** original and final message arrays. So if the final array has more characters (big dictionaries + small ref savings), you see “optimized larger.”

---

## Exact files

### 1. Where “before” and “after” token counts are calculated (lab)

| File | What it does |
|------|----------------|
| **`apps/api/src/routes/optimizerLab.ts`** | Calls the optimizer, then: **before** = `estimateBaselineTokens(messages)` (original request). **after** = `estimateOptimizedTokens(result.promptFinal.messages)` (optimizer output). **pctSaved** = `(before - after) / before * 100`. No fake numbers. |
| **`apps/api/src/services/proof/tokenEstimator.ts`** | **`estimateBaselineTokens(messages, provider, pricing)`** → input_tokens = sum of message content length (chars ÷ 4). **`estimateOptimizedTokens(optimizedMessages, path, level, provider, pricing)`** → same: input_tokens = sum of message content length. So “before” and “after” are both **character-based estimates** over the full message array. |

So: **before** = estimated tokens of the **original** messages; **after** = estimated tokens of **promptFinal.messages** (the exact payload the optimizer returns). If that payload has more total characters (e.g. REFPACK + PHRASEBOOK blocks), “after” is larger.

---

### 2. Where optimization runs (what produces `promptFinal.messages`)

| File | What it does |
|------|----------------|
| **`apps/api/src/services/optimizer/optimizer.ts`** | **`runOptimizedOrBaseline`**: unitize → embed → spectral → **applyMoatTransforms** (refpack → phrasebook → codemap) → **applyTalkPolicy** or **applyCodePolicy** → `messagesFinal`. That becomes **`result.promptFinal.messages`**. Dry-run returns this without calling the provider. |

---

### 3. Transforms that change message content

| File | What it does |
|------|----------------|
| **`apps/api/src/services/optimizer/transforms/refPack.ts`** | **`buildRefPack`**: picks stable units, builds short summaries (8–25 words, 140/180 char cap). **`applyInlineRefs`**: replaces those chunks in messages with `[[R#]]` and **prepends a system message** with `REFPACK { 1: "summary1", ... }` + instruction text. So we **add** the REFPACK block and shorten the body only where replacements happen. |
| **`apps/api/src/services/optimizer/transforms/phraseBook.ts`** | **`buildLocalPhraseBook`**: finds repeated phrases (3–8 words, min length/occurrences). **`applyPhraseBookEncoding`**: replaces phrases with `⟦P#⟧` and **prepends a system message** with `PHRASEBOOK { 1: "phrase1", ... }`. Again we **add** the dictionary; body shrinks only where phrases are replaced. |
| **`apps/api/src/services/optimizer/transforms/codeMap.ts`** | Code path only: builds code map, can replace/summarize code blocks. |
| **`apps/api/src/services/optimizer/policies/talkPolicy.ts`** | **`applyTalkPolicy`**: context compaction (replace stable with refs), **delta prompting** (adds instruction text). Can add content. |
| **`apps/api/src/services/optimizer/policies/codePolicy.ts`** | **`applyCodePolicy`**: code slicing, patch mode, etc. |

---

### 4. Summary

- **Before/after and % saved** are computed in:
  - **`apps/api/src/routes/optimizerLab.ts`** (uses the two estimates below).
  - **`apps/api/src/services/proof/tokenEstimator.ts`** (estimateBaselineTokens, estimateOptimizedTokens).

- **Optimization** (the content that becomes “after”) is produced in:
  - **`apps/api/src/services/optimizer/optimizer.ts`** (orchestration),
  - **`apps/api/src/services/optimizer/transforms/refPack.ts`**,
  - **`apps/api/src/services/optimizer/transforms/phraseBook.ts`**,
  - **`apps/api/src/services/optimizer/transforms/codeMap.ts`**,
  - **`apps/api/src/services/optimizer/policies/talkPolicy.ts`**,
  - **`apps/api/src/services/optimizer/policies/codePolicy.ts`**.

Optimized can be larger than original because we **add** REFPACK and PHRASEBOOK system messages (and sometimes policy text); the lab simply reports the real estimated token counts of the original vs that final payload.
