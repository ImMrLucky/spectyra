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
    providerTierModels: undefined,
    providerKeySource: "env",
    debugLogPrompts: false,
    persistNormalizedEvents: true,
    syncAnalyticsToCloud: true,
    spectyraAccountLinked: true,
    optimizationRunMode: "on",
    licenseKey: "spectyra_test_license_key_long_enough",
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

  const { resolved: rOpenai } = resolveAndOptimizeLocally(
    baseCfg(),
    [{ role: "user", content: "hi" }],
    "spectyra/openai/smart",
  );
  assert.equal(rOpenai.requestedModel, "spectyra/openai/smart");
  assert.equal(rOpenai.provider, "openai");
  assert.equal(rOpenai.upstreamModel, "gpt-4o-mini");

  const { resolved: rAnth } = resolveAndOptimizeLocally(
    baseCfg({
      providerTierModels: { anthropic: { quality: "claude-opus-4-20250514" } },
    }),
    [{ role: "user", content: "review" }],
    "spectyra/anthropic/quality",
  );
  assert.equal(rAnth.provider, "anthropic");
  assert.equal(rAnth.upstreamModel, "claude-opus-4-20250514");

  const m400 = mapCompanionInferenceError(new Error("Unknown Spectyra model alias: spectyra/x"));
  assert.equal(m400.status, 400);

  const m503 = mapCompanionInferenceError(new Error("Provider key not configured for openai"));
  assert.equal(m503.status, 503);

  const toolThread = resolveAndOptimizeLocally(
    baseCfg({ runMode: "on" }),
    [
      { role: "user", content: "run tool" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1", type: "function", function: { name: "t", arguments: "{}" } }],
      },
      { role: "tool", content: "ok", tool_call_id: "call_1" },
    ],
    "spectyra/smart",
  );
  assert.ok(toolThread.optResult.transforms.length >= 0);
  assert.notEqual(toolThread.optResult.optimizationSkippedReason, "tool_merge_failed");
  assert.equal(toolThread.optResult.messages[1].tool_calls != null, true);
  assert.equal(toolThread.optResult.messages[2].role, "tool");

  console.log("local-companion inference tests OK");
}

run();
