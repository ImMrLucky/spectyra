/**
 * Phase 2: adapters + ingestion engine + session aggregator (no Local Companion process).
 */
import assert from "node:assert";
import { createEventIngestionEngine } from "@spectyra/event-core";
import type { SavingsReport } from "@spectyra/core-types";
import { sdkEventAdapter } from "../sdk/adapter.js";
import { localCompanionEventAdapter } from "../local-companion/adapter.js";

function minimalReport(overrides: Partial<SavingsReport> = {}): SavingsReport {
  return {
    runId: "r_pipe",
    mode: "on",
    integrationType: "sdk-wrapper",
    provider: "p",
    model: "m",
    inputTokensBefore: 500,
    inputTokensAfter: 300,
    outputTokens: 100,
    estimatedCostBefore: 0,
    estimatedCostAfter: 0,
    estimatedSavings: 0,
    estimatedSavingsPct: 40,
    telemetryMode: "local",
    promptSnapshotMode: "local_only",
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: ["test_transform"],
    success: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// SDK path: explicit session_start then complete
const sdkEngine = createEventIngestionEngine({ adapters: [sdkEventAdapter], dedupe: true });
sdkEngine.ingest({
  kind: "spectyra.sdk.v1",
  phase: "session_start",
  sessionId: "sdk_sess",
  runId: "sdk_run",
  report: minimalReport({ runId: "sdk_run", integrationType: "sdk-wrapper" }),
});
sdkEngine.ingest({
  kind: "spectyra.sdk.v1",
  phase: "complete",
  sessionId: "sdk_sess",
  runId: "sdk_run",
  report: minimalReport({ runId: "sdk_run", inputTokensBefore: 900, inputTokensAfter: 400 }),
});
const sdkLive = sdkEngine.getLiveState();
assert.strictEqual(sdkLive.session?.sessionId, "sdk_sess");
assert.ok((sdkLive.session?.totalSteps ?? 0) >= 1);

// Companion path: chat_completed only (no session_started) — aggregator must still bind session id
const compEngine = createEventIngestionEngine({ adapters: [localCompanionEventAdapter], dedupe: true });
compEngine.ingest({
  kind: "spectyra.companion.v1",
  phase: "chat_completed",
  sessionId: "comp_sess",
  runId: "comp_run",
  report: minimalReport({ runId: "comp_run", integrationType: "local-companion" }),
});
const compLive = compEngine.getLiveState();
assert.strictEqual(compLive.session?.sessionId, "comp_sess");
assert.ok((compLive.session?.totalSteps ?? 0) >= 1);

console.log("✅ event-adapters ingestion pipeline + aggregator ok");
