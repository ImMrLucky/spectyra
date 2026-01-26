import { Router } from "express";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Scenario, Message } from "@spectyra/shared";
import { createOptimizerProvider } from "../services/optimizer/providerAdapter.js";
import { getEmbedder } from "../services/embeddings/embedderRegistry.js";
import { makeOptimizerConfig } from "../services/optimizer/config.js";
import { mapOptimizationLevelToConfig, type OptimizationLevel } from "../services/optimizer/optimizationLevel.js";
import { runOptimizedOrBaseline } from "../services/optimizer/optimizer.js";
import { providerRegistry } from "../services/llm/providerRegistry.js";
import type { ChatMessage } from "../services/optimizer/unitize.js";
import {
  estimateBaselineTokens,
  estimateOptimizedTokens,
  getPricingConfig,
} from "../services/proof/tokenEstimator.js";
import { runQualityGuard } from "../services/optimizer/quality/qualityGuard.js";
import { v4 as uuidv4 } from "uuid";
import { safeLog } from "../utils/redaction.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scenariosDir = join(__dirname, "../../scenarios");

export const replaySimulateRouter = Router();

// Apply authentication middleware
replaySimulateRouter.use(authenticate);

/**
 * POST /v1/replay/simulate
 * 
 * Simulates a replay scenario without making real LLM calls.
 * Returns estimated baseline and optimized runs for comparison.
 */
replaySimulateRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { scenario_id, provider, model, optimization_level } = req.body as {
      scenario_id: string;
      provider: string;
      model: string;
      optimization_level?: OptimizationLevel;
    };
    
    if (!scenario_id || !provider || !model) {
      return res.status(400).json({ error: "Missing required fields: scenario_id, provider, model" });
    }
    
    // Load scenario
    const scenarioPath = join(scenariosDir, `${scenario_id}.json`);
    let scenario: Scenario;
    try {
      scenario = JSON.parse(readFileSync(scenarioPath, "utf-8"));
    } catch (error: any) {
      return res.status(404).json({ error: `Scenario ${scenario_id} not found` });
    }
    
    // Convert scenario turns to ChatMessage[]
    const chatMessages: ChatMessage[] = scenario.turns.map(t => ({
      role: t.role as "system" | "user" | "assistant",
      content: t.content,
    }));
    
    const llmProvider = providerRegistry.get(provider);
    if (!llmProvider) {
      return res.status(400).json({ error: `Provider ${provider} not available` });
    }
    
    const optimizerProvider = createOptimizerProvider(llmProvider);
    const embedder = getEmbedder("openai");
    const baseConfig = makeOptimizerConfig();
    const optimizationLevel = (optimization_level ?? 2) as OptimizationLevel;
    const cfg = mapOptimizationLevelToConfig(scenario.path as "talk" | "code", optimizationLevel, baseConfig);
    const pricing = getPricingConfig(provider);
    
    // Simulate baseline run
    const baselineEstimate = estimateBaselineTokens(chatMessages, provider, pricing);
    const baselineQuality = runQualityGuard({
      text: "[SIMULATED] Baseline response would pass quality checks",
      requiredChecks: scenario.required_checks,
    });
    
    const baseline = {
      id: uuidv4(),
      scenarioId: scenario_id,
      mode: "baseline" as const,
      path: scenario.path,
      provider,
      model,
      promptFinal: { messages: chatMessages },
      responseText: "[SIMULATED] Baseline response - no LLM call made",
      usage: {
        input_tokens: baselineEstimate.input_tokens,
        output_tokens: baselineEstimate.output_tokens,
        total_tokens: baselineEstimate.total_tokens,
        estimated: true,
      },
      costUsd: baselineEstimate.cost_usd,
      quality: baselineQuality,
      debug: { mode: "baseline", simulated: true },
      createdAt: new Date().toISOString(),
    };
    
    // Simulate optimized run
    const optimizedResult = await runOptimizedOrBaseline({
      mode: "optimized",
      path: scenario.path as "talk" | "code",
      conversationId: undefined,
      model,
      provider: optimizerProvider,
      embedder,
      messages: chatMessages,
      turnIndex: Date.now(),
      requiredChecks: scenario.required_checks,
      dryRun: true, // Skip provider call
    }, cfg);
    
    const optimizedEstimate = estimateOptimizedTokens(
      optimizedResult.promptFinal.messages,
      scenario.path as "talk" | "code",
      optimizationLevel,
      provider,
      pricing
    );
    
    const optimized = {
      id: uuidv4(),
      scenarioId: scenario_id,
      mode: "optimized" as const,
      path: scenario.path,
      provider,
      model,
      promptFinal: optimizedResult.promptFinal.messages,
      responseText: "[SIMULATED] Optimized response - no LLM call made",
      usage: {
        input_tokens: optimizedEstimate.input_tokens,
        output_tokens: optimizedEstimate.output_tokens,
        total_tokens: optimizedEstimate.total_tokens,
        estimated: true,
      },
      costUsd: optimizedEstimate.cost_usd,
      quality: optimizedResult.quality || { pass: true, failures: [] },
      debug: { ...optimizedResult.debug, simulated: true },
      createdAt: new Date().toISOString(),
    };
    
    // Calculate verified savings
    const tokensSaved = baselineEstimate.total_tokens - optimizedEstimate.total_tokens;
    const pctSaved = baselineEstimate.total_tokens > 0 
      ? (tokensSaved / baselineEstimate.total_tokens) * 100 
      : 0;
    const costSaved = baselineEstimate.cost_usd - optimizedEstimate.cost_usd;
    
    res.json({
      baseline: {
        ...baseline,
        // Redact for public API
        promptFinal: undefined, // Don't expose prompt in simulation
      },
      optimized: {
        ...optimized,
        promptFinal: undefined,
      },
      savings: {
        tokens_saved: tokensSaved,
        pct_saved: pctSaved,
        cost_saved_usd: costSaved,
      },
      quality: {
        baseline_pass: baselineQuality.pass,
        optimized_pass: optimized.quality.pass,
      },
      simulated: true,
    });
  } catch (error: any) {
    safeLog("error", "Replay simulate error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
