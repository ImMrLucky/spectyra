import { Router } from "express";
import { getDb } from "../services/storage/db.js";

export const adminRouter = Router();

/**
 * Admin-only debug endpoint.
 * Requires X-ADMIN-TOKEN header matching ADMIN_TOKEN env var.
 * Returns debug_internal_json for a run (contains moat internals).
 * NEVER used by public UI.
 */
adminRouter.get("/runs/:id/debug", (req, res) => {
  try {
    // Check admin token
    const adminToken = req.headers["x-admin-token"];
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken || adminToken !== expectedToken) {
      return res.status(403).json({ error: "Forbidden: Invalid admin token" });
    }
    
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
    
    res.json({
      run_id: row.id,
      debug_internal_json: debugInternal,
    });
  } catch (error: any) {
    console.error("Admin debug error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
