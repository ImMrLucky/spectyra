/**
 * Workflow policy from normalized events — same pipeline as Local Companion
 * (`tools/local-companion/src/workflowPolicyFromEvents.ts`).
 */

import type { SpectyraEvent } from "@spectyra/event-core";
import { summarizeExecutionGraphFromSpectyraEvents } from "@spectyra/execution-graph";
import {
  extractStateSnapshotsFromSpectyraEvents,
  summarizeStateDeltaFromSnapshots,
} from "@spectyra/state-delta";
import {
  defaultWorkflowPolicyConfig,
  evaluateWorkflowPolicies,
  type WorkflowPolicyMode,
  type WorkflowPolicyResult,
} from "@spectyra/workflow-policy";

export function evaluateWorkflowPolicyFromEvents(
  events: SpectyraEvent[],
  policyMode: WorkflowPolicyMode,
): WorkflowPolicyResult {
  const eg = summarizeExecutionGraphFromSpectyraEvents(events);
  const sd = summarizeStateDeltaFromSnapshots(extractStateSnapshotsFromSpectyraEvents(events));
  const scores: Record<string, { classification: string }> = {};
  for (const [k, v] of Object.entries(eg.scores)) {
    scores[k] = { classification: v.classification };
  }
  return evaluateWorkflowPolicies(
    {
      execution: {
        stepOrder: eg.stepOrder,
        scores,
        repeatLoops: eg.repeatLoops,
      },
      stateDelta: {
        transitions: sd.transitions.map((t) => ({
          fromStepId: t.fromStepId,
          toStepId: t.toStepId,
          wireEstimateChars: t.wireEstimateChars,
        })),
      },
    },
    { ...defaultWorkflowPolicyConfig, mode: policyMode },
  );
}

export type { WorkflowPolicyMode };
