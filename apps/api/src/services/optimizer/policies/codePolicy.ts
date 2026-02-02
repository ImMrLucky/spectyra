import type { SemanticUnit, SpectralResult } from "../spectral/types";
import type { ChatMessage } from "../unitize";

// Transforms (implement or stub)
import { applyCodeSlicing } from "../transforms/codeSlicer";
import { applyPatchMode } from "../transforms/patchMode";
import { applyContextCompaction } from "../transforms/contextCompaction";
import { applyDeltaPrompting } from "../transforms/deltaPrompting";
import { postProcessOutput } from "../transforms/postProcess";

export interface CodePolicyOptions {
  maxRefs: number;               // e.g. 6
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

  const stableUnitIds = spectral.stableNodeIdx
    .map(i => units[i]?.id)
    .filter(Boolean) as string[];

  const unstableUnitIds = spectral.unstableNodeIdx
    .map(i => units[i]?.id)
    .filter(Boolean) as string[];

  const reuse = spectral.recommendation === "REUSE";

  // 1) Code slicing (always on in code path)
  const sliced = applyCodeSlicing({
    messages,
    aggressive: opts.codeSlicerAggressive ?? reuse
  });

  // 2) Context compaction (stable refs)
  const { messages: afterCompaction, refsUsed } = applyContextCompaction({
    path: "code",
    messages: sliced.messages,
    units,
    stableUnitIds: stableUnitIds.slice(0, opts.maxRefs),
    aggressive: reuse,
    maxRefs: opts.maxRefs,
    keepLastTurns: opts.keepLastTurns ?? (reuse ? 2 : 3)
  });

  // 3) Delta prompting disabled: policies may not add bulk text; SCC is authoritative (trim-only)
  const { messages: afterDelta, deltaUsed } = applyDeltaPrompting({
    path: "code",
    messages: afterCompaction,
    enabled: false,
    noteUnstableUnitIds: unstableUnitIds
  });

  // 4) Patch mode decision
  const patchMode = opts.patchModeDefault || (reuse && opts.patchModeAggressiveOnReuse);
  const patched = applyPatchMode({
    messages: afterDelta,
    enabled: patchMode
  });

  const trimLevel: CodePolicyOutput["debug"]["trimLevel"] =
    reuse && opts.trimAggressive ? "aggressive" : "moderate";

  return {
    messagesFinal: patched.messages,
    debug: {
      refsUsed,
      deltaUsed,
      codeSliced: sliced.changed,
      patchMode,
      trimLevel
    }
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
