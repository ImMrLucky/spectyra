import { Router } from "express";
import { providerRegistry } from "../services/llm/providerRegistry.js";
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

export const proofRouter = Router();

/**
 * POST /v1/proof/estimate
 * 
 * Estimates savings for a pasted conversation without making real LLM calls.
 * Used for proof/demo purposes.
 */
proofRouter.post("/estimate", async (req, res) => {
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
    
    const llmProvider = providerRegistry.get(provider);
    if (!llmProvider) {
      return res.status(400).json({ error: `Provider ${provider} not available` });
    }
    
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
    console.error("Proof estimate error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
