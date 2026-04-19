/**
 * OpenClaw bridge unit tests — no live Local Companion required.
 */
import assert from "node:assert";
import { buildOpenClawConfigObject, generateOpenClawConfigString } from "../generate-openclaw-config.js";
import { buildSessionMetadataHeaders } from "../session-metadata.js";
import { deriveOpenClawWizardStatus } from "../wizard-status.js";
import type { CompanionHealthResponse, CompanionModelsResponse } from "../types.js";

function run() {
  const cfg = buildOpenClawConfigObject({ baseUrl: "http://127.0.0.1:4111/v1" });
  assert.equal(cfg.models.providers.spectyra.baseUrl, "http://127.0.0.1:4111/v1");
  assert.ok(cfg.models.providers.spectyra.models.some((m) => m.id === "spectyra/smart"));
  assert.ok(cfg.models.providers.spectyra.models.some((m) => m.id === "spectyra/quality"));

  const noQuality = buildOpenClawConfigObject({ includeQualityAlias: false });
  assert.equal(noQuality.models.providers.spectyra.baseUrl, "http://127.0.0.1:4111/v1");
  assert.ok(!noQuality.models.providers.spectyra.models.some((m) => m.id === "spectyra/quality"));

  let threw = false;
  try {
    buildOpenClawConfigObject({ baseUrl: "ftp://bad" });
  } catch {
    threw = true;
  }
  assert.ok(threw);

  const str = generateOpenClawConfigString();
  assert.ok(str.includes("spectyra"));
  assert.ok(str.includes("127.0.0.1:4111"));

  const headers = buildSessionMetadataHeaders({ sessionId: "abc", runContext: "test", integration: "openclaw" });
  assert.equal(headers["X-Spectyra-Integration"], "openclaw");
  assert.ok(headers["X-Spectyra-Session-Id"].length > 0);

  const health: CompanionHealthResponse = {
    reachability: "reachable",
    readiness: "ready",
    providerConfigured: true,
    companionReady: true,
  };
  const models: CompanionModelsResponse = {
    ok: true,
    reachability: "reachable",
    modelIds: ["spectyra/smart"],
  };
  const wiz = deriveOpenClawWizardStatus(health, models);
  assert.equal(wiz.blocker, "none");

  const bad: CompanionHealthResponse = {
    reachability: "unreachable",
    readiness: "unknown",
  };
  assert.equal(deriveOpenClawWizardStatus(bad, models).blocker, "companion_unreachable");

  console.log("openclaw-bridge tests OK");
}

run();
