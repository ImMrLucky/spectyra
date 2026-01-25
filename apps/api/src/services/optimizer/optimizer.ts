import { PathKind, SemanticUnit, SpectralOptions } from "./spectral/types";
import { unitizeMessages, ChatMessage, UnitizeOptions } from "./unitize";
import { buildGraph } from "./buildGraph";
import { spectralAnalyze } from "./spectral/spectralCore";
import { applyTalkPolicy, postProcessTalkOutput } from "./policies/talkPolicy";
import { applyCodePolicy, postProcessCodeOutput } from "./policies/codePolicy";
import { runQualityGuard, RequiredCheck } from "./quality/qualityGuard";

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

    // Apply policy transforms (pre-LLM)
    let messagesFinal: ChatMessage[] = messages;
    let policyDebug: any = {};

    if (path === "talk") {
      const p = applyTalkPolicy({
        messages,
        units,
        spectral,
        opts: localCfg.talkPolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    } else {
      const p = applyCodePolicy({
        messages,
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

    // Build comprehensive debug internal data
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
      cacheHit: false, // Phase 3: will be set when cache is implemented
      driftScore: undefined, // Phase 2: will be set when drift is implemented
    };

    return {
      promptFinal: { messages: messagesFinal },
      responseText,
      usage: out.usage,
      spectral,
      quality: { ...quality, retried: false },
      debug: { mode: "optimized", ...policyDebug },
      debugInternal, // Include for storage
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
        messages,
        units,
        spectral,
        opts: localCfg.talkPolicy
      });
      messagesFinal = p.messagesFinal;
      policyDebug = p.debug;
    } else {
      const p = applyCodePolicy({
        messages,
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
