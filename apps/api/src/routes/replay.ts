import { Router } from "express";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.js";
import { providerRegistry } from "../services/llm/providerRegistry.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Scenario, RunRecord, ReplayResult, Message } from "@spectyra/shared";
import { v4 as uuidv4 } from "uuid";
import { saveRun, saveReplay } from "../services/storage/runsRepo.js";
import { estimateCost } from "../utils/costEstimator.js";
import { runQualityGuard } from "../services/optimizer/quality/qualityGuard.js";
import { runOptimizedOrBaseline } from "../services/optimizer/optimizer.js";
import { createOptimizerProvider } from "../services/optimizer/providerAdapter.js";
import { getEmbedder } from "../services/embeddings/embedderRegistry.js";
import { makeOptimizerConfig } from "../services/optimizer/config.js";
import { mapOptimizationLevelToConfig, getKeepLastTurns, getCodeSlicerAggressive, type OptimizationLevel } from "../services/optimizer/optimizationLevel.js";
import type { ChatMessage } from "../services/optimizer/unitize.js";
import { computeWorkloadKey, computePromptHash } from "../services/savings/workloadKey.js";
import { writeVerifiedSavings } from "../services/savings/ledgerWriter.js";
import { redactReplayResult } from "../middleware/redact.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scenariosDir = join(__dirname, "../../scenarios");

export const replayRouter = Router();

// Apply authentication middleware
replayRouter.use(authenticate);

replayRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { scenario_id, provider, model, optimization_level } = req.body as {
      scenario_id: string;
      provider: string;
      model: string;
      optimization_level?: OptimizationLevel;
    };
    
    if (!scenario_id || !provider || !model) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    // Load scenario
    const scenarioPath = join(scenariosDir, `${scenario_id}.json`);
    const scenarioContent = readFileSync(scenarioPath, "utf-8");
    const scenario: Scenario = JSON.parse(scenarioContent);
    
    // Get provider
    const llmProvider = providerRegistry.get(provider);
    if (!llmProvider) {
      return res.status(400).json({ error: `Provider ${provider} not available` });
    }
    
    // Convert scenario turns to messages
    const messages: Message[] = scenario.turns.map(t => ({
      role: t.role,
      content: t.content,
    }));
    
    // Convert to ChatMessage[]
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
    const cfg = mapOptimizationLevelToConfig(scenario.path as "talk" | "code", optimizationLevel, baseConfig);
    
    // Run baseline
    const baselineResult = await runOptimizedOrBaseline({
      mode: "baseline",
      path: scenario.path as "talk" | "code",
      model,
      provider: optimizerProvider,
      embedder,
      messages: chatMessages,
      turnIndex: Date.now(),
    }, cfg);
    
    const baselineUsage = baselineResult.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated: true,
    };
    const baselineCost = estimateCost(baselineUsage, provider);
    const baselineQuality = checkQuality(baselineResult.responseText, scenario.required_checks);
    
    // Build spectral debug for baseline (empty)
    const baselineSpectralDebug = baselineResult.spectral ? {
      nNodes: baselineResult.spectral.nNodes,
      nEdges: baselineResult.spectral.nEdges,
      stabilityIndex: baselineResult.spectral.stabilityIndex,
      lambda2: baselineResult.spectral.lambda2,
      contradictionEnergy: baselineResult.spectral.contradictionEnergy,
      recommendation: baselineResult.spectral.recommendation,
      stableUnitIds: baselineResult.spectral.stableNodeIdx.map(() => ""), // empty for baseline
      unstableUnitIds: baselineResult.spectral.unstableNodeIdx.map(() => ""), // empty for baseline
    } : undefined;
    
    // Create replay_id for grouping baseline + optimized
    const replayId = uuidv4();
    
    const baseline: RunRecord = {
      id: uuidv4(),
      scenarioId: scenario_id,
      mode: "baseline",
      path: scenario.path,
      provider,
      model,
      promptFinal: baselineResult.promptFinal.messages,
      responseText: baselineResult.responseText,
      usage: baselineUsage,
      costUsd: baselineCost,
      quality: baselineQuality,
      debug: {
        ...baselineResult.debug,
        spectral: baselineSpectralDebug,
      },
      createdAt: new Date().toISOString(),
    };
    
    saveRun({ ...baseline, replayId, optimizationLevel });
    
    // Run optimized
    const optimizedResult = await runOptimizedOrBaseline({
      mode: "optimized",
      path: scenario.path as "talk" | "code",
      model,
      provider: optimizerProvider,
      embedder,
      messages: chatMessages,
      turnIndex: Date.now(),
    }, cfg);
    
    const optimizedUsage = optimizedResult.usage || {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      estimated: true,
    };
    const optimizedCost = estimateCost(optimizedUsage, provider);
    const optimizedQuality = runQualityGuard({ 
      text: optimizedResult.responseText, 
      requiredChecks: scenario.required_checks 
    });
    
    // Build spectral debug for optimized
    const optimizedSpectralDebug = optimizedResult.spectral ? {
      nNodes: optimizedResult.spectral.nNodes,
      nEdges: optimizedResult.spectral.nEdges,
      stabilityIndex: optimizedResult.spectral.stabilityIndex,
      lambda2: optimizedResult.spectral.lambda2,
      contradictionEnergy: optimizedResult.spectral.contradictionEnergy,
      recommendation: optimizedResult.spectral.recommendation,
      stableUnitIds: optimizedResult.spectral.stableNodeIdx.map(i => `unit_${i}`), // convert indices to IDs
      unstableUnitIds: optimizedResult.spectral.unstableNodeIdx.map(i => `unit_${i}`), // convert indices to IDs
    } : undefined;
    
    const optimizedPromptHash = computePromptHash(optimizedResult.promptFinal.messages);
    // Store debug internals (use result.debugInternal if available, otherwise build it)
    const optimizedDebugInternal = optimizedResult.debugInternal || {
      mode: optimizedResult.debug.mode || "optimized",
      ...optimizedResult.debug,
      spectral: optimizedResult.spectral ? {
        nNodes: optimizedResult.spectral.nNodes,
        nEdges: optimizedResult.spectral.nEdges,
        lambda2: optimizedResult.spectral.lambda2,
        contradictionEnergy: optimizedResult.spectral.contradictionEnergy,
        stabilityIndex: optimizedResult.spectral.stabilityIndex,
        recommendation: optimizedResult.spectral.recommendation,
        stableCount: optimizedResult.spectral.stableNodeIdx?.length || 0,
        unstableCount: optimizedResult.spectral.unstableNodeIdx?.length || 0,
        ...(optimizedResult.spectral._internal || {}),
      } : undefined,
      cacheHit: false,
      driftScore: undefined,
    };
    
    const optimized: RunRecord = {
      id: uuidv4(),
      scenarioId: scenario_id,
      mode: "optimized",
      path: scenario.path,
      provider,
      model,
      promptFinal: optimizedResult.promptFinal.messages,
      responseText: optimizedResult.responseText,
      usage: optimizedUsage,
      costUsd: optimizedCost,
      quality: optimizedQuality,
      debug: {
        ...optimizedResult.debug,
        spectral: optimizedSpectralDebug,
      },
      createdAt: new Date().toISOString(),
    };
    
    const optimizedId = optimized.id;
    saveRun({ 
      ...optimized, 
      replayId, 
      optimizationLevel,
      workloadKey,
      promptHash: optimizedPromptHash,
      debugInternal: optimizedDebugInternal,
    });
    
    // Create replay record
    saveReplay(replayId, scenario_id, workloadKey, scenario.path, optimizationLevel, provider, model, baselineId, optimizedId);
    
    // Write verified savings to ledger
    writeVerifiedSavings(
      replayId,
      workloadKey,
      scenario.path,
      provider,
      model,
      optimizationLevel,
      baselineId,
      optimizedId,
      baselineUsage.total_tokens,
      optimizedUsage.total_tokens,
      baselineCost,
      optimizedCost
    );
    
    // Calculate savings
    const tokensSaved = baselineUsage.total_tokens - optimizedUsage.total_tokens;
    const pctSaved = baselineUsage.total_tokens > 0 
      ? (tokensSaved / baselineUsage.total_tokens) * 100 
      : 0;
    const costSavedUsd = baselineCost - optimizedCost;
    
    optimized.savings = {
      tokensSaved,
      pctSaved,
      costSavedUsd,
    };
    
    const replayResult: ReplayResult = {
      scenario_id,
      baseline,
      optimized,
      savings: {
        tokensSaved,
        pctSaved,
        costSavedUsd,
      },
      quality: {
        baseline_pass: baselineQuality.pass,
        optimized_pass: optimizedQuality.pass,
      },
    };
    
    // Redact internal data before sending to client
    res.json(redactReplayResult(replayResult));
  } catch (error: any) {
    console.error("Replay error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
