/**
 * Phase 2: session tracker aggregates steps from SavingsReport (same shape companion/SDK use).
 */
import assert from "node:assert";
import { createSessionTracker } from "../session-tracker.js";
import type { SavingsReport } from "@spectyra/core-types";

const report: SavingsReport = {
  runId: "run_phase2_test",
  mode: "on",
  integrationType: "sdk-wrapper",
  provider: "test-provider",
  model: "test-model",
  inputTokensBefore: 1200,
  inputTokensAfter: 800,
  outputTokens: 200,
  estimatedCostBefore: 0.02,
  estimatedCostAfter: 0.015,
  estimatedSavings: 0.005,
  estimatedSavingsPct: 33,
  telemetryMode: "local",
  promptSnapshotMode: "local_only",
  inferencePath: "direct_provider",
  providerBillingOwner: "customer",
  transformsApplied: ["refpack"],
  success: true,
  createdAt: new Date().toISOString(),
};

const tracker = createSessionTracker({
  sessionId: "sess_smoke",
  runId: "run_phase2_test",
  mode: "on",
  integrationType: "sdk-wrapper",
  telemetryMode: "local",
  promptSnapshotMode: "local_only",
});

tracker.recordStepFromReport(report);
const live = tracker.getCurrentSession();
assert.strictEqual(live.sessionId, "sess_smoke");
assert.strictEqual(live.totalSteps, 1);
assert.ok((live.totalInputTokensBefore ?? 0) >= 1200);

const finished = tracker.finish();
assert.strictEqual(finished.sessionId, "sess_smoke");
assert.strictEqual(finished.totalSteps, 1);

console.log("✅ analytics-core session-tracker smoke ok");
