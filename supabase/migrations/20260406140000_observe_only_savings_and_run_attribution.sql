-- Superuser tri-state: NULL = billing-driven observe vs full savings; TRUE = force observe; FALSE = force real savings (comp).
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS observe_only_override BOOLEAN;

COMMENT ON COLUMN orgs.observe_only_override IS 'NULL: use trial/subscription; TRUE: Observe-only savings; FALSE: real savings (superuser comp).';

-- Attribution on runs (API key + optional human email when JWT present on same request path).
ALTER TABLE runs ADD COLUMN IF NOT EXISTS api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL;
ALTER TABLE runs ADD COLUMN IF NOT EXISTS account_email TEXT;

CREATE INDEX IF NOT EXISTS idx_runs_api_key_id ON runs(api_key_id) WHERE api_key_id IS NOT NULL;

COMMENT ON COLUMN runs.api_key_id IS 'Spectyra API key used for this run (machine auth).';
COMMENT ON COLUMN runs.account_email IS 'Human account email when available (e.g. paired JWT or admin attribution).';
