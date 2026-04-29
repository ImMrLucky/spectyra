import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSpectyra } from "../createSpectyra.js";
import type { ProviderAdapter } from "../types.js";

type MinimalClient = {
  chat: {
    completions: {
      create: () => Promise<{
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      }>;
    };
  };
};

const dir = join(tmpdir(), `spectyra-mon-int-${Date.now()}`);
mkdirSync(dir, { recursive: true });
const jsonlPath = join(dir, "u.jsonl");

const spectyra = createSpectyra({
  runMode: "off",
  monitor: {
    enabled: true,
    jsonl: { enabled: true, path: jsonlPath, rotateDaily: false, maxFileSizeMb: 50 },
    console: { enabled: false },
  },
});

const client: MinimalClient = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
      }),
    },
  },
};

const adapter: ProviderAdapter<MinimalClient, unknown> = {
  providerName: "openai",
  async call({ client, model, messages: _m }) {
    const result = await client.chat.completions.create();
    return {
      result,
      text: "ok",
      usage: {
        inputTokens: result.usage.prompt_tokens,
        outputTokens: result.usage.completion_tokens,
      },
    };
  },
};

await spectyra.complete(
  { provider: "openai", client, model: "gpt-4o-mini", messages: [{ role: "user", content: "hi" }] },
  adapter,
);

await new Promise((r) => setTimeout(r, 200));

const sum = spectyra.getMonitorSummary();
assert.equal(sum.requestCount, 1);
assert.equal(sum.successCount, 1);

const lines = readFileSync(jsonlPath, "utf8").trim().split("\n").filter(Boolean);
assert.equal(lines.length, 1);
const row = JSON.parse(lines[0]!);
assert.equal(row.provider, "openai");
assert.equal(row.success, true);

const bad = createSpectyra({
  runMode: "off",
  monitor: { enabled: true, console: { enabled: false } },
});
const boom: ProviderAdapter<MinimalClient, unknown> = {
  providerName: "openai",
  async call() {
    throw new Error("boom");
  },
};
try {
  await bad.complete(
    { provider: "openai", client, model: "gpt-4o-mini", messages: [{ role: "user", content: "x" }] },
    boom,
  );
  assert.fail("expected throw");
} catch {
  const s = bad.getMonitorSummary();
  assert.equal(s.errorCount, 1);
}

rmSync(dir, { recursive: true, force: true });
console.log("monitorCompleteIntegration.test.ts: ok");
