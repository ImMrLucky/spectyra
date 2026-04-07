/**
 * Local Companion configuration.
 *
 * Resolved from environment variables and/or a local config file.
 * Security defaults: bind localhost, no prompt logging, no cloud relay.
 */

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
} from "@spectyra/core-types";
import { defaultAliasModels } from "@spectyra/shared";
import type { WorkflowPolicyMode } from "@spectyra/workflow-policy";

function loadDesktopConfig(): Record<string, unknown> {
  const p = join(homedir(), ".spectyra", "desktop", "config.json");
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return {}; }
}

export interface CompanionConfig {
  runMode: SpectyraRunMode;
  /**
   * enforce — may return 422 and skip the provider when policy rules trip (see workflow-policy defaults).
   * observe — evaluate and expose via GET summary only; never blocks provider calls.
   */
  workflowPolicyMode: WorkflowPolicyMode;
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
  /** Real model id for OpenClaw alias `spectyra/quality`. */
  aliasQualityModel: string;
  /** Optional license key for full optimization (set by Electron desktop). */
  licenseKey?: string;
  providerKeySource: "env" | "session";
  debugLogPrompts: boolean;
  /** Append normalized SpectyraEvent to ~/.spectyra/companion/events.jsonl (default true when telemetry is not off). */
  persistNormalizedEvents: boolean;
}

function parseWorkflowPolicyMode(raw: string | undefined): WorkflowPolicyMode {
  const v = (raw || "").trim().toLowerCase();
  if (v === "observe") return "observe";
  return "enforce";
}

/** Normalize so health checks match strict openai|anthropic|groq (env can pick up stray whitespace/newlines). */
function normalizeProviderId(raw: string | undefined): string {
  const t = (raw || "openai").trim().toLowerCase();
  if (t === "anthropic" || t === "groq") return t;
  return "openai";
}

export function loadConfig(): CompanionConfig {
  const dc = loadDesktopConfig();
  const provider = normalizeProviderId(process.env.SPECTYRA_PROVIDER || (dc.provider as string | undefined));
  const defaults = defaultAliasModels(provider);
  const licenseKey =
    process.env.SPECTYRA_LICENSE_KEY?.trim() ||
    (typeof dc.licenseKey === "string" && dc.licenseKey ? dc.licenseKey : undefined);
  return {
    runMode: (process.env.SPECTYRA_RUN_MODE as SpectyraRunMode) || (dc.runMode as SpectyraRunMode) || "on",
    workflowPolicyMode: parseWorkflowPolicyMode(process.env.SPECTYRA_WORKFLOW_POLICY),
    telemetryMode: (process.env.SPECTYRA_TELEMETRY as TelemetryMode) || (dc.telemetryMode as TelemetryMode) || "local",
    promptSnapshots: (process.env.SPECTYRA_PROMPT_SNAPSHOTS as PromptSnapshotMode) || (dc.promptSnapshots as PromptSnapshotMode) || "local_only",
    bindHost: process.env.SPECTYRA_BIND_HOST || "127.0.0.1",
    port: parseInt(process.env.SPECTYRA_PORT || String(dc.port || 4111), 10),
    provider,
    aliasSmartModel: process.env.SPECTYRA_ALIAS_SMART_MODEL?.trim() || (dc.aliasSmartModel as string | undefined) || defaults.smart,
    aliasFastModel: process.env.SPECTYRA_ALIAS_FAST_MODEL?.trim() || (dc.aliasFastModel as string | undefined) || defaults.fast,
    aliasQualityModel: process.env.SPECTYRA_ALIAS_QUALITY_MODEL?.trim() || (dc.aliasQualityModel as string | undefined) || defaults.quality,
    licenseKey,
    providerKeySource: (process.env.SPECTYRA_KEY_SOURCE as "env" | "session") || "env",
    debugLogPrompts: process.env.DEBUG_LOG_PROMPTS === "true",
    persistNormalizedEvents: process.env.SPECTYRA_PERSIST_EVENTS !== "false",
  };
}
