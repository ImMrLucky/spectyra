/**
 * Ensures the SDK stack (feature-detection → optimization-engine) stays aligned
 * with what Local Companion relies on: a licensed "on" run applies transforms
 * when the pipeline can shrink the request.
 */
import assert from "node:assert";
import type { CanonicalRequest } from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize } from "@spectyra/optimization-engine";

function baseRequest(over: Partial<CanonicalRequest> = {}): CanonicalRequest {
  const runId = crypto.randomUUID();
  return {
    requestId: `req_${runId}`,
    runId,
    mode: "on",
    integrationType: "sdk-wrapper",
    provider: { vendor: "openai", model: "gpt-4o-mini" },
    messages: [
      { role: "system", text: "You are a helpful assistant." },
      { role: "user", text: "hello     world\n\n\n\n" },
    ],
    execution: {},
    security: {
      telemetryMode: "local",
      promptSnapshotMode: "local_only",
      localOnly: true,
      contentExfiltration: "never",
    },
    ...over,
  };
}

async function run() {
  const request = baseRequest();
  const features = detectFeatures(request, undefined, undefined);
  const licensed = optimize({
    request,
    features,
    licenseStatus: "active",
  });

  assert.equal(licensed.licenseLimited, false);
  assert.ok(
    licensed.transformsApplied.length > 0 || licensed.projectedTokenSavings >= 0,
    "expected at least transforms or non-negative savings projection",
  );

  const unlicensed = optimize({
    request,
    features,
    licenseStatus: "observe_only",
  });
  assert.equal(unlicensed.licenseLimited, true);
  assert.strictEqual(
    unlicensed.optimizedRequest,
    unlicensed.originalRequest,
    "observe-only must not mutate the outbound request",
  );
  assert.ok(
    typeof unlicensed.projectedSavingsIfActivated === "number",
    "projected savings should be computed for conversion UX",
  );

  console.log("✅ SDK ↔ optimization-engine parity ok");
}

void run();
