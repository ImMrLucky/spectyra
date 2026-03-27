/**
 * OpenClaw-style JSONL lines — best-effort mapping (no vendor-specific product logic).
 * Heuristic: read common keys only; callers may pre-normalize JSON.
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import { defaultSecurity, newId } from "../helpers.js";

export type OpenclawJsonlPayload = {
  kind: "spectyra.openclaw.jsonl.v1";
  /** One JSON object per line (already parsed) */
  record: Record<string, unknown>;
  sessionId?: string;
  runId?: string;
};

function pickStr(o: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function pickNum(o: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  }
  return undefined;
}

export const openclawJsonlAdapter: SpectyraEventAdapter<OpenclawJsonlPayload> = {
  id: "spectyra.openclaw.jsonl.v1",
  integrationType: "openclaw-jsonl",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as OpenclawJsonlPayload).kind === "spectyra.openclaw.jsonl.v1"
    );
  },
  ingest(input: OpenclawJsonlPayload, ctx?: AdapterContext): SpectyraEvent[] {
    const r = input.record;
    const sessionId = input.sessionId ?? ctx?.sessionId ?? pickStr(r, ["session_id", "sessionId"]) ?? "unknown-session";
    const runId = input.runId ?? ctx?.runId ?? pickStr(r, ["run_id", "runId", "id"]) ?? sessionId;
    const base = {
      source: { adapterId: openclawJsonlAdapter.id, integrationType: "openclaw-jsonl" as const },
      sessionId,
      runId,
      provider: pickStr(r, ["provider", "vendor"]),
      model: pickStr(r, ["model", "model_id"]),
      security: defaultSecurity(),
    };

    const ev = pickStr(r, ["event", "type", "kind"])?.toLowerCase() ?? "";
    if (ev.includes("complete") || ev.includes("response") || ev.includes("assistant")) {
      const inTok = pickNum(r, ["prompt_tokens", "input_tokens", "inputTokens"]);
      const outTok = pickNum(r, ["completion_tokens", "output_tokens", "outputTokens"]);
      return [
        {
          id: newId(),
          type: "provider_request_completed",
          timestamp: new Date().toISOString(),
          ...base,
          payload: {
            inputTokens: inTok,
            outputTokens: outTok,
            success: true,
          },
        },
      ];
    }

    if (ev.includes("start") || ev.includes("session")) {
      return [
        {
          id: newId(),
          type: "session_started",
          timestamp: new Date().toISOString(),
          ...base,
          payload: { rawKeys: Object.keys(r).slice(0, 20) },
        },
      ];
    }

    return [
      {
        id: newId(),
        type: "error",
        timestamp: new Date().toISOString(),
        ...base,
        payload: { note: "unmapped_openclaw_record", keys: Object.keys(r).slice(0, 30) },
      },
    ];
  },
};
