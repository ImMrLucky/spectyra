import type { SpectyraMonitorProvider } from "../monitorTypes.js";
import type { SpectyraFrameworkMonitorRecord } from "./types.js";

/** Optional context for richer waste signals (never prompts or keys). */
export interface SpectyraVercelAiHookContext {
  provider: SpectyraMonitorProvider;
  model?: string;
  endpoint?: string;
  workflowType?: string;
  agentName?: string;
  operationName?: string;
  project?: string;
  environment?: string;
  service?: string;
}

function readUsage(raw: unknown): { input: number; output: number } {
  if (!raw || typeof raw !== "object") return { input: 0, output: 0 };
  const u = raw as Record<string, unknown>;
  const input = Number(
    u.inputTokens ?? u.promptTokens ?? u.prompt_tokens ?? u.inputTokenCount ?? u.input_tokens ?? 0,
  );
  const output = Number(
    u.outputTokens ?? u.completionTokens ?? u.completion_tokens ?? u.outputTokenCount ?? u.output_tokens ?? 0,
  );
  return { input: Number.isFinite(input) ? input : 0, output: Number.isFinite(output) ? output : 0 };
}

/**
 * Returns an `onFinish` handler for Vercel AI SDK `generateText` / `streamText`.
 * Call `Date.now()` (or `performance.now()`) **before** `generateText` and pass the same value as `startedAtMs`.
 * Does not read or persist `event.text`.
 *
 * @example
 * ```ts
 * const started = Date.now();
 * await generateText({
 *   model,
 *   prompt: "...",
 *   onFinish: createSpectyraVercelAiOnFinish(spectyra.recordMonitorEvent.bind(spectyra), {
 *     provider: "openai",
 *     model: "gpt-4o-mini",
 *     agentName: "support-bot",
 *   }, started),
 * });
 * ```
 */
export function createSpectyraVercelAiOnFinish(
  record: SpectyraFrameworkMonitorRecord,
  ctx: SpectyraVercelAiHookContext,
  startedAtMs: number,
): (event: unknown) => void | Promise<void> {
  return (event: unknown) => {
    try {
      const e = event as {
        usage?: unknown;
        totalUsage?: unknown;
        response?: { modelId?: string; headers?: Headers };
        finishReason?: string;
      };
      const usageRaw = e.totalUsage ?? e.usage;
      const { input, output } = readUsage(usageRaw);
      const latencyMs = Math.max(0, Math.round(Date.now() - startedAtMs));
      const model = ctx.model ?? (e.response as { modelId?: string } | undefined)?.modelId;
      record({
        provider: ctx.provider,
        model,
        latencyMs,
        success: true,
        integrationMode: "framework_hook",
        inputTokens: input,
        outputTokens: output,
        totalTokens: input + output,
        endpoint: ctx.endpoint,
        workflowType: ctx.workflowType,
        agentName: ctx.agentName,
        operationName: ctx.operationName,
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
  };
}

/**
 * Safe metadata bag for `experimental_telemetry` on Vercel AI SDK (no prompts).
 * Spread into `generateText` / `streamText` when you enable telemetry.
 */
export function createSpectyraVercelAiTelemetryMetadata(ctx: SpectyraVercelAiHookContext): Record<string, string> {
  const out: Record<string, string> = {};
  if (ctx.agentName) out["spectyra.agentName"] = ctx.agentName;
  if (ctx.operationName) out["spectyra.operationName"] = ctx.operationName;
  if (ctx.endpoint) out["spectyra.endpoint"] = ctx.endpoint;
  if (ctx.workflowType) out["spectyra.workflowType"] = ctx.workflowType;
  if (ctx.model) out["spectyra.model"] = ctx.model;
  if (ctx.project) out["spectyra.project"] = ctx.project;
  if (ctx.environment) out["spectyra.environment"] = ctx.environment;
  if (ctx.service) out["spectyra.service"] = ctx.service;
  return out;
}
