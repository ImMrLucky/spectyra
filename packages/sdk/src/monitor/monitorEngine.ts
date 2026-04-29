import type { SpectyraMonitorEvent, SpectyraMonitorSummary } from "./monitorTypes.js";
import { MonitorEventBuffer } from "./eventBuffer.js";
import { MonitorJsonlWriter } from "./jsonlWriter.js";
import { scrubMonitorEventForPersistence } from "./redaction.js";
import { buildMonitorSummaryFromEvents } from "./summaries.js";
import { mergeCrossEventWasteIntoEvent } from "./crossEventWaste.js";
import { emitMonitorEventToDevtoolsBus } from "./monitorBus.js";

export interface MonitorEngineOptions {
  enabled: boolean;
  bufferMaxEvents?: number;
  jsonl?: {
    enabled?: boolean;
    path?: string;
    rotateDaily?: boolean;
    maxFileSizeMb?: number;
  };
  console?: {
    enabled?: boolean;
    level?: "silent" | "error" | "warn" | "info" | "debug";
  };
  defaults?: {
    project?: string;
    environment?: string;
    service?: string;
    integrationMode?: SpectyraMonitorEvent["integrationMode"];
  };
  logger?: Pick<Console, "log" | "warn" | "error" | "debug">;
  /** Called after each persisted monitor row (metadata-only). */
  onAfterRecord?: (ev: SpectyraMonitorEvent) => void;
}

function newEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function isoNow(): string {
  return new Date().toISOString();
}

/**
 * Standalone monitor engine (also used by `createSpectyra` when monitoring is enabled).
 * @public
 */
export function createMonitorEngine(opts: MonitorEngineOptions) {
  const buffer = new MonitorEventBuffer(opts.bufferMaxEvents);
  const jsonl =
    opts.jsonl?.enabled !== false && opts.enabled
      ? new MonitorJsonlWriter({
          path: opts.jsonl?.path,
          rotateDaily: opts.jsonl?.rotateDaily,
          maxFileSizeMb: opts.jsonl?.maxFileSizeMb,
        })
      : null;
  const log = opts.logger ?? console;
  const consoleEnabled = opts.console?.enabled === true;
  const consoleLevel = opts.console?.level ?? "info";

  function logLine(level: typeof consoleLevel, msg: string) {
    if (!consoleEnabled || level === "silent") return;
    const order = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
    const min = order[consoleLevel] ?? 3;
    if (order[level] > min) return;
    if (level === "error") log.error(msg);
    else if (level === "warn") log.warn(msg);
    else if (level === "debug") log.debug?.(msg);
    else log.log(msg);
  }

  function recordEvent(
    partial: Partial<SpectyraMonitorEvent> &
      Pick<SpectyraMonitorEvent, "provider" | "latencyMs" | "success">,
  ): void {
    if (!opts.enabled) return;

    const ev: SpectyraMonitorEvent = scrubMonitorEventForPersistence({
      ...partial,
      eventId: partial.eventId ?? newEventId(),
      timestamp: partial.timestamp ?? isoNow(),
      provider: partial.provider,
      integrationMode: partial.integrationMode ?? opts.defaults?.integrationMode ?? "explicit_sdk",
      sdkLanguage: partial.sdkLanguage ?? "typescript",
      latencyMs: partial.latencyMs,
      success: partial.success,
      pricingSource: partial.pricingSource ?? "unknown",
      project: partial.project ?? opts.defaults?.project,
      environment: partial.environment ?? opts.defaults?.environment,
      service: partial.service ?? opts.defaults?.service,
      metadataOnly: true,
    });

    const prior = buffer.snapshot();
    mergeCrossEventWasteIntoEvent(prior, ev);

    buffer.push(ev);
    jsonl?.append(ev);
    emitMonitorEventToDevtoolsBus(ev);
    try {
      opts.onAfterRecord?.(ev);
    } catch {
      /* fail open */
    }

    const actual = ev.actualCostUsd ?? ev.estimatedCostUsd ?? 0;
    const opt = ev.optimizedCostUsd;
    const saved = ev.savedUsd ?? 0;
    const missed = ev.missedSavingsUsd ?? 0;
    const applied = ev.optimizerApplied === true;

    if (applied) {
      logLine(
        "info",
        `[Spectyra:monitor] ${ev.provider} ${ev.model ?? ""}\n` +
          `Actual Spend (Provider): $${(ev.actualCostUsd ?? 0).toFixed(4)}\n` +
          (opt != null ? `Optimized Spend (Spectyra): $${opt.toFixed(4)}\n` : "") +
          `Savings: $${(saved ?? 0).toFixed(4)}${ev.savingsPct != null ? ` (${ev.savingsPct.toFixed(0)}%)` : ""}\n` +
          `Latency: ${(ev.latencyMs / 1000).toFixed(2)}s`,
      );
    } else {
      logLine(
        "info",
        `[Spectyra:monitor] ${ev.provider} ${ev.model ?? ""}\n` +
          `Actual Spend (Provider): $${(ev.actualCostUsd ?? 0).toFixed(4)}\n` +
          (ev.projectedOptimizedCostUsd != null
            ? `Potential Spend with Spectyra: $${ev.projectedOptimizedCostUsd.toFixed(4)}\n`
            : "") +
          `Missed Savings: $${(missed ?? 0).toFixed(4)}${ev.missedSavingsPct != null ? ` (${ev.missedSavingsPct.toFixed(0)}%)` : ""}\n` +
          `Latency: ${(ev.latencyMs / 1000).toFixed(2)}s\n` +
          `Optimization disabled. Monitoring continues.`,
      );
    }
  }

  function getMonitorSummary(): SpectyraMonitorSummary {
    return buildMonitorSummaryFromEvents(buffer.snapshot());
  }

  function getEventsSnapshot(): SpectyraMonitorEvent[] {
    return buffer.snapshot();
  }

  function getRecentMonitorEvents(limit = 50): SpectyraMonitorEvent[] {
    return buffer.recent(limit);
  }

  return {
    recordEvent,
    getMonitorSummary,
    getRecentMonitorEvents,
    getEventsSnapshot,
    /** @internal testing */
    _buffer: buffer,
  };
}

export type MonitorEngine = ReturnType<typeof createMonitorEngine>;
