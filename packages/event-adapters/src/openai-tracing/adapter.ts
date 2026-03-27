/**
 * OpenAI-style tracing / spans — map pre-shaped span objects (no live API coupling).
 */

import type { SpectyraEvent, SpectyraEventAdapter, AdapterContext } from "@spectyra/event-core";
import { defaultSecurity, newId } from "../helpers.js";

export type OpenAiTracingPayload = {
  kind: "spectyra.openai-tracing.v1";
  sessionId: string;
  runId: string;
  span: {
    name?: string;
    input_tokens?: number;
    output_tokens?: number;
    model?: string;
    completed?: boolean;
  };
};

export const openAiTracingAdapter: SpectyraEventAdapter<OpenAiTracingPayload> = {
  id: "spectyra.openai-tracing.v1",
  integrationType: "openai-tracing",
  canHandle(input: unknown): boolean {
    return (
      typeof input === "object" &&
      input !== null &&
      (input as OpenAiTracingPayload).kind === "spectyra.openai-tracing.v1"
    );
  },
  ingest(input: OpenAiTracingPayload, _ctx?: AdapterContext): SpectyraEvent[] {
    const sp = input.span;
    const base = {
      source: { adapterId: openAiTracingAdapter.id, integrationType: "openai-tracing" as const },
      sessionId: input.sessionId,
      runId: input.runId,
      model: sp.model,
      security: defaultSecurity(),
    };
    const out: SpectyraEvent[] = [
      {
        id: newId(),
        type: "step_started",
        timestamp: new Date().toISOString(),
        ...base,
        payload: { spanName: sp.name },
      },
    ];
    if (sp.completed !== false) {
      out.push({
        id: newId(),
        type: "provider_request_completed",
        timestamp: new Date().toISOString(),
        ...base,
        payload: {
          inputTokens: sp.input_tokens,
          outputTokens: sp.output_tokens,
          success: true,
        },
      });
    }
    return out;
  },
};
