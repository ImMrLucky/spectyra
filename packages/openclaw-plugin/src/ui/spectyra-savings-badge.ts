import type { CompanionClient } from "../companion/companion-client.js";
import { openClawLatestOkToView, traceJsonToSavingsView } from "../companion/companion-client.js";
import type { OpenClawLatestOk, SpectyraTraceSavingsView } from "../companion/companion-types.js";
import { isFreshOpenClawTimestamp } from "../companion/seamless-helpers.js";

export interface SavingsBadgeDescriptor {
  kind: "spectyra.savings_badge";
  view: SpectyraTraceSavingsView;
}

export interface SeamlessSavingsOptions {
  /** Polled latest row (preferred over ad-hoc fetch to avoid spam). */
  getFreshLatest?: () => OpenClawLatestOk | null;
  alreadyShownInline?: (traceId: string) => boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function resolveTraceIdFromContext(ctx: Record<string, unknown> | undefined): string | undefined {
  if (!ctx) {
    return undefined;
  }
  const meta = ctx.metadata;
  if (isRecord(meta) && typeof meta.spectyraTraceId === "string") {
    return meta.spectyraTraceId;
  }
  if (typeof ctx.traceId === "string") {
    return ctx.traceId;
  }
  return undefined;
}

export function resolveFlowIdFromContext(ctx: Record<string, unknown> | undefined): string | undefined {
  if (!ctx) {
    return undefined;
  }
  if (typeof ctx.flowId === "string") {
    return ctx.flowId;
  }
  const meta = ctx.metadata;
  if (isRecord(meta) && typeof meta.flowId === "string") {
    return meta.flowId;
  }
  return undefined;
}

/**
 * Resolves savings only from companion payloads (trace, flow, latest, recent).
 * Lookup order: exact trace → exact flow → poller latest → GET latest → recent (fresh).
 * Never fabricates numbers.
 */
export async function resolveSavingsBadgeView(
  client: CompanionClient,
  ctx: Record<string, unknown> | undefined,
  seamless?: SeamlessSavingsOptions,
): Promise<SpectyraTraceSavingsView | null> {
  const traceId = resolveTraceIdFromContext(ctx);
  if (traceId) {
    const json = await client.getTrace(traceId);
    if (json) {
      const v = traceJsonToSavingsView(traceId, json);
      if (v) {
        return v;
      }
    }
  }

  const flowId = resolveFlowIdFromContext(ctx);
  if (flowId) {
    const flow = await client.getFlow(flowId);
    if (flow) {
      const nested =
        (typeof flow.traceId === "string" && flow.traceId) ||
        (typeof flow.trace_id === "string" && flow.trace_id) ||
        (typeof flow.latestTraceId === "string" && flow.latestTraceId) ||
        (typeof flow.latest_trace_id === "string" && flow.latest_trace_id);
      if (nested) {
        const json = await client.getTrace(nested);
        if (json) {
          const v = traceJsonToSavingsView(nested, json);
          if (v) {
            return v;
          }
        }
      }
      const fromFlow = traceJsonToSavingsView(flowId, flow);
      if (fromFlow) {
        return fromFlow;
      }
    }
  }

  const tryLatest = (row: OpenClawLatestOk | null | undefined): SpectyraTraceSavingsView | null => {
    if (!row?.traceId || !isFreshOpenClawTimestamp(row.timestamp)) {
      return null;
    }
    if (seamless?.alreadyShownInline?.(row.traceId)) {
      return null;
    }
    return openClawLatestOkToView(row);
  };

  const polled = seamless?.getFreshLatest?.() ?? null;
  const fromPoll = tryLatest(polled);
  if (fromPoll) {
    return fromPoll;
  }

  const direct = await client.getOpenClawLatest();
  if (direct && direct.ok === true) {
    const v = tryLatest(direct);
    if (v) {
      return v;
    }
  }

  const recent = await client.getOpenClawRecent(10);
  if (recent?.items?.length) {
    for (const item of recent.items) {
      const v = tryLatest(item);
      if (v) {
        return v;
      }
    }
  }

  return null;
}

export function buildSavingsBadgeDescriptor(view: SpectyraTraceSavingsView): SavingsBadgeDescriptor {
  return { kind: "spectyra.savings_badge", view };
}

export function formatSavingsBadgeLabel(view: SpectyraTraceSavingsView): string {
  const pct = view.percentSaved !== undefined ? `${view.percentSaved.toFixed(1)}%` : "";
  const cost =
    view.estimatedCostSaved !== undefined
      ? `${view.currency ? `${view.currency} ` : "$"}${view.estimatedCostSaved.toFixed(2)} estimated`
      : "";
  if (pct && cost) {
    return `⚡ Spectyra saved ${pct} · ${cost}`;
  }
  if (pct) {
    return `⚡ Spectyra saved ${pct}`;
  }
  if (cost) {
    return `⚡ Spectyra · ${cost}`;
  }
  return "";
}
