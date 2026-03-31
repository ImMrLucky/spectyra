import type { WorkflowPolicyConfig } from "./types.js";

/**
 * Production-oriented defaults: callers pass `mode` (enforce vs observe).
 * With `mode: "enforce"`, `blockOnSeverity: "warn"` blocks on warn- and block-level violations.
 */
export const defaultWorkflowPolicyConfig: WorkflowPolicyConfig = {
  mode: "enforce",
  maxLowValueStepRatio: 0.55,
  maxRepeatLoopGroups: 8,
  maxSingleTransitionWireChars: 500_000,
  blockOnSeverity: "warn",
  maxSessionSteps: 50,
  maxAvgTransitionWireChars: 100_000,
  maxConsecutiveLowValueSteps: 3,
};
