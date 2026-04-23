/**
 * Universal mode model for the Spectyra platform.
 *
 * These types are the single source of truth used by the SDK, Local Companion,
 * Desktop App, and Website App.
 */

/**
 * Top-level run mode that governs optimization behavior.
 *
 * - `off` – no optimization, no request mutation, host app runs natively
 *   (e.g. passthrough or not entitled to apply optimizations).
 * - `on`  – run the optimization pipeline; whether transforms apply also depends
 *   on license / entitlements in the product layer.
 *
 * Legacy `observe` in saved configs and API payloads is accepted only via
 * {@link normalizeSpectyraRunMode} (mapped to `on` for migration).
 */
export type SpectyraRunMode = "off" | "on";

/**
 * Map legacy and loose strings to a strict run mode. Unknown values → `defaultMode`.
 * `"observe"` (removed) is treated as `"on"` for backward compatibility.
 */
export function normalizeSpectyraRunMode(
  raw: string | null | undefined,
  defaultMode: SpectyraRunMode = "on",
): SpectyraRunMode {
  const s = (raw ?? "").trim().toLowerCase();
  if (s === "off") return "off";
  if (s === "on" || s === "observe") return "on";
  return defaultMode;
}

/**
 * Telemetry destination.
 *
 * - `off`            – no telemetry collected.
 * - `local`          – telemetry stored on the customer machine only (default).
 * - `cloud_redacted` – aggregated / redacted analytics synced to Spectyra cloud.
 */
export type TelemetryMode = "off" | "local" | "cloud_redacted";

/**
 * Where before/after prompt snapshots are stored.
 *
 * - `none`         – no snapshots kept.
 * - `local_only`   – snapshots stored on the customer machine only (default).
 * - `cloud_opt_in` – snapshots may be synced to Spectyra cloud if the user opts in.
 */
export type PromptSnapshotMode = "none" | "local_only" | "cloud_opt_in";

/**
 * Where the live inference call is routed.
 *
 * - `direct_provider`      – customer environment → provider (default).
 * - `legacy_remote_gateway` – routed through Spectyra cloud (deprecated).
 */
export type InferencePath = "direct_provider" | "legacy_remote_gateway";

/**
 * Who pays the LLM provider for inference tokens.
 * Always `customer` in the standard product.
 */
export type ProviderBillingOwner = "customer";

/**
 * How the customer integrates with Spectyra.
 *
 * - `sdk-wrapper`           – in-code developer integration via `@spectyra/sdk` or `@spectyra/agents`.
 * - `local-companion`       – Local Companion runtime for OpenClaw-like / no-code tools.
 * - `observe-preview`       – dry-run observe mode (no provider call, projections only).
 * - `legacy-remote-gateway` – deprecated cloud gateway path.
 */
export type IntegrationType =
  | "sdk-wrapper"
  | "local-companion"
  | "observe-preview"
  | "openclaw-jsonl"
  | "claude-hooks"
  | "claude-jsonl"
  | "openai-tracing"
  | "generic-jsonl"
  | "agent-harness"
  | "provider-direct"
  | "legacy-remote-gateway"
  | "unknown";
