import type { WorkflowPolicyResult } from "@spectyra/workflow-policy";

/**
 * Thrown by `spectyra.complete()` when `workflowPolicy.mode === "enforce"` and
 * {@link evaluateWorkflowPolicies} sets `shouldBlock` (parity with companion HTTP 422).
 */
export class WorkflowPolicyBlockedError extends Error {
  readonly result: WorkflowPolicyResult;

  constructor(result: WorkflowPolicyResult) {
    super(
      "Workflow policy blocked this call before the upstream provider (see `result.violations`).",
    );
    this.name = "WorkflowPolicyBlockedError";
    this.result = result;
  }
}
