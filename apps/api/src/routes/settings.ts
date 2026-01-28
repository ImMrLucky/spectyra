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
import type { OrgSettingsDTO, ProjectSettingsDTO } from "@spectyra/shared";

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

    const settingsRow = await getOrgSettings(orgId);
    // Convert Row to DTO (omit IDs and timestamps)
    const settings: OrgSettingsDTO = {
      data_retention_days: settingsRow.data_retention_days,
      store_prompts: settingsRow.store_prompts,
      store_responses: settingsRow.store_responses,
      store_internal_debug: settingsRow.store_internal_debug,
      allow_semantic_cache: settingsRow.allow_semantic_cache,
      allowed_ip_ranges: settingsRow.allowed_ip_ranges,
      enforce_sso: settingsRow.enforce_sso,
      allowed_email_domains: settingsRow.allowed_email_domains,
      provider_key_mode: settingsRow.provider_key_mode,
    };
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

    const updatedRow = await updateOrgSettings(orgId, updates);

    // Enterprise Security: Audit log
    await audit(req, "SETTINGS_UPDATED", {
      targetType: "ORG_SETTINGS",
      targetId: orgId,
      metadata: { updated_fields: Object.keys(updates) },
    });

    // Convert Row to DTO (omit IDs and timestamps)
    const settings: OrgSettingsDTO = {
      data_retention_days: updatedRow.data_retention_days,
      store_prompts: updatedRow.store_prompts,
      store_responses: updatedRow.store_responses,
      store_internal_debug: updatedRow.store_internal_debug,
      allow_semantic_cache: updatedRow.allow_semantic_cache,
      allowed_ip_ranges: updatedRow.allowed_ip_ranges,
      enforce_sso: updatedRow.enforce_sso,
      allowed_email_domains: updatedRow.allowed_email_domains,
      provider_key_mode: updatedRow.provider_key_mode,
    };
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

    const settingsRow = await getProjectSettings(projectId);
    // Convert Row to DTO (omit IDs and timestamps)
    const settings: ProjectSettingsDTO = {
      allowed_origins: settingsRow.allowed_origins,
      rate_limit_rps: settingsRow.rate_limit_rps,
      rate_limit_burst: settingsRow.rate_limit_burst,
    };
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

    const updatedRow = await updateProjectSettings(projectId, updates);

    // Enterprise Security: Audit log
    await audit(req, "SETTINGS_UPDATED", {
      projectId,
      targetType: "PROJECT_SETTINGS",
      targetId: projectId,
      metadata: { updated_fields: Object.keys(updates) },
    });

    // Convert Row to DTO (omit IDs and timestamps)
    const settings: ProjectSettingsDTO = {
      allowed_origins: updatedRow.allowed_origins,
      rate_limit_rps: updatedRow.rate_limit_rps,
      rate_limit_burst: updatedRow.rate_limit_burst,
    };
    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Update project settings error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
