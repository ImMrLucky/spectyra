-- Migration 004: Organizations and Projects
-- Creates org/project model and updates api_keys to be org/project-scoped

PRAGMA foreign_keys=ON;

-- Organizations table
CREATE TABLE IF NOT EXISTS orgs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  trial_ends_at TEXT, -- ISO datetime, NULL if trial expired or never started
  stripe_customer_id TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'canceled', 'past_due'))
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Update api_keys table to be org/project-scoped
-- First, add new columns if they don't exist
-- Note: We'll keep user_id for backward compatibility during migration
ALTER TABLE api_keys ADD COLUMN org_id TEXT;
ALTER TABLE api_keys ADD COLUMN project_id TEXT;
ALTER TABLE api_keys ADD COLUMN revoked_at TEXT;

-- Add foreign keys (SQLite doesn't support ADD CONSTRAINT, so we'll add them in a new table if needed)
-- For now, we'll rely on application-level enforcement

-- Indexes
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer_id ON orgs(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON api_keys(revoked_at) WHERE revoked_at IS NULL;
