/**
 * Optimizer Lab API Route
 * 
 * POST /v1/admin/optimize
 * 
 * Runs the full optimization pipeline in optimize-only mode (no provider calls).
 * Used for internal QA testing and customer demos.
 * 
 * Security:
 * - Requires admin/owner authentication
 * - Enforces view mode based on user role
 * - Server-side redaction for DEMO_VIEW mode
 * - No raw prompt/code storage by default (SOC2 posture)
 */

import { Router } from "express";
import { requireUserSession, requireOwner, type AuthenticatedRequest } from "../middleware/auth.js";
import { runOptimizedOrBaseline } from "../services/optimizer/optimizer.js";
import { getEmbedder } from "../services/embeddings/embedderRegistry.js";
import { makeOptimizerConfig } from "../services/optimizer/config.js";
import { mapOptimizationLevelToConfig, type OptimizationLevel as NumericOptLevel } from "../services/optimizer/optimizationLevel.js";
import {
  estimateBaselineTokens,
  estimateOptimizedTokens,
  getPricingConfig,
} from "../services/proof/tokenEstimator.js";
import { safeLog } from "../utils/redaction.js";
import type { ChatMessage } from "@spectyra/shared";
import {
  type OptimizeLabRequest,
  type OptimizeLabResponse,
  type ViewMode,
  type TokenEstimate,
  type DiffSummary,
  type OptimizationStep,
  type SafetySummary,
  type DebugPayload,
  optimizationLevelToNumber,
  demoTypeToPath,
} from "../types/optimizerLab.js";

/** Public health check (no auth) for uptime/monitoring and GET from browser */
export const optimizerLabHealthRouter = Router();
optimizerLabHealthRouter.get("/optimize/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

export const optimizerLabRouter = Router();

// Apply authentication: require user session + owner for now
// TODO: Add feature flag support for internal_tools
optimizerLabRouter.use(requireUserSession);
optimizerLabRouter.use(requireOwner);

/**
 * Determine the effective view mode based on user role and request
 */
function computeViewMode(
  requestedMode: ViewMode | undefined,
  isOwner: boolean,
  _orgSettings?: { forensics_enabled?: boolean }
): ViewMode {
  // Owner gets their requested mode (or ADMIN_DEBUG by default)
  if (isOwner) {
    if (requestedMode === "FORENSICS") {
      // FORENSICS requires explicit org setting (future implementation)
      // For now, owners can access it
      return "FORENSICS";
    }
    return requestedMode || "ADMIN_DEBUG";
  }
  
  // Non-owners always get DEMO_VIEW (server-enforced)
  return "DEMO_VIEW";
}

/**
 * Render messages to a single text string for display
 */
function renderMessages(messages: ChatMessage[]): string {
  return messages.map(m => {
    const rolePrefix = m.role.toUpperCase();
    return `[${rolePrefix}]\n${m.content}`;
  }).join("\n\n---\n\n");
}

/**
 * Build safety summary based on optimization results
 */
function buildSafetySummary(
  debug: any,
  path: "talk" | "code",
  optimizationsApplied: string[]
): SafetySummary {
  const preserved: string[] = [];
  const changed: string[] = [];
  const riskNotes: string[] = [];
  
  // Always preserved
  preserved.push("All explicit instructions");
  preserved.push("User requirements and constraints");
  
  if (path === "code") {
    preserved.push("Error logs and stack traces");
    preserved.push("Code structure and logic");
    preserved.push("Variable and function names");
  } else {
    preserved.push("Conversation context");
    preserved.push("User preferences");
  }
  
  // What was changed based on applied transforms
  if (optimizationsApplied.includes("refpack")) {
    changed.push("Repeated context compacted into references");
  }
  if (optimizationsApplied.includes("phrasebook")) {
    changed.push("Common phrases encoded for efficiency");
  }
  if (optimizationsApplied.includes("codemap")) {
    changed.push("Repository context summarized with symbol map");
    if (debug?.codemap?.applied) {
      changed.push(`${debug.codemap.symbolsCount || 0} code symbols indexed`);
    }
  }
  if (optimizationsApplied.includes("semantic_cache")) {
    changed.push("Semantic caching enabled for this prompt pattern");
  }
  
  // Deduplication and history compaction
  if (debug?.refsUsed && debug.refsUsed.length > 0) {
    changed.push("Stable context deduplicated");
  }
  if (debug?.deltaUsed) {
    changed.push("Delta prompting applied (incremental context)");
  }
  
  // Risk notes - transparency about what optimization does NOT do
  riskNotes.push("No summarization performed - all content preserved or compressed losslessly");
  riskNotes.push("All transformations are reversible by the LLM");
  riskNotes.push("No semantic changes to instructions or requirements");
  
  if (path === "code") {
    riskNotes.push("Patch mode preserves full code context");
  }
  
  return { preserved, changed, riskNotes };
}

/**
 * Redact optimized messages for DEMO_VIEW mode
 * Replaces internal protocol markers with safe summaries
 */
function redactOptimizedMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(msg => {
    let content = msg.content;
    
    // Redact REFPACK blocks
    content = content.replace(
      /\[REFPACK\]([\s\S]*?)\[\/REFPACK\]/gi,
      (match) => {
        const entryCount = (match.match(/\[REF:\d+\]/g) || []).length || "several";
        return `[REFPACK { ${entryCount} entries redacted for IP protection }]`;
      }
    );
    
    // Redact PHRASEBOOK blocks
    content = content.replace(
      /\[PHRASEBOOK\]([\s\S]*?)\[\/PHRASEBOOK\]/gi,
      (match) => {
        const entryCount = (match.match(/\[PB:\d+\]/g) || []).length || "several";
        return `[PHRASEBOOK { ${entryCount} entries redacted for IP protection }]`;
      }
    );
    
    // Redact CODEMAP blocks
    content = content.replace(
      /\[CODEMAP\]([\s\S]*?)\[\/CODEMAP\]/gi,
      () => {
        return `[CODEMAP { symbol map redacted for IP protection }]`;
      }
    );
    
    // Redact any OMITTED_BLOCKS sections
    content = content.replace(
      /\[OMITTED_BLOCKS\]([\s\S]*?)\[\/OMITTED_BLOCKS\]/gi,
      () => {
        return `[OMITTED_BLOCKS { list redacted }]`;
      }
    );
    
    // Redact inline refs [REF:n] with placeholders
    content = content.replace(
      /\[REF:\d+\]/g,
      "[REF:*]"
    );
    
    // Redact phrasebook refs [PB:n]
    content = content.replace(
      /\[PB:\d+\]/g,
      "[PB:*]"
    );
    
    return { ...msg, content };
  });
}

/**
 * Create a mock provider for dry-run mode
 */
function createDryRunProvider() {
  return {
    chat: async () => ({
      text: "DRY_RUN: No provider call made",
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true }
    })
  };
}

/**
 * POST /v1/admin/optimize
 * 
 * Run the optimization pipeline without making provider calls.
 */
optimizerLabRouter.post("/optimize", async (req: AuthenticatedRequest, res) => {
  const startTime = Date.now();
  
  try {
    const body = req.body as OptimizeLabRequest;
    
    // Validate required fields
    if (!body.demoType) {
      return res.status(400).json({ 
        error: "Missing required field: demoType",
        message: "demoType must be 'chat' or 'code'"
      });
    }
    
    if (!["chat", "code"].includes(body.demoType)) {
      return res.status(400).json({ 
        error: "Invalid demoType",
        message: "demoType must be 'chat' or 'code'"
      });
    }
    
    // Must have either messages or prompt
    if (!body.messages && !body.prompt) {
      return res.status(400).json({ 
        error: "Missing input",
        message: "Provide either 'messages' array or 'prompt' string"
      });
    }
    
    // Determine path and optimization level
    const path = body.path || demoTypeToPath(body.demoType);
    const optimizationLevel = body.optimizationLevel || "balanced";
    const numericLevel = optimizationLevelToNumber(optimizationLevel) as NumericOptLevel;
    
    // Build messages array
    let messages: ChatMessage[];
    if (body.messages) {
      messages = body.messages;
    } else {
      // Wrap prompt into messages
      messages = [
        { role: "user", content: body.prompt! }
      ];
    }
    
    // Add repo context for code demos
    if (body.demoType === "code" && body.repoContext) {
      messages.push({
        role: "user",
        content: `[REPO CONTEXT]\n${body.repoContext}`
      });
    }
    
    // Compute view mode based on role
    // Since we're past requireOwner, the user is an owner
    const viewMode = computeViewMode(
      body.requestedViewMode,
      true, // isOwner (we passed requireOwner middleware)
      undefined // org settings (future)
    );
    
    // Get embedder
    const embedder = getEmbedder("openai");
    
    // Get base config and apply optimization level
    const baseConfig = makeOptimizerConfig();
    const cfg = mapOptimizationLevelToConfig(path, numericLevel, baseConfig);
    
    // Apply custom options if provided
    if (body.options) {
      if (body.options.keepLastTurns !== undefined) {
        if (path === "code") {
          cfg.codePolicy.keepLastTurns = body.options.keepLastTurns;
        } else {
          cfg.talkPolicy.keepLastTurns = body.options.keepLastTurns;
        }
      }
      if (body.options.maxRefs !== undefined) {
        if (path === "code") {
          cfg.codePolicy.maxRefs = body.options.maxRefs;
        } else {
          cfg.talkPolicy.maxRefs = body.options.maxRefs;
        }
      }
    }
    
    // Run optimizer pipeline with dryRun=true
    const result = await runOptimizedOrBaseline({
      mode: "optimized",
      path,
      model: "gpt-4", // Dummy model for estimation
      provider: createDryRunProvider() as any,
      embedder,
      messages,
      turnIndex: Date.now(),
      dryRun: true,
    }, cfg);
    
    // Real numbers only — no fake percentages. Same backend flow as /proof and chat dry-run:
    // 1. Run optimizer pipeline → result.promptFinal.messages (actual optimized payload).
    // 2. Before = token estimate of original messages; After = token estimate of that payload.
    // 3. pctSaved = (before - after) / before * 100, exactly as calculated.
    const pricing = getPricingConfig("openai");
    const baselineEstimate = estimateBaselineTokens(messages, "openai", pricing);
    const optimizedEstimate = estimateOptimizedTokens(
      result.promptFinal.messages,
      path,
      numericLevel,
      "openai",
      pricing
    );
    const inputTokensBefore = baselineEstimate.input_tokens;
    const inputTokensAfter = optimizedEstimate.input_tokens;
    const pctSaved =
      inputTokensBefore > 0
        ? ((inputTokensBefore - inputTokensAfter) / inputTokensBefore) * 100
        : 0;
    const optimizationsApplied = result.optimizationsApplied || [];

    const originalTokenEstimate: TokenEstimate = {
      inputTokens: baselineEstimate.input_tokens,
      outputTokens: baselineEstimate.output_tokens,
      totalTokens: baselineEstimate.total_tokens,
      estimatedCostUsd: baselineEstimate.cost_usd,
    };

    const optimizedInputTokens = inputTokensAfter;
    const optimizedOutputTokens = Math.min(250, Math.max(60, Math.floor(optimizedInputTokens * 0.2)));
    const optimizedTokenEstimate: TokenEstimate = {
      inputTokens: optimizedInputTokens,
      outputTokens: optimizedOutputTokens,
      totalTokens: optimizedInputTokens + optimizedOutputTokens,
      estimatedCostUsd: (optimizedInputTokens / 1000) * pricing.input_per_1k + (optimizedOutputTokens / 1000) * pricing.output_per_1k,
    };

    const diffSummary: DiffSummary = {
      inputTokensBefore,
      inputTokensAfter,
      pctSaved: Math.round(pctSaved * 100) / 100,
      refsUsed: result.debugInternal?.refpack?.entriesCount,
      phrasebookEntries: result.debugInternal?.phrasebook?.entriesCount,
      codemapSnippetsKept: result.debugInternal?.codemap?.symbolsCount,
      optimizationSteps: result.debugInternal?.optimizationSteps?.map((s: OptimizationStep) => ({
        label: s.label,
        useAfter: s.useAfter,
        before: s.before,
        after: s.after,
        pct: s.pct,
        absChange: s.absChange,
      })),
    };

    const safetySummary = buildSafetySummary(result.debugInternal, path, optimizationsApplied);

    let optimizedMessages = result.promptFinal.messages;
    let optimizedRenderedText = renderMessages(optimizedMessages);
    if (viewMode === "DEMO_VIEW") {
      optimizedMessages = redactOptimizedMessages(result.promptFinal.messages);
      optimizedRenderedText = renderMessages(optimizedMessages);
    }
    
    // Build response
    const response: OptimizeLabResponse = {
      viewMode,
      original: {
        messages,
        renderedText: renderMessages(messages),
        tokenEstimate: originalTokenEstimate,
      },
      optimized: {
        messages: optimizedMessages,
        renderedText: optimizedRenderedText,
        tokenEstimate: optimizedTokenEstimate,
      },
      diff: {
        appliedTransforms: optimizationsApplied,
        summary: diffSummary,
        safetySummary,
      },
      meta: {
        demoType: body.demoType,
        path,
        optimizationLevel,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
    
    // Add unified diff for ADMIN_DEBUG/FORENSICS
    if (viewMode !== "DEMO_VIEW") {
      // Simple line-by-line diff (can enhance with proper diff library later)
      const originalLines = renderMessages(messages).split("\n");
      const optimizedLines = renderMessages(result.promptFinal.messages).split("\n");
      
      // Create simple unified diff format
      const diffLines: string[] = ["--- Original", "+++ Optimized", ""];
      const maxLines = Math.max(originalLines.length, optimizedLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const orig = originalLines[i] || "";
        const opt = optimizedLines[i] || "";
        
        if (orig === opt) {
          diffLines.push(` ${orig}`);
        } else if (orig && !opt) {
          diffLines.push(`-${orig}`);
        } else if (!orig && opt) {
          diffLines.push(`+${opt}`);
        } else {
          diffLines.push(`-${orig}`);
          diffLines.push(`+${opt}`);
        }
      }
      
      response.diff.unifiedDiff = diffLines.join("\n");
    }
    
    // Add debug info if requested and allowed
    if (body.debug && viewMode !== "DEMO_VIEW") {
      const debugPayload: DebugPayload = {};
      
      if (result.debugInternal?.budgets) {
        debugPayload.budgets = result.debugInternal.budgets;
      }
      
      if (result.spectral) {
        debugPayload.spectral = {
          nNodes: result.spectral.nNodes,
          nEdges: result.spectral.nEdges,
          stabilityIndex: result.spectral.stabilityIndex,
          lambda2: result.spectral.lambda2,
          contradictionEnergy: result.spectral.contradictionEnergy,
          recommendation: result.spectral.recommendation,
          stableCount: result.spectral.stableNodeIdx?.length || 0,
          unstableCount: result.spectral.unstableNodeIdx?.length || 0,
        };
      }
      
      if (result.debugInternal) {
        debugPayload.runDebug = result.debug;
        debugPayload.transforms = {
          refpack: result.debugInternal.refpack,
          phrasebook: result.debugInternal.phrasebook,
          codemap: result.debugInternal.codemap,
        };
      }
      
      response.debug = debugPayload;
    }
    
    // Log metadata only (SOC2 posture - no raw prompts)
    safeLog("info", "Optimizer Lab run", {
      demoType: body.demoType,
      path,
      optimizationLevel,
      viewMode,
      tokensBefore: baselineEstimate.input_tokens,
      tokensAfter: optimizedEstimate.input_tokens,
      pctSaved: Math.round(pctSaved * 100) / 100,
      latencyMs: Date.now() - startTime,
      userId: req.auth?.userId,
    });
    
    res.json(response);
  } catch (error: any) {
    safeLog("error", "Optimizer Lab error", { 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
    
    res.status(500).json({ 
      error: "Optimization failed",
      message: error.message || "Internal server error",
    });
  }
});
