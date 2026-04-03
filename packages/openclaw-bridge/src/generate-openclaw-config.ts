import { OPENCLAW_CONFIG_JSON } from "@spectyra/integration-metadata";
import type { OpenClawBridgeOptions, OpenClawGeneratedConfig } from "./types.js";
import { DEFAULT_LOCAL_COMPANION_V1_BASE } from "./types.js";

function assertConfigShape(x: unknown): asserts x is OpenClawGeneratedConfig {
  if (!x || typeof x !== "object") throw new Error("OpenClaw bridge: config template is not an object");
  const m = (x as OpenClawGeneratedConfig).models?.providers?.spectyra;
  if (!m?.baseUrl || !Array.isArray(m.models)) {
    throw new Error("OpenClaw bridge: unexpected OPENCLAW_CONFIG_JSON shape from integration-metadata");
  }
}

/**
 * Build a validated OpenClaw provider config object pointing at Spectyra Local Companion.
 * Does not perform network I/O. Does not store or transmit API keys to Spectyra cloud.
 */
export function buildOpenClawConfigObject(options: OpenClawBridgeOptions = {}): OpenClawGeneratedConfig {
  const baseUrl = (options.baseUrl ?? DEFAULT_LOCAL_COMPANION_V1_BASE).trim().replace(/\/$/, "");
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    throw new Error('OpenClaw bridge: baseUrl must start with "http://" or "https://"');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(OPENCLAW_CONFIG_JSON);
  } catch {
    throw new Error("OpenClaw bridge: failed to parse OPENCLAW_CONFIG_JSON");
  }
  assertConfigShape(parsed);

  const cfg: OpenClawGeneratedConfig = JSON.parse(JSON.stringify(parsed)) as OpenClawGeneratedConfig;
  cfg.models.providers.spectyra.baseUrl = baseUrl;

  if (options.includeQualityAlias === false) {
    cfg.models.providers.spectyra.models = cfg.models.providers.spectyra.models.filter((m) => m.id !== "quality");
  }

  const primary = options.primaryModel?.trim() || "spectyra/smart";
  if (!primary.startsWith("spectyra/")) {
    throw new Error('OpenClaw bridge: primaryModel must be a spectyra/* alias (e.g. spectyra/smart)');
  }
  cfg.agents.defaults.model.primary = primary;

  return cfg;
}

/** Pretty-printed JSON for copy/paste into OpenClaw config. */
export function generateOpenClawConfigString(options: OpenClawBridgeOptions = {}): string {
  return `${JSON.stringify(buildOpenClawConfigObject(options), null, 2)}\n`;
}
