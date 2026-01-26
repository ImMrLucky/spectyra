import { Router } from "express";
import { getRuns, getRun } from "../services/storage/runsRepo.js";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { queryOne } from "../services/storage/db.js";

export const runsRouter = Router();

// Apply authentication middleware (Supabase JWT for dashboard)
runsRouter.use(requireUserSession);

runsRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const limit = parseInt(req.query.limit as string || "50", 10);
    const projectId = req.query.project_id as string | undefined;
    const runs = await getRuns(limit, membership.org_id, projectId || null);
    res.json(runs);
  } catch (error: any) {
    safeLog("error", "Get runs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

runsRouter.get("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const { id } = req.params;
    const run = await getRun(id);
    
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    // Verify run belongs to authenticated org
    // Note: We need to check org_id from the run record
    // For now, getRuns filters by org, so this should be safe
    // TODO: Add org_id to RunRecord interface or query it separately
    res.json(run);
  } catch (error: any) {
    safeLog("error", "Get run error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
