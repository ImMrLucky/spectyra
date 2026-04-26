import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate as isUuid } from "uuid";
import { query, queryOne } from "../services/storage/db.js";
import {requireAdminToken, requireOwner, requireUserSession, type AuthenticatedRequest} from "../middleware/auth.js";
import { safeLog, redactSecrets } from "../utils/redaction.js";
import {
  getOrgById,
  getAllOrgs,
  deleteOrg,
  updateOrgName,
  getOrgProjects,
  getOrgApiKeys,
  hashApiKey,
  getApiKeyByRawKeyLookupForDiagnose,
  API_KEY_PREFIX_LENGTH,
  getFirstOwnedOrgForUser,
  setOrgPlatformExempt,
} from "../services/storage/orgsRepo.js";
import type { SupabaseAdminUser } from "../types/supabase.js";
import {
  deleteUserDataAndMemberships,
  setAccountAccessState,
  type AccountAccessState,
} from "../services/storage/userAccountRepo.js";
import {
  getPlatformRoleByEmail,
  countSuperusers,
  upsertPlatformRole,
  deletePlatformRole,
  invalidatePlatformRoleCache,
  listPlatformRoles,
} from "../services/storage/platformRolesRepo.js";
import { cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure } from "../billing/stripeSubscriptionCancelOnAccountDelete.js";
import { RL_ADMIN, RL_ADMIN_USER_DELETE, RL_ADMIN_USER_PATCH } from "../middleware/expressRateLimitPresets.js";
import { resolveAdminPricingCatalog } from "../services/pricing/resolveAdminPricingCatalog.js";
import { getBundledProviderPricingSnapshot } from "../services/pricing/bundledPricingSnapshot.js";
import {
  deletePricingOverride,
  insertPricingSnapshot,
  listPricingOverrides,
  tryParseProviderPricingSnapshot,
  upsertPricingOverride,
} from "../services/pricing/pricingRegistryRepo.js";
import { getPricingRegistryOperatorStatus } from "../services/pricing/pricingRegistryStatus.js";

export const adminRouter = Router();

adminRouter.use(rateLimit(RL_ADMIN));

function canManagePrivilegedUserActions(req: AuthenticatedRequest): boolean {
  const isSuperuser = req.auth?.platformRole === "superuser";
  const ownerEmail = process.env.OWNER_EMAIL;
  const isOwnerEmail =
    !!ownerEmail && req.auth?.email?.toLowerCase() === ownerEmail.toLowerCase();
  return !!(isSuperuser || isOwnerEmail);
}

/**
 * GET /v1/admin/capabilities
 *
 * Whether this admin may manage platform roles and per-user owner-org billing (platform_exempt).
 */
adminRouter.get("/capabilities", requireUserSession, requireOwner, (req: AuthenticatedRequest, res) => {
  const ok = canManagePrivilegedUserActions(req);
  res.json({
    can_manage_platform_roles: ok,
    can_manage_owner_org_billing: ok,
  });
});

/**
 * GET /v1/admin/pricing/snapshot
 *
 * Returns `{ snapshot, registry }` — snapshot matches machine `GET /v1/pricing/snapshot` shape;
 * `registry` describes DB vs bundled source and TTL staleness.
 */
adminRouter.get("/pricing/snapshot", requireUserSession, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const provider =
      typeof req.query.provider === "string" ? req.query.provider.trim().toLowerCase() : undefined;
    const body = await resolveAdminPricingCatalog(provider);
    res.json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing snapshot", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /v1/admin/pricing/status — operator summary (staleness, override count) without full catalog.
 */
adminRouter.get("/pricing/status", requireUserSession, requireOwner, async (_req: AuthenticatedRequest, res) => {
  try {
    const body = await getPricingRegistryOperatorStatus();
    res.json(body);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing status", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /v1/admin/pricing/ingest-bundled — copy bundled catalog into `pricing_registry_snapshots` (manual / job).
 */
adminRouter.post("/pricing/ingest-bundled", requireUserSession, requireOwner, async (_req: AuthenticatedRequest, res) => {
  try {
    const snap = getBundledProviderPricingSnapshot(undefined);
    await insertPricingSnapshot(snap, snap.ttlSeconds, "bundled_copy");
    res.json({ ok: true, version: snap.version });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing ingest bundled", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /v1/admin/pricing/snapshot — ingest a full `ProviderPricingSnapshot` JSON body.
 */
adminRouter.post("/pricing/snapshot", requireUserSession, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = tryParseProviderPricingSnapshot(req.body);
    if (!parsed) {
      return res.status(400).json({ error: "Body must be a valid ProviderPricingSnapshot (version, entries, …)" });
    }
    await insertPricingSnapshot(parsed, parsed.ttlSeconds, "admin_upload");
    res.json({ ok: true, version: parsed.version });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing snapshot upload", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.get("/pricing/overrides", requireUserSession, requireOwner, async (_req: AuthenticatedRequest, res) => {
  try {
    const rows = await listPricingOverrides();
    res.json({ overrides: rows });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing overrides list", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.put("/pricing/overrides", requireUserSession, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const orgIdRaw = (req.body as { orgId?: string | null }).orgId;
    const orgId = orgIdRaw === undefined || orgIdRaw === "" ? null : String(orgIdRaw);
    const modelId = String((req.body as { modelId?: string }).modelId ?? "").trim();
    const patch = (req.body as { patch?: Record<string, unknown> }).patch;
    if (!modelId || !patch || typeof patch !== "object") {
      return res.status(400).json({ error: "modelId and patch object are required" });
    }
    await upsertPricingOverride(orgId, modelId, patch);
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing overrides put", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

adminRouter.delete("/pricing/overrides", requireUserSession, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      return res.status(400).json({ error: "Query id (uuid) is required" });
    }
    const ok = await deletePricingOverride(id);
    if (!ok) {
      return res.status(404).json({ error: "Override not found" });
    }
    res.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "admin pricing overrides delete", { error: msg });
    res.status(500).json({ error: "Internal server error" });
  }
});

function supabaseAdminHeaders(): { base: string; headers: Record<string, string> } | null {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return {
    base,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  };
}

/**
 * Build Supabase Auth Admin URLs without interpolating untrusted path segments into a string URL (SSRF/CodeQL).
 * Path segments are encoded; user id must be a UUID.
 */
function supabaseAuthAdminUsersListUrl(base: string): string {
  const origin = base.replace(/\/$/, "");
  return new URL("auth/v1/admin/users?per_page=200&page=1", `${origin}/`).href;
}

function supabaseAuthAdminUserUrl(base: string, userId: string): string {
  if (!isUuid(userId)) {
    throw new Error("Supabase auth user id must be a UUID");
  }
  const origin = base.replace(/\/$/, "");
  return new URL(`auth/v1/admin/users/${encodeURIComponent(userId)}`, `${origin}/`).href;
}

/** Supabase Auth user IDs are UUIDs. Require strict format before embedding in outbound URLs (SSRF/path injection). */
function parseSupabaseAuthUserId(raw: string | undefined): string | null {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || !isUuid(id)) return null;
  return id;
}

/**
 * Admin-only debug endpoint.
 * Requires X-ADMIN-TOKEN header matching ADMIN_TOKEN env var.
 * Returns debug_internal_json for a run (contains moat internals).
 * NEVER used by public UI.
 * NEVER leaks provider keys.
 */
adminRouter.get("/runs/:id/debug", requireAdminToken, async (req, res) => {
  try {
    const runId = req.params.id;
    
    const row = await queryOne<any>(`
      SELECT id, debug_internal_json
      FROM runs
      WHERE id = $1
    `, [runId]);
    
    if (!row) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    const debugInternal = row.debug_internal_json 
      ? JSON.parse(row.debug_internal_json)
      : null;
    
    // Redact any provider keys that might be in debug data
    const safeDebug = redactSecrets(debugInternal);
    
    res.json({
      run_id: row.id,
      debug_internal_json: safeDebug,
    });
  } catch (error: any) {
    safeLog("error", "Admin debug error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/admin/orgs
 * 
 * List all organizations (admin only)
 */
adminRouter.get("/orgs", requireUserSession, requireOwner, async (req, res) => {
  try {
    const orgs = await getAllOrgs();
    
    // Get stats for each org
    const orgsWithStats = await Promise.all(orgs.map(async (org) => {
      const projectCount = await queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM projects WHERE org_id = $1
      `, [org.id]);
      
      const apiKeyCount = await queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM api_keys WHERE org_id = $1 AND revoked_at IS NULL
      `, [org.id]);
      
      const runCount = await queryOne<{ count: number }>(`
        SELECT COUNT(*) as count FROM runs WHERE org_id = $1
      `, [org.id]);
      
      return {
        ...org,
        stats: {
          projects: projectCount?.count || 0,
          api_keys: apiKeyCount?.count || 0,
          runs: runCount?.count || 0,
        },
      };
    }));
    
    res.json({ orgs: orgsWithStats });
  } catch (error: any) {
    safeLog("error", "Admin list orgs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/admin/orgs/:id
 * 
 * Get organization details (admin only)
 */
adminRouter.get("/orgs/:id", requireUserSession, requireOwner, async (req, res) => {
  try {
    const orgId = req.params.id;
    const org = await getOrgById(orgId);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const projects = await getOrgProjects(orgId);
    const apiKeys = await getOrgApiKeys(orgId, false);
    
    const runCount = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM runs WHERE org_id = $1
    `, [orgId]);
    
    res.json({
      org,
      projects,
      api_keys: apiKeys.map(k => ({
        id: k.id,
        name: k.name,
        project_id: k.project_id,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        revoked_at: k.revoked_at,
      })),
      stats: {
        projects: projects.length,
        api_keys: apiKeys.length,
        runs: runCount?.count || 0,
      },
    });
  } catch (error: any) {
    safeLog("error", "Admin get org error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/admin/orgs/:id
 * 
 * Update organization (admin only)
 */
adminRouter.patch("/orgs/:id", requireUserSession, requireOwner, async (req, res) => {
  try {
    const orgId = req.params.id;
    const { name } = req.body as { name?: string };
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Organization name cannot be empty" });
      }
      
      const updatedOrg = await updateOrgName(orgId, name);
      res.json({ org: updatedOrg });
    } else {
      return res.status(400).json({ error: "No fields to update" });
    }
  } catch (error: any) {
    safeLog("error", "Admin update org error", { error: error.message });
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * DELETE /v1/admin/orgs/:id
 * 
 * Delete organization (admin only)
 */
adminRouter.delete("/orgs/:id", requireAdminToken, async (req, res) => {
  try {
    const orgId = req.params.id;
    const org = await getOrgById(orgId);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    try {
      await deleteOrg(orgId);
      safeLog("info", "Admin deleted organization", { orgId, orgName: org.name });
      res.json({
        success: true,
        message: `Organization "${org.name}" deleted successfully`,
      });
    } catch (deleteError: any) {
      safeLog("error", "Admin delete org failed", { orgId, error: deleteError.message });
      return res.status(400).json({
        error: "Cannot delete organization",
        message: deleteError.message,
      });
    }
  } catch (error: any) {
    safeLog("error", "Admin delete org error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/admin/diagnose-key
 * 
 * Diagnose an API key (admin only)
 * Helps debug why a key might not be working
 */
adminRouter.post("/diagnose-key", requireUserSession, requireOwner, async (req, res) => {
  try {
    const { api_key } = req.body as { api_key?: string };
    
    if (!api_key) {
      return res.status(400).json({ error: "api_key is required" });
    }
    
    const keyHash = await hashApiKey(api_key);
    const lookupPrefix =
      api_key.length >= API_KEY_PREFIX_LENGTH
        ? api_key.substring(0, API_KEY_PREFIX_LENGTH)
        : api_key.length >= 12
          ? api_key.substring(0, 12)
          : api_key;

    const keyRow = await getApiKeyByRawKeyLookupForDiagnose(api_key);

    if (!keyRow) {
      return res.json({
        found: false,
        message: "API key not found in database (prefix lookup failed)",
        key_prefix: lookupPrefix,
        key_hash_prefix: keyHash.substring(0, 16) + "...",
      });
    }
    
    // Check org
    let org = null;
    if (keyRow.org_id) {
      org = await getOrgById(keyRow.org_id);
    }
    
    // Check if revoked
    const isRevoked = !!keyRow.revoked_at;
    
    return res.json({
      found: true,
      key_id: keyRow.id,
      has_org_id: !!keyRow.org_id,
      org_id: keyRow.org_id,
      has_project_id: !!keyRow.project_id,
      project_id: keyRow.project_id,
      has_user_id: !!keyRow.user_id,
      user_id: keyRow.user_id,
      name: keyRow.name,
      key_prefix: keyRow.key_prefix,
      created_at: keyRow.created_at,
      last_used_at: keyRow.last_used_at,
      revoked_at: keyRow.revoked_at,
      is_revoked: isRevoked,
      org_exists: !!org,
      org: org ? {
        id: org.id,
        name: org.name,
        subscription_status: org.subscription_status,
      } : null,
      issues: [
        !keyRow.org_id && "Missing org_id (key created before org model migration)",
        isRevoked && "Key is revoked",
        keyRow.org_id && !org && "Org not found for this key",
      ].filter(Boolean),
    });
  } catch (error: any) {
    safeLog("error", "Admin diagnose key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/admin/orgs/:id/sdk-access
 * 
 * Toggle SDK access for an organization (owner only)
 */
adminRouter.patch("/orgs/:id/sdk-access", requireUserSession, requireOwner, async (req, res) => {
  try {
    const orgId = req.params.id;
    const { enabled } = req.body as { enabled?: boolean };
    
    if (enabled === undefined) {
      return res.status(400).json({ error: "enabled field is required (true/false)" });
    }
    
    const org = await getOrgById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    await query(`
      UPDATE orgs 
      SET sdk_access_enabled = $1
      WHERE id = $2
    `, [enabled, orgId]);
    
    safeLog("info", "SDK access updated", { 
      orgId, 
      orgName: org.name, 
      enabled 
    });
    
    const updatedOrg = await getOrgById(orgId);
    res.json({ 
      org: updatedOrg,
      message: `SDK access ${enabled ? 'enabled' : 'disabled'} for ${org.name}`
    });
  } catch (error: any) {
    safeLog("error", "Admin update SDK access error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/admin/users
 * 
 * List all users with their org memberships (owner only)
 */
adminRouter.get("/users", requireUserSession, requireOwner, async (req, res) => {
  try {
    // Get all users from org_memberships with their email from Supabase
    // Note: This requires Supabase service role access
    const memberships = await query<{
      user_id: string;
      org_id: string;
      org_name: string;
      role: string;
      created_at: string;
    }>(`
      SELECT 
        om.user_id,
        om.org_id,
        o.name as org_name,
        om.role,
        om.created_at
      FROM org_memberships om
      JOIN orgs o ON o.id = om.org_id
      ORDER BY om.created_at DESC
    `, []);

    // Group by user_id
    const usersMap = new Map<string, {
      user_id: string;
      email?: string;
      access_state?: AccountAccessState;
      pause_savings_until?: string | null;
      platform_role?: string | null;
      primary_owner_org?: { org_id: string; platform_exempt: boolean } | null;
      orgs: Array<{
        org_id: string;
        org_name: string;
        role: string;
        created_at: string;
      }>;
    }>();

    // Iterate over rows array (query returns { rows, rowCount })
    for (const m of memberships.rows) {
      if (!usersMap.has(m.user_id)) {
        usersMap.set(m.user_id, {
          user_id: m.user_id,
          orgs: [],
        });
      }
      usersMap.get(m.user_id)!.orgs.push({
        org_id: m.org_id,
        org_name: m.org_name,
        role: m.role,
        created_at: m.created_at,
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Merge Auth users who have no org_memberships yet (so admins can see/delete them)
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const listRes = await fetch(
          supabaseAuthAdminUsersListUrl(supabaseUrl),
          {
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              apikey: supabaseServiceKey,
            },
          },
        );
        if (listRes.ok) {
          const body = (await listRes.json()) as {
            users?: Array<{ id: string; email?: string; user_metadata?: { email?: string } }>;
          };
          for (const au of body.users ?? []) {
            const email = au.email || au.user_metadata?.email;
            if (!usersMap.has(au.id)) {
              usersMap.set(au.id, {
                user_id: au.id,
                email,
                orgs: [],
              });
            } else {
              const row = usersMap.get(au.id)!;
              if (!row.email && email) row.email = email;
            }
          }
        }
      } catch {
        /* ignore directory merge */
      }
    }

    let users = Array.from(usersMap.values());

    const userIds = Array.from(usersMap.keys());
    if (userIds.length > 0) {
      try {
        const flags = await query<{
          user_id: string;
          access_state: AccountAccessState;
          pause_savings_until: string | null;
        }>(
          `SELECT user_id, access_state, pause_savings_until FROM user_account_flags WHERE user_id = ANY($1::uuid[])`,
          [userIds],
        );
        for (const row of flags.rows) {
          const u = usersMap.get(row.user_id);
          if (u) {
            u.access_state = row.access_state;
            u.pause_savings_until = row.pause_savings_until;
          }
        }
      } catch {
        /* ignore */
      }
    }

    if (userIds.length > 0) {
      try {
        const ownedRows = await query<{
          user_id: string;
          org_id: string;
          platform_exempt: boolean;
        }>(
          `
          SELECT DISTINCT ON (om.user_id)
            om.user_id,
            om.org_id,
            COALESCE(o.platform_exempt, false) AS platform_exempt
          FROM org_memberships om
          INNER JOIN orgs o ON o.id = om.org_id
          WHERE om.user_id = ANY($1::uuid[])
            AND lower(om.role::text) = 'owner'
          ORDER BY om.user_id ASC, o.created_at ASC NULLS LAST
          `,
          [userIds],
        );
        for (const row of ownedRows.rows) {
          const u = usersMap.get(row.user_id);
          if (u) {
            u.primary_owner_org = { org_id: row.org_id, platform_exempt: row.platform_exempt };
          }
        }
      } catch {
        /* ignore */
      }
    }

    // Fill emails for membership-only rows if directory list missed them
    if (supabaseUrl && supabaseServiceKey) {
      for (const user of users) {
        if (user.email) continue;
        if (!isUuid(user.user_id)) continue;
        try {
          const response = await fetch(
            supabaseAuthAdminUserUrl(supabaseUrl, user.user_id),
            {
              headers: {
                Authorization: `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
              },
            },
          );
          if (response.ok) {
            const supabaseUser = await response.json() as SupabaseAdminUser;
            user.email = supabaseUser.email || supabaseUser.user_metadata?.email;
          }
        } catch {
          /* ignore */
        }
      }
    }

    // Attach platform_role for each user that has an email
    try {
      const allRoles = await listPlatformRoles();
      const rolesByEmail = new Map(allRoles.map((r) => [r.email.toLowerCase(), r.role]));
      for (const user of users) {
        user.platform_role = user.email ? rolesByEmail.get(user.email.toLowerCase()) ?? null : null;
      }
    } catch {
      /* platform_roles table may not exist yet */
    }

    res.json({ users });
  } catch (error: any) {
    safeLog("error", "Admin list users error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/admin/users/:userId/access
 *
 * - active: normal access; resumes Stripe if coming from paused/inactive.
 * - paused: pauses Stripe + 30d savings grace, then JWT read-only (Observe) until reactivated.
 * - inactive: full app access; real savings locked to Observe via org observe lock (not JWT block). Does not auto-pause Stripe.
 */
adminRouter.patch(
  "/users/:userId/access",
  requireUserSession,
  requireOwner,
  rateLimit(RL_ADMIN_USER_PATCH),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseSupabaseAuthUserId(req.params.userId);
      const { access_state } = req.body as { access_state?: AccountAccessState };
      if (!userId) {
        return res.status(400).json({ error: "user id must be a UUID" });
      }
      if (access_state !== "active" && access_state !== "paused" && access_state !== "inactive") {
        return res.status(400).json({ error: "access_state must be active, paused, or inactive" });
      }
      if (req.auth?.userId === userId) {
        return res.status(400).json({ error: "Cannot pause or reactivate your own account from this panel" });
      }

      const cfg = supabaseAdminHeaders();
      if (!cfg) {
        return res.status(503).json({ error: "Supabase admin not configured" });
      }
      const uRes = await fetch(supabaseAuthAdminUserUrl(cfg.base, userId), { headers: cfg.headers });
      if (!uRes.ok) {
        return res.status(uRes.status === 404 ? 404 : 502).json({ error: "User not found in auth provider" });
      }

      const { stripe } = await setAccountAccessState(userId, access_state);
      const until = await queryOne<{ pause_savings_until: string | null }>(
        `SELECT pause_savings_until FROM user_account_flags WHERE user_id = $1`,
        [userId],
      );
      safeLog("info", "admin user access_state updated", { userId, access_state });
      return res.json({
        user_id: userId,
        access_state,
        pause_savings_until: until?.pause_savings_until ?? null,
        stripe,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error";
      safeLog("error", "Admin patch user access", { error: message });
      return res.status(500).json({ error: message });
    }
  },
);

/**
 * PATCH /v1/admin/users/:userId/owner-org-billing
 *
 * Sets platform_exempt on the user's first owned org (staff / special users — full entitlement without paid subscription).
 * Superusers and OWNER_EMAIL only.
 */
adminRouter.patch(
  "/users/:userId/owner-org-billing",
  requireUserSession,
  requireOwner,
  rateLimit(RL_ADMIN_USER_PATCH),
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!canManagePrivilegedUserActions(req)) {
        return res.status(403).json({
          error: "Only superusers or the platform owner can change owner-org billing exempt",
        });
      }
      const userId = parseSupabaseAuthUserId(req.params.userId);
      const { platform_exempt } = req.body as { platform_exempt?: boolean };
      if (!userId) {
        return res.status(400).json({ error: "user id must be a UUID" });
      }
      if (typeof platform_exempt !== "boolean") {
        return res.status(400).json({ error: "platform_exempt boolean required" });
      }

      const cfg = supabaseAdminHeaders();
      if (!cfg) {
        return res.status(503).json({ error: "Supabase admin not configured" });
      }
      const uRes = await fetch(supabaseAuthAdminUserUrl(cfg.base, userId), { headers: cfg.headers });
      if (!uRes.ok) {
        return res.status(uRes.status === 404 ? 404 : 502).json({ error: "User not found in auth provider" });
      }

      const row = await getFirstOwnedOrgForUser(userId);
      if (!row) {
        return res.status(400).json({ error: "User has no owned organization — cannot set billing exempt" });
      }

      const org = await setOrgPlatformExempt(row.org_id, platform_exempt);
      safeLog("info", "admin owner-org platform_exempt updated", { userId, orgId: row.org_id, platform_exempt });
      return res.json({
        user_id: userId,
        org_id: org.id,
        platform_exempt: org.platform_exempt,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error";
      safeLog("error", "Admin patch owner-org-billing", { error: message });
      return res.status(500).json({ error: message });
    }
  },
);

/**
 * PATCH /v1/admin/users/:userId/role
 *
 * Grant or revoke a platform role (admin) for a user.
 * Body: { "role": "admin" } to grant, { "role": null } to revoke.
 * Only superusers and OWNER_EMAIL can change roles — regular admins cannot.
 */
adminRouter.patch(
  "/users/:userId/role",
  requireUserSession,
  requireOwner,
  rateLimit(RL_ADMIN_USER_PATCH),
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseSupabaseAuthUserId(req.params.userId);
      const { role } = req.body as { role?: string | null };
      if (!userId) {
        return res.status(400).json({ error: "user id must be a UUID" });
      }

      if (!canManagePrivilegedUserActions(req)) {
        return res.status(403).json({ error: "Only superusers or the platform owner can manage admin roles" });
      }

      const cfg = supabaseAdminHeaders();
      if (!cfg) {
        return res.status(503).json({ error: "Supabase admin not configured" });
      }

      const uRes = await fetch(supabaseAuthAdminUserUrl(cfg.base, userId), { headers: cfg.headers });
      if (!uRes.ok) {
        return res.status(uRes.status === 404 ? 404 : 502).json({ error: "User not found in auth provider" });
      }
      const target = (await uRes.json()) as SupabaseAdminUser;
      const email = target.email || target.user_metadata?.email;
      if (!email) {
        return res.status(400).json({ error: "User has no email — cannot assign platform role" });
      }

      const currentRole = await getPlatformRoleByEmail(email);

      if (role === null || role === undefined || role === "") {
        // Revoke role
        if (currentRole === "superuser" && (await countSuperusers()) <= 1) {
          return res.status(400).json({ error: "Cannot remove the last platform superuser" });
        }
        await deletePlatformRole(email);
        safeLog("info", "admin revoked platform role", { userId, email, previousRole: currentRole });
        return res.json({ user_id: userId, email, platform_role: null });
      }

      if (role !== "admin") {
        return res.status(400).json({
          error: "Only the 'admin' role can be granted from the Admin panel. Use the Superuser console for superuser/exempt.",
        });
      }

      const actorEmail = req.auth?.email ?? "admin";
      await upsertPlatformRole(email, "admin", actorEmail);
      safeLog("info", "admin granted platform role", { userId, email, role });
      return res.json({ user_id: userId, email, platform_role: "admin" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error";
      safeLog("error", "Admin patch user role", { error: message });
      return res.status(500).json({ error: message });
    }
  },
);

/**
 * DELETE /v1/admin/users/:userId
 *
 * Removes Spectyra DB rows (memberships; sole-owner orgs deleted entirely), platform_roles, flags,
 * then deletes the Supabase Auth user. Does not remove auth-only users with no app rows except auth delete.
 */
adminRouter.delete(
  "/users/:userId",
  requireUserSession,
  requireOwner,
  rateLimit(RL_ADMIN_USER_DELETE),
  async (req: AuthenticatedRequest, res) => {
  try {
    const userId = parseSupabaseAuthUserId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ error: "user id must be a UUID" });
    }
    if (req.auth?.userId === userId) {
      return res.status(400).json({ error: "Use another admin account to delete your own user" });
    }

    const cfg = supabaseAdminHeaders();
    if (!cfg) {
      return res.status(503).json({ error: "Supabase admin not configured" });
    }

    const uRes = await fetch(supabaseAuthAdminUserUrl(cfg.base, userId), { headers: cfg.headers });
    if (!uRes.ok) {
      return res.status(uRes.status === 404 ? 404 : 502).json({ error: "User not found in auth provider" });
    }
    const target = (await uRes.json()) as SupabaseAdminUser;
    const email = target.email || target.user_metadata?.email || null;

    const targetPlatformRole = await getPlatformRoleByEmail(email);
    if (targetPlatformRole === "superuser" && (await countSuperusers()) <= 1) {
      return res.status(400).json({ error: "Cannot delete the last platform superuser" });
    }

    const stripeClosure = await cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure(userId, "immediately");
    const summary = await deleteUserDataAndMemberships({ userId, email });

    const delRes = await fetch(supabaseAuthAdminUserUrl(cfg.base, userId), {
      method: "DELETE",
      headers: cfg.headers,
    });
    if (!delRes.ok) {
      const errText = await delRes.text().catch(() => "");
      safeLog("error", "admin delete user: Supabase DELETE failed", {
        status: delRes.status,
        errText: errText.slice(0, 200),
      });
      return res.status(502).json({
        error: "App data was removed but deleting the auth user failed. Retry or remove the user in Supabase Dashboard.",
        partial: {
          ...summary,
          stripe_subscriptions_canceled: stripeClosure.canceledImmediately,
          stripe_customers_deleted: stripeClosure.customersDeleted,
          stripe_warnings: stripeClosure.warnings.length ? stripeClosure.warnings : undefined,
        },
      });
    }

    safeLog("info", "admin deleted user", { userId, email: email ?? undefined });
    return res.json({
      deleted: true,
      user_id: userId,
      orgs_deleted: summary.orgsDeleted,
      memberships_removed: summary.membershipsRemoved,
      stripe_subscriptions_canceled: stripeClosure.canceledImmediately,
      stripe_customers_deleted: stripeClosure.customersDeleted,
      stripe_warnings: stripeClosure.warnings.length ? stripeClosure.warnings : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    safeLog("error", "Admin delete user", { error: message });
    return res.status(500).json({ error: message });
  }
});
