import { Router } from "express";
import { getDb } from "../services/storage/db.js";
import { requireAdminToken } from "../middleware/auth.js";
import { safeLog, redactSecrets } from "../utils/redaction.js";
import {
  getOrgById,
  getAllOrgs,
  deleteOrg,
  updateOrgName,
  getOrgProjects,
  getOrgApiKeys,
} from "../services/storage/orgsRepo.js";

export const adminRouter = Router();

/**
 * Admin-only debug endpoint.
 * Requires X-ADMIN-TOKEN header matching ADMIN_TOKEN env var.
 * Returns debug_internal_json for a run (contains moat internals).
 * NEVER used by public UI.
 * NEVER leaks provider keys.
 */
adminRouter.get("/runs/:id/debug", requireAdminToken, (req, res) => {
  try {
    
    const runId = req.params.id;
    const db = getDb();
    
    const row = db.prepare(`
      SELECT id, debug_internal_json
      FROM runs
      WHERE id = ?
    `).get(runId) as any;
    
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
adminRouter.get("/orgs", requireAdminToken, (req, res) => {
  try {
    const orgs = getAllOrgs();
    
    // Get stats for each org
    const db = getDb();
    const orgsWithStats = orgs.map(org => {
      const projectCount = db.prepare(`
        SELECT COUNT(*) as count FROM projects WHERE org_id = ?
      `).get(org.id) as { count: number };
      
      const apiKeyCount = db.prepare(`
        SELECT COUNT(*) as count FROM api_keys WHERE org_id = ? AND revoked_at IS NULL
      `).get(org.id) as { count: number };
      
      const runCount = db.prepare(`
        SELECT COUNT(*) as count FROM runs WHERE org_id = ?
      `).get(org.id) as { count: number };
      
      return {
        ...org,
        stats: {
          projects: projectCount.count || 0,
          api_keys: apiKeyCount.count || 0,
          runs: runCount.count || 0,
        },
      };
    });
    
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
adminRouter.get("/orgs/:id", requireAdminToken, (req, res) => {
  try {
    const orgId = req.params.id;
    const org = getOrgById(orgId);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const projects = getOrgProjects(orgId);
    const apiKeys = getOrgApiKeys(orgId, false);
    
    const db = getDb();
    const runCount = db.prepare(`
      SELECT COUNT(*) as count FROM runs WHERE org_id = ?
    `).get(orgId) as { count: number };
    
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
        runs: runCount.count || 0,
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
adminRouter.patch("/orgs/:id", requireAdminToken, (req, res) => {
  try {
    const orgId = req.params.id;
    const { name } = req.body as { name?: string };
    
    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ error: "Organization name cannot be empty" });
      }
      
      const updatedOrg = updateOrgName(orgId, name);
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
adminRouter.delete("/orgs/:id", requireAdminToken, (req, res) => {
  try {
    const orgId = req.params.id;
    const org = getOrgById(orgId);
    
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    try {
      deleteOrg(orgId);
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
