import assert from "node:assert";
import {
  SPECTYRA_DEFAULT_API_BASE_URL,
  resolveSpectyraApiBaseUrl,
} from "../entitlements/resolveApiBaseUrl.js";

async function main() {
  const originalBase = process.env.SPECTYRA_API_BASE_URL;

  try {
    delete process.env.SPECTYRA_API_BASE_URL;
    assert.strictEqual(
      resolveSpectyraApiBaseUrl({}),
      SPECTYRA_DEFAULT_API_BASE_URL,
      "without overrides, base should default to Spectyra cloud /v1",
    );

    assert.strictEqual(
      resolveSpectyraApiBaseUrl({ spectyraApiBaseUrl: "https://custom.example/v1/" }),
      "https://custom.example/v1",
      "config override should win and strip trailing slash",
    );

    process.env.SPECTYRA_API_BASE_URL = "https://from-env.test/v1";
    assert.strictEqual(
      resolveSpectyraApiBaseUrl({}),
      "https://from-env.test/v1",
      "env should apply when config does not set base",
    );
  } finally {
    if (originalBase === undefined) delete process.env.SPECTYRA_API_BASE_URL;
    else process.env.SPECTYRA_API_BASE_URL = originalBase;
  }

  console.log("resolveApiBaseUrl test OK");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
