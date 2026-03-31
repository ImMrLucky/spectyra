/**
 * Policy outcomes are always computed; enforcement is a separate consumer decision.
 */

export type WorkflowPolicyMode = "observe" | "enforce";

export type PolicySeverity = "info" | "warn" | "block";

export type WorkflowPolicyViolation = {
  code: string;
  message: string;
  severity: PolicySeverity;
  stepIds?: string[];
};

export type WorkflowPolicyResult = {
  mode: WorkflowPolicyMode;
  violations: WorkflowPolicyViolation[];
  /** When mode is enforce, callers may use this to block side effects (provider calls, etc.). */
  shouldBlock: boolean;
};

/** Serializable inputs from analytics pipelines (no graph objects required). */
export type WorkflowPolicyContext = {
  execution?: {
    stepOrder: string[];
    scores: Record<string, { classification: string }>;
    repeatLoops: string[][];
  };
  stateDelta?: {
    transitions: Array<{
      fromStepId: string;
      toStepId: string;
      wireEstimateChars: number;
    }>;
  };
  session?: {
    stepCount?: number;
  };
};

export type WorkflowPolicyConfig = {
  mode: WorkflowPolicyMode;
  /** Max fraction of steps that may be low_value or likely_redundant (0–1). */
  maxLowValueStepRatio?: number;
  /** Flag when repeat loop groups exceed this count. */
  maxRepeatLoopGroups?: number;
  /** Flag when any single compiled hop estimate exceeds this character count. */
  maxSingleTransitionWireChars?: number;
  /** In enforce mode, only severities at or above this produce shouldBlock. */
  blockOnSeverity?: PolicySeverity;
  /** Max session steps before warning (default 50). */
  maxSessionSteps?: number;
  /** Max average wireEstimateChars across all transitions (default 100000). */
  maxAvgTransitionWireChars?: number;
  /** Max consecutive low-value/redundant steps before warning (default 3). */
  maxConsecutiveLowValueSteps?: number;
};
