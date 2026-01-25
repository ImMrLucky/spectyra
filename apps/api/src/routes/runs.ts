import { Router } from "express";
import { getRuns, getRun } from "../services/storage/runsRepo.js";

export const runsRouter = Router();

runsRouter.get("/", (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string || "50", 10);
    const runs = getRuns(limit);
    res.json(runs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

runsRouter.get("/:id", (req, res) => {
  try {
    const { id } = req.params;
    const run = getRun(id);
    
    if (!run) {
      return res.status(404).json({ error: "Run not found" });
    }
    
    res.json(run);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
