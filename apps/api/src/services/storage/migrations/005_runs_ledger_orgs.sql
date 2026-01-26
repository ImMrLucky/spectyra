-- Migration 005: Add org/project tracking to runs and savings_ledger
-- Adds org_id, project_id, and provider_key_fingerprint

PRAGMA foreign_keys=ON;

-- Add org/project tracking to runs table
ALTER TABLE runs ADD COLUMN org_id TEXT;
ALTER TABLE runs ADD COLUMN project_id TEXT;
ALTER TABLE runs ADD COLUMN provider_key_fingerprint TEXT; -- SHA256(last6 + org_id + salt) for audit

-- Add org/project tracking to savings_ledger table
ALTER TABLE savings_ledger ADD COLUMN org_id TEXT;
ALTER TABLE savings_ledger ADD COLUMN project_id TEXT;

-- Add indexes for org/project queries
CREATE INDEX IF NOT EXISTS idx_runs_org_id ON runs(org_id);
CREATE INDEX IF NOT EXISTS idx_runs_project_id ON runs(project_id);
CREATE INDEX IF NOT EXISTS idx_runs_org_project ON runs(org_id, project_id);
CREATE INDEX IF NOT EXISTS idx_ledger_org_id ON savings_ledger(org_id);
CREATE INDEX IF NOT EXISTS idx_ledger_project_id ON savings_ledger(project_id);
CREATE INDEX IF NOT EXISTS idx_ledger_org_project ON savings_ledger(org_id, project_id);
