import { Router } from "express";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { resolveOptimizerProvider } from "../services/llm/providerResolver.js";
import { createOptimizerProvider } from "../services/optimizer/providerAdapter.js";
import { getEmbedder } from "../services/embeddings/embedderRegistry.js";
import { makeOptimizerConfig } from "../services/optimizer/config.js";
import { mapOptimizationLevelToConfig, type OptimizationLevel } from "../services/optimizer/optimizationLevel.js";
import { runOptimizedOrBaseline } from "../services/optimizer/optimizer.js";
import type { Message, Path } from "@spectyra/shared";
import type { ChatMessage } from "../services/optimizer/unitize.js";
import {
  estimateBaselineTokens,
  estimateOptimizedTokens,
  getPricingConfig,
} from "../services/proof/tokenEstimator.js";
import { safeLog } from "../utils/redaction.js";

export const proofRouter = Router();

// Apply authentication middleware
proofRouter.use(requireSpectyraApiKey);
proofRouter.use(optionalProviderKey);

/**
 * POST /v1/proof/estimate
 * 
 * Estimates savings for a pasted conversation without making real LLM calls.
 * Used for proof/demo purposes.
 */
proofRouter.post("/estimate", async (req: AuthenticatedRequest, res) => {
  try {
    const { path, provider, model, optimization_level, messages } = req.body as {
      path: Path;
      provider: string;
      model: string;
      optimization_level?: number;
      messages: Message[];
    };
    
    if (!path || !provider || !model || !messages) {
      return res.status(400).json({ error: "Missing required fields: path, provider, model, messages" });
    }
    
    // For proof/estimation mode, we use optimizer provider resolution
    // which allows env keys since no actual LLM API calls are made (dryRun mode).
    // This is for optimizer internal use (embeddings, model config), not customer LLM calls.
    const providerResolution = await resolveOptimizerProvider(provider);
    if (!providerResolution.provider) {
      return res.status(providerResolution.statusCode || 400).json({ 
        error: providerResolution.error || `Provider ${provider} not available` 
      });
    }
    const llmProvider = providerResolution.provider;
    
    // Convert messages
    const chatMessages: ChatMessage[] = messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
    
    // Create optimizer provider adapter (won't be called in dry-run)
    const optimizerProvider = createOptimizerProvider(llmProvider);
    const embedder = getEmbedder("openai");
    
    // Get config
    const baseConfig = makeOptimizerConfig();
    const optimizationLevel = (optimization_level ?? 2) as OptimizationLevel;
    const cfg = mapOptimizationLevelToConfig(path as "talk" | "code", optimizationLevel, baseConfig);
    
    // Run optimizer pipeline (dry-run - no actual LLM call)
    const result = await runOptimizedOrBaseline({
      mode: "optimized",
      path: path as "talk" | "code",
      conversationId: undefined,
      model,
      provider: optimizerProvider,
      embedder,
      messages: chatMessages,
      turnIndex: Date.now(),
      dryRun: true, // Skip provider call
    }, cfg);
    
    // Estimate tokens and cost
    const pricing = getPricingConfig(provider);
    const baselineEstimate = estimateBaselineTokens(chatMessages, provider, pricing);
    const optimizedEstimate = estimateOptimizedTokens(
      result.promptFinal.messages,
      path as "talk" | "code",
      optimizationLevel,
      provider,
      pricing
    );
    
    // Calculate savings
    const tokensSaved = baselineEstimate.total_tokens - optimizedEstimate.total_tokens;
    const pctSaved = baselineEstimate.total_tokens > 0 
      ? (tokensSaved / baselineEstimate.total_tokens) * 100 
      : 0;
    const costSaved = baselineEstimate.cost_usd - optimizedEstimate.cost_usd;
    
    // Build explanation summary (generic only, no moat internals)
    const explanationParts: string[] = [];
    if (result.debug.refsUsed && result.debug.refsUsed.length > 0) {
      explanationParts.push("Stable context compacted");
    }
    if (result.debug.deltaUsed) {
      explanationParts.push("Delta prompting");
    }
    if (path === "code") {
      if (result.debug.codeSliced) {
        explanationParts.push("Code slicing + patch mode");
      } else if (result.debug.patchMode) {
        explanationParts.push("Patch mode");
      }
    }
    explanationParts.push("Output budget enforcement");
    
    res.json({
      baseline_estimate: {
        input_tokens: baselineEstimate.input_tokens,
        output_tokens: baselineEstimate.output_tokens,
        total_tokens: baselineEstimate.total_tokens,
        cost_usd: baselineEstimate.cost_usd,
      },
      optimized_estimate: {
        input_tokens: optimizedEstimate.input_tokens,
        output_tokens: optimizedEstimate.output_tokens,
        total_tokens: optimizedEstimate.total_tokens,
        cost_usd: optimizedEstimate.cost_usd,
      },
      savings: {
        tokens_saved: tokensSaved,
        pct_saved: pctSaved,
        cost_saved_usd: costSaved,
      },
      confidence_band: "medium", // Estimated savings in proof mode
      explanation_summary: explanationParts.join(", "),
    });
  } catch (error: any) {
    safeLog("error", "Proof estimate error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
