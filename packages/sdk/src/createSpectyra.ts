/**
 * Create Spectyra SDK Instance
 *
 * Main entry point for the Spectyra SDK.
 *
 * Primary path: local-first, direct-provider optimization via complete().
 * Legacy path: remote agent options and chat API (deprecated).
 */

import type {
  SpectyraConfig,
  SpectyraCtx,
  PromptMeta,
  ClaudeAgentOptions,
  AgentOptionsResponse,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
} from "./types.js";
import {
  createExecutorAdapter,
  mapCompleteToRunResult,
  type SpectyraRunInput,
  type SpectyraRunExecutor,
  type SpectyraRunResult,
} from "./run/spectyraRun.js";
import { decideAgent } from "./local/decideAgent.js";
import { toClaudeAgentOptions } from "./adapters/claudeAgent.js";
import { fetchAgentOptions, sendAgentEvent } from "./remote/agentRemote.js";
import { localComplete } from "./local/localWrapper.js";
import { maybePostSdkRunTelemetry } from "./cloud/postRunTelemetry.js";
import { resolveSpectyraCloudApiKey } from "./cloud/resolveSpectyraCloudApiKey.js";
import { createSpectyraLogger } from "./observability/spectyraLogger.js";
import { SpectyraSessionState } from "./observability/spectyraSessionState.js";
import type {
  SpectyraEntitlementStatus,
  SpectyraMetricsSnapshot,
  SpectyraQuotaStatus,
  SpectyraSavingsSummary,
  SpectyraLastRun,
  SpectyraSessionCostSummary,
} from "./observability/observabilityTypes.js";
import { startEntitlementRuntime, entitlementsDefaultEnabled } from "./entitlements/entitlementRuntime.js";
import { mountSpectyraDevtools, shouldMountDevtoolsByDefault } from "./devtools/mountDevtools.js";
import {
  getPricingSnapshot,
  getPricingSnapshotMeta,
  startPricingRuntime,
  type PricingSnapshotMeta,
} from "./pricing/pricingRuntime.js";
import { resolveModelPricingEntry } from "./pricing/modelResolver.js";
import { calculateSavingsFromUsages } from "./pricing/costCalculator.js";
import { normalizedUsageFromTokens } from "./pricing/normalizeUsage.js";
import type { SavingsCalculation } from "./pricing/types.js";

function newRunId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `run_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && "now" in performance) {
    return performance.now();
  }
  return Date.now();
}

function shouldPassthroughFromEntitlement(c: SpectyraConfig, session: SpectyraSessionState): boolean {
  if (!entitlementsDefaultEnabled(c)) return false;
  const q = session.getEntitlement()?.quota;
  return Boolean(q && !q.canRunOptimized);
}

function defaultQuota(session: SpectyraSessionState): SpectyraQuotaStatus {
  return (
    session.getEntitlement()?.quota ?? {
      plan: "free",
      state: "active_free",
      used: 0,
      limit: null,
      remaining: null,
      percentUsed: null,
      canRunOptimized: true,
    }
  );
}

export interface SpectyraInstance {
  /**
   * Primary API — wrap a provider call with Spectyra optimization.
   */
  complete<TClient, TResult>(
    input: SpectyraCompleteInput<TClient>,
    adapter: ProviderAdapter<TClient, TResult>,
  ): Promise<SpectyraCompleteResult<TResult>>;

  /**
   * Callback-style API: optimize locally, then run your provider call with optimized messages.
   * Same privacy and BYOK guarantees as `complete()` (no proxy; provider keys stay in your executor).
   */
  run<TResult>(
    input: SpectyraRunInput,
    execute: SpectyraRunExecutor<TResult>,
  ): Promise<SpectyraRunResult<TResult>>;

  /**
   * Get agent options locally (SDK mode - default)
   * Synchronous, works offline, no API calls
   */
  agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions;

  /**
   * @deprecated Use complete() instead
   * Get agent options from remote API (API mode)
   */
  agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse>;

  /**
   * @deprecated Legacy remote event forwarding
   */
  sendAgentEvent(ctx: SpectyraCtx, event: unknown): Promise<void>;

  /**
   * @deprecated Legacy remote stream observation
   */
  observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<unknown>): Promise<void>;

  getSessionStats(): SpectyraMetricsSnapshot;
  getSavingsSummary(): SpectyraSavingsSummary;
  /** Cumulative estimated costs for this `createSpectyra()` instance (resets with new instance). */
  getSessionCostSummary(): SpectyraSessionCostSummary;
  getQuotaStatus(): SpectyraQuotaStatus;
  getEntitlementStatus(): SpectyraEntitlementStatus | null;
  getLastRun(): SpectyraLastRun | null;
  /** Last run line-item cost breakdown when registry pricing resolved (null otherwise). */
  getLastRunCostBreakdown(): SavingsCalculation | null;
  /** Convenience: savings amount + percent from last completed run. */
  getLastRunSavings(): { savingsAmount: number; savingsPercent: number } | null;
  /** Pricing snapshot version / staleness for overlay and audits. */
  getPricingSnapshotMeta(): PricingSnapshotMeta;
  /**
   * Manually refresh entitlements (normally polled when enabled).
   */
  refreshEntitlement(): Promise<void>;
  /**
   * Mount the floating devtools (browser only; idempotent if already present).
   * @returns unmount
   */
  mountDevtools(): () => void;
}

/**
 * Create a Spectyra SDK instance.
 */
export function createSpectyra(config: SpectyraConfig = {}): SpectyraInstance {
  const legacyMode = config.mode;
  const endpoint = config.endpoint;
  const apiKey = config.apiKey;
  const telemetryMode = config.telemetry?.mode ?? "local";

  if (legacyMode === "api") {
    if (!endpoint) throw new Error("endpoint is required for API mode");
    if (!apiKey) throw new Error("apiKey is required for API mode");
  }

  if (telemetryMode === "cloud_redacted") {
    const hasSpectyraCredential =
      Boolean(config.licenseKey?.trim()) || Boolean(resolveSpectyraCloudApiKey(config));
    if (!hasSpectyraCredential) {
      throw new Error(
        'Spectyra: telemetry.mode "cloud_redacted" requires licenseKey and/or spectyraCloudApiKey (or SPECTYRA_CLOUD_API_KEY / SPECTYRA_API_KEY). These are Spectyra credentials, not provider API keys.',
      );
    }
  }

  const session = new SpectyraSessionState();
  const log = createSpectyraLogger(config);
  const entRuntime = startEntitlementRuntime(config, session);
  void startPricingRuntime(config);
  if (shouldMountDevtoolsByDefault(config) && (config.devtools?.enabled !== false)) {
    void mountSpectyraDevtools({
      config,
      devtools: config.devtools,
      getEntitlement: () => session.getEntitlement(),
      getSession: () => session,
      environmentLabel:
        (typeof process !== "undefined" && process.env?.NODE_ENV) || "browser",
    });
  }

  return {
    async complete<TClient, TResult>(
      input: SpectyraCompleteInput<TClient>,
      adapter: ProviderAdapter<TClient, TResult>,
    ): Promise<SpectyraCompleteResult<TResult>> {
      const t0 = nowMs();
      const runId = input.runContext?.runId?.trim() || newRunId();
      const withRun: SpectyraCompleteInput<TClient> = {
        ...input,
        runContext: { ...input.runContext, runId },
      };
      const baseMode = config.runMode ?? "on";
      const passthrough = shouldPassthroughFromEntitlement(config, session);
      const effectiveMode: import("@spectyra/core-types").SpectyraRunMode = passthrough
        ? "off"
        : baseMode;
      const merged: SpectyraConfig = { ...config, runMode: effectiveMode };

      try {
        config.onRequestStart?.({
          runId,
          provider: input.provider,
          model: input.model,
          runMode: effectiveMode,
        });
      } catch (e) {
        log.error("onRequestStart failed", { error: String(e) });
      }

      log.log("request", "started", { runId, model: input.model, provider: input.provider, runMode: effectiveMode });

      const out = await localComplete(merged, withRun, adapter);
      void maybePostSdkRunTelemetry(config, withRun, out).catch(() => {});

      const durationMs = nowMs() - t0;

      session.onRequestComplete(out as SpectyraCompleteResult<unknown>);

      const snap = getPricingSnapshot();
      if (snap?.entries?.length) {
        const w: string[] = [];
        const entry = resolveModelPricingEntry(snap.entries, out.report.provider, out.report.model, w);
        if (entry) {
          const baseU = normalizedUsageFromTokens({
            provider: out.report.provider,
            modelId: out.report.model,
            inputTokens: out.report.inputTokensBefore,
            outputTokens: out.report.outputTokens,
          });
          const optU = normalizedUsageFromTokens({
            provider: out.report.provider,
            modelId: out.report.model,
            inputTokens: out.report.inputTokensAfter,
            outputTokens: out.report.outputTokens,
          });
          session.setLastSavingsCalculation(calculateSavingsFromUsages(baseU, optU, entry, entry));
        } else {
          session.setLastSavingsCalculation(null);
        }
      } else {
        session.setLastSavingsCalculation(null);
      }

      const tf = out.report.transformsApplied?.length
        ? (out.report.transformsApplied ?? []).join(",")
        : "";
      log.log("request", "completed", {
        runId,
        durationMs: Math.round(durationMs),
        savingsUsd: out.report.estimatedSavings,
        savingsPct: out.report.estimatedSavingsPct,
        runMode: out.report.mode,
        transforms: tf,
      });

      if (passthrough || session.metricsFrozen) {
        try {
          config.onQuota?.(defaultQuota(session));
        } catch (e) {
          log.error("onQuota (complete path) failed", { error: String(e) });
        }
      }

      const pricingMeta = getPricingSnapshotMeta();
      if (pricingMeta.version && pricingMeta.stale) {
        try {
          config.onPricingStale?.({
            version: pricingMeta.version,
            fetchedAt: pricingMeta.fetchedAt,
            stale: pricingMeta.stale,
          });
        } catch (e) {
          log.error("onPricingStale (complete path) failed", { error: String(e) });
        }
      }

      if (out.report.transformsApplied && out.report.transformsApplied.length > 0) {
        try {
          config.onOptimization?.({
            runId,
            runMode: out.report.mode,
            transformsApplied: out.report.transformsApplied,
            inputTokensBefore: out.report.inputTokensBefore,
            inputTokensAfter: out.report.inputTokensAfter,
          });
        } catch (e) {
          log.error("onOptimization failed", { error: String(e) });
        }
      }

      try {
        config.onRequestEnd?.({ runId, provider: input.provider, model: input.model, durationMs });
        const snap = session.getSessionStats();
        config.onMetrics?.(snap);
      } catch (e) {
        log.error("onRequestEnd/onMetrics failed", { error: String(e) });
      }

      if (out.licenseLimited && effectiveMode !== "off") {
        log.log("license", "free tier / license limited: optimization not applied; provider call unchanged where applicable", {
          runId,
        });
      }

      try {
        config.onCostCalculated?.({
          runId,
          provider: input.provider,
          model: input.model,
          costBefore: out.report.estimatedCostBefore,
          costAfter: out.report.estimatedCostAfter,
          savingsAmount: out.report.estimatedSavings,
          savingsPercent: out.report.estimatedSavingsPct,
        });
      } catch (e) {
        log.error("onCostCalculated failed", { error: String(e) });
      }

      return out;
    },

    async run<TResult>(input: SpectyraRunInput, execute: SpectyraRunExecutor<TResult>): Promise<SpectyraRunResult<TResult>> {
      const adapter = createExecutorAdapter(input.provider, execute);
      const out = await this.complete(
        { ...input, client: {} as Record<string, never> },
        adapter,
      );
      const optimizationActive = out.report.mode === "on" && !out.licenseLimited;
      return mapCompleteToRunResult(out, defaultQuota(session), optimizationActive);
    },

    agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions {
      const decision = decideAgent({ config, ctx, prompt });
      return toClaudeAgentOptions(decision);
    },

    async agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse> {
      if (legacyMode !== "api" || !endpoint || !apiKey) {
        throw new Error("agentOptionsRemote requires API mode with endpoint and apiKey");
      }
      const response = await fetchAgentOptions(endpoint, apiKey, ctx, promptMeta);
      if (response.run_id && !ctx.runId) {
        ctx.runId = response.run_id;
      }
      return response;
    },

    async sendAgentEvent(ctx: SpectyraCtx, event: unknown): Promise<void> {
      if (legacyMode !== "api" || !endpoint || !apiKey) return;
      try {
        await sendAgentEvent(endpoint, apiKey, ctx, event);
      } catch (error) {
        console.warn("Failed to send agent event:", error);
      }
    },

    async observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<unknown>): Promise<void> {
      try {
        for await (const event of stream) {
          await this.sendAgentEvent(ctx, event);
        }
      } catch (error) {
        console.warn("Error observing agent stream:", error);
      }
    },

    getSessionStats() {
      return session.getSessionStats();
    },
    getSavingsSummary() {
      return session.getSavingsSummary();
    },
    getSessionCostSummary() {
      return session.getSessionCostSummary();
    },
    getQuotaStatus() {
      return defaultQuota(session);
    },
    getEntitlementStatus() {
      return session.getEntitlement();
    },
    getLastRun() {
      return session.getLastRun();
    },
    getLastRunCostBreakdown() {
      return session.getLastRunCostBreakdown();
    },
    getLastRunSavings() {
      return session.getLastRunSavings();
    },
    getPricingSnapshotMeta() {
      return getPricingSnapshotMeta();
    },
    async refreshEntitlement() {
      await entRuntime.refresh();
    },
    mountDevtools() {
      return mountSpectyraDevtools({
        config,
        devtools: config.devtools,
        getEntitlement: () => session.getEntitlement(),
        getSession: () => session,
        environmentLabel: (typeof process !== "undefined" && process.env?.NODE_ENV) || "browser",
      }).unmount;
    },
  };
}
