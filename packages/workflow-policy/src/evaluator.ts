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

  // Session step count limit
  if (ctx.session?.stepCount != null && ctx.session.stepCount > (c.maxSessionSteps ?? 50)) {
    violations.push({
      code: "excessive_session_steps",
      message: `Session step count ${ctx.session.stepCount} exceeds ${c.maxSessionSteps ?? 50}`,
      severity: "warn",
    });
  }

  // Rapid state growth (average wireEstimateChars across all transitions)
  if (sd && sd.transitions.length > 0 && c.maxAvgTransitionWireChars != null) {
    const totalWire = sd.transitions.reduce((sum, t) => sum + t.wireEstimateChars, 0);
    const avgWire = totalWire / sd.transitions.length;
    if (avgWire > c.maxAvgTransitionWireChars) {
      violations.push({
        code: "rapid_state_growth",
        message: `Average transition wire estimate ${Math.round(avgWire)} chars exceeds ${c.maxAvgTransitionWireChars}`,
        severity: "warn",
      });
    }
  }

  // Cascade low-value: 3+ consecutive low-value/redundant steps
  if (ex && ex.stepOrder.length > 0) {
    const maxConsec = c.maxConsecutiveLowValueSteps ?? 3;
    let run: string[] = [];
    for (const stepId of ex.stepOrder) {
      const cls = ex.scores[stepId]?.classification;
      if (cls === "low_value" || cls === "likely_redundant") {
        run.push(stepId);
        if (run.length >= maxConsec) {
          violations.push({
            code: "cascade_low_value_steps",
            message: `${run.length} consecutive low-value/redundant steps detected`,
            severity: "warn",
            stepIds: [...run],
          });
          break;
        }
      } else {
        run = [];
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
