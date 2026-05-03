import assert from "node:assert/strict";
import { createMonitorEngine } from "@spectyra/sdk";

process.env.SPECTYRA_AUTO = "false";
const { recordMonitorFromJsonBody, startSpectyraAuto, stopSpectyraAuto, getAutoMonitorEngine } = await import(
  "@spectyra/sdk/auto"
);

const eng = createMonitorEngine({
  enabled: true,
  jsonl: { enabled: false },
  console: { enabled: false },
});

recordMonitorFromJsonBody({
  engine: eng,
  host: "api.openai.com",
  pathname: "/v1/chat/completions",
  method: "POST",
  statusCode: 200,
  latencyMs: 12,
  bodyText: JSON.stringify({
    model: "gpt-4o-mini",
    usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 },
  }),
  integrationMode: "auto_fetch",
  project: "test-proj",
});

assert.equal(eng.getMonitorSummary().requestCount, 1);

const autoEng = startSpectyraAuto({ jsonlEnabled: false, console: false });
assert.strictEqual(getAutoMonitorEngine(), autoEng);
stopSpectyraAuto();
assert.equal(getAutoMonitorEngine(), null);

console.log("autoSmoke.test.ts: ok");
