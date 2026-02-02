import { Router } from "express";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireActiveAccess, allowEstimatorMode } from "../middleware/trialGate.js";
import { resolveProvider } from "../services/llm/providerResolver.js";
import { hasActiveAccess } from "../services/storage/orgsRepo.js";
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
import { safeLog } from "../utils/redaction.js";
import { 
  estimateBaselineTokens, 
  estimateOptimizedTokens, 
  getPricingConfig 
} from "../services/proof/tokenEstimator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scenariosDir = join(__dirname, "../../scenarios");

export const replayRouter = Router();

// Apply authentication middleware
replayRouter.use(requireSpectyraApiKey);
replayRouter.use(optionalProviderKey);
// Check trial access per-request (estimator mode allowed even if trial expired)

replayRouter.post("/", async (req: AuthenticatedRequest, res) => {
  // Check if estimator mode - if so, allow even if trial expired
  const isEstimatorMode = req.body.proof_mode === "estimator";
  
  if (!isEstimatorMode) {
    // For live mode, require active access
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = req.context.org;
    if (!org || !hasActiveAccess(org)) {
      const trialEnd = org?.trial_ends_at ? new Date(org.trial_ends_at) : null;
      const trialEnded = trialEnd ? trialEnd < new Date() : false;
      
      return res.status(402).json({
        error: "Payment Required",
        message: "Your trial has expired. Use estimator mode for demos, or subscribe for live runs.",
        trial_ended: trialEnded,
        subscription_active: org?.subscription_status === "active",
        billing_url: "/billing",
      });
    }
  }
  
  try {
    const { scenario_id, provider, model, optimization_level, proof_mode } = req.body as {
      scenario_id: string;
      provider: string;
      model: string;
      optimization_level?: OptimizationLevel;
      proof_mode?: "live" | "estimator";
    };
    
    if (!scenario_id || !provider || !model) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const isEstimatorMode = proof_mode === "estimator";
    
    // Load scenario
    const scenarioPath = join(scenariosDir, `${scenario_id}.json`);
    const scenarioContent = readFileSync(scenarioPath, "utf-8");
    const scenario: Scenario = JSON.parse(scenarioContent);
    
    // Enterprise Security: Strict provider key resolution
    // Spectyra NEVER pays for customer LLM tokens in production.
    // Resolution order: 1) BYOK header, 2) Vaulted key, 3) Env fallback (dev only)
    const orgId: string | undefined = req.context?.org?.id ?? req.auth?.orgId;
    const projectId: string | null | undefined = req.context?.project?.id ?? req.auth?.projectId ?? null;
    
    const providerResolution = await resolveProvider({
      orgId,
      projectId,
      byokKey: req.context?.providerKeyOverride,
      providerName: provider,
    });
    
    if (!providerResolution.provider) {
      return res.status(providerResolution.statusCode || 401).json({ 
        error: providerResolution.error || "Provider key required",
        hint: "Provide X-PROVIDER-KEY header (BYOK) or configure a vaulted key for your organization.",
      });
    }
    
    const llmProvider = providerResolution.provider;
    
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
    let baselineResult: any;
    let baselineUsage: any;
    let baselineCost: number;
    let baselineQuality: any;
    
    if (isEstimatorMode) {
      // Estimator mode: estimate tokens without calling provider
      const pricing = getPricingConfig(provider);
      const estimate = estimateBaselineTokens(chatMessages, provider, pricing);
      baselineUsage = {
        input_tokens: estimate.input_tokens,
        output_tokens: estimate.output_tokens,
        total_tokens: estimate.total_tokens,
        estimated: true,
      };
      baselineCost = estimate.cost_usd;
      baselineResult = {
        promptFinal: { messages: chatMessages },
        responseText: "[ESTIMATED] Response would be generated here",
        usage: baselineUsage,
        quality: { pass: true, failures: [] },
        debug: { mode: "baseline", estimated: true }
      };
      baselineQuality = { pass: true, failures: [] };
    } else {
      // Live mode: call actual provider
      baselineResult = await runOptimizedOrBaseline({
        mode: "baseline",
        path: scenario.path as "talk" | "code",
        model,
        provider: optimizerProvider,
        embedder,
        messages: chatMessages,
        turnIndex: Date.now(),
      }, cfg);
      
      baselineUsage = baselineResult.usage || {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated: true,
      };
      baselineCost = estimateCost(baselineUsage, provider);
      baselineQuality = runQualityGuard({
        text: baselineResult.responseText,
        requiredChecks: scenario.required_checks,
      });
    }
    
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
    const baselineId = uuidv4();
    const workloadKey = computeWorkloadKey({
      path: scenario.path as "talk" | "code",
      provider,
      model,
      promptLength: JSON.stringify(chatMessages).length,
      scenarioId: scenario_id,
    });
    
    const baseline: RunRecord = {
      id: baselineId,
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
    
    await saveRun({ 
      ...baseline, 
      replayId, 
      optimizationLevel,
      orgId: req.context?.org.id,
      projectId: req.context?.project?.id || null,
      providerKeyFingerprint: req.context?.providerKeyFingerprint || null,
    });
    
    // Run optimized
    let optimizedResult: any;
    let optimizedUsage: any;
    let optimizedCost: number;
    let optimizedQuality: any;
    
    if (isEstimatorMode) {
      // Estimator mode: run optimizer pipeline but estimate tokens
      optimizedResult = await runOptimizedOrBaseline({
        mode: "optimized",
        path: scenario.path as "talk" | "code",
        model,
        provider: optimizerProvider,
        embedder,
        messages: chatMessages,
        turnIndex: Date.now(),
        dryRun: true, // Skip actual provider call
      }, cfg);
      
      // Estimate tokens for optimized prompt
      const pricing = getPricingConfig(provider);
      const estimate = estimateOptimizedTokens(
        optimizedResult.promptFinal.messages,
        scenario.path as "talk" | "code",
        optimizationLevel,
        provider,
        pricing
      );
      
      optimizedUsage = {
        input_tokens: estimate.input_tokens,
        output_tokens: estimate.output_tokens,
        total_tokens: estimate.total_tokens,
        estimated: true,
      };
      optimizedCost = estimate.cost_usd;
      optimizedResult.responseText = "[ESTIMATED] Optimized response would be generated here";
      optimizedResult.usage = optimizedUsage;
      optimizedQuality = { pass: true, failures: [] };
    } else {
      // Live mode: call actual provider
      optimizedResult = await runOptimizedOrBaseline({
        mode: "optimized",
        path: scenario.path as "talk" | "code",
        model,
        provider: optimizerProvider,
        embedder,
        messages: chatMessages,
        turnIndex: Date.now(),
      }, cfg);
      
      optimizedUsage = optimizedResult.usage || {
        input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        estimated: true,
      };
      optimizedCost = estimateCost(optimizedUsage, provider);
      optimizedQuality = runQualityGuard({ 
        text: optimizedResult.responseText, 
        requiredChecks: scenario.required_checks 
      });
    }
    
    // Build spectral debug for optimized
    const optimizedSpectralDebug = optimizedResult.spectral ? {
      nNodes: optimizedResult.spectral.nNodes,
      nEdges: optimizedResult.spectral.nEdges,
      stabilityIndex: optimizedResult.spectral.stabilityIndex,
      lambda2: optimizedResult.spectral.lambda2,
      contradictionEnergy: optimizedResult.spectral.contradictionEnergy,
      recommendation: optimizedResult.spectral.recommendation,
      stableUnitIds: optimizedResult.spectral.stableNodeIdx.map((i: number) => `unit_${i}`), // convert indices to IDs
      unstableUnitIds: optimizedResult.spectral.unstableNodeIdx.map((i: number) => `unit_${i}`), // convert indices to IDs
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
    await saveRun({ 
      ...optimized, 
      replayId, 
      optimizationLevel,
      workloadKey,
      promptHash: optimizedPromptHash,
      debugInternal: optimizedDebugInternal,
      orgId: req.context?.org.id,
      projectId: req.context?.project?.id || null,
      providerKeyFingerprint: req.context?.providerKeyFingerprint || null,
    });
    
    // Create replay record
    await saveReplay(replayId, scenario_id, workloadKey, scenario.path, optimizationLevel, provider, model, baselineId, optimizedId);
    
    // Write verified savings to ledger (only for live mode)
    if (!isEstimatorMode) {
      await writeVerifiedSavings(
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
        optimizedCost,
        req.context?.org.id,
        req.context?.project?.id || null
      );
    }
    
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
        savings_type: isEstimatorMode ? "estimated_demo" : "verified",
      },
      quality: {
        baseline_pass: baselineQuality.pass,
        optimized_pass: optimizedQuality.pass,
      },
    };
    
    // Redact internal data before sending to client
    res.json(redactReplayResult(replayResult));
  } catch (error: any) {
    safeLog("error", "Replay error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
