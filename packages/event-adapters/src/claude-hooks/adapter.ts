/**
 * Claude-style hook callbacks — stub: map pre-shaped payloads only (no scraping).
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import { defaultSecurity, newId } from "../helpers.js";

export type ClaudeHookPayload = {
  kind: "spectyra.claude-hooks.v1";
  hook: "session_start" | "turn" | "stop";
  sessionId: string;
  runId: string;
  payload?: Record<string, unknown>;
};

export const claudeHooksAdapter: SpectyraEventAdapter<ClaudeHookPayload> = {
  id: "spectyra.claude-hooks.v1",
  integrationType: "claude-hooks",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as ClaudeHookPayload).kind === "spectyra.claude-hooks.v1"
    );
  },
  ingest(input: ClaudeHookPayload, _ctx?: AdapterContext): SpectyraEvent[] {
    const base = {
      source: { adapterId: claudeHooksAdapter.id, integrationType: "claude-hooks" as const },
      sessionId: input.sessionId,
      runId: input.runId,
      security: defaultSecurity(),
    };
    if (input.hook === "session_start") {
      return [
        {
          id: newId(),
          type: "session_started",
          timestamp: new Date().toISOString(),
          ...base,
          payload: input.payload ?? {},
        },
      ];
    }
    if (input.hook === "stop") {
      return [
        {
          id: newId(),
          type: "session_finished",
          timestamp: new Date().toISOString(),
          ...base,
          payload: input.payload ?? {},
        },
      ];
    }
    return [
      {
        id: newId(),
        type: "step_started",
        timestamp: new Date().toISOString(),
        ...base,
        payload: input.payload ?? {},
      },
    ];
  },
};
