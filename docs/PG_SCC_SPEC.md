# PG-SCC Spec Summary

**❗ CRITICAL: PG-SCC IS THE ONLY COMPRESSION LAYER.**

RefPack and Glossary are **DEPRECATED** for SCC paths and must be removed from the pipeline.

- When PG-SCC is active (SCC produced), **RefPack** and **PhraseBook/Glossary** must **NOT** run.
- SCC output must **NOT** contain: `[[R1]]`, `[[R2]]`, glossary tables, or phrase indexes.
- Token estimation: measure tokens on SCC text directly; do not estimate savings from ref replacement when SCC is active.

## Pipeline (when SCC applied)

1. **SCC** → single state message (talk or code).
2. **Skip** RefPack and PhraseBook/STE entirely (`useLegacyCompression = !sccApplied`).
3. Code path: CodeMap is **embedded** into the SCC system message (no separate CODEMAP message).
4. Policy runs on SCC output; when SCC is present, policies do not add competing memory/recap.

## Acceptance

- **No ref tokens in SCC**: output must NOT contain `[[R*]]` patterns or glossary sections.
- **Equality**: SCC-only must score equal or better quality than SCC → RefPack → Glossary.
- **Failure grounding**: real error text must appear verbatim, not replaced.
