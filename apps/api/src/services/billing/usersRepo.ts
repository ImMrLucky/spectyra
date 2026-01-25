/**
 * Users Repository - User and API key management
 */

import { getDb } from "../storage/db.js";
import crypto from "node:crypto";

export interface User {
  id: string;
  email: string;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  subscription_active: boolean;
  subscription_id: string | null;
  subscription_status: string | null;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Hash an API key (SHA256)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  // Format: sk_spectyra_<random>
  const random = crypto.randomBytes(32).toString("hex");
  return `sk_spectyra_${random}`;
}

/**
 * Create a new user
 */
export function createUser(email: string, trialDays: number = 7): User {
  const db = getDb();
  const id = crypto.randomUUID();
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
  
  db.prepare(`
    INSERT INTO users (id, email, trial_ends_at)
    VALUES (?, ?, ?)
  `).run(id, email, trialEndsAt.toISOString());
  
  return getUserById(id)!;
}

/**
 * Get user by ID
 */
export function getUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `).get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    trial_ends_at: row.trial_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    subscription_active: row.subscription_active === 1,
    subscription_id: row.subscription_id,
    subscription_status: row.subscription_status,
    updated_at: row.updated_at,
  };
}

/**
 * Get user by email
 */
export function getUserByEmail(email: string): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `).get(email) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    trial_ends_at: row.trial_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    subscription_active: row.subscription_active === 1,
    subscription_id: row.subscription_id,
    subscription_status: row.subscription_status,
    updated_at: row.updated_at,
  };
}

/**
 * Get user by Stripe customer ID
 */
export function getUserByStripeCustomerId(customerId: string): User | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM users WHERE stripe_customer_id = ?
  `).get(customerId) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    trial_ends_at: row.trial_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    subscription_active: row.subscription_active === 1,
    subscription_id: row.subscription_id,
    subscription_status: row.subscription_status,
    updated_at: row.updated_at,
  };
}

/**
 * Update user subscription status
 */
export function updateUserSubscription(
  userId: string,
  subscriptionId: string | null,
  subscriptionStatus: string | null,
  subscriptionActive: boolean
): void {
  const db = getDb();
  db.prepare(`
    UPDATE users
    SET subscription_id = ?,
        subscription_status = ?,
        subscription_active = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(subscriptionId, subscriptionStatus, subscriptionActive ? 1 : 0, userId);
}

/**
 * Update Stripe customer ID
 */
export function updateStripeCustomerId(userId: string, customerId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE users
    SET stripe_customer_id = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(customerId, userId);
}

/**
 * Check if user has active access (trial or subscription)
 */
export function hasActiveAccess(user: User): boolean {
  // Check subscription first
  if (user.subscription_active) {
    return true;
  }
  
  // Check trial
  if (user.trial_ends_at) {
    const trialEnd = new Date(user.trial_ends_at);
    return trialEnd > new Date();
  }
  
  return false;
}

/**
 * Create an API key for a user
 */
export function createApiKey(userId: string, name: string | null = null): { key: string; apiKey: ApiKey } {
  const db = getDb();
  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  const id = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO api_keys (id, user_id, key_hash, name)
    VALUES (?, ?, ?, ?)
  `).run(id, userId, keyHash, name);
  
  const apiKey: ApiKey = {
    id,
    user_id: userId,
    key_hash: keyHash,
    name,
    created_at: new Date().toISOString(),
    last_used_at: null,
  };
  
  return { key, apiKey };
}

/**
 * Get API key by hash
 */
export function getApiKeyByHash(keyHash: string): ApiKey | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM api_keys WHERE key_hash = ?
  `).get(keyHash) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    user_id: row.user_id,
    key_hash: row.key_hash,
    name: row.name,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

/**
 * Update API key last used timestamp
 */
export function updateApiKeyLastUsed(keyHash: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE api_keys
    SET last_used_at = datetime('now')
    WHERE key_hash = ?
  `).run(keyHash);
}

/**
 * Get all API keys for a user
 */
export function getUserApiKeys(userId: string): ApiKey[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    user_id: row.user_id,
    key_hash: row.key_hash,
    name: row.name,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  }));
}

/**
 * Delete an API key
 */
export function deleteApiKey(keyId: string, userId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    DELETE FROM api_keys WHERE id = ? AND user_id = ?
  `).run(keyId, userId);
  
  return result.changes > 0;
}
