import { PathKind, SemanticUnit, SpectralOptions } from "./spectral/types";

// Re-export PathKind for use in other optimizer modules
export type { PathKind };
import { unitizeMessages, ChatMessage, UnitizeOptions } from "./unitize";
import { buildGraph } from "./buildGraph";
import { spectralAnalyze } from "./spectral/spectralCore";
import { applyTalkPolicy, postProcessTalkOutput } from "./policies/talkPolicy";
import { applyCodePolicy, postProcessCodeOutput } from "./policies/codePolicy";
import { runQualityGuard, RequiredCheck } from "./quality/qualityGuard";
/**
 * CRITICAL: PG-SCC IS THE ONLY COMPRESSION LAYER.
 * RefPack and Glossary are DEPRECATED for SCC paths and must not run when SCC is produced.
 * When PG-SCC is active, RefPack and PhraseBook/Glossary must NOT run (no [[R#]] tokens, no glossary tables).
 */
const USE_PG_SCC_ONLY = true;

// Core Moat v1 transforms + PG-SCC (SCC is the only memory layer; no RefPack)
import { compileTalkState, compileCodeState } from "./transforms/contextCompiler";
import { buildCodeMap } from "./transforms/codeMap";
import { computeBudgetsFromSpectral } from "./budgeting/budgetsFromSpectral";
import { semanticCacheKey } from "./cache/semanticHash";
import { getCacheStore } from "./cache/createCacheStore";
import { getConversationState, setConversationState } from "./cache/conversationState";
import { profitGate, TALK_PROFIT_GATE, CODE_PROFIT_GATE, estimateInputTokens } from "./utils/tokenCount";
import type { ProfitGateResult } from "./utils/tokenCount";
import { buildSTE } from "./transforms/ste";

import type { OptimizerChatProvider } from "@spectyra/shared";

// Provider + embedding interfaces
// Note: This is a different interface than the LLM service ChatProvider
// This one is used internally by the optimizer
export type OptimizerProvider = OptimizerChatProvider;

export interface EmbeddingService {
  embed(texts: string[]): Promise<number[][]>;
}

export interface OptimizerConfig {
  spectral: SpectralOptions;
  unitize: UnitizeOptions;

  talkPolicy: {
    maxRefs: number;
    compactionAggressive: boolean;
    trimAggressive: boolean;
    keepLastTurns?: number;
  };

  codePolicy: {
    maxRefs: number;
    patchModeDefault: boolean;
    patchModeAggressiveOnReuse: boolean;
    trimAggressive: boolean;
    keepLastTurns?: number;
    codeSlicerAggressive?: boolean;
  };

  // Optional output budgets (NOT required)
  maxOutputTokensOptimized?: number;      // e.g. 450 (optional)
  maxOutputTokensOptimizedRetry?: number; // e.g. 900 (optional)
}

export interface OptimizeInput {
  mode: "baseline" | "optimized";
  path: PathKind;
  conversationId?: string;
  model: string;
  provider: OptimizerProvider;
  embedder: EmbeddingService;

  messages: ChatMessage[];
  turnIndex: number;

  // For quality guard
  requiredChecks?: RequiredCheck[];
  
  // For dry-run mode (skip provider call, return estimates)
  dryRun?: boolean;
}

export interface OptimizeOutput {
  promptFinal: { messages: ChatMessage[] };
  responseText: string;
  usage?: { input_tokens: number; output_tokens: number; total_tokens: number; estimated?: boolean };
  debug: any;
  spectral?: any;
  quality?: { pass: boolean; failures: string[]; retried?: boolean };
  debugInternal?: any; // Internal operator signals for debug_internal_json storage
  // Core Moat v1: Optimization metrics for API response
  optimizationsApplied?: string[];
  tokenBreakdown?: {
    refpack?: { before: number; after: number; saved: number };
    phrasebook?: { before: number; after: number; saved: number };
    codemap?: { before: number; after: number; saved: number };
  };
  // Customer-safe optimization report
  optimizationReport?: {
    layers: {
      refpack: boolean;
      phrasebook: boolean;
      codemap: boolean;
      semantic_cache: boolean;
      cache_hit: boolean;
      context_compiler?: boolean;
      profit_gated?: boolean;
    };
    tokens: {
      estimated: boolean;
      input_before?: number;
      input_after?: number;
      saved?: number;
      pct_saved?: number;
    };
    /** Set true when optimized exceeded baseline and pipeline reverted to baseline. */
    reverted?: boolean;
    spectral?: {
      nNodes: number;
      nEdges: number;
      stabilityIndex: number;
      lambda2: number;
    };
  };
}

function makeClarifyQuestion(path: PathKind): string {
  if (path === "code") {
    return "Quick clarification: which file/function should I change, and what is the expected behavior (or failing test) after the fix?";
  }
  return "Quick clarification: what outcome do you want, and what constraints (format/length/tone) should I follow?";
}

async function callWithPolicy(
  path: PathKind,
  provider: OptimizerProvider,
  model: string,
  messagesFinal: ChatMessage[],
  cfg: OptimizerConfig,
  isRetry: boolean
) {
  const maxOutputTokens =
    isRetry ? cfg.maxOutputTokensOptimizedRetry : cfg.maxOutputTokensOptimized;

  return provider.chat({
    model,
    messages: messagesFinal,
    maxOutputTokens
  });
}

export async function runOptimizedOrBaseline(
  input: OptimizeInput,
  cfg: OptimizerConfig
): Promise<OptimizeOutput> {
  const { mode, path, provider, embedder, model, messages, turnIndex, requiredChecks, dryRun, conversationId } = input;

  // Baseline: forward as-is (still can be quality-checked in replay)
  if (mode === "baseline") {
    const out = await provider.chat({ model, messages });
    const q = runQualityGuard({ text: out.text, requiredChecks });
    return {
      promptFinal: { messages },
      responseText: out.text,
      usage: out.usage,
      quality: { ...q },
      debug: { mode: "baseline" }
    };
  }

  // -------- Optimized pipeline --------
  //
  // CORE INVARIANTS:
  // 1. Any optimization layer (RefPack, STE, CodeMap, policies) MUST prove net token savings or be skipped (profit gates).
  // 2. SCC (Spectral Context Compiler) is the authoritative compression step; its output is the only system message added.
  // 3. Optimized prompt must never exceed baseline; final size guard reverts to baseline and sets optimizationReport.reverted if so.
  //
  // Pipeline order: unitize → embed → graph → spectral → budgets → SCC (single memory) → profit-gated STE → profit-gated CodeMap (code only) → policy (trim-only) → final size guard.
  //
  // Markov state carry: prepend prior state if we have conversationId
  let pipelineMessages: ChatMessage[] = messages;
  if (conversationId) {
    try {
      const prior = await getConversationState(conversationId);
      if (prior) {
        pipelineMessages = [prior.stateMsg, ...prior.lastTurn, ...messages];
      }
    } catch (_) {
      // ignore
    }
  }

  const baselineTokenCount = estimateInputTokens(pipelineMessages);

  // 1) Unitize
  const unitsRaw = unitizeMessages({
    path,
    messages: pipelineMessages,
    lastTurnIndex: turnIndex,
    opts: cfg.unitize
  });

  // 2) Embed
  const embeds = await embedder.embed(unitsRaw.map(u => u.text));
  const units: SemanticUnit[] = unitsRaw.map((u, idx) => ({ ...u, embedding: embeds[idx] }));

  // 3) Build graph
  const graph = buildGraph({ path, units, opts: cfg.spectral });

  // 4) Spectral analysis → budgets. SCC is the authoritative compression step.
  const spectral = spectralAnalyze({
    graph,
    opts: cfg.spectral,
    units,
    currentTurn: turnIndex,
  });

  // 5) If unstable: clarify short-circuit (saves tokens and avoids wrong answers)
  // In dry-run (e.g. Optimizer Lab), skip short-circuit so we still run transforms and show real before/after.
  if (spectral.recommendation === "ASK_CLARIFY" && !dryRun) {
    const qText = makeClarifyQuestion(path);
    const q = runQualityGuard({ text: qText, requiredChecks }); // usually passes if no checks
    
    // Build debug internal for short-circuit
    const debugInternal = {
      mode: "optimized",
      shortCircuit: "ASK_CLARIFY",
      spectral: {
        nNodes: spectral.nNodes,
        nEdges: spectral.nEdges,
        lambda2: spectral.lambda2,
        contradictionEnergy: spectral.contradictionEnergy,
        stabilityIndex: spectral.stabilityIndex,
        recommendation: spectral.recommendation,
        stableCount: spectral.stableNodeIdx.length,
        unstableCount: spectral.unstableNodeIdx.length,
        ...(spectral._internal || {}),
      },
      cacheHit: false,
      driftScore: undefined,
    };
    
    return {
      promptFinal: { messages },
      responseText: qText,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true },
      spectral,
      quality: { ...q, retried: false },
      debug: { mode: "optimized", shortCircuit: "ASK_CLARIFY" },
      debugInternal,
      optimizationReport: {
        layers: {
          refpack: false,
          phrasebook: false,
          codemap: false,
          semantic_cache: false,
          cache_hit: false,
          context_compiler: false,
          profit_gated: false,
        },
        tokens: {
          estimated: true,
        },
        spectral: {
          nNodes: spectral.nNodes,
          nEdges: spectral.nEdges,
          stabilityIndex: spectral.stabilityIndex,
          lambda2: spectral.lambda2,
        },
      },
    };
  }

    // ===== Core Moat v1: Apply Moat Transforms (extracted for reuse) =====
  interface MoatTransformResult {
    messagesAfterCodeMap: ChatMessage[];
    refPackMetrics: { tokensBefore: number; tokensAfter: number; entriesCount: number; replacementsMade: number };
    phraseBookMetrics: { tokensBefore: number; tokensAfter: number; entriesCount: number; changed: boolean };
    codeMapMetrics: { tokensBefore: number; tokensAfter: number; symbolsCount: number; changed: boolean };
    cacheKey: string;
    budgets: ReturnType<typeof computeBudgetsFromSpectral>;
    optimizationSteps: ProfitGateResult[];
    lastSccDropped: number;
    sccStateChars: number;
    /** Code path only: failing signals in state (1 latest + up to 6 history). */
    failingSignalsCount: number;
  }

  const applyMoatTransforms = (): MoatTransformResult => {
    // Compute budgets from spectral
    const budgets = computeBudgetsFromSpectral({
      spectral,
      baseKeepLastTurns: path === "code" ? cfg.codePolicy.keepLastTurns : cfg.talkPolicy.keepLastTurns,
      baseMaxRefs: path === "code" ? cfg.codePolicy.maxRefs : cfg.talkPolicy.maxRefs,
      messages: path === "code" ? pipelineMessages : undefined,
    });

    const gateOpts = path === "code" ? CODE_PROFIT_GATE : TALK_PROFIT_GATE;
    const optimizationSteps: ProfitGateResult[] = [];

    // ===== SINGLE SOURCE OF TRUTH = PG-SCC (no RefPack; no competing memory) =====
    let messagesAfterScc = pipelineMessages;
    let lastSccDropped = 0;
    let sccStateChars = 0;
    let failingSignalsCount = 0;

    if (path === "code") {
      const scc = compileCodeState({
        messages: pipelineMessages,
        units,
        spectral,
        budgets,
      });
      messagesAfterScc = scc.keptMessages;
      lastSccDropped = scc.droppedCount;
      sccStateChars = typeof scc.stateMsg.content === "string" ? scc.stateMsg.content.length : 0;
      failingSignalsCount = scc.failingSignalsCount;
    } else {
      const scc = compileTalkState({
        messages: pipelineMessages,
        units,
        spectral,
        budgets,
      });
      messagesAfterScc = scc.keptMessages;
      lastSccDropped = scc.droppedCount;
      sccStateChars = typeof scc.stateMsg.content === "string" ? scc.stateMsg.content.length : 0;
    }

    if (USE_PG_SCC_ONLY && messagesAfterScc !== pipelineMessages) {
      const sys = messagesAfterScc.filter((m) => m.role === "system");
      if (sys.length !== 1) {
        throw new Error("SCC must be single system state");
      }
    }

    const gateScc = profitGate(pipelineMessages, messagesAfterScc, gateOpts, "scc");
    optimizationSteps.push(gateScc);

    const sccApplied = messagesAfterScc !== pipelineMessages;
    // When PG-SCC is active, skip RefPack + PhraseBook/STE entirely (single compression layer).
    const useLegacyCompression = !sccApplied;

    // Code path: embed CodeMap into SCC (no separate CODEMAP system message)
    let codeMapResultEmbedded: { tokensBefore: number; tokensAfter: number; symbolsCount: number; changed: boolean } | null = null;
    if (path === "code" && budgets.codemapDetailLevel < 1.0) {
      const codeMapResult = buildCodeMap({
        messages: messagesAfterScc,
        spectral,
        detailLevel: budgets.codemapDetailLevel,
        structuralOnly: true,
      });
      if (codeMapResult.changed && codeMapResult.codeMap) {
        const cm = codeMapResult.codeMap;
        const codemapSnippet =
          `Repo symbols (from codemap):\n- exports: ${cm.exports.slice(0, 15).join(", ") || "(none)"}\n- imports: ${cm.imports.slice(0, 15).join(", ") || "(none)"}\n- key symbols: ${cm.symbols.slice(0, 20).map((s) => `${s.name}:${s.type}`).join(", ") || "(none)"}`;
        const sysMsg = messagesAfterScc.find(
          (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("[SPECTYRA_STATE_CODE]")
        );
        if (sysMsg && typeof sysMsg.content === "string") {
          sysMsg.content = sysMsg.content.replace(
            /- key symbols: \(see recent context\)/,
            codemapSnippet.slice(0, 600) + (codemapSnippet.length > 600 ? "…" : "")
          );
        }
        codeMapResultEmbedded = {
          tokensBefore: codeMapResult.tokensBefore,
          tokensAfter: codeMapResult.tokensAfter,
          symbolsCount: cm.symbols.length,
          changed: true,
        };
      }
    }

    let messagesAfterRefPack = messagesAfterScc;
    const refPackMetrics = { tokensBefore: 0, tokensAfter: 0, entriesCount: 0, replacementsMade: 0 };

    // ===== STE (PhraseBook): skip when SCC applied — PG-SCC is the only compression layer =====
    let messagesAfterSTE = messagesAfterRefPack;
    let phraseBookMetrics = { tokensBefore: 0, tokensAfter: 0, entriesCount: 0, changed: false };

    if (useLegacyCompression && budgets.phrasebookAggressiveness > 0.3) {
      const steResult = buildSTE({
        messages: messagesAfterRefPack,
        aggressiveness: budgets.phrasebookAggressiveness,
      });

      const gateSte = profitGate(messagesAfterRefPack, steResult.messages, gateOpts, "ste");
      optimizationSteps.push(gateSte);
      if (gateSte.useAfter && steResult.changed) {
        messagesAfterSTE = steResult.messages;
        phraseBookMetrics = {
          tokensBefore: steResult.tokensBefore,
          tokensAfter: steResult.tokensAfter,
          entriesCount: steResult.ste.entries.length,
          changed: steResult.changed,
        };
      }
    }

    // ===== CodeMap: code path only — already embedded into SCC; no separate system message =====
    let messagesAfterCodeMap = messagesAfterSTE;
    let codeMapMetrics = { tokensBefore: 0, tokensAfter: 0, symbolsCount: 0, changed: false };

    if (path === "code" && codeMapResultEmbedded) {
      codeMapMetrics = codeMapResultEmbedded;
      const gateCm = profitGate(messagesAfterSTE, messagesAfterSTE, gateOpts, "codemap");
      optimizationSteps.push(gateCm);
    }

    // ===== Core Moat v1: Semantic Hash Caching =====
    const cacheKey = semanticCacheKey({
      units,
      spectral,
      routeMeta: { model, path },
    });

    return {
      messagesAfterCodeMap,
      refPackMetrics,
      phraseBookMetrics,
      codeMapMetrics,
      cacheKey,
      budgets,
      optimizationSteps,
      lastSccDropped,
      sccStateChars,
      failingSignalsCount,
    };
  };

  // Compute moat transforms once (reused in retry)
  const moatResult = applyMoatTransforms();

  // Helper to run once with given policy overrides
  const runOnce = async (policyOverride?: Partial<OptimizerConfig>): Promise<OptimizeOutput> => {
    const localCfg: OptimizerConfig = {
      ...cfg,
      talkPolicy: { ...cfg.talkPolicy, ...(policyOverride?.talkPolicy ?? {}) },
      codePolicy: { ...cfg.codePolicy, ...(policyOverride?.codePolicy ?? {}) },
      maxOutputTokensOptimized: policyOverride?.maxOutputTokensOptimized ?? cfg.maxOutputTokensOptimized,
      maxOutputTokensOptimizedRetry: policyOverride?.maxOutputTokensOptimizedRetry ?? cfg.maxOutputTokensOptimizedRetry,
      spectral: cfg.spectral,
      unitize: cfg.unitize
    };

    // ===== Core Moat v1: Spectral-Driven Budgets =====
    const budgets = computeBudgetsFromSpectral({
      spectral,
      baseKeepLastTurns: path === "code" ? localCfg.codePolicy.keepLastTurns : localCfg.talkPolicy.keepLastTurns,
      baseMaxRefs: path === "code" ? localCfg.codePolicy.maxRefs : localCfg.talkPolicy.maxRefs,
    });

    // Use pre-computed moat transforms
    const {
      messagesAfterCodeMap,
      refPackMetrics,
      phraseBookMetrics,
      codeMapMetrics,
      cacheKey,
      budgets: moatBudgets,
      optimizationSteps: moatSteps,
      lastSccDropped,
      sccStateChars,
      failingSignalsCount,
    } = moatResult;

    // Update config with dynamic budgets
    if (path === "code") {
      localCfg.codePolicy.keepLastTurns = moatBudgets.keepLastTurns;
      localCfg.codePolicy.maxRefs = moatBudgets.maxRefpackEntries;
    } else {
      localCfg.talkPolicy.keepLastTurns = moatBudgets.keepLastTurns;
      localCfg.talkPolicy.maxRefs = moatBudgets.maxRefpackEntries;
    }

    // Apply policy transforms (pre-LLM) - now using messages after Core Moat transforms
    let messagesFinal: ChatMessage[] = messagesAfterCodeMap;
    let policyDebug: any = {};

    if (path === "talk") {
      const p = applyTalkPolicy({
        messages: messagesAfterCodeMap,
        units,
        spectral,
        opts: localCfg.talkPolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    } else {
      const p = applyCodePolicy({
        messages: messagesAfterCodeMap,
        units,
        spectral,
        opts: localCfg.codePolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    }

    // Profit-gate policy: do not use policy output if it increases tokens
    const gateOpts = path === "code" ? CODE_PROFIT_GATE : TALK_PROFIT_GATE;
    const policyGate = profitGate(messagesAfterCodeMap, messagesFinal, gateOpts, "policy");
    const optimizationSteps = [...moatSteps, policyGate];
    if (!policyGate.useAfter) {
      messagesFinal = messagesAfterCodeMap;
    }

    // Final safety: optimized prompt must never exceed baseline. Revert and mark reverted if so.
    const optimizedTokenCount = estimateInputTokens(messagesFinal);
    let reverted = false;
    if (optimizedTokenCount > baselineTokenCount) {
      messagesFinal = pipelineMessages;
      reverted = true;
    }

    // Markov state carry: persist compiled state for next request
    if (conversationId && messagesFinal.length > 0) {
      const stateMsg = messagesFinal.find(
        (m) =>
          m.role === "system" &&
          (m.content?.includes("[SPECTYRA_STATE_TALK]") || m.content?.includes("[SPECTYRA_STATE_CODE]"))
      );
      const lastTurn = messagesFinal.slice(-4);
      if (stateMsg) {
        setConversationState(conversationId, stateMsg, lastTurn).catch(() => {});
      }
    }

    // If dry-run, skip provider call and return placeholder with optimization report
    if (dryRun) {
      const optimizationsAppliedDry: string[] = [];
      if (lastSccDropped > 0) optimizationsAppliedDry.push("scc");
      if (phraseBookMetrics.changed) optimizationsAppliedDry.push("phrasebook");
      if (codeMapMetrics.changed) optimizationsAppliedDry.push("codemap");
      const totalInputBeforeDry = baselineTokenCount;
      const totalInputAfterDry = optimizedTokenCount;
      const totalSavedDry = totalInputBeforeDry - totalInputAfterDry;
      const pctSavedDry = totalInputBeforeDry > 0 ? (totalSavedDry / totalInputBeforeDry) * 100 : 0;
      const tokenBreakdownDry: OptimizeOutput["tokenBreakdown"] = {};
      if (refPackMetrics.entriesCount > 0) {
        tokenBreakdownDry.refpack = {
          before: refPackMetrics.tokensBefore,
          after: refPackMetrics.tokensAfter,
          saved: refPackMetrics.tokensBefore - refPackMetrics.tokensAfter,
        };
      }
      if (phraseBookMetrics.changed) {
        tokenBreakdownDry.phrasebook = {
          before: phraseBookMetrics.tokensBefore,
          after: phraseBookMetrics.tokensAfter,
          saved: phraseBookMetrics.tokensBefore - phraseBookMetrics.tokensAfter,
        };
      }
      if (codeMapMetrics.changed) {
        tokenBreakdownDry.codemap = {
          before: codeMapMetrics.tokensBefore,
          after: codeMapMetrics.tokensAfter,
          saved: codeMapMetrics.tokensBefore - codeMapMetrics.tokensAfter,
        };
      }
      return {
        promptFinal: { messages: messagesFinal },
        responseText: "DRY_RUN: No provider call made",
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true },
        spectral,
        quality: { pass: true, failures: [] },
        debug: { mode: "optimized", ...policyDebug, dryRun: true },
        debugInternal: {
          mode: "optimized",
          scc: { lastSccDropped, sccStateChars, failingSignalsCount },
          refpack: { tokensBefore: refPackMetrics.tokensBefore, tokensAfter: refPackMetrics.tokensAfter, entriesCount: refPackMetrics.entriesCount },
          phrasebook: { tokensBefore: phraseBookMetrics.tokensBefore, tokensAfter: phraseBookMetrics.tokensAfter, entriesCount: phraseBookMetrics.entriesCount, changed: phraseBookMetrics.changed },
          codemap: { tokensBefore: codeMapMetrics.tokensBefore, tokensAfter: codeMapMetrics.tokensAfter, symbolsCount: codeMapMetrics.symbolsCount, changed: codeMapMetrics.changed },
          optimizationSteps,
        },
        optimizationsApplied: optimizationsAppliedDry,
        tokenBreakdown: tokenBreakdownDry,
        optimizationReport: {
          layers: {
            refpack: refPackMetrics.entriesCount > 0,
            phrasebook: phraseBookMetrics.changed,
            codemap: codeMapMetrics.changed,
            semantic_cache: false,
            cache_hit: false,
            context_compiler: lastSccDropped > 0,
            profit_gated: optimizationSteps.some((s) => !s.useAfter),
          },
          tokens: {
            estimated: true,
            input_before: totalInputBeforeDry > 0 ? totalInputBeforeDry : undefined,
            input_after: totalInputAfterDry > 0 ? totalInputAfterDry : undefined,
            saved: totalSavedDry > 0 ? totalSavedDry : undefined,
            pct_saved: pctSavedDry > 0 ? Math.round(pctSavedDry * 100) / 100 : undefined,
          },
          reverted: reverted,
          spectral: spectral ? { nNodes: spectral.nNodes, nEdges: spectral.nEdges, stabilityIndex: spectral.stabilityIndex, lambda2: spectral.lambda2 } : undefined,
        },
      };
    }

    // ===== Core Moat v1: Semantic Cache Lookup =====
    let cacheHit = false;
    let cachedResponse: string | null = null;
    const cacheStore = getCacheStore();
    
    if (cacheStore && cacheKey) {
      try {
        cachedResponse = await cacheStore.get(cacheKey);
        if (cachedResponse) {
          cacheHit = true;
        }
      } catch (error) {
        console.error("Cache lookup error:", error);
        // Continue without cache on error
      }
    }

    // If cache hit, return cached response
    if (cacheHit && cachedResponse) {
      const quality = runQualityGuard({ text: cachedResponse, requiredChecks });
      
      // Build customer-safe optimization report for cache hit
      const optimizationReport = {
        layers: {
          refpack: false,
          phrasebook: false,
          codemap: false,
          semantic_cache: true,
          cache_hit: true,
        },
        tokens: {
          estimated: true,
        },
        reverted,
        spectral: {
          nNodes: spectral.nNodes,
          nEdges: spectral.nEdges,
          stabilityIndex: spectral.stabilityIndex,
          lambda2: spectral.lambda2,
        },
      };

      return {
        promptFinal: { messages: messagesFinal },
        responseText: cachedResponse,
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true },
        spectral,
        quality,
        debug: { mode: "optimized", cacheHit: true, ...policyDebug },
        debugInternal: {
          mode: "optimized",
          cache: { key: cacheKey, hit: true },
          ...policyDebug,
        },
        optimizationsApplied: ["semantic_cache_hit"],
        optimizationReport,
      };
    }

    const out = await callWithPolicy(path, provider, model, messagesFinal, localCfg, false);

    // Post-process output
    const responseText =
      path === "talk"
        ? postProcessTalkOutput(out.text, policyDebug.trimLevel)
        : postProcessCodeOutput(out.text, policyDebug.trimLevel);

    const quality = runQualityGuard({ text: responseText, requiredChecks });

    // Build comprehensive debug internal data with Core Moat v1 metrics
    const debugInternal = {
      mode: "optimized",
      ...policyDebug,
      scc: { lastSccDropped, sccStateChars, failingSignalsCount },
      spectral: {
        // Public-safe fields (already in spectral result)
        nNodes: spectral.nNodes,
        nEdges: spectral.nEdges,
        lambda2: spectral.lambda2,
        contradictionEnergy: spectral.contradictionEnergy,
        stabilityIndex: spectral.stabilityIndex,
        recommendation: spectral.recommendation,
        stableCount: spectral.stableNodeIdx.length,
        unstableCount: spectral.unstableNodeIdx.length,
        // Internal operator signals (from _internal)
        ...(spectral._internal || {}),
      },
      // Core Moat v1: Budgets
      budgets: {
        keepLastTurns: moatBudgets.keepLastTurns,
        maxRefpackEntries: moatBudgets.maxRefpackEntries,
        compressionAggressiveness: moatBudgets.compressionAggressiveness,
        phrasebookAggressiveness: moatBudgets.phrasebookAggressiveness,
        codemapDetailLevel: moatBudgets.codemapDetailLevel,
      },
      // Core Moat v1: RefPack metrics
      refpack: {
        tokensBefore: refPackMetrics.tokensBefore,
        tokensAfter: refPackMetrics.tokensAfter,
        tokensSaved: refPackMetrics.tokensBefore - refPackMetrics.tokensAfter,
        entriesCount: refPackMetrics.entriesCount,
        replacementsMade: refPackMetrics.replacementsMade,
      },
      // Core Moat v1: PhraseBook metrics
      phrasebook: {
        tokensBefore: phraseBookMetrics.tokensBefore,
        tokensAfter: phraseBookMetrics.tokensAfter,
        tokensSaved: phraseBookMetrics.tokensBefore - phraseBookMetrics.tokensAfter,
        entriesCount: phraseBookMetrics.entriesCount,
        applied: phraseBookMetrics.changed,
      },
      // Core Moat v1: CodeMap metrics
      codemap: {
        tokensBefore: codeMapMetrics.tokensBefore,
        tokensAfter: codeMapMetrics.tokensAfter,
        tokensSaved: codeMapMetrics.tokensBefore - codeMapMetrics.tokensAfter,
        symbolsCount: codeMapMetrics.symbolsCount,
        applied: codeMapMetrics.changed,
      },
      // Core Moat v1: Semantic cache
      cache: {
        key: cacheKey,
        keyType: "semantic",
        hit: cacheHit,
      },
      driftScore: undefined, // Phase 2: will be set when drift is implemented
    };

    // Build optimizations_applied array for API response
    const optimizationsApplied: string[] = [];
    if (refPackMetrics.entriesCount > 0) optimizationsApplied.push("refpack");
    if (phraseBookMetrics.changed) optimizationsApplied.push("phrasebook");
    if (codeMapMetrics.changed) optimizationsApplied.push("codemap");
    if (cacheHit) {
      optimizationsApplied.push("semantic_cache_hit");
    } else if (cacheKey) {
      optimizationsApplied.push("semantic_cache");
    }

    // Build token breakdown for API response
    const tokenBreakdown: OptimizeOutput["tokenBreakdown"] = {};
    if (refPackMetrics.entriesCount > 0) {
      tokenBreakdown.refpack = {
        before: refPackMetrics.tokensBefore,
        after: refPackMetrics.tokensAfter,
        saved: refPackMetrics.tokensBefore - refPackMetrics.tokensAfter,
      };
    }
    if (phraseBookMetrics.changed) {
      tokenBreakdown.phrasebook = {
        before: phraseBookMetrics.tokensBefore,
        after: phraseBookMetrics.tokensAfter,
        saved: phraseBookMetrics.tokensBefore - phraseBookMetrics.tokensAfter,
      };
    }
    if (codeMapMetrics.changed) {
      tokenBreakdown.codemap = {
        before: codeMapMetrics.tokensBefore,
        after: codeMapMetrics.tokensAfter,
        saved: codeMapMetrics.tokensBefore - codeMapMetrics.tokensAfter,
      };
    }

    // Store response in cache if quality passes and cache is enabled
    if (cacheStore && cacheKey && quality.pass && !cacheHit) {
      try {
        const ttlSeconds = parseInt(process.env.SPECTYRA_CACHE_TTL_SECONDS || "86400", 10);
        await cacheStore.set(cacheKey, responseText, ttlSeconds);
      } catch (error) {
        console.error("Cache store error:", error);
        // Fail silently - cache is optional
      }
    }

    // Build customer-safe optimization report
    const totalInputBefore = refPackMetrics.tokensBefore || 
      (phraseBookMetrics.tokensBefore || 0) + 
      (codeMapMetrics.tokensBefore || 0);
    const totalInputAfter = (refPackMetrics.tokensAfter || 0) + 
      (phraseBookMetrics.tokensAfter || 0) + 
      (codeMapMetrics.tokensAfter || 0);
    const totalSaved = totalInputBefore - totalInputAfter;
    const pctSaved = totalInputBefore > 0 ? (totalSaved / totalInputBefore) * 100 : 0;

    const optimizationReport = {
      layers: {
        refpack: refPackMetrics.entriesCount > 0,
        phrasebook: phraseBookMetrics.changed,
        codemap: codeMapMetrics.changed,
        semantic_cache: !!cacheKey,
        cache_hit: cacheHit,
      },
      tokens: {
        estimated: cacheHit || false,
        input_before: totalInputBefore > 0 ? totalInputBefore : undefined,
        input_after: totalInputAfter > 0 ? totalInputAfter : undefined,
        saved: totalSaved > 0 ? totalSaved : undefined,
        pct_saved: pctSaved > 0 ? Math.round(pctSaved * 100) / 100 : undefined,
      },
      reverted,
      spectral: {
        nNodes: spectral.nNodes,
        nEdges: spectral.nEdges,
        stabilityIndex: spectral.stabilityIndex,
        lambda2: spectral.lambda2,
      },
    };

    return {
      promptFinal: { messages: messagesFinal },
      responseText,
      usage: out.usage,
      spectral,
      quality: { ...quality, retried: false },
      debug: { mode: "optimized", ...policyDebug },
      debugInternal, // Include for storage
      optimizationsApplied,
      tokenBreakdown,
      optimizationReport,
    };
  };

  // First attempt: aggressive (as configured)
  const first = await runOnce();

  if (first.quality?.pass || !requiredChecks || requiredChecks.length === 0) {
    return first;
  }

  // Retry once: relax the risky parts that could cause missing requirements
  // - reduce trimming aggressiveness
  // - reduce compaction aggressiveness (keep more context)
  // - for code: disable patch-only if it might hide required details
  const retryOverride: Partial<OptimizerConfig> =
    path === "talk"
      ? {
          talkPolicy: {
            ...cfg.talkPolicy,
            compactionAggressive: false,
            trimAggressive: false
          },
          // optional: allow more output tokens on retry if provider supports it
          maxOutputTokensOptimized: cfg.maxOutputTokensOptimizedRetry ?? cfg.maxOutputTokensOptimized
        }
      : {
          codePolicy: {
            ...cfg.codePolicy,
            patchModeDefault: false,
            patchModeAggressiveOnReuse: false,
            trimAggressive: false
          },
          maxOutputTokensOptimized: cfg.maxOutputTokensOptimizedRetry ?? cfg.maxOutputTokensOptimized
        };

  // Run retry
  const second = await (async () => {
    // Use the same runOnce but with overrides; callWithPolicy uses maxOutputTokensOptimized
    const localCfg: OptimizerConfig = {
      ...cfg,
      talkPolicy: { ...cfg.talkPolicy, ...(retryOverride.talkPolicy ?? {}) },
      codePolicy: { ...cfg.codePolicy, ...(retryOverride.codePolicy ?? {}) },
      maxOutputTokensOptimized: retryOverride.maxOutputTokensOptimized ?? cfg.maxOutputTokensOptimized,
      maxOutputTokensOptimizedRetry: cfg.maxOutputTokensOptimizedRetry,
      spectral: cfg.spectral,
      unitize: cfg.unitize
    };

    // Apply policy transforms again (with relaxed settings)
    // Use the same moat-transformed messages from first attempt
    let messagesFinal: ChatMessage[] = moatResult.messagesAfterCodeMap;
    let policyDebug: any = {};

    if (path === "talk") {
      const p = applyTalkPolicy({
        messages: moatResult.messagesAfterCodeMap,
        units,
        spectral,
        opts: localCfg.talkPolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    } else {
      const p = applyCodePolicy({
        messages: moatResult.messagesAfterCodeMap,
        units,
        spectral,
        opts: localCfg.codePolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    }

    // Final safety: revert to baseline if optimized exceeds baseline (same invariant as runOnce)
    const retryOptimizedTokens = estimateInputTokens(messagesFinal);
    let reverted = false;
    if (retryOptimizedTokens > baselineTokenCount) {
      messagesFinal = pipelineMessages;
      reverted = true;
    }

    const out = await provider.chat({
      model,
      messages: messagesFinal,
      maxOutputTokens: localCfg.maxOutputTokensOptimized
    });

    const responseText =
      path === "talk"
        ? postProcessTalkOutput(out.text, policyDebug.trimLevel)
        : postProcessCodeOutput(out.text, policyDebug.trimLevel);

    const quality = runQualityGuard({ text: responseText, requiredChecks });

    // Build debug internal for retry
    const debugInternal = {
      mode: "optimized",
      retry: true,
      retry_reason: "QUALITY_GUARD_FAIL",
      first_failures: first.quality?.failures ?? [],
      ...policyDebug,
      spectral: {
        nNodes: spectral.nNodes,
        nEdges: spectral.nEdges,
        lambda2: spectral.lambda2,
        contradictionEnergy: spectral.contradictionEnergy,
        stabilityIndex: spectral.stabilityIndex,
        recommendation: spectral.recommendation,
        stableCount: spectral.stableNodeIdx.length,
        unstableCount: spectral.unstableNodeIdx.length,
        ...(spectral._internal || {}),
      },
      cacheHit: false,
      driftScore: undefined,
    };

    // Build optimization report for retry (reuse moat metrics from first attempt)
    const retryOptimizationReport = {
      layers: {
        refpack: moatResult.refPackMetrics.entriesCount > 0,
        phrasebook: moatResult.phraseBookMetrics.changed,
        codemap: moatResult.codeMapMetrics.changed,
        semantic_cache: !!moatResult.cacheKey,
        cache_hit: false, // Retry doesn't use cache
      },
      tokens: {
        estimated: false,
      },
      reverted,
      spectral: {
        nNodes: spectral.nNodes,
        nEdges: spectral.nEdges,
        stabilityIndex: spectral.stabilityIndex,
        lambda2: spectral.lambda2,
      },
    };

    return {
      promptFinal: { messages: messagesFinal },
      responseText,
      usage: out.usage,
      spectral,
      quality: { ...quality, retried: true },
      debug: {
        mode: "optimized",
        retry: true,
        retry_reason: "QUALITY_GUARD_FAIL",
        first_failures: first.quality?.failures ?? [],
        ...policyDebug
      },
      debugInternal,
      optimizationReport: retryOptimizationReport,
    } as OptimizeOutput;
  })();

  // If retry passes, return it; else return first (so you can see failure explicitly)
  if (second.quality?.pass) return second;

  // Return the better of the two (prefer passing; otherwise prefer fewer failures)
  const firstFails = first.quality?.failures?.length ?? 999;
  const secondFails = second.quality?.failures?.length ?? 999;

  return secondFails < firstFails ? second : first;
}
