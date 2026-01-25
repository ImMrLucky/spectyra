/**
 * Redaction middleware to strip moat/internal data from API responses.
 * Protects IP by ensuring frontend never receives optimization internals.
 * 
 * ALWAYS strips internal fields for public endpoints.
 * Only returns public schemas (see contracts/schemas/).
 */

const EXPOSE_INTERNAL_DEBUG = process.env.EXPOSE_INTERNAL_DEBUG === "true";

export interface RedactableRun {
  id?: string;
  run_id?: string;
  debug?: any;
  promptFinal?: any;
  debugInternal?: any;
  promptHash?: string;
  workloadKey?: string;
  optimizer_debug?: any;
  spectral_debug?: any;
  [key: string]: any;
}

/**
 * Redact internal debug data from a run record.
 * Conforms to chat.response.public.json schema.
 * NEVER returns: prompt_final contents, optimizer_debug, spectral_debug, debug_internal_json, refsUsed, unit arrays.
 */
export function redactRun(run: RedactableRun): any {
  // Always strip internal fields, even in dev mode (unless explicitly enabled)
  const {
    debug,
    promptFinal,
    debugInternal,
    promptHash,
    workloadKey,
    optimizer_debug,
    spectral_debug,
    refsUsed,
    deltaUsed,
    codeSliced,
    patchMode,
    retry,
    retry_reason,
    first_failures,
    ...rest
  } = run;
  
  // Build public-safe response matching chat.response.public.json
  const safe: any = {
    run_id: run.id || run.run_id,
    created_at: run.createdAt || run.created_at,
    mode: run.mode,
    path: run.path,
    optimization_level: run.optimizationLevel ?? run.optimization_level ?? 2,
    provider: run.provider,
    model: run.model,
    response_text: run.responseText || run.response_text,
    usage: run.usage ? {
      input_tokens: run.usage.input_tokens,
      output_tokens: run.usage.output_tokens,
      total_tokens: run.usage.total_tokens,
    } : undefined,
    cost_usd: run.costUsd || run.cost_usd,
  };
  
  // Add savings if available (from ledger lookup or computed)
  if (run.savings) {
    const savings = run.savings;
    safe.savings = {
      savings_type: savings.savings_type || (run.mode === "optimized" ? "estimated" : null),
      tokens_saved: savings.tokensSaved || savings.tokens_saved,
      pct_saved: savings.pctSaved || savings.pct_saved,
      cost_saved_usd: savings.costSavedUsd || savings.cost_saved_usd,
      confidence_band: savings.confidence_band || confidenceToBand(savings.confidence || 1.0),
    };
  }
  
  // Only expose debug in explicit dev mode
  if (EXPOSE_INTERNAL_DEBUG) {
    safe.debug_internal = debugInternal;
    safe.optimizer_debug = optimizer_debug;
    safe.spectral_debug = spectral_debug;
  }
  
  return safe;
}

/**
 * Redact internal data from a replay result.
 * Conforms to replay.response.public.json schema.
 */
export function redactReplayResult(result: any): any {
  const {
    baseline,
    optimized,
    savings,
    verified_savings,
    ...rest
  } = result;
  
  const safe: any = {
    replay_id: result.replay_id || result.replayId,
    created_at: result.created_at || result.createdAt,
    scenario_id: result.scenario_id || result.scenarioId,
    path: result.path,
    optimization_level: result.optimization_level || result.optimizationLevel,
    provider: result.provider,
    model: result.model,
    baseline: baseline ? redactRun(baseline) : undefined,
    optimized: optimized ? redactRun(optimized) : undefined,
    verified_savings: verified_savings || (savings ? {
      tokens_saved: savings.tokensSaved || savings.tokens_saved,
      pct_saved: savings.pctSaved || savings.pct_saved,
      cost_saved_usd: savings.costSavedUsd || savings.cost_saved_usd,
    } : undefined),
  };
  
  return safe;
}

/**
 * Redact internal data from savings summary/breakdown.
 * Ensures no workload_key, prompt_hash, or other internals leak.
 */
export function redactSavingsData(data: any): any {
  // Remove any internal fields
  if (Array.isArray(data)) {
    return data.map(item => {
      const { workloadKey, promptHash, debug_internal_json, ...safe } = item;
      return safe;
    });
  }
  
  const { workloadKey, promptHash, debug_internal_json, ...safe } = data;
  return safe;
}

/**
 * Convert confidence score (0-1) to band.
 */
function confidenceToBand(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.70) return "medium";
  return "low";
}
