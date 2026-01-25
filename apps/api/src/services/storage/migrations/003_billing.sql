-- Migration 003: Billing and User Management
-- Adds users, api_keys, and subscription tracking

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  trial_ends_at TEXT, -- ISO datetime, NULL if trial expired or never started
  stripe_customer_id TEXT UNIQUE,
  subscription_active INTEGER DEFAULT 0, -- 0 = false, 1 = true
  subscription_id TEXT, -- Stripe subscription ID
  subscription_status TEXT, -- active, canceled, past_due, etc.
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- API Keys table (for authentication)
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL, -- SHA256 hash of the API key
  name TEXT, -- Optional name for the key
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
