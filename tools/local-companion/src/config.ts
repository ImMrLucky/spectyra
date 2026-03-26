/**
 * Local Companion configuration.
 *
 * Resolved from environment variables and/or a local config file.
 * Security defaults: bind localhost, no prompt logging, no cloud relay.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
} from "@spectyra/core-types";
import { defaultAliasModels } from "@spectyra/shared";

export interface CompanionConfig {
  runMode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshots: PromptSnapshotMode;
  bindHost: string;
  port: number;
  /** Upstream LLM provider selected in Desktop / env (openai | anthropic | groq). */
  provider: string;
  /** Real model id for OpenClaw alias `spectyra/smart`. */
  aliasSmartModel: string;
  /** Real model id for OpenClaw alias `spectyra/fast`. */
  aliasFastModel: string;
  /** Optional license key for full optimization (set by Electron desktop). */
  licenseKey?: string;
  providerKeySource: "env" | "session";
  debugLogPrompts: boolean;
}

export function loadConfig(): CompanionConfig {
  const provider = process.env.SPECTYRA_PROVIDER || "openai";
  const defaults = defaultAliasModels(provider);
  return {
    runMode: (process.env.SPECTYRA_RUN_MODE as SpectyraRunMode) || "observe",
    telemetryMode: (process.env.SPECTYRA_TELEMETRY as TelemetryMode) || "local",
    promptSnapshots: (process.env.SPECTYRA_PROMPT_SNAPSHOTS as PromptSnapshotMode) || "local_only",
    bindHost: process.env.SPECTYRA_BIND_HOST || "127.0.0.1",
    port: parseInt(process.env.SPECTYRA_PORT || "4111", 10),
    provider,
    aliasSmartModel: process.env.SPECTYRA_ALIAS_SMART_MODEL?.trim() || defaults.smart,
    aliasFastModel: process.env.SPECTYRA_ALIAS_FAST_MODEL?.trim() || defaults.fast,
    licenseKey: process.env.SPECTYRA_LICENSE_KEY?.trim() || undefined,
    providerKeySource: (process.env.SPECTYRA_KEY_SOURCE as "env" | "session") || "env",
    debugLogPrompts: process.env.DEBUG_LOG_PROMPTS === "true",
  };
}
