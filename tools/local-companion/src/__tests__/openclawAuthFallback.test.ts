/**
 * OpenClaw auth fallback — no real keys; temp dirs only.
 */
import assert from "node:assert";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractApiKeyFromAuthProfilesJson, readOpenClawProviderKey } from "../openclawAuthFallback.js";

function run() {
  const wrapped = {
    version: 1,
    profiles: {
      "openai:default": { type: "api_key", provider: "openai", key: "sk-from-wrapped" },
    },
  };
  assert.equal(extractApiKeyFromAuthProfilesJson(wrapped, "openai"), "sk-from-wrapped");

  const legacy = {
    "anthropic:default": { type: "api_key", provider: "anthropic", token: "sk-ant-token-field" },
  };
  assert.equal(extractApiKeyFromAuthProfilesJson(legacy, "anthropic"), "sk-ant-token-field");

  const d = mkdtempSync(join(tmpdir(), "spectyra-oc-auth-"));
  const prev = process.env.OPENCLAW_STATE_DIR;
  process.env.OPENCLAW_STATE_DIR = d;
  try {
    mkdirSync(join(d, "agents", "main", "agent"), { recursive: true });
    writeFileSync(
      join(d, "agents", "main", "agent", "auth-profiles.json"),
      JSON.stringify({
        version: 1,
        profiles: {
          "openai:default": { type: "api_key", provider: "openai", key: "sk-tempdir-probe" },
        },
      }),
      "utf-8",
    );
    assert.equal(readOpenClawProviderKey("openai"), "sk-tempdir-probe");
    assert.equal(readOpenClawProviderKey("groq"), undefined);
  } finally {
    if (prev === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = prev;
  }

  console.log("openclawAuthFallback tests OK");
}

run();
