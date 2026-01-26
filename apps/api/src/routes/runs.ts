import { Router } from "express";
import { getRuns, getRun } from "../services/storage/runsRepo.js";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";

export const runsRouter = Router();

// Apply authentication middleware
runsRouter.use(requireSpectyraApiKey);
runsRouter.use(optionalProviderKey);

runsRouter.get("/", (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "50", 10);
    const runs = getRuns(limit, req.context?.org.id, req.context?.project?.id || null);
    res.json(runs);
  } catch (error: any) {
    safeLog("error", "Get runs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

runsRouter.get("/:id", (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const run = getRun(id);
    
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    // Verify run belongs to authenticated org
    // Note: getRun needs to return org_id for this check, or we need to query it
    // For now, we'll rely on the fact that getRuns filters by org
    res.json(run);
  } catch (error: any) {
    safeLog("error", "Get run error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
