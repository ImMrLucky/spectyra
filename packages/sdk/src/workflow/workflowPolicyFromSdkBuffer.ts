import type { WorkflowPolicyMode, WorkflowPolicyResult } from "@spectyra/workflow-policy";
import { sdkEventEngine } from "../events/sdkEvents.js";
import { evaluateWorkflowPolicyFromEvents } from "./sdkWorkflowPolicyFromEvents.js";

/** Same payload as `GET /v1/analytics/workflow-policy/summary` on Local Companion. */
export function workflowPolicySummaryFromSdkBuffer(
  mode: WorkflowPolicyMode,
): WorkflowPolicyResult {
  return evaluateWorkflowPolicyFromEvents(sdkEventEngine.snapshot(), mode);
}
