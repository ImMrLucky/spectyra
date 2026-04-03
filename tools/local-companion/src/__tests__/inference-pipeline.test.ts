/**
 * Local pipeline unit tests — no HTTP server.
 */
import assert from "node:assert";
import { resolveAndOptimizeLocally } from "../inferencePipeline.js";
import type { CompanionConfig } from "../config.js";
import { mapCompanionInferenceError } from "../httpErrors.js";

function baseCfg(over: Partial<CompanionConfig> = {}): CompanionConfig {
  return {
    runMode: "on",
    workflowPolicyMode: "enforce",
    telemetryMode: "local",
    promptSnapshots: "local_only",
    bindHost: "127.0.0.1",
    port: 4111,
    provider: "openai",
    aliasSmartModel: "gpt-4o-mini",
    aliasFastModel: "gpt-4o-mini",
    aliasQualityModel: "gpt-4o",
    providerKeySource: "env",
    debugLogPrompts: false,
    persistNormalizedEvents: true,
    ...over,
  };
}

function run() {
  const { resolved, optResult } = resolveAndOptimizeLocally(
    baseCfg(),
    [{ role: "user", content: "hi" }],
    "spectyra/quality",
  );
  assert.equal(resolved.requestedModel, "spectyra/quality");
  assert.equal(resolved.upstreamModel, "gpt-4o");
  assert.ok(optResult.inputTokensBefore >= 1);

  let threw = false;
  try {
    resolveAndOptimizeLocally(baseCfg(), [{ role: "user", content: "x" }], "spectyra/unknown");
  } catch {
    threw = true;
  }
  assert.ok(threw);

  const m400 = mapCompanionInferenceError(new Error("Unknown Spectyra model alias: spectyra/x"));
  assert.equal(m400.status, 400);

  const m503 = mapCompanionInferenceError(new Error("Provider key not configured for openai"));
  assert.equal(m503.status, 503);

  console.log("local-companion inference tests OK");
}

run();
