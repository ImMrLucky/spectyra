/**
 * Agent harness adapter.
 *
 * For agent frameworks that pass a batch of messages through Spectyra
 * before forwarding to the LLM provider. The harness shape is a
 * superset of the simple message array — it carries execution metadata
 * like step index, workflow type, and tool support flags.
 */

import type {
  SpectyraAdapter,
  AdapterContext,
  CanonicalRequest,
  CanonicalResponse,
  CanonicalMessage,
  CanonicalExecutionMetadata,
} from "@spectyra/canonical-model";
import { generateId, defaultSecurity } from "./helpers.js";

export interface AgentHarnessRequest {
  messages: Array<{ role: string; content: string; name?: string }>;
  model?: string;
  provider?: string;
  runMode?: "off" | "observe" | "on";
  execution?: Partial<CanonicalExecutionMetadata>;
}

export interface AgentHarnessResponse {
  messages: Array<{ role: string; content: string }>;
  usage?: { inputTokens: number; outputTokens: number };
}

export class AgentHarnessAdapter implements SpectyraAdapter<AgentHarnessRequest, AgentHarnessResponse> {
  id = "agent-harness";
  category = "agent_harness" as const;

  canHandle(input: unknown): boolean {
    if (typeof input !== "object" || input === null) return false;
    const obj = input as Record<string, unknown>;
    return Array.isArray(obj.messages);
  }

  toCanonicalRequest(input: AgentHarnessRequest, ctx?: AdapterContext): CanonicalRequest {
    const messages: CanonicalMessage[] = input.messages.map(m => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content,
      name: m.name,
    }));

    return {
      requestId: generateId("req"),
      runId: generateId("run"),
      mode: ctx?.runModeOverride ?? input.runMode ?? "on",
      integrationType: "agent-harness",
      provider: input.model ? { vendor: input.provider, model: input.model } : undefined,
      messages,
      execution: {
        isAgenticFlow: true,
        ...input.execution,
      },
      security: defaultSecurity(),
    };
  }

  fromCanonicalResponse(canonical: CanonicalResponse): AgentHarnessResponse {
    return {
      messages: canonical.outputMessages.map(m => ({
        role: m.role,
        content: m.text ?? "",
      })),
      usage: canonical.usage ? {
        inputTokens: canonical.usage.inputTokens ?? 0,
        outputTokens: canonical.usage.outputTokens ?? 0,
      } : undefined,
    };
  }

  extractExecutionMetadata(input: AgentHarnessRequest): Partial<CanonicalExecutionMetadata> {
    return { isAgenticFlow: true, ...input.execution };
  }
}
