import type { SpectyraConfig, SpectyraCompleteInput, SpectyraCompleteResult } from "../types.js";

function defaultBaseUrl(): string {
  if (typeof process !== "undefined" && process.env?.SPECTYRA_API_BASE_URL) {
    return process.env.SPECTYRA_API_BASE_URL.replace(/\/$/, "");
  }
  return "";
}

/**
 * POST aggregated usage for one LLM call to Spectyra SaaS (POST /v1/telemetry/run).
 * Fire-and-forget; failures are swallowed (log in dev only).
 */
export async function maybePostSdkRunTelemetry<TResult>(
  config: SpectyraConfig,
  input: SpectyraCompleteInput<unknown>,
  result: SpectyraCompleteResult<TResult>,
): Promise<void> {
  const mode = config.telemetry?.mode ?? "local";
  if (mode === "off") return;

  const apiKey = config.spectyraCloudApiKey?.trim();
  if (!apiKey) return;

  const base = (config.spectyraApiBaseUrl ?? defaultBaseUrl()).replace(/\/$/, "");
  if (!base) return;

  const project = input.runContext?.project?.trim();
  const environment = (input.runContext?.environment ?? process.env.NODE_ENV ?? "development").toString().slice(0, 128);
  const report = result.report;

  const body: Record<string, unknown> = {
    environment,
    model: report.model,
    inputTokens: report.inputTokensBefore,
    outputTokens: report.outputTokens,
    optimizedTokens: report.inputTokensAfter,
    estimatedCost: report.estimatedCostBefore,
    optimizedCost: report.estimatedCostAfter,
    savings: report.estimatedSavings,
  };
  if (project) body.project = project;

  const url = `${base}/telemetry/run`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPECTYRA-API-KEY": apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok && typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
      const t = await res.text().catch(() => "");
      console.warn(`Spectyra telemetry POST ${res.status}:`, t.slice(0, 200));
    }
  } catch (e) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
      console.warn("Spectyra telemetry POST failed:", e);
    }
  }
}
