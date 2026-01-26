/**
 * Organizations and Projects Repository (Postgres)
 * 
 * Manages org/project model and API key associations
 * Uses Postgres via Supabase
 */

import { query, queryOne, tx } from "./db.js";
import { safeLog } from "../utils/redaction.js";
import crypto from "node:crypto";
import argon2 from "argon2";

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
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

/**
 * Create a new organization
 */
export async function createOrg(name: string, trialDays: number = 7): Promise<Org> {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);
  
  const result = await query<Org>(`
    INSERT INTO orgs (name, trial_ends_at, subscription_status)
    VALUES ($1, $2, 'trial')
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status
  `, [name, trialEndsAt.toISOString()]);
  
  return result.rows[0];
}

/**
 * Get all organizations
 */
export async function getAllOrgs(): Promise<Org[]> {
  const result = await query<Org>(`
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status
    FROM orgs 
    ORDER BY created_at DESC
  `);
  
  return result.rows;
}

/**
 * Get org by ID
 */
export async function getOrgById(id: string): Promise<Org | null> {
  const result = await queryOne<Org>(`
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status
    FROM orgs 
    WHERE id = $1
  `, [id]);
  
  return result;
}

/**
 * Update organization name
 */
export async function updateOrgName(orgId: string, newName: string): Promise<Org> {
  if (!newName || newName.trim().length === 0) {
    throw new Error("Organization name cannot be empty");
  }
  
  const result = await query<Org>(`
    UPDATE orgs 
    SET name = $1 
    WHERE id = $2
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status
  `, [newName.trim(), orgId]);
  
  if (result.rowCount === 0) {
    throw new Error(`Organization ${orgId} not found`);
  }
  
  return result.rows[0];
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
export async function createProject(orgId: string, name: string): Promise<Project> {
  const result = await query<Project>(`
    INSERT INTO projects (org_id, name)
    VALUES ($1, $2)
    RETURNING id, org_id, name, created_at
  `, [orgId, name]);
  
  return result.rows[0];
}

/**
 * Get project by ID
 */
export async function getProjectById(id: string): Promise<Project | null> {
  const result = await queryOne<Project>(`
    SELECT id, org_id, name, created_at
    FROM projects 
    WHERE id = $1
  `, [id]);
  
  return result;
}

/**
 * Get all projects for an org
 */
export async function getOrgProjects(orgId: string): Promise<Project[]> {
  const result = await query<Project>(`
    SELECT id, org_id, name, created_at
    FROM projects 
    WHERE org_id = $1 
    ORDER BY created_at DESC
  `, [orgId]);
  
  return result.rows;
}

/**
 * Hash an API key using argon2id
 */
export async function hashApiKey(key: string): Promise<string> {
  return await argon2.hash(key, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Verify an API key hash
 */
export async function verifyApiKey(key: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, key);
  } catch (error) {
    return false;
  }
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
 * Get API key by prefix (for fast lookup)
 */
export async function getApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | null> {
  const result = await queryOne<ApiKey>(`
    SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at
    FROM api_keys 
    WHERE key_prefix = $1 AND revoked_at IS NULL
  `, [keyPrefix]);
  
  if (!result) return null;
  
  // Check if org_id is missing (shouldn't happen with new schema, but safety check)
  if (!result.org_id) {
    safeLog("warn", "API key missing org_id", { 
      key_id: result.id, 
      key_prefix: keyPrefix
    });
    return null;
  }
  
  return result;
}

/**
 * Get API key by hash (for backward compatibility during migration)
 */
export async function getApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const result = await queryOne<ApiKey>(`
    SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at
    FROM api_keys 
    WHERE key_hash = $1 AND revoked_at IS NULL
  `, [keyHash]);
  
  if (!result) return null;
  
  if (!result.org_id) {
    safeLog("warn", "API key missing org_id", { 
      key_id: result.id, 
      key_hash: keyHash.substring(0, 8) + "..."
    });
    return null;
  }
  
  return result;
}

/**
 * Create a new API key
 */
export async function createApiKey(
  orgId: string,
  projectId: string | null,
  name: string | null = null,
  scopes: string[] = []
): Promise<{ key: string; apiKey: ApiKey }> {
  const key = generateApiKey();
  const keyPrefix = key.substring(0, 12); // First 12 chars for lookup (sk_spectyra_ is 12 chars)
  const keyHash = await hashApiKey(key);
  
  const result = await query<ApiKey>(`
    INSERT INTO api_keys (org_id, project_id, name, key_prefix, key_hash, scopes)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at
  `, [orgId, projectId, name || "Default Key", keyPrefix, keyHash, scopes]);
  
  return { key, apiKey: result.rows[0] };
}

/**
 * Get all API keys for an org
 */
export async function getOrgApiKeys(orgId: string, includeRevoked: boolean = false): Promise<ApiKey[]> {
  const sql = includeRevoked
    ? `SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at
       FROM api_keys 
       WHERE org_id = $1 
       ORDER BY created_at DESC`
    : `SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at
       FROM api_keys 
       WHERE org_id = $1 AND revoked_at IS NULL 
       ORDER BY created_at DESC`;
  
  const result = await query<ApiKey>(sql, [orgId]);
  return result.rows;
}

/**
 * Update API key last used timestamp
 */
export async function updateApiKeyLastUsed(keyHash: string): Promise<void> {
  await query(`
    UPDATE api_keys 
    SET last_used_at = now()
    WHERE key_hash = $1
  `, [keyHash]);
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyHash: string): Promise<void> {
  await query(`
    UPDATE api_keys 
    SET revoked_at = now()
    WHERE key_hash = $1
  `, [keyHash]);
}

/**
 * Delete an API key (hard delete)
 */
export async function deleteApiKey(keyHash: string): Promise<void> {
  await query(`
    DELETE FROM api_keys 
    WHERE key_hash = $1
  `, [keyHash]);
}

/**
 * Delete an organization and all associated data
 * Uses CASCADE deletes via foreign keys
 */
export async function deleteOrg(orgId: string): Promise<void> {
  // Verify org exists first
  const org = await getOrgById(orgId);
  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }
  
  // Delete in transaction
  await tx(async (client) => {
    // 1. Delete replays that reference runs from this org
    const orgRunIds = await client.query(`
      SELECT id FROM runs WHERE org_id = $1
    `, [orgId]);
    
    if (orgRunIds.rows.length > 0) {
      const runIds = orgRunIds.rows.map(r => r.id);
      const placeholders = runIds.map((_, i) => `$${i + 1}`).join(',');
      
      await client.query(`
        DELETE FROM replays 
        WHERE baseline_run_id = ANY($1::text[]) 
           OR optimized_run_id = ANY($1::text[])
      `, [runIds]);
    }
    
    // 2. Delete savings ledger entries
    await client.query(`
      DELETE FROM savings_ledger WHERE org_id = $1
    `, [orgId]);
    
    // 3. Delete runs (CASCADE will handle replays, but we did it manually above)
    await client.query(`
      DELETE FROM runs WHERE org_id = $1
    `, [orgId]);
    
    // 4. Delete API keys
    await client.query(`
      DELETE FROM api_keys WHERE org_id = $1
    `, [orgId]);
    
    // 5. Delete projects (CASCADE will handle, but explicit for clarity)
    await client.query(`
      DELETE FROM projects WHERE org_id = $1
    `, [orgId]);
    
    // 6. Delete org memberships
    await client.query(`
      DELETE FROM org_memberships WHERE org_id = $1
    `, [orgId]);
    
    // 7. Finally delete the org
    const result = await client.query(`
      DELETE FROM orgs WHERE id = $1
    `, [orgId]);
    
    if (result.rowCount === 0) {
      throw new Error(`Failed to delete organization ${orgId} - no rows affected`);
    }
  });
}

/**
 * Get org by Stripe customer ID
 */
export async function getOrgByStripeCustomerId(customerId: string): Promise<Org | null> {
  const result = await queryOne<Org>(`
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status
    FROM orgs 
    WHERE stripe_customer_id = $1
  `, [customerId]);
  
  return result;
}

/**
 * Update org Stripe customer ID
 */
export async function updateOrgStripeCustomerId(orgId: string, customerId: string): Promise<void> {
  await query(`
    UPDATE orgs 
    SET stripe_customer_id = $1
    WHERE id = $2
  `, [customerId, orgId]);
}

/**
 * Update org subscription status
 */
export async function updateOrgSubscription(
  orgId: string,
  subscriptionId: string | null,
  status: string,
  isActive: boolean
): Promise<void> {
  // Map isActive to subscription_status
  let subscriptionStatus: Org["subscription_status"] = "trial";
  if (isActive && status === "active") {
    subscriptionStatus = "active";
  } else if (status === "canceled") {
    subscriptionStatus = "canceled";
  } else if (status === "past_due") {
    subscriptionStatus = "past_due";
  }
  
  await query(`
    UPDATE orgs 
    SET subscription_status = $1
    WHERE id = $2
  `, [subscriptionStatus, orgId]);
}
