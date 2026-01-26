import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireActiveAccess } from "../middleware/trialGate.js";
import { providerRegistry } from "../services/llm/providerRegistry.js";
import { createProviderWithKey } from "../services/llm/providerFactory.js";
import { runOptimizedOrBaseline } from "../services/optimizer/optimizer.js";
import { createOptimizerProvider } from "../services/optimizer/providerAdapter.js";
import { getEmbedder } from "../services/embeddings/embedderRegistry.js";
import { makeOptimizerConfig } from "../services/optimizer/config.js";
import { mapOptimizationLevelToConfig, getKeepLastTurns, getCodeSlicerAggressive, type OptimizationLevel } from "../services/optimizer/optimizationLevel.js";
import { estimateCost } from "../utils/costEstimator.js";
import { checkQuality } from "../services/optimizer/quality/qualityGuard.js";
import { saveRun } from "../services/storage/runsRepo.js";
import type { OptimizationLevel } from "../services/optimizer/optimizationLevel.js";
import { computeWorkloadKey, computePromptHash } from "../services/savings/workloadKey.js";
import { writeEstimatedSavings } from "../services/savings/ledgerWriter.js";
import { redactRun } from "../middleware/redact.js";
import { safeLog } from "../utils/redaction.js";
import type { RunRecord, Message, Path, Mode } from "@spectyra/shared";
import type { ChatMessage } from "../services/optimizer/unitize.js";
import {
  estimateBaselineTokens,
  estimateOptimizedTokens,
  getPricingConfig,
} from "../services/proof/tokenEstimator.js";
import { confidenceToBand } from "../services/savings/confidence.js";

export const chatRouter = Router();

// Apply authentication middleware to all chat routes
chatRouter.use(requireSpectyraApiKey);
chatRouter.use(optionalProviderKey);
// Require active access (trial or subscription) for live provider calls
chatRouter.use(requireActiveAccess);

chatRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { path, conversation_id, provider, model, messages, mode, optimization_level, dry_run } = req.body as {
      path: Path;
      conversation_id?: string;
      provider: string;
      model: string;
      messages: Message[];
      mode: Mode;
      optimization_level?: number;
      dry_run?: boolean;
    };
    
    if (!path || !provider || !model || !messages || !mode) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // BYOK (Bring Your Own Key): Use provider key from context (ephemeral, never stored)
    // If provided, create provider with user's key; otherwise use default from env
    const providerKeyOverride = req.context?.providerKeyOverride;
    let llmProvider;
    
    if (providerKeyOverride) {
      // Create provider with user's API key (BYOK)
      llmProvider = createProviderWithKey(provider, providerKeyOverride);
      if (!llmProvider) {
        return res.status(400).json({ error: `Provider ${provider} not supported for BYOK` });
      }
    } else {
      // Use default provider from registry (env vars)
      llmProvider = providerRegistry.get(provider);
      if (!llmProvider) {
        return res.status(400).json({ error: `Provider ${provider} not available. Provide X-PROVIDER-KEY header for BYOK.` });
      }
    }
    
    // Convert Message[] to ChatMessage[]
    const chatMessages: ChatMessage[] = messages.map(m => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));
    
    // Create optimizer provider adapter
    const optimizerProvider = createOptimizerProvider(llmProvider);
    
    // Get embedder
    const embedder = getEmbedder("openai");
    
    // Get base config and apply optimization level if provided
    const baseConfig = makeOptimizerConfig();
    const optimizationLevel = optimization_level ?? 2; // default to 2
    const cfg = mapOptimizationLevelToConfig(path as "talk" | "code", optimizationLevel, baseConfig);
    
    // Handle dry-run mode (no real LLM calls)
    if (dry_run === true) {
      // Run optimizer pipeline to get optimized prompt (but don't call provider)
      const result = await runOptimizedOrBaseline({
        mode: "optimized",
        path: path as "talk" | "code",
        conversationId: conversation_id,
        model,
        provider: optimizerProvider,
        embedder,
        messages: chatMessages,
        turnIndex: Date.now(),
        dryRun: true,
      }, cfg);
      
      // Estimate baseline tokens
      const pricing = getPricingConfig(provider);
      const baselineEstimate = estimateBaselineTokens(chatMessages, provider, pricing);
      
      // Estimate optimized tokens
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
      
      // Get confidence (for estimated savings, use medium confidence in dry-run)
      const confidenceBand = "Medium"; // Dry-run estimates are always medium confidence
      
      // Build explanation summary (generic, no moat internals)
      const explanationParts: string[] = [];
      if (result.debug.refsUsed && result.debug.refsUsed.length > 0) {
        explanationParts.push("Stable context compacted");
      }
      if (result.debug.deltaUsed) {
        explanationParts.push("Delta prompting");
      }
      if (path === "code" && result.debug.codeSliced) {
        explanationParts.push("Code slicing + patch mode");
      }
      if (result.debug.patchMode) {
        explanationParts.push("Patch mode");
      }
      explanationParts.push("Output budget enforcement");
      
      return res.json({
        run_id: uuidv4(),
        created_at: new Date().toISOString(),
        mode: "optimized",
        path,
        optimization_level: optimizationLevel,
        provider,
        model,
        response_text: "DRY_RUN: No provider call made. See baseline_estimate and optimized_estimate for token/cost projections.",
        usage: {
          input_tokens: optimizedEstimate.input_tokens,
          output_tokens: optimizedEstimate.output_tokens,
          total_tokens: optimizedEstimate.total_tokens,
        },
        cost_usd: optimizedEstimate.cost_usd,
        savings: {
          savings_type: "estimated",
          tokens_saved: tokensSaved,
          pct_saved: pctSaved,
          cost_saved_usd: costSaved,
          confidence_band: confidenceBand.toLowerCase() as "high" | "medium" | "low",
        },
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
        explanation_summary: explanationParts.join(", "),
      });
    }
    
    // Run optimizer (real mode)
    const result = await runOptimizedOrBaseline({
      mode,
      path: path as "talk" | "code",
      conversationId: conversation_id,
      model,
      provider: optimizerProvider,
      embedder,
      messages: chatMessages,
      turnIndex: Date.now(), // TODO: track per conversation
    }, cfg);
    
    // Ensure we have usage
    const usage = result.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated: true,
    };
    
    // Estimate cost
    const costUsd = estimateCost(usage, provider);
    
    // Quality check (if scenario provided)
    const quality = { pass: true, failures: [] };
    
    // Build spectral debug info
    const spectralDebug = result.spectral ? {
      nNodes: result.spectral.nNodes,
      nEdges: result.spectral.nEdges,
      stabilityIndex: result.spectral.stabilityIndex,
      lambda2: result.spectral.lambda2,
      contradictionEnergy: result.spectral.contradictionEnergy,
      recommendation: result.spectral.recommendation,
      stableNodeIdx: result.spectral.stableNodeIdx,
      unstableNodeIdx: result.spectral.unstableNodeIdx,
    } : undefined;
    
    // Compute workload key and prompt hash
    const promptLength = JSON.stringify(result.promptFinal.messages).length;
    const workloadKey = computeWorkloadKey({
      path: path as "talk" | "code",
      provider,
      model,
      promptLength,
    });
    const promptHash = computePromptHash(result.promptFinal.messages);
    
    // Store debug internals separately (use result.debugInternal if available, otherwise build it)
    const debugInternal = result.debugInternal || {
      mode: result.debug.mode || "optimized",
      ...result.debug,
      spectral: result.spectral ? {
        nNodes: result.spectral.nNodes,
        nEdges: result.spectral.nEdges,
        lambda2: result.spectral.lambda2,
        contradictionEnergy: result.spectral.contradictionEnergy,
        stabilityIndex: result.spectral.stabilityIndex,
        recommendation: result.spectral.recommendation,
        stableCount: result.spectral.stableNodeIdx?.length || 0,
        unstableCount: result.spectral.unstableNodeIdx?.length || 0,
        ...(result.spectral._internal || {}),
      } : undefined,
      cacheHit: false,
      driftScore: undefined,
    };
    
    // Create run record
    const run: RunRecord = {
      id: uuidv4(),
      scenarioId: undefined,
      conversationId: conversation_id,
      mode,
      path,
      provider,
      model,
      promptFinal: result.promptFinal.messages,
      responseText: result.responseText,
      usage,
      costUsd,
      quality,
      debug: {
        ...result.debug,
        spectral: spectralDebug,
      },
      createdAt: new Date().toISOString(),
    };
    
    const runId = run.id;
    const optLevel = (optimizationLevel ?? 2) as OptimizationLevel;
    
    // Save to database with org/project context
    saveRun({ 
      ...run, 
      optimizationLevel: optLevel,
      workloadKey,
      promptHash,
      debugInternal,
      orgId: req.context?.org.id,
      projectId: req.context?.project?.id || null,
      providerKeyFingerprint: req.context?.providerKeyFingerprint || null,
    });
    
    // For optimized runs without baseline, write estimated savings
    if (mode === "optimized") {
      writeEstimatedSavings(
        workloadKey,
        path,
        provider,
        model,
        optLevel,
        runId,
        usage.total_tokens,
        costUsd,
        req.context?.org.id,
        req.context?.project?.id || null
      );
    }
    
    // Redact internal data before sending to client
    const safeRun = redactRun(run);
    
    res.json({
      ...safeRun,
      // Only include debug if explicitly enabled
      ...(process.env.EXPOSE_INTERNAL_DEBUG === "true" ? {
        optimizer_debug: result.debug,
        spectral_debug: spectralDebug,
      } : {}),
    });
  } catch (error: any) {
    safeLog("error", "Chat error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
