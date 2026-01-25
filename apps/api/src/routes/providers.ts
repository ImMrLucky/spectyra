import { Router } from "express";
import { providerRegistry } from "../services/llm/providerRegistry.js";

export const providersRouter = Router();

providersRouter.get("/", async (req, res) => {
  const providers = await providerRegistry.listProviders();
  res.json(providers);
});
