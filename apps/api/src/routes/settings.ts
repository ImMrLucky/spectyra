/**
 * Settings Routes
 * 
 * Enterprise Security: Manage org and project settings
 */

import { Router } from "express";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireOrgRole } from "../middleware/requireRole.js";
import { getOrgSettings, updateOrgSettings, getProjectSettings, updateProjectSettings } from "../services/storage/settingsRepo.js";
import { audit } from "../services/audit/audit.js";
import { safeLog } from "../utils/redaction.js";

export const settingsRouter = Router();

// All routes require authentication and org membership
settingsRouter.use(requireUserSession);
settingsRouter.use(requireOrgMembership);

/**
 * GET /v1/orgs/:orgId/settings
 * 
 * Get org settings
 */
settingsRouter.get("/:orgId/settings", async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const settings = await getOrgSettings(orgId);
    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Get org settings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/orgs/:orgId/settings
 * 
 * Update org settings (OWNER/ADMIN only)
 */
settingsRouter.patch("/:orgId/settings", requireOrgRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const updates = req.body as Partial<{
      data_retention_days: number;
      store_prompts: boolean;
      store_responses: boolean;
      store_internal_debug: boolean;
      allow_semantic_cache: boolean;
      allowed_ip_ranges: string[];
      enforce_sso: boolean;
      allowed_email_domains: string[];
      provider_key_mode: "BYOK_ONLY" | "VAULT_ONLY" | "EITHER";
    }>;

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const settings = await updateOrgSettings(orgId, updates);

    // Enterprise Security: Audit log
    await audit(req, "SETTINGS_UPDATED", {
      targetType: "ORG_SETTINGS",
      targetId: orgId,
      metadata: { updated_fields: Object.keys(updates) },
    });

    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Update org settings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/projects/:projectId/settings
 * 
 * Get project settings
 */
settingsRouter.get("/projects/:projectId/settings", async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project belongs to user's org
    const { queryOne } = await import("../services/storage/db.js");
    const project = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM projects WHERE id = $1
    `, [projectId]);

    if (!project || project.org_id !== req.auth?.orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const settings = await getProjectSettings(projectId);
    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Get project settings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/projects/:projectId/settings
 * 
 * Update project settings (DEV role or higher)
 */
settingsRouter.patch("/projects/:projectId/settings", requireOrgRole("DEV"), async (req: AuthenticatedRequest, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project belongs to user's org
    const { queryOne } = await import("../services/storage/db.js");
    const project = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM projects WHERE id = $1
    `, [projectId]);

    if (!project || project.org_id !== req.auth?.orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updates = req.body as Partial<{
      allowed_origins: string[];
      rate_limit_rps: number;
      rate_limit_burst: number;
    }>;

    const settings = await updateProjectSettings(projectId, updates);

    // Enterprise Security: Audit log
    await audit(req, "SETTINGS_UPDATED", {
      projectId,
      targetType: "PROJECT_SETTINGS",
      targetId: projectId,
      metadata: { updated_fields: Object.keys(updates) },
    });

    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Update project settings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
