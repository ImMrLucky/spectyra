/**
 * Retention Worker Routes
 * 
 * Enterprise Security: Data retention and cleanup
 * 
 * Protected by internal secret (not public-facing)
 */

import { Router } from "express";
import { query } from "../services/storage/db.js";
import { getOrgSettings } from "../services/storage/settingsRepo.js";
import { systemAudit } from "../services/audit/audit.js";
import { safeLog } from "../utils/redaction.js";

export const retentionRouter = Router();

/**
 * Internal secret for retention worker (cron job)
 */
const RETENTION_SECRET = process.env.RETENTION_SECRET || "change-me-in-production";

/**
 * POST /internal/retention/run
 * 
 * Retention worker endpoint (called by cron)
 * Requires RETENTION_SECRET header
 */
retentionRouter.post("/run", async (req, res) => {
  try {
    // Verify internal secret
    const providedSecret = req.headers["x-retention-secret"] as string | undefined;
    if (!providedSecret || providedSecret !== RETENTION_SECRET) {
      return res.status(403).json({ error: "Invalid retention secret" });
    }

    safeLog("info", "Retention worker started");

    // Get all orgs
    const orgs = await query<{ id: string; name: string }>(`
      SELECT id, name FROM orgs
    `, []);

    let totalRunsDeleted = 0;
    let totalOrgsProcessed = 0;

    for (const org of orgs.rows) {
      try {
        const settings = await getOrgSettings(org.id);
        const retentionDays = settings.data_retention_days;

        if (retentionDays <= 0) {
          // Skip if retention disabled
          continue;
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Delete runs older than retention period
        // Note: This respects store_prompts/store_responses settings (already null if disabled)
        const result = await query(`
          DELETE FROM runs
          WHERE org_id = $1
            AND created_at < $2
        `, [org.id, cutoffDate.toISOString()]);

        const deleted = result.rowCount || 0;
        totalRunsDeleted += deleted;
        totalOrgsProcessed++;

        if (deleted > 0) {
          safeLog("info", "Retention applied", {
            orgId: org.id,
            orgName: org.name,
            deleted,
            retentionDays,
          });

          // Audit log
          await systemAudit(org.id, "RETENTION_APPLIED", {
            metadata: {
              deleted_runs: deleted,
              retention_days: retentionDays,
              cutoff_date: cutoffDate.toISOString(),
            },
          });
        }
      } catch (error: any) {
        safeLog("error", "Retention error for org", {
          orgId: org.id,
          error: error.message,
        });
        // Continue with other orgs
      }
    }

    safeLog("info", "Retention worker completed", {
      totalOrgsProcessed,
      totalRunsDeleted,
    });

    res.json({
      success: true,
      total_orgs_processed: totalOrgsProcessed,
      total_runs_deleted: totalRunsDeleted,
    });
  } catch (error: any) {
    safeLog("error", "Retention worker error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
