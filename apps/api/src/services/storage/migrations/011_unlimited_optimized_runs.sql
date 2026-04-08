-- Optimization is gated only by trial/subscription (see entitlement.canRunOptimized).
-- Clear legacy per-period caps; column kept for optional analytics (optimized_runs_used).

UPDATE orgs SET optimized_runs_limit = NULL WHERE optimized_runs_limit IS NOT NULL;

ALTER TABLE orgs ALTER COLUMN optimized_runs_limit DROP DEFAULT;
ALTER TABLE orgs ALTER COLUMN optimized_runs_limit SET DEFAULT NULL;
