import type { SpectyraWasteSignal } from "./monitorTypes.js";

/** Premium / frontier IDs where tiny completions may be “overkill” (heuristic). */
const PREMIUM_MODEL = /gpt-4(?!o-mini)|gpt-4-turbo|claude-3-opus|claude-opus|o1-pro|o1-preview|\bo3\b|gpt-5/i;

export interface WasteContextFromComplete {
  inputTokens: number;
  outputTokens: number;
  promptLengthChars?: number;
  messageCount?: number;
  toolsEnabled?: boolean;
  model?: string;
  latencyMs: number;
  actualCostUsd?: number;
  missedSavingsUsd?: number;
}

export interface WasteContextFromHttpAuto {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  actualCostUsd?: number;
}

function push(
  out: SpectyraWasteSignal[],
  s: Omit<SpectyraWasteSignal, "confidence"> & { confidence?: SpectyraWasteSignal["confidence"] },
): void {
  out.push({ ...s, confidence: s.confidence ?? "medium" });
}

/**
 * Metadata-only waste hints after an explicit SDK `complete()` / `run()` row is built.
 * Heuristics are conservative; all signals are safe to persist (no prompt content).
 */
export function buildWasteSignalsFromCompletePath(ctx: WasteContextFromComplete): SpectyraWasteSignal[] {
  const signals: SpectyraWasteSignal[] = [];
  const inTok = Math.max(0, ctx.inputTokens);
  const outTok = Math.max(0, ctx.outputTokens);
  const chars = ctx.promptLengthChars ?? 0;
  const msgs = ctx.messageCount ?? 0;
  const cost = ctx.actualCostUsd ?? 0;
  const missed = ctx.missedSavingsUsd ?? 0;

  if (chars > 120_000 || inTok > 90_000) {
    push(signals, {
      type: "large_context",
      severity: inTok > 150_000 || chars > 200_000 ? "warning" : "info",
      title: "Large working context",
      description:
        "This call used a very large prompt or tokenized context. Consider trimming history, RAG chunks, or tool payloads.",
      confidence: "high",
    });
  }

  if (outTok > 12_000 || (inTok > 400 && outTok > inTok * 3)) {
    push(signals, {
      type: "high_output_tokens",
      severity: outTok > 25_000 ? "warning" : "info",
      title: "High completion size",
      description:
        "Completion tokens are high relative to input. Long generations drive cost; check verbosity settings or max_tokens.",
      confidence: inTok > 0 ? "high" : "medium",
    });
  }

  if (ctx.toolsEnabled && msgs > 35) {
    push(signals, {
      type: "tool_overuse",
      severity: msgs > 60 ? "warning" : "info",
      title: "Many messages with tools",
      description:
        "Long tool-heavy threads often accumulate redundant context. Consider summarization or a slimmer tool schema.",
      confidence: "low",
    });
  }

  if (ctx.latencyMs > 45_000 && cost > 0.15) {
    push(signals, {
      type: "slow_expensive_call",
      severity: ctx.latencyMs > 120_000 ? "warning" : "info",
      title: "Slow and costly request",
      description: "High latency combined with meaningful spend often indicates large payloads or provider throttling.",
      confidence: "medium",
    });
  }

  if (ctx.model && PREMIUM_MODEL.test(ctx.model) && inTok > 5_000 && outTok < 200) {
    push(signals, {
      type: "model_overkill",
      severity: "info",
      title: "Premium model, tiny output",
      description:
        "A top-tier model was used with a large prompt but very small completion. A smaller or faster model may suffice for similar tasks.",
      confidence: "low",
    });
  }

  if (missed > 0.05 && cost > 0) {
    push(signals, {
      type: "cache_opportunity",
      severity: missed > cost * 0.25 ? "warning" : "info",
      title: "Optimization left savings on the table",
      description:
        "Spectyra estimates meaningful missed savings on this call. Enabling optimization (when entitled) may reduce spend.",
      estimatedWasteUsd: missed,
      confidence: "medium",
    });
  }

  return signals;
}

/** Narrower heuristics for auto-instrumented HTTP/fetch rows (less context). */
export function buildWasteSignalsFromHttpAutoPath(ctx: WasteContextFromHttpAuto): SpectyraWasteSignal[] {
  const signals: SpectyraWasteSignal[] = [];
  const inTok = Math.max(0, ctx.inputTokens);
  const outTok = Math.max(0, ctx.outputTokens);
  const cost = ctx.actualCostUsd ?? 0;

  if (inTok > 80_000) {
    push(signals, {
      type: "large_context",
      severity: "warning",
      title: "Large prompt tokens",
      description: "Provider usage shows a very large input token count for this response.",
      confidence: "high",
    });
  }

  if (outTok > 12_000 || (inTok > 500 && outTok > inTok * 3)) {
    push(signals, {
      type: "high_output_tokens",
      severity: "info",
      title: "High completion tokens",
      description: "Output token volume is high; consider tightening the task or lowering max_tokens.",
      confidence: "medium",
    });
  }

  if (ctx.latencyMs > 50_000 && cost > 0.1) {
    push(signals, {
      type: "slow_expensive_call",
      severity: "info",
      title: "Slow provider response",
      description: "This LLM HTTP call took a long time and incurred noticeable cost.",
      confidence: "low",
    });
  }

  return signals;
}
