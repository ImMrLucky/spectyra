import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { providerRegistry } from "../services/llm/providerRegistry.js";
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
import type { RunRecord, Message, Path, Mode } from "@spectyra/shared";
import type { ChatMessage } from "../services/optimizer/unitize.js";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  try {
    const { path, conversation_id, provider, model, messages, mode, optimization_level } = req.body as {
      path: Path;
      conversation_id?: string;
      provider: string;
      model: string;
      messages: Message[];
      mode: Mode;
      optimization_level?: number;
    };
    
    if (!path || !provider || !model || !messages || !mode) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const llmProvider = providerRegistry.get(provider);
    if (!llmProvider) {
      return res.status(400).json({ error: `Provider ${provider} not available` });
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
    
    // Run optimizer
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
    
    // Store debug internals separately
    const debugInternal = {
      spectral: result.spectral,
      optimizer: result.debug,
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
    
    // Save to database
    saveRun({ 
      ...run, 
      optimizationLevel: optLevel,
      workloadKey,
      promptHash,
      debugInternal,
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
        costUsd
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
    console.error("Chat error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
