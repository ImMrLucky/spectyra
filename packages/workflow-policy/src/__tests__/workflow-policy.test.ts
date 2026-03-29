/**
 * Phase 6 — workflow policy evaluator (observe / enforce).
 */
import assert from "node:assert";
import { evaluateWorkflowPolicies } from "../evaluator.js";

const observe = evaluateWorkflowPolicies(
  {
    execution: {
      stepOrder: ["a", "b", "c"],
      scores: {
        a: { classification: "low_value" },
        b: { classification: "likely_redundant" },
        c: { classification: "critical" },
      },
      repeatLoops: [],
    },
  },
  { mode: "observe", maxLowValueStepRatio: 0.5 },
);
assert.strictEqual(observe.shouldBlock, false);
assert.ok(observe.violations.some((v) => v.code === "high_low_value_ratio"));

const enforce = evaluateWorkflowPolicies(
  {
    execution: {
      stepOrder: ["x"],
      scores: { x: { classification: "critical" } },
      repeatLoops: new Array(10).fill(["x"]),
    },
  },
  { mode: "enforce", maxRepeatLoopGroups: 5, blockOnSeverity: "info" },
);
assert.strictEqual(enforce.shouldBlock, true);

/** Default enforce + blockOnSeverity warn blocks on high_low_value_ratio (warn). */
const enforceDefaultWarn = evaluateWorkflowPolicies(
  {
    execution: {
      stepOrder: ["a", "b", "c"],
      scores: {
        a: { classification: "low_value" },
        b: { classification: "likely_redundant" },
        c: { classification: "critical" },
      },
      repeatLoops: [],
    },
  },
  { mode: "enforce", maxLowValueStepRatio: 0.5 },
);
assert.strictEqual(enforceDefaultWarn.shouldBlock, true);

console.log("✅ workflow-policy Phase 6 tests passed");
