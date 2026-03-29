import { defaultWorkflowPolicyConfig } from "./defaults.js";
import type {
  PolicySeverity,
  WorkflowPolicyConfig,
  WorkflowPolicyContext,
  WorkflowPolicyResult,
  WorkflowPolicyViolation,
} from "./types.js";

const SEVERITY_ORDER: PolicySeverity[] = ["info", "warn", "block"];

function severityMeetsThreshold(s: PolicySeverity, min: PolicySeverity): boolean {
  return SEVERITY_ORDER.indexOf(s) >= SEVERITY_ORDER.indexOf(min);
}

/**
 * Evaluate declarative workflow rules. Does not call providers or read raw prompts.
 */
export function evaluateWorkflowPolicies(
  ctx: WorkflowPolicyContext,
  config: Partial<WorkflowPolicyConfig> = {},
): WorkflowPolicyResult {
  const c = { ...defaultWorkflowPolicyConfig, ...config };
  const violations: WorkflowPolicyViolation[] = [];

  const ex = ctx.execution;
  if (ex && ex.stepOrder.length > 0 && c.maxLowValueStepRatio != null) {
    const lowish = [...Object.values(ex.scores)].filter(
      (s) => s.classification === "low_value" || s.classification === "likely_redundant",
    ).length;
    const ratio = lowish / ex.stepOrder.length;
    if (ratio > c.maxLowValueStepRatio) {
      violations.push({
        code: "high_low_value_ratio",
        message: `Low-value / redundant step ratio ${ratio.toFixed(2)} exceeds ${c.maxLowValueStepRatio}`,
        severity: "warn",
      });
    }
  }

  if (ex && c.maxRepeatLoopGroups != null && ex.repeatLoops.length > c.maxRepeatLoopGroups) {
    violations.push({
      code: "too_many_repeat_loops",
      message: `Repeat loop groups ${ex.repeatLoops.length} exceeds ${c.maxRepeatLoopGroups}`,
      severity: "info",
    });
  }

  const sd = ctx.stateDelta;
  if (sd && c.maxSingleTransitionWireChars != null) {
    for (const t of sd.transitions) {
      if (t.wireEstimateChars > c.maxSingleTransitionWireChars) {
        violations.push({
          code: "large_state_delta_hop",
          message: `Transition ${t.fromStepId}→${t.toStepId} wire estimate ${t.wireEstimateChars} chars exceeds ${c.maxSingleTransitionWireChars}`,
          severity: "warn",
          stepIds: [t.fromStepId, t.toStepId],
        });
      }
    }
  }

  const blockOn = c.blockOnSeverity ?? "block";
  const shouldBlock =
    c.mode === "enforce" &&
    violations.some((v) => severityMeetsThreshold(v.severity, blockOn));

  return {
    mode: c.mode,
    violations,
    shouldBlock,
  };
}
