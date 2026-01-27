import { PathKind, SemanticUnit, SpectralOptions } from "./spectral/types";
import { unitizeMessages, ChatMessage, UnitizeOptions } from "./unitize";
import { buildGraph } from "./buildGraph";
import { spectralAnalyze } from "./spectral/spectralCore";
import { applyTalkPolicy, postProcessTalkOutput } from "./policies/talkPolicy";
import { applyCodePolicy, postProcessCodeOutput } from "./policies/codePolicy";
import { runQualityGuard, RequiredCheck } from "./quality/qualityGuard";
// Core Moat v1 transforms
import { buildRefPack, applyInlineRefs } from "./transforms/refPack";
import { buildLocalPhraseBook } from "./transforms/phraseBook";
import { buildCodeMap } from "./transforms/codeMap";
import { computeBudgetsFromSpectral } from "./budgeting/budgetsFromSpectral";
import { semanticCacheKey } from "./cache/semanticHash";

// Provider + embedding interfaces
export interface ChatProvider {
  id: string;
  chat(args: {
    model: string;
    messages: ChatMessage[];
    maxOutputTokens?: number; // optional, provider adapter can ignore
  }): Promise<{
    text: string;
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number; estimated?: boolean };
    raw?: any;
  }>;
}

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
  provider: ChatProvider;
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
}

function makeClarifyQuestion(path: PathKind): string {
  if (path === "code") {
    return "Quick clarification: which file/function should I change, and what is the expected behavior (or failing test) after the fix?";
  }
  return "Quick clarification: what outcome do you want, and what constraints (format/length/tone) should I follow?";
}

async function callWithPolicy(
  path: PathKind,
  provider: ChatProvider,
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
  const { mode, path, provider, embedder, model, messages, turnIndex, requiredChecks, dryRun } = input;

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
  // 1) Unitize
  const unitsRaw = unitizeMessages({
    path,
    messages,
    lastTurnIndex: turnIndex,
    opts: cfg.unitize
  });

  // 2) Embed
  const embeds = await embedder.embed(unitsRaw.map(u => u.text));
  const units: SemanticUnit[] = unitsRaw.map((u, idx) => ({ ...u, embedding: embeds[idx] }));

  // 3) Build graph
  const graph = buildGraph({ path, units, opts: cfg.spectral });

  // 4) Spectral analysis (MOAT) - with multi-operator stability
  const spectral = spectralAnalyze({
    graph,
    opts: cfg.spectral,
    units,
    currentTurn: turnIndex,
  });

  // 5) If unstable: clarify short-circuit (saves tokens and avoids wrong answers)
  if (spectral.recommendation === "ASK_CLARIFY") {
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
    };
  }

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

    // Update config with dynamic budgets
    if (path === "code") {
      localCfg.codePolicy.keepLastTurns = budgets.keepLastTurns;
      localCfg.codePolicy.maxRefs = budgets.maxRefpackEntries;
    } else {
      localCfg.talkPolicy.keepLastTurns = budgets.keepLastTurns;
      localCfg.talkPolicy.maxRefs = budgets.maxRefpackEntries;
    }

    // ===== Core Moat v1: RefPack + Inline Replacement =====
    let messagesAfterRefPack = messages;
    let refPackMetrics = { tokensBefore: 0, tokensAfter: 0, entriesCount: 0, replacementsMade: 0 };
    
    if (budgets.compressionAggressiveness > 0.3) {
      const refPackResult = buildRefPack({
        units,
        spectral,
        path,
        maxEntries: budgets.maxRefpackEntries,
      });
      
      const inlineResult = applyInlineRefs({
        messages,
        refPack: refPackResult.refPack,
        spectral,
        units, // Pass units for finding original text
      });
      
      messagesAfterRefPack = inlineResult.messages;
      refPackMetrics = {
        tokensBefore: refPackResult.tokensBefore,
        tokensAfter: refPackResult.tokensAfter,
        entriesCount: refPackResult.refPack.entries.length,
        replacementsMade: inlineResult.replacementsMade,
      };
    }

    // ===== Core Moat v1: PhraseBook Encoding =====
    let messagesAfterPhraseBook = messagesAfterRefPack;
    let phraseBookMetrics = { tokensBefore: 0, tokensAfter: 0, entriesCount: 0, changed: false };
    
    if (budgets.phrasebookAggressiveness > 0.3) {
      const phraseBookResult = buildLocalPhraseBook({
        messages: messagesAfterRefPack,
        aggressiveness: budgets.phrasebookAggressiveness,
      });
      
      messagesAfterPhraseBook = phraseBookResult.messages;
      phraseBookMetrics = {
        tokensBefore: phraseBookResult.tokensBefore,
        tokensAfter: phraseBookResult.tokensAfter,
        entriesCount: phraseBookResult.phraseBook.entries.length,
        changed: phraseBookResult.changed,
      };
    }

    // ===== Core Moat v1: CodeMap Compression (code path only) =====
    let messagesAfterCodeMap = messagesAfterPhraseBook;
    let codeMapMetrics = { tokensBefore: 0, tokensAfter: 0, symbolsCount: 0, changed: false };
    
    if (path === "code" && budgets.codemapDetailLevel < 1.0) {
      const codeMapResult = buildCodeMap({
        messages: messagesAfterPhraseBook,
        spectral,
        detailLevel: budgets.codemapDetailLevel,
      });
      
      if (codeMapResult.changed) {
        messagesAfterCodeMap = codeMapResult.messages;
        codeMapMetrics = {
          tokensBefore: codeMapResult.tokensBefore,
          tokensAfter: codeMapResult.tokensAfter,
          symbolsCount: codeMapResult.codeMap?.symbols.length || 0,
          changed: codeMapResult.changed,
        };
      }
    }

    // ===== Core Moat v1: Semantic Hash Caching =====
    const cacheKey = semanticCacheKey({
      units,
      spectral,
      routeMeta: { model, path },
    });

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

    // If dry-run, skip provider call and return placeholder
    if (dryRun) {
      return {
        promptFinal: { messages: messagesFinal },
        responseText: "DRY_RUN: No provider call made",
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0, estimated: true },
        spectral,
        quality: { pass: true, failures: [] },
        debug: { mode: "optimized", ...policyDebug, dryRun: true }
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
        keepLastTurns: budgets.keepLastTurns,
        maxRefpackEntries: budgets.maxRefpackEntries,
        compressionAggressiveness: budgets.compressionAggressiveness,
        phrasebookAggressiveness: budgets.phrasebookAggressiveness,
        codemapDetailLevel: budgets.codemapDetailLevel,
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
        hit: false, // TODO: Implement cache lookup
      },
      driftScore: undefined, // Phase 2: will be set when drift is implemented
    };

    // Build optimizations_applied array for API response
    const optimizationsApplied: string[] = [];
    if (refPackMetrics.entriesCount > 0) optimizationsApplied.push("refpack");
    if (phraseBookMetrics.changed) optimizationsApplied.push("phrasebook");
    if (codeMapMetrics.changed) optimizationsApplied.push("codemap");
    if (cacheKey) optimizationsApplied.push("semantic_cache");

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
    let messagesFinal: ChatMessage[] = messages;
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
    } as OptimizeOutput;
  })();

  // If retry passes, return it; else return first (so you can see failure explicitly)
  if (second.quality?.pass) return second;

  // Return the better of the two (prefer passing; otherwise prefer fewer failures)
  const firstFails = first.quality?.failures?.length ?? 999;
  const secondFails = second.quality?.failures?.length ?? 999;

  return secondFails < firstFails ? second : first;
}
