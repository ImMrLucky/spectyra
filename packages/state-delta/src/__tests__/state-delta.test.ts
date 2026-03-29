/**
 * Phase 4: diff, refs, compiler, event bridge, summary.
 */
import assert from "node:assert";
import type { SpectyraEvent } from "@spectyra/event-core";
import { shallowDiffState } from "../diff.js";
import { unchangedKeySet } from "../stable-memory.js";
import { RefStore } from "../refs.js";
import { compileNextHopPayload } from "../compiler.js";
import { SharedContextIndex } from "../shared-context.js";
import { extractStateSnapshotsFromSpectyraEvents } from "../events-bridge.js";
import { summarizeStateDeltaFromSnapshots } from "../summary.js";

const diff = shallowDiffState(
  { a: 1, b: "x" },
  { a: 1, b: "y", c: 3 },
);
assert.deepStrictEqual(Object.keys(diff.unchanged), ["a"]);
assert.strictEqual(diff.changed.b?.before, "x");
assert.strictEqual(diff.added.c, 3);
assert.deepStrictEqual(diff.removed, []);

const stable = unchangedKeySet({ x: 1 }, { x: 1, y: 2 });
assert.ok(stable.has("x"));

const store = new RefStore();
const h = store.put({ big: "x".repeat(300) });
assert.match(h, /^ref:sha256:[a-f0-9]{16}$/);
assert.deepStrictEqual(store.get(h), { big: "x".repeat(300) });

const hop = compileNextHopPayload({ a: 1 }, { a: 1, b: "x".repeat(300) }, store);
assert.ok(Object.keys(hop.valueRefs).includes("b"));
assert.ok(hop.keysUnchanged.includes("a"));

const idx = new SharedContextIndex();
assert.strictEqual(idx.note("s1", "t1", "k", "hello").reused, false);
assert.strictEqual(idx.note("s2", "t2", "k", "hello").reused, true);

function ev(
  partial: Partial<SpectyraEvent> & Pick<SpectyraEvent, "id" | "type" | "sessionId" | "runId">,
): SpectyraEvent {
  return {
    id: partial.id,
    type: partial.type,
    timestamp: partial.timestamp ?? "2026-03-01T12:00:00.000Z",
    source: partial.source ?? { adapterId: "t", integrationType: "sdk-wrapper" },
    sessionId: partial.sessionId,
    runId: partial.runId,
    stepId: partial.stepId,
    payload: partial.payload ?? {},
    security: partial.security ?? {
      telemetryMode: "local",
      promptSnapshotMode: "local_only",
      localOnly: true,
    },
  };
}

const stream: SpectyraEvent[] = [
  ev({
    id: "1",
    type: "step_started",
    sessionId: "sess",
    runId: "r1",
    stepId: "s1",
    payload: { estimatedInputTokens: 100 },
  }),
  ev({
    id: "2",
    type: "optimization_applied",
    sessionId: "sess",
    runId: "r1",
    stepId: "s1",
    payload: { estimatedInputTokensAfter: 80, transformsApplied: ["refpack"] },
  }),
  ev({
    id: "3",
    type: "step_started",
    sessionId: "sess",
    runId: "r1",
    stepId: "s2",
    payload: { estimatedInputTokens: 80 },
  }),
];

const snaps = extractStateSnapshotsFromSpectyraEvents(stream);
assert.ok(snaps.length >= 2);
const summary = summarizeStateDeltaFromSnapshots(snaps);
assert.ok(summary.transitionCount >= 1);
assert.ok(summary.snapshotCount >= 2);

console.log("✅ state-delta Phase 4 tests passed");
