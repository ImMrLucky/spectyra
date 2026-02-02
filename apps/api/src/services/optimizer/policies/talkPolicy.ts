import type { PathKind, SemanticUnit, SpectralResult } from "../spectral/types";
import type { ChatMessage } from "../unitize";

// Transforms (implement or stub no-op)
import { applyContextCompaction } from "../transforms/contextCompaction";
import { applyDeltaPrompting } from "../transforms/deltaPrompting";
import { postProcessOutput } from "../transforms/postProcess";

export interface TalkPolicyOptions {
  maxRefs: number;                 // e.g. 8
  compactionAggressive: boolean;   // for REUSE
  trimAggressive: boolean;         // for REUSE
  keepLastTurns?: number;          // optional, defaults to 2 or 3 based on reuse
}

export interface TalkPolicyInput {
  messages: ChatMessage[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  opts: TalkPolicyOptions;
}

export interface TalkPolicyOutput {
  messagesFinal: ChatMessage[];
  debug: {
    refsUsed: string[];
    deltaUsed: boolean;
    trimLevel: "none" | "moderate" | "aggressive";
  };
}

/**
 * Talk path policy:
 * - REUSE: compact stable units => REFs + delta-only
 * - EXPAND: moderate compaction + mild delta prompting
 * - ASK_CLARIFY: respond with a short clarifying question (handled upstream by optimizer)
 */
export function applyTalkPolicy(input: TalkPolicyInput): TalkPolicyOutput {
  const { messages, units, spectral, opts } = input;

  const stableUnitIds = spectral.stableNodeIdx
    .map(i => units[i]?.id)
    .filter(Boolean) as string[];

  const unstableUnitIds = spectral.unstableNodeIdx
    .map(i => units[i]?.id)
    .filter(Boolean) as string[];

  // Policy invariant: trim-only. No bulk instructional text (instructional text folded into SCC).
  const reuse = spectral.recommendation === "REUSE";

  // 1) Context compaction: replace stable content with REFs (bounded) — reduces size only
  const { messages: afterCompaction, refsUsed } = applyContextCompaction({
    path: "talk",
    messages,
    units,
    stableUnitIds: stableUnitIds.slice(0, opts.maxRefs),
    aggressive: reuse && opts.compactionAggressive,
    maxRefs: opts.maxRefs,
    keepLastTurns: opts.keepLastTurns ?? (reuse ? 2 : 3)
  });

  // 2) Delta prompting disabled: policies may not add bulk text; SCC is authoritative
  const { messages: afterDelta, deltaUsed } = applyDeltaPrompting({
    path: "talk",
    messages: afterCompaction,
    enabled: false,
    noteUnstableUnitIds: unstableUnitIds
  });

  // 3) Post process: trimming level (actual trimming done after LLM response)
  const trimLevel: TalkPolicyOutput["debug"]["trimLevel"] =
    reuse && opts.trimAggressive ? "aggressive" : "moderate";

  return {
    messagesFinal: afterDelta,
    debug: {
      refsUsed,
      deltaUsed,
      trimLevel
    }
  };
}

/**
 * Post-process hook for Talk output. Called after provider returns text.
 */
export function postProcessTalkOutput(text: string, trimLevel: "none" | "moderate" | "aggressive"): string {
  return postProcessOutput({
    path: "talk",
    text,
    trimLevel
  });
}
