/**
 * Authentication Routes
 * 
 * User registration and API key management (without Stripe for now)
 */

import { Router } from "express";
import {
  createOrg,
  getOrgById,
  hasActiveAccess,
  createProject,
  createApiKey,
  getOrgApiKeys,
  deleteApiKey,
  hashApiKey,
  getApiKeyByHash,
  revokeApiKey,
  deleteOrg,
  updateOrgName,
  getOrgProjects,
} from "../services/storage/orgsRepo.js";
import { requireSpectyraApiKey, optionalProviderKey, requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { query, queryOne } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";
import { audit } from "../services/audit/audit.js";
import { requireOrgRole } from "../middleware/requireRole.js";
import type { SupabaseAdminUser } from "../types/supabase.js";

export const authRouter = Router();

/**
 * POST /v1/auth/bootstrap
 * 
 * Bootstrap org/project for a Supabase user (called after first Supabase login)
 * Requires Supabase JWT authentication
 * Creates org, default project, and first API key
 */
authRouter.post("/bootstrap", requireUserSession, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { org_name, project_name } = req.body as { org_name?: string; project_name?: string };
    
    if (!org_name || org_name.trim().length === 0) {
      return res.status(400).json({ error: "Organization name is required" });
    }

    const userId = req.auth.userId;

    // Enterprise Security: Check domain allowlist BEFORE org creation
    // If user is trying to join an existing org with domain restrictions, check their email
    // Note: For new org creation, domain restrictions apply after org is created
    // This check is primarily for when users are invited to existing orgs
    try {
      // Get user email from Supabase to check domain
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceKey) {
        try {
          const response = await fetch(
            `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`,
            {
              headers: {
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey,
              },
            }
          );

          if (response.ok) {
            const user = await response.json() as SupabaseAdminUser;
            const userEmail = user.email || user.user_metadata?.email;
            
            if (userEmail) {
              const userDomain = userEmail.split('@')[1]?.toLowerCase();
              
              // Check if any existing org has domain restrictions that would block this user
              // (This is a pre-check - actual enforcement happens in requireOrgMembership)
              const { query } = await import("../services/storage/db.js");
              const orgsWithDomainRestrictions = await query<{ org_id: string; allowed_email_domains: string[] }>(`
                SELECT org_id, allowed_email_domains
                FROM org_settings
                WHERE allowed_email_domains IS NOT NULL
                  AND array_length(allowed_email_domains, 1) > 0
              `);

              // If user's domain is restricted by any org, log it (but allow org creation)
              // Actual enforcement happens when they try to access that org
              for (const org of orgsWithDomainRestrictions.rows) {
                const allowedDomains = org.allowed_email_domains.map((d: string) => d.toLowerCase());
                if (!allowedDomains.includes(userDomain)) {
                  safeLog("info", "User domain may be restricted by existing org", {
                    userId,
                    userEmail,
                    userDomain,
                    restrictedOrgId: org.org_id,
                  });
                }
              }
            }
          }
        } catch (error) {
          // If we can't check email, allow org creation (fail open)
          safeLog("warn", "Could not verify email domain during bootstrap", { error });
        }
      }
    } catch (error) {
      // Don't block org creation if domain check fails
      safeLog("warn", "Domain check error during bootstrap", { error });
    }

    // Check if user already has an org
    const { queryOne } = await import("../services/storage/db.js");
    const existingMembership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [userId]);

    if (existingMembership) {
      return res.status(400).json({ 
        error: "Organization already exists for this user",
        org_id: existingMembership.org_id
      });
    }

    // Create org with 7-day trial
    const org = await createOrg(org_name.trim(), 7);
    
    // Create default project
    const project = await createProject(org.id, project_name || "Default Project");
    
    // Add user as OWNER of the org
    await query(`
      INSERT INTO org_memberships (org_id, user_id, role)
      VALUES ($1, $2, 'OWNER')
    `, [org.id, userId]);
    
    // Enterprise Security: Audit log
    try {
      await audit(req, "ORG_CREATED", {
        targetType: "ORG",
        targetId: org.id,
        metadata: { name: org.name },
      });
      await audit(req, "MEMBER_ADDED", {
        targetType: "ORG_MEMBERSHIP",
        metadata: { role: "OWNER", org_id: org.id },
      });
    } catch {
      // Don't fail bootstrap if audit fails
    }
    
    // Create first API key (org-level, not project-scoped)
    const { key, apiKey } = await createApiKey(org.id, null, "Default Key");
    
    // Enterprise Security: Audit log (already done in createApiKey route, but ensure it's here too)
    await audit(req, "KEY_CREATED", {
      targetType: "API_KEY",
      targetId: apiKey.id,
      metadata: { name: "Default Key", is_bootstrap: true },
    });
    
    res.status(201).json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: {
        id: project.id,
        name: project.name,
      },
      api_key: key, // Only returned once
      api_key_id: apiKey.id,
      message: "Organization created successfully. Save your API key - it won't be shown again!",
    });
  } catch (error: any) {
    safeLog("error", "Bootstrap error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/register
 * 
 * Register a new organization and create default project + API key
 * (Legacy endpoint - for API key-based registration)
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { org_name, project_name } = req.body as { org_name?: string; project_name?: string };
    
    if (!org_name || org_name.trim().length === 0) {
      return res.status(400).json({ error: "Organization name is required" });
    }
    
    // Create org with 7-day trial
    const org = await createOrg(org_name.trim(), 7);
    
    // Create default project
    const project = await createProject(org.id, project_name || "Default Project");
    
    // Create first API key (org-level, not project-scoped)
    const { key, apiKey } = await createApiKey(org.id, null, "Default Key");
    
    res.status(201).json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: {
        id: project.id,
        name: project.name,
      },
      api_key: key, // Only returned once
      api_key_id: apiKey.id,
      message: "Organization created successfully. Save your API key - it won't be shown again!",
    });
  } catch (error: any) {
    safeLog("error", "Registration error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/login
 * 
 * Validate API key and return org/project info
 * (With API keys, "login" is just validating the key)
 */
authRouter.post("/login", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  // Enterprise Security: Audit log login
  try {
    await audit(req, "LOGIN", {
      metadata: { method: "API_KEY" },
    });
  } catch {
    // Don't fail login if audit fails
  }
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = await getOrgById(req.context.org.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const hasAccess = hasActiveAccess(org);
    
    res.json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: req.context.project,
      has_access: hasAccess,
    });
  } catch (error: any) {
    safeLog("error", "Login error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/auth/me
 * 
 * Get current org/project info
 * Supports both Supabase JWT and API key auth
 * 
 * Uses proper middleware pattern
 */
authRouter.get("/me", async (req: AuthenticatedRequest, res) => {
  try {
    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      // Use middleware properly - wrap in promise to handle async
      return new Promise<void>((resolve) => {
        requireUserSession(req, res, async () => {
          if (res.headersSent) {
            resolve();
            return;
          }
          
          if (!req.auth?.userId) {
            res.status(401).json({ error: "Not authenticated" });
            resolve();
            return;
          }

          try {
            // Get user's org membership
            const { queryOne } = await import("../services/storage/db.js");
            const membership = await queryOne<{ org_id: string; role: string }>(`
              SELECT org_id, role 
              FROM org_memberships 
              WHERE user_id = $1
              LIMIT 1
            `, [req.auth.userId]);

            if (!membership) {
              res.status(404).json({ 
                error: "Organization not found",
                needs_bootstrap: true 
              });
              resolve();
              return;
            }

            const org = await getOrgById(membership.org_id);
            if (!org) {
              res.status(404).json({ error: "Organization not found" });
              resolve();
              return;
            }

            // Get projects for this org
            const projects = await getOrgProjects(org.id);

            const hasAccess = hasActiveAccess(org);
            const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
            const isTrialActive = trialEnd ? trialEnd > new Date() : false;

            res.json({
              org: {
                id: org.id,
                name: org.name,
                trial_ends_at: org.trial_ends_at,
                subscription_status: org.subscription_status,
              },
              projects: projects,
              has_access: hasAccess,
              trial_active: isTrialActive,
            });
            resolve();
          } catch (error: any) {
            safeLog("error", "Get org error in /me", { error: error.message });
            if (!res.headersSent) {
              res.status(500).json({ error: error.message || "Internal server error" });
            }
            resolve();
          }
        }).catch((error: any) => {
          // Middleware error - response already sent
          resolve();
        });
      });
    }

    // Fall back to API key auth
    return new Promise<void>((resolve) => {
      requireSpectyraApiKey(req, res, async () => {
        if (res.headersSent) {
          resolve();
          return;
        }
        
        if (!req.context) {
          res.status(401).json({ error: "Not authenticated" });
          resolve();
          return;
        }
        
        try {
          const org = await getOrgById(req.context.org.id);
          if (!org) {
            res.status(404).json({ error: "Organization not found" });
            resolve();
            return;
          }
          
          const hasAccess = hasActiveAccess(org);
          const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
          const isTrialActive = trialEnd ? trialEnd > new Date() : false;
          
          res.json({
            org: {
              id: org.id,
              name: org.name,
              trial_ends_at: org.trial_ends_at,
              subscription_status: org.subscription_status,
            },
            project: req.context.project,
            has_access: hasAccess,
            trial_active: isTrialActive,
          });
          resolve();
        } catch (error: any) {
          safeLog("error", "Get org error in /me (API key)", { error: error.message });
          if (!res.headersSent) {
            res.status(500).json({ error: error.message || "Internal server error" });
          }
          resolve();
        }
      }).catch((error: any) => {
        // Middleware error - response already sent
        resolve();
      });
    });
  } catch (error: any) {
    if (!res.headersSent) {
      safeLog("error", "Get org error", { error: error.message });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

/**
 * POST /v1/auth/api-keys
 * 
 * Create a new API key (requires auth - Supabase JWT or API key)
 */
authRouter.post("/api-keys", async (req: AuthenticatedRequest, res) => {
  try {
    let orgId: string | null = null;

    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        await requireUserSession(req, res, async () => {
          if (!req.auth?.userId) {
            return res.status(401).json({ error: "Not authenticated" });
          }

          const { queryOne } = await import("../services/storage/db.js");
          const membership = await queryOne<{ org_id: string }>(`
            SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
          `, [req.auth.userId]);

          if (!membership) {
            return res.status(404).json({ error: "Organization not found" });
          }

          orgId = membership.org_id;
        });
        if (res.headersSent) return; // Response already sent
      } catch (jwtError) {
        // Fall through to API key
      }
    }

    // Fall back to API key auth
    if (!orgId) {
      await requireSpectyraApiKey(req, res, async () => {
        if (!req.context) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        orgId = req.context.org.id;
      });
      if (res.headersSent) return;
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name, project_id } = req.body as { name?: string; project_id?: string };
    const { key, apiKey } = await createApiKey(
      orgId,
      project_id || null,
      name || null
    );
    
    // Enterprise Security: Audit log
    await audit(req, "KEY_CREATED", {
      projectId: project_id || null,
      targetType: "API_KEY",
      targetId: apiKey.id,
      metadata: { name: name || null, project_id: project_id || null },
    });
    
    res.json({
      id: apiKey.id,
      key, // Only returned once
      name: apiKey.name,
      project_id: apiKey.project_id,
      created_at: apiKey.created_at,
    });
  } catch (error: any) {
    safeLog("error", "Create API key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/orgs/:orgId/api-keys/:keyId/rotate
 * POST /v1/orgs/:orgId/projects/:projectId/api-keys/:keyId/rotate
 * 
 * Rotate an API key (creates new key, revokes old one)
 * Requires OWNER/ADMIN role
 */
authRouter.post("/orgs/:orgId/api-keys/:keyId/rotate", 
  requireUserSession,
  requireOrgMembership,
  requireOrgRole("ADMIN"),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { orgId, keyId } = req.params;
      const { projectId } = req.query as { projectId?: string };
      
      if (!req.auth?.orgId || req.auth.orgId !== orgId) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Verify project belongs to org (if project-scoped)
      const finalProjectId = projectId && projectId !== "null" ? projectId : null;
      if (finalProjectId) {
        const { queryOne } = await import("../services/storage/db.js");
        const project = await queryOne<{ org_id: string }>(`
          SELECT org_id FROM projects WHERE id = $1
        `, [finalProjectId]);

        if (!project || project.org_id !== orgId) {
          return res.status(403).json({ error: "Project not found or access denied" });
        }
      }

      // Get existing key
      const { getApiKeyById } = await import("../services/storage/orgsRepo.js");
      const existingKey = await getApiKeyById(keyId);
      
      if (!existingKey || existingKey.org_id !== orgId) {
        return res.status(404).json({ error: "API key not found" });
      }

      if (existingKey.revoked_at) {
        return res.status(400).json({ error: "API key is already revoked" });
      }

      // Create new key with same properties
      const { createApiKey } = await import("../services/storage/orgsRepo.js");
      const { key: newKey, apiKey: newApiKey } = await createApiKey(
        orgId,
        finalProjectId,
        existingKey.name ? `${existingKey.name} (rotated)` : null,
        existingKey.scopes || [],
        existingKey.expires_at,
        existingKey.allowed_ip_ranges,
        existingKey.allowed_origins,
        existingKey.description
      );

      // Revoke old key
      const { revokeApiKey } = await import("../services/storage/orgsRepo.js");
      await revokeApiKey(keyId, true); // byId = true

      // Enterprise Security: Audit log
      await audit(req, "KEY_ROTATED", {
        projectId: finalProjectId,
        targetType: "API_KEY",
        targetId: keyId,
        metadata: {
          old_key_id: keyId,
          new_key_id: newApiKey.id,
          name: existingKey.name,
        },
      });

      res.json({
        id: newApiKey.id,
        key: newKey, // Only returned once
        name: newApiKey.name,
        message: "API key rotated successfully. Save the new key - it won't be shown again!",
      });
    } catch (error: any) {
      safeLog("error", "Rotate API key error", { error: error.message });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
);

/**
 * GET /v1/auth/api-keys
 * 
 * List API keys (requires auth - Supabase JWT or API key)
 */
authRouter.get("/api-keys", async (req: AuthenticatedRequest, res) => {
  try {
    let orgId: string | null = null;

    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    safeLog("info", "GET /api-keys auth check", { 
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 20) || "none",
      hasApiKeyHeader: !!req.headers["x-spectyra-api-key"]
    });
    
    if (authHeader && authHeader.startsWith("Bearer ")) {
      let jwtAuthSucceeded = false;
      let middlewareCompleted = false;
      
      // Wrap requireUserSession in a promise to handle the middleware pattern
      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          // This callback is executed when JWT verification succeeds (next() is called)
          jwtAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };
        
        requireUserSession(req, res, nextCallback)
          .then(() => {
            // Middleware Promise resolved - check if next() was called
            if (!middlewareCompleted) {
              // Middleware completed without calling next() - response was sent (error case)
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            // Error in middleware - response already sent
            middlewareCompleted = true;
            resolve();
          });
      });
      
      // If JWT auth succeeded and no response was sent yet, get orgId
      if (jwtAuthSucceeded && !res.headersSent) {
        if (!req.auth?.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const { queryOne } = await import("../services/storage/db.js");
        const membership = await queryOne<{ org_id: string }>(`
          SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
        `, [req.auth.userId]);

        if (!membership) {
          return res.status(404).json({ error: "Organization not found" });
        }

        orgId = membership.org_id;
      }
      
      // If response was already sent (error case from middleware), return early
      if (res.headersSent) {
        return;
      }
    }

    // Fall back to API key auth (only if no response was sent)
    if (!orgId && !res.headersSent) {
      let apiKeyAuthSucceeded = false;
      let middlewareCompleted = false;
      
      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          apiKeyAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };
        
        requireSpectyraApiKey(req, res, nextCallback)
          .then(() => {
            if (!middlewareCompleted) {
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            middlewareCompleted = true;
            resolve();
          });
      });
      
      if (apiKeyAuthSucceeded && !res.headersSent && req.context) {
        orgId = req.context.org.id;
      }
      
      if (res.headersSent) {
        return;
      }
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const keys = await getOrgApiKeys(orgId, false);
    
    // Don't return key hashes, just metadata
    res.json(keys.map(k => ({
      id: k.id,
      name: k.name,
      project_id: k.project_id,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
    })));
  } catch (error: any) {
    if (!res.headersSent) {
      safeLog("error", "List API keys error", { error: error.message });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});

/**
 * DELETE /v1/auth/api-keys/:id
 * 
 * Revoke an API key (requires auth - Supabase JWT or API key)
 */
authRouter.delete("/api-keys/:id", async (req: AuthenticatedRequest, res) => {
  try {
    let orgId: string | null = null;

    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        await requireUserSession(req, res, async () => {
          if (!req.auth?.userId) {
            return res.status(401).json({ error: "Not authenticated" });
          }

          const { queryOne } = await import("../services/storage/db.js");
          const membership = await queryOne<{ org_id: string }>(`
            SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
          `, [req.auth.userId]);

          if (!membership) {
            return res.status(404).json({ error: "Organization not found" });
          }

          orgId = membership.org_id;
        });
        if (res.headersSent) return;
      } catch (jwtError) {
        // Fall through to API key
      }
    }

    // Fall back to API key auth
    if (!orgId) {
      await requireSpectyraApiKey(req, res, async () => {
        if (!req.context) {
          return res.status(401).json({ error: "Not authenticated" });
        }
        orgId = req.context.org.id;
      });
      if (res.headersSent) return;
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Get the key to verify it belongs to this org
    const keyId = req.params.id;
    const { getApiKeyById } = await import("../services/storage/orgsRepo.js");
    const apiKey = await getApiKeyById(keyId);
    
    if (!apiKey || apiKey.org_id !== orgId) {
      return res.status(404).json({ error: "API key not found" });
    }
    
    // Revoke the key
    const { revokeApiKey } = await import("../services/storage/orgsRepo.js");
    await revokeApiKey(keyId, true); // byId = true
    
    // Enterprise Security: Audit log
    await audit(req, "KEY_REVOKED", {
      targetType: "API_KEY",
      targetId: keyId,
    });
    
    res.json({ success: true });
  } catch (error: any) {
    safeLog("error", "Delete API key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/auth/org
 * 
 * Update organization name (requires auth)
 */
authRouter.patch("/org", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const orgId = req.context.org.id;
    const { name } = req.body as { name?: string };
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: "Organization name is required" });
    }
    
    try {
      const updatedOrg = await updateOrgName(orgId, name);
      res.json({
        success: true,
        org: {
          id: updatedOrg.id,
          name: updatedOrg.name,
          trial_ends_at: updatedOrg.trial_ends_at,
          subscription_status: updatedOrg.subscription_status,
        },
      });
    } catch (updateError: any) {
      safeLog("error", "Update org failed", { orgId, error: updateError.message });
      return res.status(400).json({
        error: "Cannot update organization",
        message: updateError.message,
      });
    }
  } catch (error: any) {
    safeLog("error", "Update org endpoint error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * DELETE /v1/auth/org
 * 
 * Delete the current organization and all associated data (requires auth)
 * WARNING: This is irreversible! Deletes org, projects, API keys, runs, and savings data.
 */
authRouter.delete("/org", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const orgId = req.context.org.id;
    const orgName = req.context.org.name;
    
    // Verify org exists
    const org = await getOrgById(orgId);
    if (!org) {
      return res.status(404).json({ 
        error: "Organization not found",
        message: `Organization ${orgId} does not exist`
      });
    }
    
    // Delete the org and all associated data
    try {
      safeLog("info", "Deleting organization", { orgId, orgName: org.name });
      await deleteOrg(orgId);
      safeLog("info", "Organization deleted successfully", { orgId, orgName });
    } catch (deleteError: any) {
      const errorMessage = deleteError.message || "Unknown error";
      safeLog("error", "Delete org failed", { 
        orgId, 
        orgName,
        error: errorMessage,
        stack: deleteError.stack 
      });
      return res.status(400).json({ 
        error: "Cannot delete organization",
        message: errorMessage,
        details: "This may be due to database constraints or missing foreign key relationships. Check server logs for details."
      });
    }
    
    res.json({ 
      success: true,
      message: `Organization "${orgName}" and all associated data deleted successfully`
    });
  } catch (error: any) {
    safeLog("error", "Delete org endpoint error", { 
      error: error.message,
      stack: error.stack 
    });
    res.status(500).json({ 
      error: "Internal server error",
      message: error.message || "An unexpected error occurred while deleting the organization"
    });
  }
});
