import type { PathKind, SemanticUnit, SpectralResult } from "../spectral/types";
import type { ChatMessage } from "../unitize";

// Transforms (trim-only; no bulk system memory — SCC is authoritative)
import { applyDeltaPrompting } from "../transforms/deltaPrompting";
import { postProcessOutput } from "../transforms/postProcess";

/** True if messages already contain PG-SCC state (single system message). Policies must not add memory/recap. */
export function hasSCC(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role === "system" &&
      typeof m.content === "string" &&
      m.content.includes("[SPECTYRA_STATE_")
  );
}

export interface TalkPolicyOptions {
  maxRefs: number;                 // e.g. 8 (used by budgets; RefPack in optimizer)
  compactionAggressive: boolean;   // legacy; unused when PG-SCC only
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

  const unstableUnitIds = spectral.unstableNodeIdx
    .map((i) => units[i]?.id)
    .filter(Boolean) as string[];

  // PG-SCC invariant: if SCC is already present, do not add any system memory / recap / summary.
  if (hasSCC(messages)) {
    const reuse = spectral.recommendation === "REUSE";
    const trimLevel: TalkPolicyOutput["debug"]["trimLevel"] =
      reuse && opts.trimAggressive ? "aggressive" : "moderate";
    return {
      messagesFinal: messages,
      debug: { refsUsed: [], deltaUsed: false, trimLevel },
    };
  }

  // Trim-only: delta prompting disabled; SCC is authoritative.
  const { messages: afterDelta, deltaUsed } = applyDeltaPrompting({
    path: "talk",
    messages,
    enabled: false,
    noteUnstableUnitIds: unstableUnitIds,
  });

  const reuse = spectral.recommendation === "REUSE";
  const trimLevel: TalkPolicyOutput["debug"]["trimLevel"] =
    reuse && opts.trimAggressive ? "aggressive" : "moderate";

  return {
    messagesFinal: afterDelta,
    debug: { refsUsed: [], deltaUsed, trimLevel },
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
