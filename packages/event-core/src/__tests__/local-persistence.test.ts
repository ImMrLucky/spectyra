/**
 * Phase 2: JSONL round-trip for normalized events.
 */
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { appendNormalizedEventJsonl, readRecentNormalizedEventsJsonl } from "../local-persistence.js";
import type { SpectyraEvent } from "../types.js";

async function run() {
  const dir = await mkdtemp(join(tmpdir(), "spectyra-ev-"));
  const file = join(dir, "events.jsonl");
  try {
    const base = {
      source: { adapterId: "test", integrationType: "unknown" as const },
      sessionId: "sess",
      runId: "run",
      security: {
        telemetryMode: "local" as const,
        promptSnapshotMode: "local_only" as const,
        localOnly: true,
      },
      payload: {},
    };
    const e1: SpectyraEvent = {
      id: "1",
      type: "session_started",
      timestamp: new Date().toISOString(),
      ...base,
    };
    const e2: SpectyraEvent = {
      id: "2",
      type: "optimization_applied",
      timestamp: new Date().toISOString(),
      ...base,
      stepId: "s1",
    };
    await appendNormalizedEventJsonl(file, e1);
    await appendNormalizedEventJsonl(file, e2);
    const recent = await readRecentNormalizedEventsJsonl(file, 10);
    assert.strictEqual(recent.length, 2);
    assert.strictEqual(recent[0].type, "session_started");
    assert.strictEqual(recent[1].type, "optimization_applied");
    const tail1 = await readRecentNormalizedEventsJsonl(file, 1);
    assert.strictEqual(tail1.length, 1);
    assert.strictEqual(tail1[0].id, "2");
    console.log("✅ event-core local-persistence round-trip ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
