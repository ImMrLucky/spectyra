import type { SpectyraMonitorEvent, SpectyraWasteSignal } from "./monitorTypes.js";
import type { SpectyraMonitorSummary } from "./monitorTypes.js";
import { buildMonitorSummaryFromEvents } from "./summaries.js";

/** Row shape for provider/model/environment/endpoint breakdowns. */
export interface SpectyraMonitorBreakdownRow {
  key: string;
  requestCount: number;
  actualSpendProviderUsd: number;
  optimizedSpendSpectyraUsd?: number;
  potentialSpendWithSpectyraUsd?: number;
  savingsUsd: number;
  missedSavingsUsd: number;
  totalTokens: number;
  averageCostUsd: number;
  averageLatencyMs: number;
  errorRate: number;
  topWasteSignals: SpectyraWasteSignal[];
}

function spend(ev: SpectyraMonitorEvent): number {
  return ev.actualCostUsd ?? ev.estimatedCostUsd ?? 0;
}

function tokens(ev: SpectyraMonitorEvent): number {
  return ev.totalTokens ?? (ev.inputTokens ?? 0) + (ev.outputTokens ?? 0);
}

function collectWaste(events: SpectyraMonitorEvent[]): SpectyraWasteSignal[] {
  const out: SpectyraWasteSignal[] = [];
  for (const e of events) {
    for (const w of e.wasteSignals ?? []) {
      out.push(w);
    }
  }
  return out.slice(0, 20);
}

function group(
  events: SpectyraMonitorEvent[],
  keyFn: (e: SpectyraMonitorEvent) => string,
): Map<string, SpectyraMonitorEvent[]> {
  const m = new Map<string, SpectyraMonitorEvent[]>();
  for (const e of events) {
    const k = keyFn(e) || "unknown";
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(e);
  }
  return m;
}

function rowFromGroup(key: string, evs: SpectyraMonitorEvent[]): SpectyraMonitorBreakdownRow {
  const n = evs.length;
  let spendUsd = 0;
  let optSpend = 0;
  let pot = 0;
  let sav = 0;
  let miss = 0;
  let tok = 0;
  let lat = 0;
  let err = 0;
  for (const e of evs) {
    spendUsd += spend(e);
    optSpend += e.optimizedCostUsd ?? 0;
    pot += e.projectedOptimizedCostUsd ?? 0;
    sav += e.savedUsd ?? 0;
    miss += e.missedSavingsUsd ?? 0;
    tok += tokens(e);
    lat += e.latencyMs;
    if (!e.success) err += 1;
  }
  return {
    key,
    requestCount: n,
    actualSpendProviderUsd: spendUsd,
    optimizedSpendSpectyraUsd: optSpend > 0 ? optSpend : undefined,
    potentialSpendWithSpectyraUsd: pot > 0 ? pot : undefined,
    savingsUsd: sav,
    missedSavingsUsd: miss,
    totalTokens: tok,
    averageCostUsd: n ? spendUsd / n : 0,
    averageLatencyMs: n ? lat / n : 0,
    errorRate: n ? err / n : 0,
    topWasteSignals: collectWaste(evs).slice(0, 5),
  };
}

export function getProviderBreakdownFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorBreakdownRow[] {
  const m = group(events, (e) => e.provider);
  return [...m.entries()].map(([k, evs]) => rowFromGroup(k, evs)).sort((a, b) => b.actualSpendProviderUsd - a.actualSpendProviderUsd);
}

export function getModelBreakdownFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorBreakdownRow[] {
  const m = group(events, (e) => `${e.provider}:${e.model ?? "unknown"}`);
  return [...m.entries()].map(([k, evs]) => rowFromGroup(k, evs)).sort((a, b) => b.actualSpendProviderUsd - a.actualSpendProviderUsd);
}

export function getEnvironmentBreakdownFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorBreakdownRow[] {
  const m = group(events, (e) => e.environment ?? "unknown");
  return [...m.entries()].map(([k, evs]) => rowFromGroup(k, evs)).sort((a, b) => b.requestCount - a.requestCount);
}

export function getEndpointBreakdownFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorBreakdownRow[] {
  const m = group(events, (e) => e.endpoint ?? e.route ?? e.urlHost ?? "unknown");
  return [...m.entries()].map(([k, evs]) => rowFromGroup(k, evs)).sort((a, b) => b.actualSpendProviderUsd - a.actualSpendProviderUsd);
}

export function getExpensiveCallsFromEvents(events: SpectyraMonitorEvent[], limit = 15): SpectyraMonitorEvent[] {
  return [...events].sort((a, b) => spend(b) - spend(a)).slice(0, limit);
}

export function getMissedSavingsSummaryFromEvents(events: SpectyraMonitorEvent[]): {
  totalMissedSavingsUsd: number;
  eventCount: number;
  averageMissedPerEventUsd: number;
} {
  let t = 0;
  let n = 0;
  for (const e of events) {
    const m = e.missedSavingsUsd ?? 0;
    if (m > 0) {
      t += m;
      n += 1;
    }
  }
  return {
    totalMissedSavingsUsd: t,
    eventCount: n,
    averageMissedPerEventUsd: n ? t / n : 0,
  };
}

export function getWasteSummaryFromEvents(events: SpectyraMonitorEvent[]): {
  byType: Record<string, number>;
  estimatedImpactUsd: number;
} {
  const byType: Record<string, number> = {};
  let impact = 0;
  for (const e of events) {
    for (const w of e.wasteSignals ?? []) {
      byType[w.type] = (byType[w.type] ?? 0) + 1;
      impact += w.estimatedWasteUsd ?? 0;
    }
  }
  return { byType, estimatedImpactUsd: impact };
}

export function getEventsWithWasteType(events: SpectyraMonitorEvent[], type: SpectyraWasteSignal["type"]): SpectyraMonitorEvent[] {
  return events.filter((e) => (e.wasteSignals ?? []).some((w) => w.type === type));
}

export function getRepeatedCallsFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorEvent[] {
  return getEventsWithWasteType(events, "repeated_call");
}

export function getCacheOpportunitiesFromEvents(events: SpectyraMonitorEvent[]): SpectyraMonitorEvent[] {
  return getEventsWithWasteType(events, "cache_opportunity");
}

export function getOptimizerQuotaSummaryFromEvents(
  events: SpectyraMonitorEvent[],
  quota: { plan?: string; canRunOptimized?: boolean; percentUsed?: number | null } | null,
): {
  plan: string;
  canRunOptimized: boolean;
  freeOptimizerPercentUsed: number | null;
  monitorEventsWhileLimited: number;
} {
  return {
    plan: quota?.plan ?? "unknown",
    canRunOptimized: quota?.canRunOptimized !== false,
    freeOptimizerPercentUsed: quota?.percentUsed ?? null,
    monitorEventsWhileLimited: events.filter((e) => e.optimizerStatus && e.optimizerStatus !== "enabled").length,
  };
}

export function aggregateAllMonitorViews(events: SpectyraMonitorEvent[]): {
  summary: SpectyraMonitorSummary;
  provider: SpectyraMonitorBreakdownRow[];
  model: SpectyraMonitorBreakdownRow[];
  environment: SpectyraMonitorBreakdownRow[];
  endpoint: SpectyraMonitorBreakdownRow[];
  expensive: SpectyraMonitorEvent[];
  missed: ReturnType<typeof getMissedSavingsSummaryFromEvents>;
  waste: ReturnType<typeof getWasteSummaryFromEvents>;
  repeated: SpectyraMonitorEvent[];
  cache: SpectyraMonitorEvent[];
} {
  return {
    summary: buildMonitorSummaryFromEvents(events),
    provider: getProviderBreakdownFromEvents(events),
    model: getModelBreakdownFromEvents(events),
    environment: getEnvironmentBreakdownFromEvents(events),
    endpoint: getEndpointBreakdownFromEvents(events),
    expensive: getExpensiveCallsFromEvents(events),
    missed: getMissedSavingsSummaryFromEvents(events),
    waste: getWasteSummaryFromEvents(events),
    repeated: getRepeatedCallsFromEvents(events),
    cache: getCacheOpportunitiesFromEvents(events),
  };
}
