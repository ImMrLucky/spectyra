/**
 * Organizations and Projects Repository
 * 
 * Manages org/project model and API key associations
 */

import { getDb } from "./db.js";
import crypto from "node:crypto";

export interface Org {
  id: string;
  name: string;
  created_at: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  subscription_status: "trial" | "active" | "canceled" | "past_due";
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  created_at: string;
}

export interface ApiKey {
  id: string;
  org_id: string;
  project_id: string | null;
  name: string | null;
  key_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/**
 * Create a new organization
 */
export function createOrg(name: string, trialDays: number = 7): Org {
  const db = getDb();
  const id = crypto.randomUUID();
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
  
  db.prepare(`
    INSERT INTO orgs (id, name, trial_ends_at, subscription_status)
    VALUES (?, ?, ?, 'trial')
  `).run(id, name, trialEndsAt.toISOString());
  
  return getOrgById(id)!;
}

/**
 * Get org by ID
 */
export function getOrgById(id: string): Org | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM orgs WHERE id = ?
  `).get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    trial_ends_at: row.trial_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    subscription_status: row.subscription_status as Org["subscription_status"],
  };
}

/**
 * Check if org has active access (trial or subscription)
 */
export function hasActiveAccess(org: Org): boolean {
  if (org.subscription_status === "active") {
    return true;
  }
  
  if (org.subscription_status === "trial" && org.trial_ends_at) {
    return new Date(org.trial_ends_at) > new Date();
  }
  
  return false;
}

/**
 * Create a new project
 */
export function createProject(orgId: string, name: string): Project {
  const db = getDb();
  const id = crypto.randomUUID();
  
  db.prepare(`
    INSERT INTO projects (id, org_id, name)
    VALUES (?, ?, ?)
  `).run(id, orgId, name);
  
  return getProjectById(id)!;
}

/**
 * Get project by ID
 */
export function getProjectById(id: string): Project | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM projects WHERE id = ?
  `).get(id) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    created_at: row.created_at,
  };
}

/**
 * Get all projects for an org
 */
export function getOrgProjects(orgId: string): Project[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM projects WHERE org_id = ? ORDER BY created_at DESC
  `).all(orgId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    org_id: row.org_id,
    name: row.name,
    created_at: row.created_at,
  }));
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
 * Get API key by hash
 */
export function getApiKeyByHash(keyHash: string): ApiKey | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM api_keys 
    WHERE key_hash = ? AND revoked_at IS NULL
  `).get(keyHash) as any;
  
  if (!row) return null;
  
  return {
    id: row.id,
    org_id: row.org_id,
    project_id: row.project_id,
    name: row.name,
    key_hash: row.key_hash,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at,
  };
}

/**
 * Create a new API key
 */
export function createApiKey(
  orgId: string,
  projectId: string | null,
  name: string | null = null
): { key: string; apiKey: ApiKey } {
  const db = getDb();
  const id = crypto.randomUUID();
  const key = generateApiKey();
  const keyHash = hashApiKey(key);
  
  db.prepare(`
    INSERT INTO api_keys (id, org_id, project_id, name, key_hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, orgId, projectId, name, keyHash);
  
  const apiKey = getApiKeyByHash(keyHash)!;
  return { key, apiKey };
}

/**
 * Get all API keys for an org
 */
export function getOrgApiKeys(orgId: string, includeRevoked: boolean = false): ApiKey[] {
  const db = getDb();
  const query = includeRevoked
    ? `SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC`
    : `SELECT * FROM api_keys WHERE org_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`;
  
  const rows = db.prepare(query).all(orgId) as any[];
  
  return rows.map(row => ({
    id: row.id,
    org_id: row.org_id,
    project_id: row.project_id,
    name: row.name,
    key_hash: row.key_hash,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
    revoked_at: row.revoked_at,
  }));
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
 * Revoke an API key
 */
export function revokeApiKey(keyHash: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE api_keys 
    SET revoked_at = datetime('now')
    WHERE key_hash = ?
  `).run(keyHash);
}

/**
 * Delete an API key (hard delete)
 */
export function deleteApiKey(keyHash: string): void {
  const db = getDb();
  db.prepare(`
    DELETE FROM api_keys WHERE key_hash = ?
  `).run(keyHash);
}
