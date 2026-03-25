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

export interface CompanionConfig {
  runMode: SpectyraRunMode;
  telemetryMode: TelemetryMode;
  promptSnapshots: PromptSnapshotMode;
  bindHost: string;
  port: number;
  provider: string;
  providerKeySource: "env" | "session";
  debugLogPrompts: boolean;
}

export function loadConfig(): CompanionConfig {
  return {
    runMode: (process.env.SPECTYRA_RUN_MODE as SpectyraRunMode) || "observe",
    telemetryMode: (process.env.SPECTYRA_TELEMETRY as TelemetryMode) || "local",
    promptSnapshots: (process.env.SPECTYRA_PROMPT_SNAPSHOTS as PromptSnapshotMode) || "local_only",
    bindHost: process.env.SPECTYRA_BIND_HOST || "127.0.0.1",
    port: parseInt(process.env.SPECTYRA_PORT || "4111", 10),
    provider: process.env.SPECTYRA_PROVIDER || "openai",
    providerKeySource: (process.env.SPECTYRA_KEY_SOURCE as "env" | "session") || "env",
    debugLogPrompts: process.env.DEBUG_LOG_PROMPTS === "true",
  };
}
