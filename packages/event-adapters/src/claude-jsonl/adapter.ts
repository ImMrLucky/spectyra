/**
 * Claude JSONL transcript lines — supplemental; reuses openclaw heuristics with a distinct adapter id.
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import { openclawJsonlAdapter, type OpenclawJsonlPayload } from "../openclaw-jsonl/adapter.js";

export type ClaudeJsonlPayload = Omit<OpenclawJsonlPayload, "kind"> & { kind: "spectyra.claude.jsonl.v1" };

export const claudeJsonlAdapter: SpectyraEventAdapter<ClaudeJsonlPayload> = {
  id: "spectyra.claude.jsonl.v1",
  integrationType: "claude-jsonl",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as ClaudeJsonlPayload).kind === "spectyra.claude.jsonl.v1"
    );
  },
  ingest(input: ClaudeJsonlPayload, ctx?: AdapterContext) {
    const mapped: OpenclawJsonlPayload = {
      kind: "spectyra.openclaw.jsonl.v1",
      record: input.record,
      sessionId: input.sessionId,
      runId: input.runId,
    };
    return openclawJsonlAdapter.ingest(mapped, ctx).map((e: SpectyraEvent) => ({
      ...e,
      source: { adapterId: claudeJsonlAdapter.id, integrationType: "claude-jsonl" },
    }));
  },
};
