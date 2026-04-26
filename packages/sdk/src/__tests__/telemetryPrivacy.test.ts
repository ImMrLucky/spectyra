/**
 * Ensures cloud telemetry POST bodies never carry prompts, completions, message arrays, or provider keys.
 */
import assert from "node:assert";
import { maybePostSdkRunTelemetry } from "../cloud/postRunTelemetry.js";
import type { SpectyraCompleteInput, SpectyraCompleteResult } from "../types.js";

const SECRET = "SPECTYRA_PRIVACY_TEST_SECRET_DO_NOT_LEAK";

function collectJsonPaths(value: unknown, base = ""): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") return [base];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => collectJsonPaths(v, `${base}[${i}]`));
  }
  const o = value as Record<string, unknown>;
  return Object.keys(o).flatMap((k) => {
    const p = base ? `${base}.${k}` : k;
    return [p, ...collectJsonPaths(o[k], p)];
  });
}

function assertNoForbiddenTelemetryKeys(body: Record<string, unknown>): void {
  const banned = new Set(
    [
      "messages",
      "prompt",
      "completions",
      "completion",
      "documents",
      "document",
      "tool_calls",
      "apiKey",
      "api_key",
      "openai_api_key",
      "providerKey",
      "provider_key",
      "x-provider-key",
    ].map((s) => s.toLowerCase()),
  );

  const paths = collectJsonPaths(body);
  for (const path of paths) {
    const last = path.split(/[.[\]]+/).filter(Boolean).pop() ?? path;
    if (banned.has(last.toLowerCase())) {
      assert.fail(`telemetry body must not include key "${last}" at path ${path}`);
    }
  }
}

async function main() {
  const originalFetch = globalThis.fetch;
  const originalBase = process.env.SPECTYRA_API_BASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  let captured: { url: string; body: string } | null = null;
  process.env.SPECTYRA_API_BASE_URL = "https://telemetry-privacy.test/v1";
  process.env.NODE_ENV = "test";

  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    captured = { url: String(url), body: init?.body as string };
    return new Response("{}", { status: 200 });
  }) as typeof fetch;

  const config = {
    telemetry: { mode: "cloud_redacted" as const },
    spectyraCloudApiKey: "sp_test_key",
  };

  const input: SpectyraCompleteInput<unknown> = {
    provider: "openai",
    client: null,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: SECRET }],
    runContext: { project: "test-proj" },
  };

  const report = {
    runId: "run_privacy_1",
    mode: "on" as const,
    integrationType: "sdk-wrapper" as const,
    provider: "openai",
    model: "gpt-4o-mini",
    inputTokensBefore: 100,
    inputTokensAfter: 40,
    outputTokens: 20,
    estimatedCostBefore: 0.02,
    estimatedCostAfter: 0.01,
    estimatedSavings: 0.01,
    estimatedSavingsPct: 50,
    telemetryMode: "local" as const,
    promptSnapshotMode: "local_only" as const,
    inferencePath: "direct_provider" as const,
    providerBillingOwner: "customer" as const,
    transformsApplied: ["dedup"] as string[],
  };

  const result: SpectyraCompleteResult<unknown> = {
    providerResult: { choices: [{ message: { content: SECRET } }], usage: { total_tokens: 99 } },
    report,
    security: {
      inferencePath: "direct_provider",
      providerBillingOwner: "customer",
      telemetryMode: "local",
      promptSnapshotMode: "local_only",
      cloudRelay: "none",
    },
  };

  await maybePostSdkRunTelemetry(config, input, result);

  assert(captured, "fetch should have been called");
  assert.strictEqual(captured.url, "https://telemetry-privacy.test/v1/telemetry/run");

  const raw = captured.body;
  assert(!raw.includes(SECRET), "telemetry body must not echo user message content");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assertNoForbiddenTelemetryKeys(parsed);
  assert.strictEqual(typeof parsed.diagnostics, "object");

  globalThis.fetch = originalFetch;
  if (originalBase === undefined) delete process.env.SPECTYRA_API_BASE_URL;
  else process.env.SPECTYRA_API_BASE_URL = originalBase;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;

  console.log("telemetry privacy test OK");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
