-- Lightweight savings breakdown columns for runs
-- Allows UI to show "Refpack saved X, PhraseBook saved Y, CodeMap saved Z"
-- without storing full prompt_final, response_text, or debug_internal_json.

ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS refpack_tokens_saved INTEGER;

ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS phrasebook_tokens_saved INTEGER;

ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_before INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_after INTEGER;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS codemap_tokens_saved INTEGER;

COMMENT ON COLUMN runs.refpack_tokens_saved IS 'Lightweight: tokens saved by RefPack (no full prompt storage needed)';
COMMENT ON COLUMN runs.phrasebook_tokens_saved IS 'Lightweight: tokens saved by PhraseBook';
COMMENT ON COLUMN runs.codemap_tokens_saved IS 'Lightweight: tokens saved by CodeMap';
