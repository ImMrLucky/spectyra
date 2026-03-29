/**
 * Phase 5 — learning gate, calibration merge, pipeline feedback shapes.
 */
import assert from "node:assert";
import type { LearningProfile } from "@spectyra/canonical-model";
import { createEmptyProfile, applyUpdate } from "../local-profile.js";
import { shouldSkipTransformForLearning, TRANSFORMS_SUBJECT_TO_LEARNING_GATE } from "../transform-gate.js";
import { mergeCalibrationForDetection, learningUpdatesFromPipelineRun } from "../pipeline-feedback.js";

assert.ok(TRANSFORMS_SUBJECT_TO_LEARNING_GATE.has("refpack"));
assert.strictEqual(shouldSkipTransformForLearning("refpack", undefined), false);

let p: LearningProfile = createEmptyProfile("t");
for (let i = 0; i < 10; i++) {
  p = applyUpdate(p, {
    scopeId: "t",
    transformId: "refpack",
    success: false,
    tokensSaved: 0,
    featureIds: [],
    timestamp: new Date().toISOString(),
  });
}
assert.strictEqual(shouldSkipTransformForLearning("refpack", p), true);
assert.strictEqual(shouldSkipTransformForLearning("whitespace_normalize", p), false);

const prof = createEmptyProfile("x");
prof.detectorCalibration = { dup_cluster: 0.5 };
const cal = mergeCalibrationForDetection(prof, {
  generatedAt: "",
  transformBenchmarks: {},
  detectorThresholdUpdates: { dup_cluster: 0.2, other: 0.1 },
});
assert.strictEqual(cal!.dup_cluster, 0.5);
assert.strictEqual(cal!.other, 0.1);

const updates = learningUpdatesFromPipelineRun({
  scopeId: "s",
  appliedTransformIds: ["a", "b"],
  tokensSaved: 100,
  featureIds: ["f1"],
  success: true,
});
assert.strictEqual(updates.length, 2);
assert.strictEqual(updates[0]!.tokensSaved, 50);

console.log("✅ learning Phase 5 tests passed");
