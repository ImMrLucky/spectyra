import type { SemanticUnit, SpectralResult } from "../spectral/types";
import type { ChatMessage } from "../unitize";

// Transforms (trim-only; no bulk system memory — SCC is authoritative)
import { applyCodeSlicing } from "../transforms/codeSlicer";
import { applyPatchMode } from "../transforms/patchMode";
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

export interface CodePolicyOptions {
  maxRefs: number;               // e.g. 6 (used by budgets; RefPack in optimizer)
  patchModeDefault: boolean;     // true
  patchModeAggressiveOnReuse: boolean; // true
  trimAggressive: boolean;       // true
  keepLastTurns?: number;       // optional, defaults to 2 or 3 based on reuse
  codeSlicerAggressive?: boolean; // optional, defaults based on level
}

export interface CodePolicyInput {
  messages: ChatMessage[];
  units: SemanticUnit[];
  spectral: SpectralResult;
  opts: CodePolicyOptions;
}

export interface CodePolicyOutput {
  messagesFinal: ChatMessage[];
  debug: {
    refsUsed: string[];
    deltaUsed: boolean;
    codeSliced: boolean;
    patchMode: boolean;
    trimLevel: "moderate" | "aggressive";
  };
}

/**
 * Code path policy:
 * - Always try to slice code context
 * - Prefer patch-only output (unified diff + short bullets), especially when REUSE
 * - Delta prompting is generally enabled
 */
export function applyCodePolicy(input: CodePolicyInput): CodePolicyOutput {
  const { messages, units, spectral, opts } = input;

  const unstableUnitIds = spectral.unstableNodeIdx
    .map((i) => units[i]?.id)
    .filter(Boolean) as string[];

  const reuse = spectral.recommendation === "REUSE";

  // PG-SCC invariant: if SCC is already present, do not add any system memory / recap / summary.
  if (hasSCC(messages)) {
    const trimLevel: CodePolicyOutput["debug"]["trimLevel"] =
      reuse && opts.trimAggressive ? "aggressive" : "moderate";
    return {
      messagesFinal: messages,
      debug: {
        refsUsed: [],
        deltaUsed: false,
        codeSliced: false,
        patchMode: false,
        trimLevel,
      },
    };
  }

  // 1) Code slicing (always on in code path when no SCC)
  const sliced = applyCodeSlicing({
    messages,
    aggressive: opts.codeSlicerAggressive ?? reuse,
  });

  // 2) Delta prompting disabled: SCC is authoritative (trim-only)
  const { messages: afterDelta, deltaUsed } = applyDeltaPrompting({
    path: "code",
    messages: sliced.messages,
    enabled: false,
    noteUnstableUnitIds: unstableUnitIds,
  });

  // 3) Patch mode decision
  const patchMode = opts.patchModeDefault || (reuse && opts.patchModeAggressiveOnReuse);
  const patched = applyPatchMode({
    messages: afterDelta,
    enabled: patchMode,
  });

  const trimLevel: CodePolicyOutput["debug"]["trimLevel"] =
    reuse && opts.trimAggressive ? "aggressive" : "moderate";

  return {
    messagesFinal: patched.messages,
    debug: {
      refsUsed: [],
      deltaUsed,
      codeSliced: sliced.changed,
      patchMode,
      trimLevel,
    },
  };
}

/**
 * Post-process hook for Code output. Called after provider returns text.
 */
export function postProcessCodeOutput(text: string, trimLevel: "moderate" | "aggressive"): string {
  return postProcessOutput({
    path: "code",
    text,
    trimLevel
  });
}
