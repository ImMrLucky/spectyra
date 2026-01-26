import { Router } from "express";
import { getDb } from "../services/storage/db.js";
import { requireAdminToken } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";

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
    const { redactSecrets } = await import("../utils/redaction.js");
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
