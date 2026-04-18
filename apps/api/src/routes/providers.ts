import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RL_STANDARD } from "../middleware/expressRateLimitPresets.js";
import { providerRegistry } from "../services/llm/providerRegistry.js";

export const providersRouter = Router();
providersRouter.use(rateLimit(RL_STANDARD));

providersRouter.get("/", async (req, res) => {
  const providers = await providerRegistry.listProviders();
  res.json(providers);
});
