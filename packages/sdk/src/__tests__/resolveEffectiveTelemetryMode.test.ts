import assert from "node:assert";
import { resolveEffectiveTelemetryMode } from "../observability/resolveEffectiveTelemetryMode.js";

async function main() {
  assert.strictEqual(
    resolveEffectiveTelemetryMode({ telemetry: { mode: "local" }, spectyraCloudApiKey: "k" }),
    "local",
    "explicit local wins over API key",
  );
  assert.strictEqual(
    resolveEffectiveTelemetryMode({ spectyraCloudApiKey: "sp_test" }),
    "cloud_redacted",
    "in-app + API key defaults to cloud_redacted",
  );
  assert.strictEqual(resolveEffectiveTelemetryMode({}), "local", "no key → local");
  assert.strictEqual(
    resolveEffectiveTelemetryMode({ productSurface: "openclaw_compat", spectyraCloudApiKey: "sp_x" }),
    "local",
    "openclaw_compat keeps local unless explicit",
  );
  assert.strictEqual(
    resolveEffectiveTelemetryMode({
      productSurface: "openclaw_compat",
      spectyraCloudApiKey: "sp_x",
      telemetry: { mode: "cloud_redacted" },
    }),
    "cloud_redacted",
    "explicit cloud_redacted honored for openclaw_compat",
  );

  process.env.SPECTYRA_API_KEY = "sp_env";
  assert.strictEqual(resolveEffectiveTelemetryMode({}), "cloud_redacted", "env API key counts");
  delete process.env.SPECTYRA_API_KEY;

  console.log("resolveEffectiveTelemetryMode test OK");
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
