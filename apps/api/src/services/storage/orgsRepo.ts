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
 * Get all organizations
 */
export function getAllOrgs(): Org[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM orgs ORDER BY created_at DESC
  `).all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    trial_ends_at: row.trial_ends_at,
    stripe_customer_id: row.stripe_customer_id,
    subscription_status: row.subscription_status as Org["subscription_status"],
  }));
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
 * Update organization name
 */
export function updateOrgName(orgId: string, newName: string): Org {
  const db = getDb();
  
  if (!newName || newName.trim().length === 0) {
    throw new Error("Organization name cannot be empty");
  }
  
  const result = db.prepare(`
    UPDATE orgs SET name = ? WHERE id = ?
  `).run(newName.trim(), orgId);
  
  if (result.changes === 0) {
    throw new Error(`Organization ${orgId} not found`);
  }
  
  return getOrgById(orgId)!;
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

/**
 * Delete an organization and all associated data
 * This will cascade delete projects (via foreign key)
 * and manually delete API keys, runs, and savings ledger entries
 */
export function deleteOrg(orgId: string): void {
  const db = getDb();
  
  // Verify org exists first
  const org = getOrgById(orgId);
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }
  
  // Enable foreign keys for this connection
  db.pragma("foreign_keys = ON");
  
  // Delete in transaction to ensure consistency
  // Note: better-sqlite3 transactions automatically rollback on error
  const transaction = db.transaction(() => {
    // 1. Delete replays that reference runs from this org
    // (replays table doesn't have org_id, so we need to find them via runs)
    const orgRunIds = db.prepare(`
      SELECT id FROM runs WHERE org_id = ?
    `).all(orgId) as Array<{ id: string }>;
    
    if (orgRunIds.length > 0) {
      const runIds = orgRunIds.map(r => r.id);
      if (runIds.length > 0) {
        const placeholders = runIds.map(() => '?').join(',');
        
        // Delete replays that reference these runs
        db.prepare(`
          DELETE FROM replays 
          WHERE baseline_run_id IN (${placeholders}) 
             OR optimized_run_id IN (${placeholders})
        `).run(...runIds, ...runIds);
      }
    }
    
    // 2. Delete savings ledger entries (they reference runs, but have ON DELETE SET NULL)
    db.prepare(`
      DELETE FROM savings_ledger WHERE org_id = ?
    `).run(orgId);
    
    // 3. Delete runs for this org
    db.prepare(`
      DELETE FROM runs WHERE org_id = ?
    `).run(orgId);
    
    // 4. Delete API keys for this org
    db.prepare(`
      DELETE FROM api_keys WHERE org_id = ?
    `).run(orgId);
    
    // 5. Delete projects (will cascade if foreign keys are enabled, but we'll do it manually to be safe)
    db.prepare(`
      DELETE FROM projects WHERE org_id = ?
    `).run(orgId);
    
    // 6. Finally delete the org
    const result = db.prepare(`
      DELETE FROM orgs WHERE id = ?
    `).run(orgId);
    
    if (result.changes === 0) {
      throw new Error(`Failed to delete organization ${orgId} - no rows affected`);
    }
  });
  
  // Execute transaction (will throw if any step fails)
  transaction();
}

/**
 * Get org by Stripe customer ID
 */
export function getOrgByStripeCustomerId(customerId: string): Org | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM orgs WHERE stripe_customer_id = ?
  `).get(customerId) as any;
  
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
 * Update org Stripe customer ID
 */
export function updateOrgStripeCustomerId(orgId: string, customerId: string): void {
  const db = getDb();
  db.prepare(`
    UPDATE orgs 
    SET stripe_customer_id = ?
    WHERE id = ?
  `).run(customerId, orgId);
}

/**
 * Update org subscription status
 */
export function updateOrgSubscription(
  orgId: string,
  subscriptionId: string | null,
  status: string,
  isActive: boolean
): void {
  const db = getDb();
  
  // Map isActive to subscription_status
  let subscriptionStatus: Org["subscription_status"] = "trial";
  if (isActive && status === "active") {
    subscriptionStatus = "active";
  } else if (status === "canceled") {
    subscriptionStatus = "canceled";
  } else if (status === "past_due") {
    subscriptionStatus = "past_due";
  }
  
  db.prepare(`
    UPDATE orgs 
    SET subscription_status = ?
    WHERE id = ?
  `).run(subscriptionStatus, orgId);
}
