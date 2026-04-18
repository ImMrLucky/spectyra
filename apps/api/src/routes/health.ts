import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_HEALTH } from "../middleware/expressRateLimitPresets.js";

export const healthRouter = Router();
healthRouter.use(rateLimit(RL_HEALTH));

healthRouter.get("/", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
