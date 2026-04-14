/**
 * Local Companion configuration.
 *
 * Resolved from environment variables and/or a local config file.
 * Security defaults: bind localhost, no prompt logging, no cloud relay.
 */

import { loadDesktopConfig, readSpectyraAccountGate } from "./desktopSession.js";
import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
} from "@spectyra/core-types";
import { defaultAliasModels, type UpstreamProviderId } from "@spectyra/shared";
import type { WorkflowPolicyMode } from "@spectyra/workflow-policy";

export interface CompanionConfig {
  /**
   * OpenClaw distributed path: full local optimization without Spectyra account or billing.
   * Default true; set `SPECTYRA_OPENCLAW_FREE=false` for account-gated / desktop-style behavior.
   */
  openclawFreeMode: boolean;
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
  /**
   * Per-vendor tier overrides for explicit routes `spectyra/<openai|anthropic|groq>/<tier>`.
   * Lets you point e.g. `spectyra/anthropic/quality` at Opus while `spectyra/openai/smart` uses GPT.
   */
  providerTierModels?: Partial<
    Record<UpstreamProviderId, Partial<Record<"smart" | "fast" | "quality", string>>>
  >;
  /** Optional license key for full optimization (set by Electron desktop). */
  licenseKey?: string;
  providerKeySource: "env" | "session";
  debugLogPrompts: boolean;
  /** Append normalized SpectyraEvent to ~/.spectyra/companion/events.jsonl (default true when telemetry is not off). */
  persistNormalizedEvents: boolean;
  /**
   * When true (default), upload redacted session summaries to Spectyra when a Supabase session is present.
   * Set false in ~/.spectyra/desktop/config.json or SPECTYRA_SYNC_ANALYTICS=false to disable.
   */
  syncAnalyticsToCloud: boolean;

  /**
   * True when ~/.spectyra/desktop/config.json has a non-expired Supabase session and a Spectyra API key.
   * Required for `runMode: "on"` to apply real optimizations (otherwise we stay in observe-style behavior).
   */
  spectyraAccountLinked: boolean;
  /** Email shown in health/dashboard — from config or JWT (never verified locally beyond session presence). */
  accountEmail?: string;
  /**
   * Effective mode for the optimization pipeline after account gate.
   * If the user requests `on` but the account is not linked, this is `observe` (unless `off`).
   */
  optimizationRunMode: SpectyraRunMode;
  /**
   * Spectyra org API key from desktop config — used with license key for local engine activation.
   * Never returned from HTTP JSON endpoints.
   */
  spectyraApiKey?: string;
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

function parseProviderTierModels(raw: unknown): CompanionConfig["providerTierModels"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: NonNullable<CompanionConfig["providerTierModels"]> = {};
  for (const p of ["openai", "anthropic", "groq"] as const) {
    const block = o[p];
    if (!block || typeof block !== "object" || Array.isArray(block)) continue;
    const tierMap: NonNullable<CompanionConfig["providerTierModels"]>[typeof p] = {};
    for (const t of ["smart", "fast", "quality"] as const) {
      const v = (block as Record<string, unknown>)[t];
      if (typeof v === "string" && v.trim()) tierMap[t] = v.trim();
    }
    if (Object.keys(tierMap).length > 0) out[p] = tierMap;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function loadConfig(): CompanionConfig {
  const dc = loadDesktopConfig();
  const gate = readSpectyraAccountGate(dc);
  const bypassAccount = process.env.SPECTYRA_BYPASS_ACCOUNT_CHECK === "true";
  const spectyraAccountLinked = bypassAccount || gate.linked;
  const openclawFreeMode =
    process.env.SPECTYRA_OPENCLAW_FREE === "false" || process.env.SPECTYRA_OPENCLAW_FREE === "0"
      ? false
      : true;
  const provider = normalizeProviderId(process.env.SPECTYRA_PROVIDER || (dc.provider as string | undefined));
  const defaults = defaultAliasModels(provider);
  const licenseKey =
    process.env.SPECTYRA_LICENSE_KEY?.trim() ||
    (typeof dc.licenseKey === "string" && dc.licenseKey ? dc.licenseKey : undefined);
  const spectyraApiKey = gate.apiKey;
  const requestedRunMode =
    (process.env.SPECTYRA_RUN_MODE as SpectyraRunMode) || (dc.runMode as SpectyraRunMode) || "on";
  const optimizationRunMode: SpectyraRunMode =
    requestedRunMode === "off"
      ? "off"
      : openclawFreeMode || spectyraAccountLinked
        ? requestedRunMode
        : "observe";
  return {
    openclawFreeMode,
    runMode: requestedRunMode,
    workflowPolicyMode: parseWorkflowPolicyMode(process.env.SPECTYRA_WORKFLOW_POLICY),
    telemetryMode: (process.env.SPECTYRA_TELEMETRY as TelemetryMode) || (dc.telemetryMode as TelemetryMode) || "local",
    promptSnapshots: (process.env.SPECTYRA_PROMPT_SNAPSHOTS as PromptSnapshotMode) || (dc.promptSnapshots as PromptSnapshotMode) || "local_only",
    bindHost: process.env.SPECTYRA_BIND_HOST || "127.0.0.1",
    port: parseInt(process.env.SPECTYRA_PORT || String(dc.port || 4111), 10),
    provider,
    aliasSmartModel: process.env.SPECTYRA_ALIAS_SMART_MODEL?.trim() || (dc.aliasSmartModel as string | undefined) || defaults.smart,
    aliasFastModel: process.env.SPECTYRA_ALIAS_FAST_MODEL?.trim() || (dc.aliasFastModel as string | undefined) || defaults.fast,
    aliasQualityModel: process.env.SPECTYRA_ALIAS_QUALITY_MODEL?.trim() || (dc.aliasQualityModel as string | undefined) || defaults.quality,
    providerTierModels: parseProviderTierModels(dc.providerTierModels),
    licenseKey,
    providerKeySource: (process.env.SPECTYRA_KEY_SOURCE as "env" | "session") || "env",
    debugLogPrompts: process.env.DEBUG_LOG_PROMPTS === "true",
    persistNormalizedEvents: process.env.SPECTYRA_PERSIST_EVENTS !== "false",
    syncAnalyticsToCloud: dc.syncAnalyticsToCloud !== false,
    spectyraAccountLinked,
    accountEmail: gate.email,
    optimizationRunMode,
    spectyraApiKey,
  };
}
