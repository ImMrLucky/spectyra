-- Optional JSONB payload for safe SDK diagnostics (no prompts / secrets).
ALTER TABLE sdk_run_telemetry ADD COLUMN IF NOT EXISTS diagnostics JSONB;
