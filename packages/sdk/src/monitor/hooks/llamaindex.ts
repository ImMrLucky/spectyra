import type { SpectyraMonitorProvider } from "../monitorTypes.js";
import type { SpectyraFrameworkMonitorRecord } from "./types.js";

export interface SpectyraLlamaIndexHookContext {
  provider: SpectyraMonitorProvider;
  model?: string;
  endpoint?: string;
  workflowType?: string;
  agentName?: string;
  project?: string;
  environment?: string;
  service?: string;
}

function readUsage(u: unknown): { input: number; output: number } {
  if (!u || typeof u !== "object") return { input: 0, output: 0 };
  const o = u as Record<string, unknown>;
  const input = Number(o.prompt_tokens ?? o.inputTokens ?? o.input_tokens ?? 0);
  const output = Number(o.completion_tokens ?? o.outputTokens ?? o.output_tokens ?? 0);
  return { input: Number.isFinite(input) ? input : 0, output: Number.isFinite(output) ? output : 0 };
}

/**
 * Loose subscriber for LlamaIndex.TS-style callback hooks (`CallbackManager`, `Settings.callbackManager`).
 * Wire `onLLMEnd` / `onLLMStart` to your callback manager; shapes vary by `@llamaindex/*` version — this uses defensive reads only.
 */
export function createSpectyraLlamaIndexMonitorSubscriber(
  record: SpectyraFrameworkMonitorRecord,
  ctx: SpectyraLlamaIndexHookContext,
): {
  onLLMStart?: (event: unknown) => void;
  onLLMEnd?: (event: unknown) => void;
  onLLMError?: (event: unknown) => void;
} {
  const starts = new Map<string, number>();

  return {
    onLLMStart(event: unknown) {
      try {
        const ev = event as { runId?: string; id?: string; detail?: { id?: string } };
        const id = ev.runId ?? ev.id ?? ev.detail?.id ?? "_";
        starts.set(String(id), Date.now());
      } catch {
        /* ignore */
      }
    },

    onLLMEnd(event: unknown) {
      try {
        const ev = event as {
          runId?: string;
          id?: string;
          detail?: { id?: string; payload?: { usage?: unknown; response?: { model?: string } } };
        };
        const id = String(ev.runId ?? ev.id ?? ev.detail?.id ?? "_");
        const t0 = starts.get(id) ?? Date.now();
        starts.delete(id);
        const payload = ev.detail?.payload as Record<string, unknown> | undefined;
        const usage = payload?.usage ?? (payload?.response as Record<string, unknown> | undefined)?.usage;
        const { input, output } = readUsage(usage);
        const model = ctx.model ?? (payload?.model as string | undefined);
        record({
          provider: ctx.provider,
          model,
          latencyMs: Math.max(0, Math.round(Date.now() - t0)),
          success: true,
          integrationMode: "framework_hook",
          inputTokens: input,
          outputTokens: output,
          totalTokens: input + output,
          endpoint: ctx.endpoint,
          workflowType: ctx.workflowType,
          agentName: ctx.agentName,
          project: ctx.project,
          environment: ctx.environment,
          service: ctx.service,
          pricingSource: input || output ? "provider_usage" : "unknown",
          optimizerApplied: false,
          optimizerStatus: "not_integrated",
          metadataOnly: true,
        });
      } catch {
        /* fail open */
      }
    },

    onLLMError(event: unknown) {
      try {
        const ev = event as { runId?: string; id?: string; detail?: { id?: string } };
        const id = String(ev.runId ?? ev.id ?? ev.detail?.id ?? "_");
        const t0 = starts.get(id) ?? Date.now();
        starts.delete(id);
        record({
          provider: ctx.provider,
          model: ctx.model,
          latencyMs: Math.max(0, Math.round(Date.now() - t0)),
          success: false,
          integrationMode: "framework_hook",
          endpoint: ctx.endpoint,
          workflowType: ctx.workflowType,
          agentName: ctx.agentName,
          project: ctx.project,
          environment: ctx.environment,
          service: ctx.service,
          pricingSource: "unknown",
          optimizerApplied: false,
          optimizerStatus: "not_integrated",
          metadataOnly: true,
        });
      } catch {
        /* fail open */
      }
    },
  };
}
