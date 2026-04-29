import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMonitorEngine } from "../monitor/monitorEngine.js";
import { detectProviderFromHost } from "../monitor/providerDetection.js";
import { scrubMonitorEventForPersistence } from "../monitor/redaction.js";
import { emptyMonitorSummary, buildMonitorSummaryFromEvents } from "../monitor/summaries.js";
import { createSpectyraDevBridgeConnectMiddleware } from "../monitor/localDevServer.js";
import { buildWasteSignalsFromCompletePath } from "../monitor/wasteHeuristics.js";
import type { SpectyraMonitorEvent } from "../monitor/monitorTypes.js";

const base: Pick<SpectyraMonitorEvent, "provider" | "latencyMs" | "success" | "pricingSource" | "metadataOnly"> = {
  provider: "openai",
  latencyMs: 100,
  success: true,
  pricingSource: "provider_usage",
  metadataOnly: true,
};

assert.equal(detectProviderFromHost("api.openai.com"), "openai");
assert.equal(detectProviderFromHost("api.anthropic.com"), "anthropic");
assert.equal(detectProviderFromHost("example.com"), "unknown");

const waste = buildWasteSignalsFromCompletePath({
  inputTokens: 100_000,
  outputTokens: 100,
  promptLengthChars: 150_000,
  messageCount: 4,
  toolsEnabled: false,
  model: "gpt-4o-mini",
  latencyMs: 1000,
  actualCostUsd: 0.5,
  missedSavingsUsd: 0,
});
assert.ok(waste.some((s) => s.type === "large_context"));

const scrubbed = scrubMonitorEventForPersistence({
  ...base,
  eventId: "e1",
  timestamp: new Date().toISOString(),
  integrationMode: "explicit_sdk",
  sdkLanguage: "typescript",
  authorization: "secret" as unknown as undefined,
} as SpectyraMonitorEvent);
assert.equal((scrubbed as unknown as { authorization?: string }).authorization, undefined);

const dir = join(tmpdir(), `spectyra-monitor-test-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const jsonlPath = join(dir, "usage.jsonl");

const engine = createMonitorEngine({
  enabled: true,
  jsonl: { enabled: true, path: jsonlPath, rotateDaily: false },
  console: { enabled: false },
});

engine.recordEvent({
  ...base,
  model: "gpt-4o-mini",
  actualCostUsd: 0.01,
  optimizerApplied: true,
  savedUsd: 0.004,
  savingsPct: 40,
});

await new Promise((r) => setTimeout(r, 150));

const raw = readFileSync(jsonlPath, "utf8");
const line = raw.trim().split("\n").pop();
assert.ok(line?.includes("gpt-4o-mini"));
assert.ok(!line?.includes("secret"));

const sum = engine.getMonitorSummary();
assert.equal(sum.requestCount, 1);
assert.ok(sum.actualSpendProviderUsd >= 0.01);

const empty = emptyMonitorSummary();
assert.equal(empty.requestCount, 0);

const multi = buildMonitorSummaryFromEvents([
  {
    ...base,
    eventId: "a",
    timestamp: "2026-01-01T00:00:00.000Z",
    integrationMode: "explicit_sdk",
    sdkLanguage: "typescript",
    actualCostUsd: 1,
    latencyMs: 100,
  },
  {
    ...base,
    eventId: "b",
    timestamp: "2026-01-01T00:00:01.000Z",
    integrationMode: "explicit_sdk",
    sdkLanguage: "typescript",
    actualCostUsd: 3,
    latencyMs: 300,
  },
]);
assert.equal(multi.requestCount, 2);
assert.equal(multi.actualSpendProviderUsd, 4);

process.env.SPECTYRA_DEV_BRIDGE = "true";
const engBridge = createMonitorEngine({
  enabled: true,
  jsonl: { enabled: false },
  console: { enabled: false },
});
engBridge.recordEvent({
  ...base,
  eventId: "bridge1",
  timestamp: new Date().toISOString(),
  integrationMode: "explicit_sdk",
  sdkLanguage: "typescript",
  actualCostUsd: 0.5,
});
const mw = createSpectyraDevBridgeConnectMiddleware(() => engBridge);
const server = http.createServer((req, res) => {
  mw(req, res, () => {
    res.writeHead(404);
    res.end();
  });
});
server.listen(0);
await once(server, "listening");
const port = (server.address() as import("node:net").AddressInfo).port;
const br = await fetch(`http://127.0.0.1:${port}/__spectyra/monitor/summary`);
assert.equal(br.status, 200);
const summaryJson = (await br.json()) as { requestCount: number };
assert.equal(summaryJson.requestCount, 1);
await new Promise<void>((resolve, reject) => {
  server.close((e) => (e ? reject(e) : resolve()));
});
delete process.env.SPECTYRA_DEV_BRIDGE;

rmSync(dir, { recursive: true, force: true });

console.log("monitorCore.test.ts: ok");
