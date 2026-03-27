/**
 * Config-driven generic JSONL / record mapping (minimal v1).
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import { defaultSecurity, newId } from "../helpers.js";

export type GenericJsonlMapping = {
  sessionIdField?: string;
  runIdField?: string;
  inputTokensField?: string;
  outputTokensField?: string;
  eventTypeField?: string;
};

export type GenericJsonlPayload = {
  kind: "spectyra.generic-jsonl.v1";
  record: Record<string, unknown>;
  mapping?: GenericJsonlMapping;
};

function getPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

export const genericJsonlAdapter: SpectyraEventAdapter<GenericJsonlPayload> = {
  id: "spectyra.generic-jsonl.v1",
  integrationType: "generic-jsonl",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as GenericJsonlPayload).kind === "spectyra.generic-jsonl.v1"
    );
  },
  ingest(input: GenericJsonlPayload, ctx?: AdapterContext): SpectyraEvent[] {
    const r = input.record;
    const m = input.mapping ?? {};
    const sid = (m.sessionIdField ? getPath(r, m.sessionIdField) : undefined) as string | undefined;
    const rid = (m.runIdField ? getPath(r, m.runIdField) : undefined) as string | undefined;
    const sessionId = sid ?? ctx?.sessionId ?? "generic-session";
    const runId = rid ?? ctx?.runId ?? sessionId;

    const inTok = m.inputTokensField
      ? (getPath(r, m.inputTokensField) as number | undefined)
      : undefined;
    const outTok = m.outputTokensField
      ? (getPath(r, m.outputTokensField) as number | undefined)
      : undefined;

    const base = {
      source: { adapterId: genericJsonlAdapter.id, integrationType: "generic-jsonl" as const },
      sessionId,
      runId,
      security: defaultSecurity(),
    };

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
  },
};
