/**
 * Organizations and Projects Repository (Postgres)
 * 
 * Manages org/project model and API key associations
 * Uses Postgres via Supabase
 */

import { query, queryOne, tx } from "./db.js";
import { safeLog } from "../../utils/redaction.js";
import crypto from "node:crypto";
import argon2 from "argon2";
import type { Org, Project, ApiKey } from "@spectyra/shared";
import {
  isBillingExemptEmail,
  isBillingExemptOrgId,
} from "../../billing/billingExempt.js";

// Re-export canonical types
export type { Org, Project, ApiKey };

/**
 * Create a new organization
 */
/** Default max org members when env unset or invalid (new orgs and provisioning). */
export function getDefaultOrgSeatLimit(): number {
  const raw = process.env.DEFAULT_ORG_SEAT_LIMIT?.trim();
  if (!raw) return 5;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? n : 5;
}

/** True when the org has a Stripe subscription record in a billable state. */
export function orgHasPaidStripeSubscription(
  org: Pick<Org, "stripe_subscription_id" | "subscription_status">,
): boolean {
  const sid = org.stripe_subscription_id?.trim();
  if (!sid) return false;
  const s = org.subscription_status;
  return s === "active" || s === "past_due" || s === "paused";
}

export async function countOrgMembers(orgId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM org_memberships WHERE org_id = $1`,
    [orgId],
  );
  return parseInt(row?.n ?? "0", 10);
}

/**
 * After subscription ends, keep at least current member count (and a floor of 5) so
 * existing teams are not blocked from operating until seats are adjusted manually.
 */
export async function syncOrgSeatLimitToMemberFloor(orgId: string): Promise<void> {
  await query(
    `
    UPDATE orgs
    SET seat_limit = GREATEST(
      $2::int,
      (SELECT count(*)::int FROM org_memberships WHERE org_id = $1)
    )
    WHERE id = $1
    `,
    [orgId, getDefaultOrgSeatLimit()],
  );
}

export async function createOrg(name: string): Promise<Org> {
  const seats = getDefaultOrgSeatLimit();

  const result = await query<Org>(`
    INSERT INTO orgs (name, trial_ends_at, subscription_status, sdk_access_enabled, seat_limit)
    VALUES ($1, NULL, 'active', true, $2)
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status, sdk_access_enabled, platform_exempt, seat_limit, observe_only_override, billing_admin_observe_lock_user_id
  `, [name, seats]);

  return result.rows[0];
}

/**
 * Get all organizations
 */
export async function getAllOrgs(): Promise<Org[]> {
  const result = await query<Org>(`
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id,
           subscription_current_period_end, cancel_at_period_end, subscription_status, sdk_access_enabled, platform_exempt,
           seat_limit, observe_only_override, billing_admin_observe_lock_user_id
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
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id,
           subscription_current_period_end, cancel_at_period_end, subscription_status, sdk_access_enabled, platform_exempt,
           seat_limit, observe_only_override, billing_admin_observe_lock_user_id
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
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status, sdk_access_enabled, platform_exempt, seat_limit, observe_only_override, billing_admin_observe_lock_user_id
    `, [newName.trim(), orgId]);
  
  if (result.rowCount === 0) {
    throw new Error(`Organization ${orgId} not found`);
  }
  
  return result.rows[0];
}

export type HasActiveAccessOpts = {
  /** Supabase user email (JWT) — matches BILLING_EXEMPT_EMAILS */
  userEmail?: string | null;
  /** DB platform_roles or equivalent — perpetual access for that user */
  platformBillingExempt?: boolean;
};

/**
 * Check if org has active access (trial, subscription, or founder exempt list).
 */
export function hasActiveAccess(org: Org, opts?: HasActiveAccessOpts): boolean {
  if (org.platform_exempt) {
    return true;
  }
  if (opts?.platformBillingExempt) {
    return true;
  }
  if (isBillingExemptOrgId(org.id)) {
    return true;
  }
  if (opts?.userEmail && isBillingExemptEmail(opts.userEmail)) {
    return true;
  }

  if (org.subscription_status === "active") {
    return true;
  }

  // Paused subscription (Stripe or DB) but still inside paid period — savings/features until period end
  if (
    org.subscription_status === "paused" &&
    org.subscription_current_period_end &&
    new Date(org.subscription_current_period_end) > new Date()
  ) {
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
 * Resolve a project by UUID or by name (case-insensitive) within an org.
 */
export async function getProjectByOrgAndIdentifier(
  orgId: string,
  projectIdOrName: string,
): Promise<Project | null> {
  const raw = projectIdOrName.trim();
  if (!raw) return null;
  const byId = await getProjectById(raw);
  if (byId && byId.org_id === orgId) return byId;
  const result = await queryOne<Project>(
    `
    SELECT id, org_id, name, created_at
    FROM projects
    WHERE org_id = $1 AND LOWER(name) = LOWER($2)
    LIMIT 1
    `,
    [orgId, raw],
  );
  return result;
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
 * Stored prefix for `api_keys.key_prefix` (UNIQUE): fixed brand + enough secret
 * material to be unique per key. Do not use only `sk_spectyra_` (12 chars) — that
 * collides for every key.
 */
export const API_KEY_PREFIX_LENGTH = 24;

/**
 * Generate a new API key
 */
export function generateApiKey(): string {
  // Format: sk_spectyra_<random>
  const random = crypto.randomBytes(32).toString("hex");
  return `sk_spectyra_${random}`;
}

/**
 * Lookup row for a raw API key: tries current prefix length, then legacy 12-char prefix
 * (`sk_spectyra_` only — older bug stored identical prefix for all keys; only one survived).
 */
export async function getApiKeyByRawKeyLookup(plainKey: string): Promise<ApiKey | null> {
  if (plainKey.length >= API_KEY_PREFIX_LENGTH) {
    const row = await getApiKeyByPrefix(plainKey.substring(0, API_KEY_PREFIX_LENGTH));
    if (row) return row;
  }
  if (plainKey.length >= 12 && plainKey.startsWith("sk_spectyra_")) {
    return getApiKeyByPrefix(plainKey.substring(0, 12));
  }
  return null;
}

/** Row shape for admin key diagnose (includes revoked; may include legacy user_id). */
export type ApiKeyDiagnoseRow = ApiKey & { user_id?: string | null };

async function getApiKeyRowByPrefixAnyStatus(keyPrefix: string): Promise<ApiKeyDiagnoseRow | null> {
  return queryOne<ApiKeyDiagnoseRow>(`
    SELECT id, org_id, project_id, user_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at,
           expires_at, allowed_ip_ranges, allowed_origins, description
    FROM api_keys
    WHERE key_prefix = $1
  `, [keyPrefix]);
}

/**
 * Like getApiKeyByRawKeyLookup but includes revoked/expired rows (admin diagnose only).
 */
export async function getApiKeyByRawKeyLookupForDiagnose(plainKey: string): Promise<ApiKeyDiagnoseRow | null> {
  if (plainKey.length >= API_KEY_PREFIX_LENGTH) {
    const row = await getApiKeyRowByPrefixAnyStatus(plainKey.substring(0, API_KEY_PREFIX_LENGTH));
    if (row) return row;
  }
  if (plainKey.length >= 12 && plainKey.startsWith("sk_spectyra_")) {
    return getApiKeyRowByPrefixAnyStatus(plainKey.substring(0, 12));
  }
  return null;
}

/**
 * Get API key by prefix (for fast lookup)
 * Excludes expired and revoked keys
 */
export async function getApiKeyByPrefix(keyPrefix: string): Promise<ApiKey | null> {
  const result = await queryOne<ApiKey>(`
    SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at,
           expires_at, allowed_ip_ranges, allowed_origins, description
    FROM api_keys 
    WHERE key_prefix = $1 
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
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
  scopes: string[] = [],
  expiresAt: string | null = null,
  allowedIpRanges: string[] | null = null,
  allowedOrigins: string[] | null = null,
  description: string | null = null
): Promise<{ key: string; apiKey: ApiKey }> {
  const key = generateApiKey();
  const keyPrefix = key.substring(0, API_KEY_PREFIX_LENGTH);
  const keyHash = await hashApiKey(key);
  
  const result = await query<ApiKey>(`
    INSERT INTO api_keys (org_id, project_id, name, key_prefix, key_hash, scopes, expires_at, allowed_ip_ranges, allowed_origins, description)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at, expires_at, allowed_ip_ranges, allowed_origins, description
  `, [orgId, projectId, name || "Default Key", keyPrefix, keyHash, scopes, expiresAt, allowedIpRanges, allowedOrigins, description]);
  
  return { key, apiKey: result.rows[0] };
}

/**
 * Get API key by ID
 */
export async function getApiKeyById(keyId: string): Promise<ApiKey | null> {
  const result = await queryOne<ApiKey>(`
    SELECT id, org_id, project_id, name, key_prefix, key_hash, scopes, created_at, last_used_at, revoked_at,
           expires_at, allowed_ip_ranges, allowed_origins, description
    FROM api_keys
    WHERE id = $1
  `, [keyId]);
  
  return result;
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
 * Revoke an API key (by key hash or key ID)
 */
export async function revokeApiKey(keyHashOrId: string, byId: boolean = false): Promise<void> {
  if (byId) {
    await query(`
      UPDATE api_keys 
      SET revoked_at = now()
      WHERE id = $1
    `, [keyHashOrId]);
  } else {
    await query(`
      UPDATE api_keys 
      SET revoked_at = now()
      WHERE key_hash = $1
    `, [keyHashOrId]);
  }
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
    SELECT id, name, created_at, trial_ends_at, stripe_customer_id, stripe_subscription_id,
           subscription_current_period_end, cancel_at_period_end, subscription_status, sdk_access_enabled, platform_exempt,
           seat_limit, observe_only_override, billing_admin_observe_lock_user_id
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

/** Clear stored Stripe customer (e.g. test→live key change left a customer id from the wrong mode). */
export async function clearOrgStripeCustomerId(orgId: string): Promise<void> {
  await query(
    `
    UPDATE orgs
    SET stripe_customer_id = NULL
    WHERE id = $1
  `,
    [orgId],
  );
}

/**
 * Superuser-only: mark org as exempt from subscription/trial gates (API key + chat flows).
 */
export async function setOrgPlatformExempt(orgId: string, exempt: boolean): Promise<Org> {
  const result = await query<Org>(`
    UPDATE orgs SET platform_exempt = $2 WHERE id = $1
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status, sdk_access_enabled, platform_exempt, seat_limit, observe_only_override, billing_admin_observe_lock_user_id
  `, [orgId, exempt]);
  if (result.rowCount === 0) {
    throw new Error(`Organization ${orgId} not found`);
  }
  return result.rows[0];
}

/**
 * Superuser: force Observe-only savings, allow real savings despite billing, or clear override (null).
 */
export async function setOrgObserveOnlyOverride(
  orgId: string,
  override: boolean | null,
): Promise<Org> {
  const result = await query<Org>(`
    UPDATE orgs SET observe_only_override = $2 WHERE id = $1
    RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status, sdk_access_enabled, platform_exempt, seat_limit, observe_only_override, billing_admin_observe_lock_user_id
  `, [orgId, override]);
  if (result.rowCount === 0) {
    throw new Error(`Organization ${orgId} not found`);
  }
  return result.rows[0];
}

/**
 * Update org subscription status (and Stripe ids from webhooks).
 */
export async function updateOrgSubscription(
  orgId: string,
  subscriptionId: string | null,
  status: string,
  isActive: boolean,
  stripeExtras?: {
    currentPeriodEndUnix?: number | null;
    cancelAtPeriodEnd?: boolean | null;
    /** Stripe subscription item quantity → org seat cap when set. */
    seatLimit?: number | null;
  },
): Promise<void> {
  // Map Stripe subscription status to DB. Trialing must count as paid access.
  let subscriptionStatus: Org["subscription_status"] = "trial";
  if (
    isActive &&
    (status === "active" || status === "trialing")
  ) {
    subscriptionStatus = "active";
  } else if (status === "canceled") {
    subscriptionStatus = "canceled";
  } else if (status === "past_due") {
    subscriptionStatus = "past_due";
  } else if (status === "paused") {
    subscriptionStatus = "paused";
  }

  const periodEnd: string | null =
    stripeExtras?.currentPeriodEndUnix != null && Number.isFinite(stripeExtras.currentPeriodEndUnix)
      ? new Date(stripeExtras.currentPeriodEndUnix * 1000).toISOString()
      : null;

  const seatLimitFromStripe = stripeExtras?.seatLimit;
  const seatLimitParam =
    typeof seatLimitFromStripe === "number" && Number.isFinite(seatLimitFromStripe) && seatLimitFromStripe >= 1
      ? Math.floor(seatLimitFromStripe)
      : null;

  await query(
    `
    UPDATE orgs
    SET subscription_status = $1,
        stripe_subscription_id = $2,
        subscription_current_period_end = CASE
          WHEN $1::text = 'canceled' THEN NULL
          WHEN $3::timestamptz IS NULL THEN subscription_current_period_end
          ELSE $3::timestamptz
        END,
        cancel_at_period_end = CASE
          WHEN $1::text = 'canceled' THEN false
          WHEN $4::boolean IS NULL THEN cancel_at_period_end
          ELSE $4::boolean
        END,
        seat_limit = CASE
          WHEN $6::integer IS NULL THEN seat_limit
          ELSE GREATEST(1, $6::integer)
        END
    WHERE id = $5
    `,
    [
      subscriptionStatus,
      subscriptionId,
      periodEnd,
      stripeExtras?.cancelAtPeriodEnd ?? null,
      orgId,
      seatLimitParam,
    ],
  );
}

/** First org where the user is owner (oldest by org created_at) — admin billing exempt toggle. */
export async function getFirstOwnedOrgForUser(
  userId: string,
): Promise<{ org_id: string; platform_exempt: boolean } | null> {
  return await queryOne<{ org_id: string; platform_exempt: boolean }>(
    `
    SELECT o.id AS org_id, COALESCE(o.platform_exempt, false) AS platform_exempt
    FROM org_memberships om
    INNER JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1 AND lower(om.role::text) = 'owner'
    ORDER BY o.created_at ASC NULLS LAST
    LIMIT 1
    `,
    [userId],
  );
}

/** Org IDs where the user is owner (admin inactive / staff helpers). */
export async function listOwnerOrgIdsForUser(userId: string): Promise<string[]> {
  const r = await query<{ org_id: string }>(
    `SELECT org_id FROM org_memberships WHERE user_id = $1 AND lower(role::text) = 'owner'`,
    [userId],
  );
  return r.rows.map((row) => row.org_id);
}

/**
 * Admin "inactive": force Observe-only savings on orgs this user owns (skip platform_exempt orgs).
 */
export async function applyInactiveBillingLockForOwnerOrgs(userId: string): Promise<{ orgIds: string[] }> {
  const ids = await listOwnerOrgIdsForUser(userId);
  for (const orgId of ids) {
    await query(
      `
      UPDATE orgs
      SET observe_only_override = true,
          billing_admin_observe_lock_user_id = $2::uuid
      WHERE id = $1
        AND COALESCE(platform_exempt, false) IS NOT TRUE
      `,
      [orgId, userId],
    );
  }
  return { orgIds: ids };
}

/** Clear observe lock applied by admin inactive for this user. */
export async function clearInactiveBillingLockForUser(userId: string): Promise<void> {
  await query(
    `
    UPDATE orgs
    SET observe_only_override = NULL,
        billing_admin_observe_lock_user_id = NULL
    WHERE billing_admin_observe_lock_user_id = $1::uuid
    `,
    [userId],
  );
}
