/**
 * Learning gate skips heavy transforms when local profile shows persistent failure.
 */
import assert from "node:assert";
import type { CanonicalRequest, FeatureDetectionResult, LearningProfile } from "@spectyra/canonical-model";
import { createEmptyProfile, applyUpdate } from "@spectyra/learning";
import { optimize } from "../engine.js";

const chunk = "hello world sentence. ".repeat(120);
const minimalRequest: CanonicalRequest = {
  requestId: "r1",
  runId: "run1",
  mode: "on",
  integrationType: "local-companion",
  messages: [
    { role: "user", text: chunk },
    { role: "assistant", text: "ack." },
    { role: "user", text: chunk },
    { role: "assistant", text: "ack." },
  ],
  execution: {},
  security: {
    telemetryMode: "local",
    promptSnapshotMode: "local_only",
    localOnly: true,
    contentExfiltration: "never",
  },
};

const features: FeatureDetectionResult[] = [
  { featureId: "test_signal", confidence: 0.99, evidence: ["x"], path: "talk" },
];

let badRefpack: LearningProfile = createEmptyProfile("p");
for (let i = 0; i < 10; i++) {
  badRefpack = applyUpdate(badRefpack, {
    scopeId: "p",
    transformId: "refpack",
    success: false,
    tokensSaved: 0,
    featureIds: [],
    timestamp: new Date().toISOString(),
  });
}

const licensed = optimize({
  request: minimalRequest,
  features,
  profile: badRefpack,
  licenseStatus: "active",
});

assert.ok(
  !licensed.transformsApplied.includes("refpack"),
  "refpack should be muted by learning",
);

console.log("✅ optimization-engine learning-gate test passed");
