/**
 * Normalized event ingestion + SSE fan-out (local-first).
 */

import type { Response } from "express";
import { createEventIngestionEngine, type SpectyraEvent } from "@spectyra/event-core";
import { appendNormalizedEventJsonl } from "@spectyra/event-core/local-persistence";
import { defaultEventAdapters } from "@spectyra/event-adapters";
import type { SavingsReport } from "@spectyra/core-types";
import { loadConfig } from "./config.js";
import { companionEventsJsonlPath } from "./localStore.js";

const sseClients = new Set<Response>();
const companionCfg = loadConfig();

/** Full adapter stack (SDK envelopes, companion, OpenClaw JSONL, Claude, OpenAI tracing, generic JSONL). */
export const companionEventEngine = createEventIngestionEngine({
  adapters: defaultEventAdapters,
  dedupe: true,
});

companionEventEngine.subscribe((event: SpectyraEvent) => {
  if (companionCfg.telemetryMode !== "off" && companionCfg.persistNormalizedEvents) {
    void appendNormalizedEventJsonl(companionEventsJsonlPath(), event).catch(() => {
      /* disk full / permission — do not break bus */
    });
  }
  const line = `data: ${JSON.stringify({ v: 1, event })}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(line);
    } catch {
      sseClients.delete(res);
    }
  }
});

export function registerSseClient(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(":ok\n\n");
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
}

export function ingestCompanionChatCompleted(input: {
  sessionId: string;
  runId: string;
  report: SavingsReport;
}): void {
  companionEventEngine.ingest({
    kind: "spectyra.companion.v1",
    phase: "chat_completed",
    sessionId: input.sessionId,
    runId: input.runId,
    report: input.report,
  });
}

export function getLiveStateFromEvents() {
  return companionEventEngine.getLiveState();
}
