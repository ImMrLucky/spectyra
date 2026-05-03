import type { SpectyraMonitorIntegrationMode, SpectyraMonitorProvider } from "../monitor/monitorTypes.js";
import { detectProviderFromHost } from "../monitor/providerDetection.js";
import { extractUsageFromProviderResult } from "../monitor/usageExtraction.js";
import { estimateCost } from "../local/tokenEstimator.js";
import { getPricingSnapshot } from "../pricing/pricingRuntime.js";
import { buildWasteSignalsFromHttpAutoPath } from "../monitor/wasteHeuristics.js";
import type { MonitorEngine } from "../monitor/monitorEngine.js";

const MAX_JSON_BYTES = 512_000;

function providerEnumToSdkVendor(p: SpectyraMonitorProvider): string {
  if (p === "google-gemini") return "google";
  if (p === "azure-openai" || p === "openrouter" || p === "together" || p === "perplexity") return "openai";
  return p;
}

export function shouldRecordPath(pathname: string, provider: SpectyraMonitorProvider): boolean {
  const path = pathname.toLowerCase();
  if (provider === "openai" || provider === "groq" || provider === "azure-openai") {
    return path.includes("/chat/completions") || path.includes("/responses");
  }
  if (provider === "anthropic") return path.includes("/v1/messages");
  if (provider === "google-gemini") return path.includes("/v1beta/") || path.includes("/v1/");
  if (provider === "mistral") return path.includes("/v1/chat/completions");
  if (provider === "cohere") return path.includes("/v1/chat") || path.includes("/v2/chat");
  if (provider === "openrouter") return path.includes("/v1/chat/completions");
  if (provider === "together") return path.includes("/v1/chat/completions");
  if (provider === "perplexity") return path.includes("/chat/completions");
  if (provider === "aws-bedrock") return path.includes("/invoke") || path.includes("/invoke-with-response-stream");
  return false;
}

function extractModel(json: Record<string, unknown>): string | undefined {
  const m = json.model;
  if (typeof m === "string" && m.length > 0 && m.length < 200) return m;
  return undefined;
}

function sdkVendorForExtract(provider: SpectyraMonitorProvider): string {
  if (provider === "groq") return "groq";
  return providerEnumToSdkVendor(provider);
}

/**
 * Parse a JSON LLM response body and append a monitor row (never throws).
 */
export function recordMonitorFromJsonBody(args: {
  engine: MonitorEngine | null;
  host: string;
  pathname: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  bodyText: string;
  integrationMode: SpectyraMonitorIntegrationMode;
  project?: string;
  environment?: string;
  service?: string;
}): void {
  try {
    if (!args.engine) return;
    const provider = detectProviderFromHost(args.host);
    if (provider === "unknown") return;
    if (!shouldRecordPath(args.pathname, provider)) return;
    if (args.bodyText.length > MAX_JSON_BYTES) return;

    let json: Record<string, unknown>;
    try {
      json = JSON.parse(args.bodyText) as Record<string, unknown>;
    } catch {
      return;
    }

    const vendor = sdkVendorForExtract(provider);
    const usageEx = extractUsageFromProviderResult(vendor, json);
    const model = extractModel(json) ?? "unknown";
    const inputTok = usageEx?.inputTokens ?? 0;
    const outputTok = usageEx?.outputTokens ?? 0;
    const fromUsage = Boolean(usageEx?.inputTokens || usageEx?.outputTokens);
    const snap = getPricingSnapshot();
    const actualUsd = estimateCost(vendor, model, inputTok, outputTok, snap);
    const wasteSignals = buildWasteSignalsFromHttpAutoPath({
      inputTokens: inputTok,
      outputTokens: outputTok,
      latencyMs: args.latencyMs,
      actualCostUsd: actualUsd,
    });

    args.engine.recordEvent({
      provider,
      model,
      latencyMs: args.latencyMs,
      success: args.statusCode > 0 && args.statusCode < 400,
      method: args.method,
      statusCode: args.statusCode,
      urlHost: args.host,
      route: args.pathname,
      project: args.project,
      environment: args.environment,
      service: args.service,
      pricingSource: fromUsage ? "provider_usage" : "local_token_estimate",
      inputTokens: inputTok,
      outputTokens: outputTok,
      totalTokens: inputTok + outputTok,
      actualCostUsd: actualUsd,
      integrationMode: args.integrationMode,
      optimizerApplied: false,
      optimizerStatus: "not_integrated",
      wasteSignals: wasteSignals.length ? wasteSignals : undefined,
      metadataOnly: true,
    });
  } catch {
    /* fail open */
  }
}

/**
 * Records an LLM HTTP response without consuming the response body (streaming-safe).
 * Latency should be measured from request start until response headers (TTFB).
 */
export function recordMonitorFromHttpResponseOnly(args: {
  engine: MonitorEngine | null;
  host: string;
  pathname: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  integrationMode: SpectyraMonitorIntegrationMode;
  project?: string;
  environment?: string;
  service?: string;
}): void {
  try {
    if (!args.engine) return;
    const provider = detectProviderFromHost(args.host);
    if (provider === "unknown") return;
    if (!shouldRecordPath(args.pathname, provider)) return;

    const wasteSignals = buildWasteSignalsFromHttpAutoPath({
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: args.latencyMs,
      actualCostUsd: 0,
    });

    args.engine.recordEvent({
      provider,
      model: "unknown",
      latencyMs: args.latencyMs,
      success: args.statusCode > 0 && args.statusCode < 400,
      method: args.method,
      statusCode: args.statusCode,
      urlHost: args.host,
      route: args.pathname,
      project: args.project,
      environment: args.environment,
      service: args.service,
      pricingSource: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      integrationMode: args.integrationMode,
      optimizerApplied: false,
      optimizerStatus: "not_integrated",
      wasteSignals: wasteSignals.length ? wasteSignals : undefined,
      metadataOnly: true,
    });
  } catch {
    /* fail open */
  }
}
