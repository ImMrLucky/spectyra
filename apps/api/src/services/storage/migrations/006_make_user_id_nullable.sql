-- Migration 006: Make user_id nullable in api_keys
-- Since we've moved to org/project model, user_id is no longer required
-- Keep it for backward compatibility but allow NULL

PRAGMA foreign_keys=ON;

-- SQLite doesn't support ALTER COLUMN to change NOT NULL constraint directly
-- We need to recreate the table. However, since we want to preserve data,
-- we'll use a workaround: create a new table, copy data, drop old, rename new

-- Check if migration is needed (if user_id is already nullable, skip)
-- We'll check by trying to insert NULL - if it fails, we need to migrate

-- Step 1: Create new table with nullable user_id
CREATE TABLE IF NOT EXISTS api_keys_new (
  id TEXT PRIMARY KEY,
  user_id TEXT, -- Now nullable
  org_id TEXT,
  project_id TEXT,
  name TEXT,
  key_hash TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);

-- Step 2: Copy existing data (if any)
INSERT INTO api_keys_new (id, user_id, org_id, project_id, name, key_hash, created_at, last_used_at, revoked_at)
SELECT id, user_id, org_id, project_id, name, key_hash, created_at, last_used_at, revoked_at
FROM api_keys;

-- Step 3: Drop old table (only if it exists)
DROP TABLE IF EXISTS api_keys;

-- Step 4: Rename new table
ALTER TABLE api_keys_new RENAME TO api_keys;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_revoked ON api_keys(revoked_at) WHERE revoked_at IS NULL;
