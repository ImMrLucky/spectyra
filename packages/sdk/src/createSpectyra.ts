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
  SpectyraSavingsEvent,
} from "./types.js";
import type { SpectyraMonitorEvent, SpectyraMonitorSummary } from "./monitor/monitorTypes.js";
import { createMonitorEngine } from "./monitor/monitorEngine.js";
import { emptyMonitorSummary } from "./monitor/summaries.js";
import { buildMonitorEventFromComplete, buildFailureMonitorEvent } from "./monitor/emitFromComplete.js";
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
import { createMonitorCloudSyncDebouncer } from "./cloud/monitorCloudSyncDebouncer.js";
import { resolveEffectiveTelemetryMode } from "./observability/resolveEffectiveTelemetryMode.js";
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
import {
  mountSpectyraDevtools,
  shouldMountDevtoolsByDefault,
  type SpectyraDevtoolsMountHandle,
} from "./devtools/mountDevtools.js";
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
import { resolveSpectyraEnvironmentLabel, resolveEffectiveDebug, isSpectyraProductionEnvironment } from "./config/sdkUiEnv.js";
import { logSpectyraDebugSafeLine } from "./debug/debugSafeSummary.js";
import { resolveMonitorEnabledInApp } from "./monitor/resolveMonitorEnabled.js";
import {
  aggregateAllMonitorViews,
  getOptimizerQuotaSummaryFromEvents,
  type SpectyraMonitorBreakdownRow,
} from "./monitor/monitorAggregates.js";

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
   * Safe savings snapshot for dev/QA (no prompt text).
   */
  getSavings(): {
    summary: SpectyraSavingsSummary;
    lastRun: SpectyraLastRun | null;
    lastRunSavings: { savingsAmount: number; savingsPercent: number } | null;
  };
  /**
   * Subscribe to post-run savings events (numeric summaries only).
   * @returns unsubscribe function
   */
  on(event: "savings", listener: (e: SpectyraSavingsEvent) => void): () => void;
  /** Browser savings overlay — mounts devtools if needed. No-op in Node or when `devtools.enabled === false`. */
  showOverlay(): void;
  hideOverlay(): void;
  toggleOverlay(): void;
  /**
   * Mount the floating devtools (browser only; idempotent if already present).
   * @returns unmount
   */
  mountDevtools(): () => void;

  /**
   * Record a metadata-only monitor event when the monitor is enabled (default in-app).
   */
  recordMonitorEvent(
    partial: Partial<SpectyraMonitorEvent> & Pick<SpectyraMonitorEvent, "provider" | "latencyMs" | "success">,
  ): void;
  /** Rollup of buffered monitor events (empty when monitor is disabled). */
  getMonitorSummary(): SpectyraMonitorSummary;
  /** Alias of {@link getMonitorSummary} (spec naming: cost rollup). */
  getCostSummary(): SpectyraMonitorSummary;
  /** Recent monitor events from the in-memory buffer (newest last). */
  getRecentMonitorEvents(limit?: number): SpectyraMonitorEvent[];
  getProviderBreakdown(): SpectyraMonitorBreakdownRow[];
  getModelBreakdown(): SpectyraMonitorBreakdownRow[];
  getEnvironmentBreakdown(): SpectyraMonitorBreakdownRow[];
  getEndpointBreakdown(): SpectyraMonitorBreakdownRow[];
  getExpensiveCalls(): SpectyraMonitorEvent[];
  getMissedSavingsSummary(): {
    totalMissedSavingsUsd: number;
    eventCount: number;
    averageMissedPerEventUsd: number;
  };
  getWasteSummary(): { byType: Record<string, number>; estimatedImpactUsd: number };
  getRepeatedCalls(): SpectyraMonitorEvent[];
  getCacheOpportunities(): SpectyraMonitorEvent[];
  getOptimizerQuotaSummary(): {
    plan: string;
    canRunOptimized: boolean;
    freeOptimizerPercentUsed: number | null;
    monitorEventsWhileLimited: number;
  };
}

/**
 * Create a Spectyra SDK instance.
 */
export function createSpectyra(config: SpectyraConfig = {}): SpectyraInstance {
  const feat = config.features ?? {};
  const effectiveConfig: SpectyraConfig = {
    ...config,
    features: {
      monitor: feat.monitor !== false,
      analytics: feat.analytics !== false,
      optimizer: feat.optimizer !== false,
    },
  };

  const legacyMode = effectiveConfig.mode;
  const endpoint = effectiveConfig.endpoint;
  const apiKey = effectiveConfig.apiKey;
  const telemetryMode = resolveEffectiveTelemetryMode(effectiveConfig);

  if (legacyMode === "api") {
    if (!endpoint) throw new Error("endpoint is required for API mode");
    if (!apiKey) throw new Error("apiKey is required for API mode");
  }

  if (telemetryMode === "cloud_redacted") {
    const hasSpectyraCredential =
      Boolean(effectiveConfig.licenseKey?.trim()) || Boolean(resolveSpectyraCloudApiKey(effectiveConfig));
    if (!hasSpectyraCredential) {
      throw new Error(
        'Spectyra: telemetry.mode "cloud_redacted" requires licenseKey and/or spectyraCloudApiKey (or SPECTYRA_CLOUD_API_KEY / SPECTYRA_API_KEY). These are Spectyra credentials, not provider API keys.',
      );
    }
  }

  const session = new SpectyraSessionState();
  const log = createSpectyraLogger(effectiveConfig);
  const monitorEnabled = resolveMonitorEnabledInApp(effectiveConfig);
  const monitorConsoleEnabled =
    effectiveConfig.monitor?.console?.enabled ??
    (typeof process !== "undefined" && !isSpectyraProductionEnvironment(effectiveConfig));

  let monitorEngine: ReturnType<typeof createMonitorEngine> | null = null;
  const monitorCloudDebouncer = monitorEnabled
    ? createMonitorCloudSyncDebouncer(effectiveConfig, () => monitorEngine?.getEventsSnapshot() ?? [])
    : null;

  monitorEngine = monitorEnabled
    ? createMonitorEngine({
        enabled: true,
        bufferMaxEvents: effectiveConfig.monitor?.bufferMaxEvents,
        jsonl: effectiveConfig.monitor?.jsonl,
        console: {
          enabled: monitorConsoleEnabled,
          level: effectiveConfig.monitor?.console?.level ?? "info",
        },
        defaults: {
          project: effectiveConfig.projectId,
          environment: typeof effectiveConfig.environment === "string" ? effectiveConfig.environment : undefined,
          service: effectiveConfig.service,
        },
        logger: effectiveConfig.logger,
        onAfterRecord: monitorCloudDebouncer ? () => monitorCloudDebouncer.schedule() : undefined,
      })
    : null;

  const entRuntime = startEntitlementRuntime(effectiveConfig, session);
  void startPricingRuntime(effectiveConfig);

  const savingsListeners = new Set<(e: SpectyraSavingsEvent) => void>();
  let overlayHandle: SpectyraDevtoolsMountHandle | null = null;
  const envLabel = resolveSpectyraEnvironmentLabel(effectiveConfig);

  function mountDevtoolsUi(): SpectyraDevtoolsMountHandle {
    const h = mountSpectyraDevtools({
      config: effectiveConfig,
      devtools: effectiveConfig.devtools,
      getEntitlement: () => session.getEntitlement(),
      getSession: () => session,
      environmentLabel: envLabel,
      getMonitorSummary: monitorEngine ? () => monitorEngine.getMonitorSummary() : undefined,
    });
    if (h.didMount) {
      overlayHandle = h;
    }
    return h;
  }

  if (shouldMountDevtoolsByDefault(effectiveConfig) && effectiveConfig.devtools?.enabled !== false) {
    void mountDevtoolsUi();
  }

  function monitorSnapshot(): SpectyraMonitorEvent[] {
    return monitorEngine?.getEventsSnapshot() ?? [];
  }

  function monitorViews() {
    return aggregateAllMonitorViews(monitorSnapshot());
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
      const baseMode = effectiveConfig.runMode ?? "on";
      const passthrough = shouldPassthroughFromEntitlement(effectiveConfig, session);
      const effectiveMode: import("@spectyra/core-types").SpectyraRunMode = passthrough
        ? "off"
        : baseMode;
      const merged: SpectyraConfig = { ...effectiveConfig, runMode: effectiveMode };

      try {
        effectiveConfig.onRequestStart?.({
          runId,
          provider: input.provider,
          model: input.model,
          runMode: effectiveMode,
        });
      } catch (e) {
        log.error("onRequestStart failed", { error: String(e) });
      }

      log.log("request", "started", { runId, model: input.model, provider: input.provider, runMode: effectiveMode });

      let out: SpectyraCompleteResult<TResult>;
      try {
        out = await localComplete(merged, withRun, adapter);
      } catch (err) {
        try {
          monitorEngine?.recordEvent(
            buildFailureMonitorEvent({
              config: effectiveConfig,
              input: withRun,
              durationMs: nowMs() - t0,
              error: err,
              runId,
            }),
          );
        } catch {
          /* monitor must never mask the original error */
        }
        throw err;
      }
      void maybePostSdkRunTelemetry(effectiveConfig, withRun, out).catch(() => {});

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
          effectiveConfig.onQuota?.(defaultQuota(session));
        } catch (e) {
          log.error("onQuota (complete path) failed", { error: String(e) });
        }
      }

      const pricingMeta = getPricingSnapshotMeta();
      if (pricingMeta.version && pricingMeta.stale) {
        try {
          effectiveConfig.onPricingStale?.({
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
          effectiveConfig.onOptimization?.({
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
        effectiveConfig.onRequestEnd?.({ runId, provider: input.provider, model: input.model, durationMs });
        const snap = session.getSessionStats();
        effectiveConfig.onMetrics?.(snap);
      } catch (e) {
        log.error("onRequestEnd/onMetrics failed", { error: String(e) });
      }

      if (out.licenseLimited && effectiveMode !== "off") {
        log.log("license", "free tier / license limited: optimization not applied; provider call unchanged where applicable", {
          runId,
        });
      }

      try {
        effectiveConfig.onCostCalculated?.({
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

      const quotaSnap = session.getEntitlement()?.quota ?? null;
      if (resolveEffectiveDebug(effectiveConfig)) {
        logSpectyraDebugSafeLine({
          effectiveMode,
          passthroughFromQuota: passthrough,
          quota: quotaSnap,
          out: out as SpectyraCompleteResult<unknown>,
          traceId: withRun.runContext?.traceId?.trim() || runId,
        });
      }

      const rep = out.report;
      const traceId = withRun.runContext?.traceId?.trim() || rep.runId || runId;
      const optimized =
        effectiveMode === "on" && !passthrough && !out.licenseLimited && rep.mode === "on";
      let passthroughReason: string | undefined;
      if (passthrough) {
        passthroughReason = quotaSnap?.state ? `quota:${quotaSnap.state}` : "quota";
      } else if (effectiveMode === "off") {
        passthroughReason = "run_mode_off";
      } else if (out.licenseLimited) {
        passthroughReason = "license_limited";
      }
      const savingsEvent: SpectyraSavingsEvent = {
        runId: rep.runId || runId,
        traceId,
        provider: rep.provider,
        model: rep.model,
        optimized,
        passthroughReason,
        savingsPercent: rep.estimatedSavingsPct,
        savingsUsd: rep.estimatedSavings,
        inputTokensBefore: rep.inputTokensBefore,
        inputTokensAfter: rep.inputTokensAfter,
        outputTokens: rep.outputTokens,
        estimatedCostBefore: rep.estimatedCostBefore,
        estimatedCostAfter: rep.estimatedCostAfter,
      };
      for (const fn of savingsListeners) {
        try {
          fn(savingsEvent);
        } catch (e) {
          log.warn("savings listener failed", { error: String(e) });
        }
      }

      try {
        if (monitorEngine) {
          monitorEngine.recordEvent(
            buildMonitorEventFromComplete({
              config: effectiveConfig,
              monitor: effectiveConfig.monitor,
              input: withRun,
              out: out as SpectyraCompleteResult<unknown>,
              durationMs,
              optimized,
              passthrough,
              effectiveMode,
            }),
          );
        }
      } catch {
        /* never fail complete() because of monitor */
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
      const decision = decideAgent({ config: effectiveConfig, ctx, prompt });
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
    getSavings() {
      return {
        summary: session.getSavingsSummary(),
        lastRun: session.getLastRun(),
        lastRunSavings: session.getLastRunSavings(),
      };
    },
    on(event: "savings", listener: (e: SpectyraSavingsEvent) => void) {
      if (event !== "savings") {
        throw new Error(`Spectyra: unsupported event "${String(event)}" (only "savings" is supported)`);
      }
      savingsListeners.add(listener);
      return () => {
        savingsListeners.delete(listener);
      };
    },
    showOverlay() {
      const h = overlayHandle?.didMount ? overlayHandle : mountDevtoolsUi();
      h.show();
    },
    hideOverlay() {
      overlayHandle?.hide();
    },
    toggleOverlay() {
      const h = overlayHandle?.didMount ? overlayHandle : mountDevtoolsUi();
      h.toggle();
    },
    getPricingSnapshotMeta() {
      return getPricingSnapshotMeta();
    },
    async refreshEntitlement() {
      await entRuntime.refresh();
    },
    mountDevtools() {
      const h = mountDevtoolsUi();
      return () => {
        h.unmount();
        if (overlayHandle === h) {
          overlayHandle = null;
        }
      };
    },

    recordMonitorEvent(partial) {
      monitorEngine?.recordEvent(partial);
    },
    getMonitorSummary() {
      return monitorEngine?.getMonitorSummary() ?? emptyMonitorSummary();
    },
    getCostSummary() {
      return monitorEngine?.getMonitorSummary() ?? emptyMonitorSummary();
    },
    getRecentMonitorEvents(limit = 50) {
      return monitorEngine?.getRecentMonitorEvents(limit) ?? [];
    },
    getProviderBreakdown() {
      return monitorViews().provider;
    },
    getModelBreakdown() {
      return monitorViews().model;
    },
    getEnvironmentBreakdown() {
      return monitorViews().environment;
    },
    getEndpointBreakdown() {
      return monitorViews().endpoint;
    },
    getExpensiveCalls() {
      return monitorViews().expensive;
    },
    getMissedSavingsSummary() {
      return monitorViews().missed;
    },
    getWasteSummary() {
      return monitorViews().waste;
    },
    getRepeatedCalls() {
      return monitorViews().repeated;
    },
    getCacheOpportunities() {
      return monitorViews().cache;
    },
    getOptimizerQuotaSummary() {
      return getOptimizerQuotaSummaryFromEvents(monitorSnapshot(), defaultQuota(session));
    },
  };
}
